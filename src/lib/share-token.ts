// Token de compartilhamento público de relatório (PURO, sem I/O — testável isolado).
// O token é o ÚNICO segredo que dá acesso ao link público, então precisa ser forte e não
// enumerável. A leitura pública (rota /r/$token) filtra por token + share_enabled via service
// role — nunca abre RLS anônima. Revogar = share_enabled=false (o token continua no banco mas
// para de abrir).

import { randomBytes } from "crypto";

/** ~32 chars base64url (24 bytes de entropia) — inadivinhável, URL-safe, sem padding. */
export function generateShareToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Aceita tokens reais (base64url, 20–64 chars) e o token especial "demo" (fixture, sem banco). */
export function isValidTokenFormat(token: string): boolean {
  if (token === "demo") return true;
  return /^[A-Za-z0-9_-]{20,64}$/.test(token);
}
