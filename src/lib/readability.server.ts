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

/** Extrai o IPv4 embutido de um endereço IPv4-mapeado (::ffff:1.2.3.4 ou ::ffff:0102:0304). */
function mappedV4(ip6: string): string | null {
  const lower = ip6.toLowerCase();
  const dotted = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (dotted) return dotted[1];
  const hex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
  }
  return null;
}

function isPrivateV6(ip: string): boolean {
  const lower = ip.toLowerCase();
  return (
    lower === "::1" || // loopback
    lower === "::" ||
    lower.startsWith("fe80:") || // link-local
    lower.startsWith("fc") || // unique local fc00::/7
    lower.startsWith("fd")
  );
}

function isPrivateIp(ip: string): boolean {
  const clean = ip.replace(/^\[|\]$/g, ""); // remove colchetes de literais IPv6
  if (isIP(clean) === 6) {
    const v4 = mappedV4(clean); // IPv4-mapeado (::ffff:192.168.x.x) roteia p/ IPv4 → checar como v4
    return v4 ? isPrivateV4(v4) : isPrivateV6(clean);
  }
  return isPrivateV4(clean);
}

function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, ""); // URL hostname vem com [] em IPv6
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
  const cleanHost = parsed.hostname.replace(/^\[|\]$/g, "");
  if (!isIP(cleanHost)) {
    // Valida TODOS os endereços resolvidos (um host pode ter A público + AAAA privado). Nota:
    // o fetch re-resolve o DNS por conta própria — resta um resíduo teórico de DNS-rebinding
    // (TTL baixo). Aceitável aqui: as URLs vêm de provedores de busca (Firecrawl/Google),
    // não de entrada arbitrária do usuário. Pinar o IP exigiria um agente HTTP customizado.
    let addrs: Array<{ address: string }>;
    try {
      addrs = await dnsLookup(cleanHost, { all: true });
    } catch {
      throw new Error(`Falha ao resolver DNS de ${cleanHost}`);
    }
    for (const { address } of addrs) {
      if (isPrivateIp(address)) {
        throw new Error(`Host resolve para IP privado: ${cleanHost} -> ${address}`);
      }
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
      // Lê em stream com teto de bytes — uma página maliciosa gigante não estoura a memória.
      const reader = res.body?.getReader();
      if (!reader) {
        const buf = await res.arrayBuffer();
        html = new TextDecoder().decode(buf.slice(0, MAX_BYTES));
      } else {
        const chunks: Uint8Array[] = [];
        let total = 0;
        while (total < MAX_BYTES) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          total += value.byteLength;
        }
        await reader.cancel().catch(() => {});
        const out = new Uint8Array(total);
        let off = 0;
        for (const c of chunks) {
          out.set(c, off);
          off += c.byteLength;
        }
        html = new TextDecoder().decode(out.slice(0, MAX_BYTES));
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
