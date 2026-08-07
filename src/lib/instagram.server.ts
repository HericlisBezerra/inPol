// Instagram scraper via Apify actor `apify/instagram-scraper`.
// Alvos vêm de duas fontes (unidas por handle):
//   1. org_instagram_targets (cadastro explícito)
//   2. org_adversaries.handle (adversários com @handle preenchido)
// Noop se APIFY_API_TOKEN não estiver configurado.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchAllPages } from "@/lib/pg-paginate";
import { createHash } from "crypto";

import { normalizeInstagramHandle, isValidInstagramHandle } from "@/lib/instagram-handle";

const APIFY_BASE = "https://api.apify.com/v2";
const ACTOR_ID = "apify~instagram-scraper";
const DEFAULT_POSTS_PER_SCAN = 5;

interface IgPost {
  id?: string;
  shortCode?: string;
  url?: string;
  caption?: string;
  timestamp?: string;
  likesCount?: number;
  commentsCount?: number;
  ownerUsername?: string;
  displayUrl?: string;
  type?: string;
}

interface HandleAlvo {
  handle: string; // sem "@"
  posts_per_scan: number;
  target_id: string | null; // id em org_instagram_targets se existir
  /** Última varredura registrada no alvo — base da guarda de reentrância. */
  last_scanned_at: string | null;
  source: "target" | "adversary";
}

const normalizeHandle = normalizeInstagramHandle;

function extId(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 40);
}

async function ensureSource(orgId: string, handle: string): Promise<string> {
  const label = `Instagram · @${handle}`;
  const { data: existing } = await supabaseAdmin
    .from("sources")
    .select("id")
    .eq("org_id", orgId)
    .eq("kind", "instagram")
    .eq("label", label)
    .maybeSingle();
  if (existing) return existing.id;
  const { data: created, error } = await supabaseAdmin
    .from("sources")
    .insert({ org_id: orgId, kind: "instagram", label, is_active: true, config: { handle } })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id;
}

async function runApifyScraper(handles: string[], postsPerHandle: number): Promise<IgPost[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token || handles.length === 0) return [];
  // A chamada ao Apify é UMA para todos os perfis: um handle inválido faz o lote inteiro
  // voltar 400 e nenhum perfil é coletado. Já aconteceu (ver instagram-handle.ts). Então
  // o alvo problemático é descartado com aviso, e os demais seguem.
  const validos = handles.filter((h) => isValidInstagramHandle(h));
  const invalidos = handles.filter((h) => !isValidInstagramHandle(h));
  if (invalidos.length > 0) {
    console.error(
      `[scan-instagram] ${invalidos.length} alvo(s) com handle inválido, ignorados: ` +
        `${invalidos.map((h) => JSON.stringify(h)).join(", ")}. Corrija o cadastro em Configurações.`,
    );
  }
  if (validos.length === 0) return [];

  const url = `${APIFY_BASE}/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${token}&timeout=180`;
  const body = {
    directUrls: validos.map((h) => `https://www.instagram.com/${h}/`),
    resultsType: "posts",
    resultsLimit: postsPerHandle,
    searchType: "user",
    addParentData: false,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Apify ${res.status}: ${await res.text().catch(() => "")}`);
  return (await res.json()) as IgPost[];
}

async function collectHandlesForOrg(orgId: string): Promise<HandleAlvo[]> {
  const map = new Map<string, HandleAlvo>();

  const { data: targets } = await supabaseAdmin
    .from("org_instagram_targets")
    .select("id, handle, posts_per_scan, active, last_scanned_at")
    .eq("org_id", orgId)
    .eq("active", true);
  for (const t of targets ?? []) {
    const h = normalizeHandle(t.handle ?? "");
    if (!h) continue;
    map.set(h, {
      handle: h,
      posts_per_scan: t.posts_per_scan ?? DEFAULT_POSTS_PER_SCAN,
      target_id: t.id,
      last_scanned_at: t.last_scanned_at ?? null,
      source: "target",
    });
  }

  const { data: advs } = await supabaseAdmin
    .from("org_adversaries")
    .select("handle")
    .eq("org_id", orgId)
    .not("handle", "is", null);
  for (const a of advs ?? []) {
    const h = normalizeHandle(a.handle ?? "");
    if (!h) continue;
    if (map.has(h)) continue;
    map.set(h, {
      handle: h,
      posts_per_scan: DEFAULT_POSTS_PER_SCAN,
      target_id: null,
      // Handle vindo de adversário não tem registro de varredura próprio — a guarda de
      // reentrância se apoia nos alvos, que é onde `last_scanned_at` é gravado.
      last_scanned_at: null,
      source: "adversary",
    });
  }

  return Array.from(map.values());
}

async function ingestPostsForHandle(
  orgId: string,
  handle: string,
  posts: IgPost[],
): Promise<number> {
  if (posts.length === 0) return 0;
  const source_id = await ensureSource(orgId, handle);
  let inserted = 0;
  for (const p of posts) {
    const purl = p.url ?? (p.shortCode ? `https://www.instagram.com/p/${p.shortCode}/` : null);
    if (!purl) continue;
    const content = (p.caption ?? "").slice(0, 4000);
    if (!content) continue;
    const { error } = await supabaseAdmin.from("raw_messages").insert({
      org_id: orgId,
      source_id,
      external_id: extId(purl),
      content,
      posted_at: p.timestamp ?? new Date().toISOString(),
      media_kind: p.type === "Video" ? "video" : "text",
      raw_payload: {
        url: purl,
        author: p.ownerUsername ?? handle,
        likes: p.likesCount ?? 0,
        comments: p.commentsCount ?? 0,
        image: p.displayUrl,
      } as unknown as never,
    });
    if (!error) inserted++;
  }
  return inserted;
}

