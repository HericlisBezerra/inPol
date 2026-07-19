// Extração de conteúdo legível de uma URL arbitrária (fallback do firecrawlScrape).
// Sem dependência externa: fetch + strip de HTML. Hardened contra SSRF — nunca deixar o
// servidor requisitar host privado/loopback/link-local a partir de uma URL vinda de busca.

import { lookup as dnsLookup } from "dns/promises";
import { isIP } from "net";

export interface ReadableContent {
  title?: string;
  markdown?: string;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;
const MAX_BYTES = 2_000_000; // 2MB de HTML é mais que suficiente
const USER_AGENT = "Mozilla/5.0 (compatible; InPolBot/1.0; +https://inpolapp.com)";

/** IPv4 CIDR ranges privadas/loopback/link-local/reservadas. */
const PRIVATE_V4_RANGES: Array<[string, number]> = [
  ["10.0.0.0", 8],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // inclui 169.254.169.254 (metadata cloud)
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["0.0.0.0", 8],
  ["100.64.0.0", 10], // CGNAT
  ["192.0.0.0", 24],
  ["198.18.0.0", 15],
];

function ipToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function isPrivateV4(ip: string): boolean {
  const target = ipToInt(ip);
  return PRIVATE_V4_RANGES.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (target & mask) === (ipToInt(base) & mask);
  });
}

function isPrivateV6(ip: string): boolean {
  const lower = ip.toLowerCase();
  return (
    lower === "::1" || // loopback
    lower === "::" ||
    lower.startsWith("fe80:") || // link-local
    lower.startsWith("fc") || // unique local fc00::/7
    lower.startsWith("fd") ||
    lower.startsWith("::ffff:127.") ||
    lower.startsWith("::ffff:10.") ||
    lower.startsWith("::ffff:169.254.")
  );
}

function isPrivateIp(ip: string): boolean {
  return isIP(ip) === 6 ? isPrivateV6(ip) : isPrivateV4(ip);
}

function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h.endsWith(".local")) return true;
  if (h === "metadata.google.internal") return true;
  if (isIP(h)) return isPrivateIp(h);
  return false;
}

/** Valida protocolo + hostname (literal ou resolvido via DNS) antes de permitir a requisição. */
async function assertSafeUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("URL inválida");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Protocolo não permitido: ${parsed.protocol}`);
  }
  if (isBlockedHostname(parsed.hostname)) {
    throw new Error(`Host bloqueado (privado/local): ${parsed.hostname}`);
  }
  if (!isIP(parsed.hostname)) {
    try {
      const { address } = await dnsLookup(parsed.hostname);
      if (isPrivateIp(address)) {
        throw new Error(`Host resolve para IP privado: ${parsed.hostname} -> ${address}`);
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("IP privado")) throw e;
      throw new Error(`Falha ao resolver DNS de ${parsed.hostname}`);
    }
  }
  return parsed;
}

function stripHtml(html: string): { title?: string; markdown?: string } {
  const titleMatch =
    html.match(/<title[^>]*>([^<]*)<\/title>/i) ??
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i);
  const title = titleMatch?.[1]?.trim();

  let body = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "");

  // Preserva quebras de parágrafo/heading antes de tirar as tags (markdown simples).
  body = body
    .replace(/<(h[1-6])[^>]*>/gi, "\n\n## ")
    .replace(/<\/(h[1-6])>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<[^>]+>/g, " ");

  const markdown = body
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { title, markdown: markdown || undefined };
}

/**
 * Faz fetch de uma URL pública e extrai texto legível, com salvaguardas SSRF (protocolo,
 * hostname bloqueado, resolução DNS, e revalidação a cada redirect manual). Retorna null em
 * qualquer falha — é um fallback best-effort, nunca deve derrubar o caller.
 */
export async function extractReadable(url: string): Promise<ReadableContent | null> {
  try {
    let current = await assertSafeUrl(url);
    let html: string | null = null;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(current.toString(), {
          redirect: "manual",
          signal: controller.signal,
          headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
        });
      } finally {
        clearTimeout(timeout);
      }

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) return null;
        const next = new URL(location, current);
        current = await assertSafeUrl(next.toString());
        continue;
      }

      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      if (buf.byteLength > MAX_BYTES) {
        html = new TextDecoder().decode(buf.slice(0, MAX_BYTES));
      } else {
        html = new TextDecoder().decode(buf);
      }
      break;
    }

    if (!html) return null;
    const { title, markdown } = stripHtml(html);
    if (!markdown) return null;
    return { title, markdown };
  } catch (e) {
    console.warn(`extractReadable: falha para ${url}:`, e instanceof Error ? e.message : e);
    return null;
  }
}
