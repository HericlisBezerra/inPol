/**
 * Paginação para PostgREST/Supabase.
 *
 * ⚠️ POR QUE ISSO EXISTE: o PostgREST corta TODA resposta em `db-max-rows`
 * (1.000 no Supabase) e **ignora silenciosamente** um `.limit()` maior — pedir
 * `.limit(20000)` devolve 1.000 sem erro, sem aviso, sem nada. Toda query que
 * precisa do conjunto INTEIRO (para contar, somar, agregar ou processar em lote)
 * tem que paginar com `.range()`.
 *
 * Módulo puro de propósito (não importa o cliente Supabase): serve tanto para
 * `supabaseAdmin` quanto para o cliente do usuário (`context.supabase`), e pode
 * ser importado de `*.functions.ts` sem arrastar código server-only pro bundle.
 */

/** Tamanho da página — igual ao teto do servidor; pedir mais não adianta. */
export const PG_PAGE = 1000;

/** Trava de segurança: acima disso, algo está errado no filtro (ou o dado
 *  cresceu além do que a agregação em memória aguenta). */
export const PG_MAX_ROWS = 60_000;

export type PageFetcher<T> = (
  from: number,
  to: number,
) => PromiseLike<{ data: T[] | null; error: unknown }>;

/**
 * Busca todas as páginas até esgotar.
 *
 * IMPORTANTE: a query passada **precisa ter ordem estável** (`.order(...)` por
 * uma coluna única, ex.: `id`). Sem ordem determinística o Postgres pode
 * devolver a mesma linha em duas páginas — ou pular linhas — e a contagem sai
 * errada de um jeito difícil de perceber.
 *
 * @param page  recebe o intervalo inclusivo `[from, to]` e devolve a resposta do PostgREST
 * @param maxRows  trava opcional (default `PG_MAX_ROWS`)
 */
export async function fetchAllPages<T>(
  page: PageFetcher<T>,
  maxRows: number = PG_MAX_ROWS,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < maxRows; from += PG_PAGE) {
    const { data, error } = await page(from, from + PG_PAGE - 1);
    if (error) {
      const msg = (error as { message?: string })?.message ?? String(error);
      throw new Error(msg);
    }
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PG_PAGE) return out; // última página
  }
  console.warn(
    `[pg-paginate] trava de ${maxRows} linhas atingida — resultado pode estar truncado.`,
  );
  return out;
}

/**
 * Contagem exata sem trazer as linhas (`count: "exact", head: true`).
 * Use quando só o número importa — é muito mais barato que paginar.
 */
export async function countExact(
  query: PromiseLike<{ count: number | null; error: unknown }>,
): Promise<number> {
  const { count, error } = await query;
  if (error) {
    const msg = (error as { message?: string })?.message ?? String(error);
    throw new Error(msg);
  }
  return count ?? 0;
}