export async function scanInstagramForTarget(
  orgId: string,
  targetId: string,
): Promise<{ inserted: number; total: number }> {
  const { data: target } = await supabaseAdmin
    .from("org_instagram_targets")
    .select("id, handle, posts_per_scan, active")
    .eq("id", targetId)
    .maybeSingle();
  if (!target || !target.active) return { inserted: 0, total: 0 };
  const handle = normalizeHandle(target.handle ?? "");
  if (!handle) return { inserted: 0, total: 0 };

  let inserted = 0;
  let total = 0;
  let status = "ok";
  try {
    const posts = await runApifyScraper([handle], target.posts_per_scan ?? DEFAULT_POSTS_PER_SCAN);
    total = posts.length;
    inserted = await ingestPostsForHandle(orgId, handle, posts);
  } catch (e) {
    status = e instanceof Error ? e.message : String(e);
  }

  await supabaseAdmin
    .from("org_instagram_targets")
    .update({ last_scanned_at: new Date().toISOString(), last_status: status })
    .eq("id", targetId);

  return { inserted, total };
}

/** Silêncio mínimo entre varreduras de uma mesma org.
 *
 *  POR QUE EXISTE: em 06/08 o Apify registrou DUAS execuções por horário de cron, com 1
 *  segundo de diferença e `origin=API` — dobrando a conta. O banco tem um único cron, uma
 *  única org, e este arquivo chama o scraper uma vez só; a origem da segunda chamada não
 *  foi identificada (o app da Lovable já estava despublicado). Como a causa é desconhecida,
 *  a defesa fica aqui: uma segunda invocação dentro da janela não gasta crédito.
 *
 *  Valor bem abaixo da cadência do cron (24h) para nunca bloquear um scan legítimo, e
 *  muito acima do 1s que separa as duplicatas. */
const MIN_HORAS_ENTRE_SCANS = 4;

export async function scanInstagramForOrg(
  orgId: string,
  opts: { force?: boolean } = {},
): Promise<{ inserted: number; handles: number; skipped?: string }> {
  if (!process.env.APIFY_API_TOKEN) return { inserted: 0, handles: 0 };
  const alvos = await collectHandlesForOrg(orgId);
  if (alvos.length === 0) return { inserted: 0, handles: 0 };

  // Perfil de Instagram publica 1 a 2 vezes por dia; varrer de novo minutos depois não
  // descobre nada e custa o mesmo. `force` existe para o botão "varrer agora" da tela,
  // onde a pessoa está pedindo explicitamente.
  if (!opts.force) {
    const ultimo = alvos
      .map((a) => a.last_scanned_at)
      .filter((d): d is string => !!d)
      .sort()
      .at(-1);
    if (ultimo) {
      const horas = (Date.now() - Date.parse(ultimo)) / 3600_000;
      if (horas < MIN_HORAS_ENTRE_SCANS) {
        console.warn(
          `[scan-instagram] org ${orgId}: pulando — última varredura há ${horas.toFixed(1)}h ` +
            `(mínimo ${MIN_HORAS_ENTRE_SCANS}h). Invocação duplicada não gasta crédito do Apify.`,
        );
        return {
          inserted: 0,
          handles: alvos.length,
          skipped: `última varredura há ${horas.toFixed(1)}h`,
        };
      }
    }
  }

  // Um único run cobre todos os handles do org; usamos o maior posts_per_scan
  // como limite comum (Apify aplica por handle na actor `instagram-scraper`).
  const maxPosts = alvos.reduce((m, a) => Math.max(m, a.posts_per_scan), DEFAULT_POSTS_PER_SCAN);
  let inserted = 0;
  const nowIso = new Date().toISOString();

  try {
    const posts = await runApifyScraper(
      alvos.map((a) => a.handle),
      maxPosts,
    );
    // Agrupa posts por owner (fallback: distribui igualmente se ownerUsername vier vazio)
    const byOwner = new Map<string, IgPost[]>();
    for (const p of posts) {
      const owner = normalizeHandle(p.ownerUsername ?? "");
      const key = owner || alvos[0].handle;
      const arr = byOwner.get(key) ?? [];
      arr.push(p);
      byOwner.set(key, arr);
    }
    for (const a of alvos) {
      const owned = byOwner.get(a.handle) ?? [];
      const ins = await ingestPostsForHandle(orgId, a.handle, owned);
      inserted += ins;
      if (a.target_id) {
        await supabaseAdmin
          .from("org_instagram_targets")
          .update({ last_scanned_at: nowIso, last_status: `ok · ${ins} novos` })
          .eq("id", a.target_id);
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    for (const a of alvos) {
      if (a.target_id) {
        await supabaseAdmin
          .from("org_instagram_targets")
          .update({ last_scanned_at: nowIso, last_status: msg })
          .eq("id", a.target_id);
      }
    }
    throw e;
  }

  return { inserted, handles: alvos.length };
}

export async function scanInstagramForOrgLegacy(
  orgId: string,
): Promise<{ inserted: number; targets: number }> {
  const r = await scanInstagramForOrg(orgId);
  return { inserted: r.inserted, targets: r.handles };
}

export async function scanInstagramAllOrgs(): Promise<
  Array<{ org_id: string; inserted?: number; handles?: number; error?: string }>
> {
  const orgs = await fetchAllPages<{ id: string }>((from, to) =>
    supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("is_demo", false)
      .order("id", { ascending: true })
      .range(from, to),
  );
  const out: Array<{ org_id: string; inserted?: number; handles?: number; error?: string }> = [];
  for (const o of orgs) {
    try {
      const r = await scanInstagramForOrg(o.id);
      out.push({ org_id: o.id, ...r });
    } catch (e) {
      out.push({ org_id: o.id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}
