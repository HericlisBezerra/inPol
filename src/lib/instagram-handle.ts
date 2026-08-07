/** Normalização de handle do Instagram — módulo puro, sem dependência de servidor,
 *  para que o cadastro (instagram.functions) e a varredura (instagram.server) usem
 *  exatamente a mesma regra.
 *
 *  POR QUE EXISTE: em 07/08/2026 dois alvos foram cadastrados colando o link do perfil
 *  direto do app do Instagram — que vem com query string de rastreamento:
 *
 *      https://www.instagram.com/parimoschijundiai?utm_source=ig_web_button_share_sheet
 *
 *  O cadastro só removia o "@" inicial, então a URL inteira virou "handle". Na varredura,
 *  o Apify rejeitou o lote com HTTP 400 de validação — e como a chamada é UMA só para
 *  todos os perfis, os 13 alvos pararam juntos. A coleta ficou parada das 14:01 até ser
 *  descoberta, com o erro registrado apenas em `last_status`, onde ninguém olhava.
 */

/** Nome de usuário válido no Instagram: letras, números, ponto, underscore e hífen.
 *  Espelha o padrão que o actor `apify/instagram-scraper` valida do lado dele. */
const IG_USERNAME = /^[A-Za-z0-9._-]+$/;

/**
 * Reduz qualquer forma de referência a um perfil ao nome de usuário puro.
 * Aceita "@fulano", "fulano", "instagram.com/fulano", a URL completa, com ou sem
 * query string, fragmento, barra final ou caminho extra ("/reels", "/p/xyz").
 *
 * Devolve `""` quando não sobra um nome de usuário válido — o chamador decide se isso
 * é erro de cadastro (rejeitar) ou alvo a pular (ignorar). Nunca devolve algo que o
 * Apify vá recusar.
 */
export function normalizeInstagramHandle(raw: string): string {
  let s = (raw ?? "").trim();
  if (!s) return "";

  // Corta query string e fragmento antes de qualquer outra coisa: é o que o link
  // "compartilhar" do app cola junto, e é o que quebrou a coleta.
  s = s.split("?")[0].split("#")[0];

  s = s.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  s = s.replace(/^instagram\.com\//i, "");
  s = s.replace(/^@/, "");

  // Fica só o primeiro segmento: "fulano/reels" e "fulano/" viram "fulano".
  s = s.split("/")[0].trim().toLowerCase();

  return IG_USERNAME.test(s) ? s : "";
}

/** `true` quando o valor já é um nome de usuário utilizável na varredura. */
export function isValidInstagramHandle(value: string): boolean {
  return !!value && IG_USERNAME.test(value);
}
