// Firecrawl-based scanners for news portals and public social pages.
// Falls back to noop if FIRECRAWL_API_KEY isn't linked (connector not configured).

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createHash } from "crypto";

const FIRECRAWL = "https://api.firecrawl.dev/v2";

interface FirecrawlSearchResult {
  url: string;
  title?: string;
  description?: string;
  markdown?: string;
}

async function firecrawlSearch(query: string, limit = 8): Promise<FirecrawlSearchResult[]> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return [];
  // NOTE: no `scrapeOptions` — search alone is 1 credit/query. Scrape só das URLs novas.
  const res = await fetch(`${FIRECRAWL}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query, limit, tbs: "qdr:d" }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Firecrawl search failed [${res.status}]: ${body || res.statusText}`);
  }
  const j = (await res.json()) as { data?: { web?: FirecrawlSearchResult[] } | FirecrawlSearchResult[] };
  const items = Array.isArray(j.data) ? j.data : (j.data?.web ?? []);
  return items;
}

async function firecrawlScrape(url: string): Promise<{ markdown?: string; title?: string } | null> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return null;
  const res = await fetch(`${FIRECRAWL}/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Firecrawl scrape failed [${res.status}]: ${body || res.statusText}`);
  }
  const j = (await res.json()) as { data?: { markdown?: string; metadata?: { title?: string } } };
  return { markdown: j.data?.markdown, title: j.data?.metadata?.title };
}


type NewsKind = "news" | "instagram" | "facebook" | "x" | "web_search";

async function ensureExternalSource(orgId: string, kind: NewsKind, label: string): Promise<string> {
  const { data: existing } = await supabaseAdmin
    .from("sources")
    .select("id")
    .eq("org_id", orgId)
    .eq("kind", kind)
    .eq("label", label)
    .maybeSingle();
  if (existing) return existing.id;
  const { data: created, error } = await supabaseAdmin
    .from("sources")
    .insert({ org_id: orgId, kind, label, is_active: true, config: {} })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id;
}

function externalId(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 40);
}

export async function scanNewsForOrg(orgId: string): Promise<{ inserted: number; queries: number }> {
  if (!process.env.FIRECRAWL_API_KEY) return { inserted: 0, queries: 0 };
  // Build queries from org_vocabulary: city/facility/opponent terms + neighborhood
  const { data: vocab } = await supabaseAdmin
    .from("org_vocabulary")
    .select("kind, value, aliases")
    .eq("org_id", orgId);
  const terms = new Set<string>();
  const focus: string[] = [];
  const domains: string[] = [];
  for (const v of vocab ?? []) {
    if (v.kind === "focus_term") focus.push(v.value);
    if (
      v.kind === "neighborhood" ||
      v.kind === "facility" ||
      v.kind === "opponent" ||
      v.kind === "sensitive_term"
    ) {
      terms.add(v.value);
      for (const alias of (v.aliases ?? []) as string[]) terms.add(alias);
    }
    if (v.kind === "news_domain") domains.push(v.value);
  }
  // Caps globais para conter consumo do Firecrawl.
  const MAX_FOCUS = 12;
  const MAX_GENERIC = 3;
  const MAX_DOMAIN = 3;
  const SEARCH_LIMIT = 6;

  const priorityQueries = focus.slice(0, MAX_FOCUS).map((f) => `"${f}"`);
  const generic = Array.from(terms).slice(0, MAX_GENERIC);

  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("city")
    .eq("id", orgId)
    .maybeSingle();
  const city = org?.city ?? "";

  const allTerms = [...priorityQueries, ...generic];
  const queriesToRun = new Set<string>();
  for (const term of allTerms) {
    queriesToRun.add(
      domains.length > 0
        ? `${term} ${city} (${domains.map((d) => `site:${d}`).join(" OR ")})`
        : `${term} ${city}`,
    );
  }
  for (const domain of domains.slice(0, MAX_DOMAIN)) queriesToRun.add(`${city} site:${domain}`);
  if (queriesToRun.size === 0) return { inserted: 0, queries: 0 };

  const source_id = await ensureExternalSource(orgId, "news", "Imprensa · Firecrawl");

  // Coleta URLs candidatas de todas as buscas primeiro, dedup e filtra as já vistas
  // antes de gastar créditos com scrape.
  const candidates = new Map<string, FirecrawlSearchResult>();
  let queries = 0;
  for (const q of queriesToRun) {
    queries++;
    const results = await firecrawlSearch(q, SEARCH_LIMIT);
    for (const r of results) {
      if (!r.url) continue;
      if (!candidates.has(r.url)) candidates.set(r.url, r);
    }
  }

  const urls = Array.from(candidates.keys());
  const knownIds = new Set(urls.map(externalId));
  const seen = new Set<string>();
  if (knownIds.size > 0) {
    const { data: existing } = await supabaseAdmin
      .from("raw_messages")
      .select("external_id")
      .eq("org_id", orgId)
      .in("external_id", Array.from(knownIds));
    for (const e of existing ?? []) if (e.external_id) seen.add(e.external_id);
  }

  // Teto de scrapes por execução — mais um freio de créditos.
  const MAX_SCRAPES = 20;
  let scraped = 0;
  let inserted = 0;
  for (const url of urls) {
    const ext = externalId(url);
    if (seen.has(ext)) continue;
    const r = candidates.get(url)!;
    let content = [r.title, r.description].filter(Boolean).join("\n\n");
    if (scraped < MAX_SCRAPES) {
      const s = await firecrawlScrape(url);
      scraped++;
      if (s?.markdown) content = [r.title ?? s.title, r.description, s.markdown].filter(Boolean).join("\n\n");
    }
    content = content.slice(0, 4000);
    if (!content) continue;
    const { error } = await supabaseAdmin.from("raw_messages").insert({
      org_id: orgId,
      source_id,
      external_id: ext,
      content,
      posted_at: new Date().toISOString(),
      media_kind: "text",
      raw_payload: { url, title: r.title } as unknown as never,
    });
    if (!error) inserted++;
  }
  return { inserted, queries };
}


export async function scanNewsAllOrgs(): Promise<
  Array<{ org_id: string; inserted?: number; queries?: number; error?: string }>
> {
  const { data: orgs } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("is_demo", false);
  const out: Array<{ org_id: string; inserted?: number; queries?: number; error?: string }> = [];
  for (const o of orgs ?? []) {
    try {
      const r = await scanNewsForOrg(o.id);
      out.push({ org_id: o.id, ...r });
    } catch (e) {
      out.push({ org_id: o.id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}
