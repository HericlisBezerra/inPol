import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const TSE_BASE = "https://divulgacandcontas.tse.jus.br/divulga/rest/v1";

// IDs internos das eleições municipais (DivulgaCandContas)
const MUNICIPAL_ELECTION_IDS: Record<number, string> = {
  2024: "2045202024",
  2020: "2030402020", // 2032002020 = suplementar AP (postergada)
  2016: "2",
  2012: "1699",
};

// Cargos municipais (TSE)
const MUNI_CARGOS = [11, 13]; // 11 prefeito, 13 vereador

function electionIdFor(ano: number, uf: string): string {
  if (ano === 2020 && uf.toUpperCase() === "AP") return "2032002020";
  const id = MUNICIPAL_ELECTION_IDS[ano];
  if (!id) throw new Error(`Ano ${ano} não suportado`);
  return id;
}

async function tseFetch<T>(path: string): Promise<T> {
  const r = await fetch(`${TSE_BASE}${path}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; Inpol/1.0)",
      Referer: "https://divulgacandcontas.tse.jus.br/divulga/",
    },
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`TSE ${r.status} em ${path}: ${body.slice(0, 200)}`);
  }
  return (await r.json()) as T;
}

type TseMunicipio = { codigo: string; nome: string };
type TseListResp = { municipios?: TseMunicipio[] };

export const tseListMunicipios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ uf: z.string().length(2), ano: z.number().int().min(2012).max(2030) }).parse(d),
  )
  .handler(async ({ data }) => {
    const eleicaoId = electionIdFor(data.ano, data.uf);
    const j = await tseFetch<TseListResp>(
      `/eleicao/buscar/${data.uf.toUpperCase()}/${eleicaoId}/municipios`,
    );
    return (j.municipios ?? []).map((m) => ({ codigo: String(m.codigo), nome: m.nome }));
  });

type TseCandidato = {
  id?: number | string;
  nomeCompleto?: string;
  nomeUrna?: string;
  numero?: string | number;
  cargo?: { codigo?: number | string; nome?: string };
  partido?: { sigla?: string; nome?: string };
  descricaoSituacao?: string;
  descricaoTotalizacao?: string;
  fotoUrl?: string;
};

type TseCandResp = { candidatos?: TseCandidato[] };

export const importElected = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        uf: z.string().length(2),
        codMunicipioTse: z.string().min(2),
        ano: z.number().int().min(2012).max(2030),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const eleicaoId = electionIdFor(data.ano, data.uf);
    const all: TseCandidato[] = [];
    for (const cargo of MUNI_CARGOS) {
      try {
        const j = await tseFetch<TseCandResp>(
          `/candidatura/listar/${data.ano}/${data.codMunicipioTse}/${eleicaoId}/${cargo}/candidatos`,
        );
        all.push(...(j.candidatos ?? []));
      } catch (e) {
        console.warn(`TSE cargo ${cargo}:`, e instanceof Error ? e.message : e);
      }
    }
    if (all.length === 0) throw new Error("Nenhum candidato retornado pelo TSE");

    const rows = all.map((c) => {
      const tot = (c.descricaoTotalizacao ?? "").toString();
      const isElected = /eleit/i.test(tot) && !/n[aã]o eleito/i.test(tot);
      return {
        org_id: data.orgId,
        ano_eleicao: data.ano,
        cod_municipio_tse: data.codMunicipioTse,
        uf: data.uf.toUpperCase(),
        cargo_codigo: c.cargo?.codigo != null ? String(c.cargo.codigo) : null,
        cargo_nome: c.cargo?.nome ?? "—",
        numero: String(c.numero ?? ""),
        nome: c.nomeCompleto ?? c.nomeUrna ?? "—",
        nome_urna: c.nomeUrna ?? null,
        partido_sigla: c.partido?.sigla ?? null,
        partido_nome: c.partido?.nome ?? null,
        situacao_turno: tot || c.descricaoSituacao || null,
        is_elected: isElected,
        foto_url: c.fotoUrl ?? null,
        tse_candidate_id: c.id != null ? String(c.id) : null,
      };
    });

    const dedup = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      const key = `${r.ano_eleicao}|${r.cod_municipio_tse}|${r.cargo_codigo ?? ""}|${r.numero}`;
      const prev = dedup.get(key);
      // prefer the elected row when duplicates collide (1º vs 2º turno)
      if (!prev || (r.is_elected && !prev.is_elected)) dedup.set(key, r);
    }
    const unique = [...dedup.values()];

    const { error } = await context.supabase.from("elected_officials").upsert(unique, {
      onConflict: "org_id,ano_eleicao,cod_municipio_tse,cargo_codigo,numero",
      ignoreDuplicates: false,
    });
    if (error) throw new Error(error.message);

    return { imported: unique.length, elected: unique.filter((r) => r.is_elected).length };
  });

export const listElected = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        onlyElected: z.boolean().optional(),
        alignment: z.enum(["ally", "opponent", "neutral", "management", "all"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("elected_officials")
      .select("*")
      .eq("org_id", data.orgId)
      .order("is_elected", { ascending: false })
      .order("cargo_nome")
      .order("nome");
    if (data.onlyElected) q = q.eq("is_elected", true);
    if (data.alignment && data.alignment !== "all") q = q.eq("alignment", data.alignment);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const ALIGNMENT_TO_VOCAB: Record<string, "opponent" | "ally" | "focus_term" | null> = {
  opponent: "opponent",
  ally: "ally",
  management: "focus_term",
  neutral: null,
};

async function syncElectedToVocabulary(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  orgId: string,
  electedId: string,
  alignment: "ally" | "opponent" | "neutral" | "management",
) {
  // Remove qualquer entrada anterior deste eleito no vocabulário
  await supabase
    .from("org_vocabulary")
    .delete()
    .eq("org_id", orgId)
    .contains("metadata", { elected_id: electedId });

  const kind = ALIGNMENT_TO_VOCAB[alignment];
  if (!kind) return;

  const { data: person } = await supabase
    .from("elected_officials")
    .select("nome, nome_urna, partido_sigla, cargo_nome")
    .eq("id", electedId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!person) return;

  const value = (person.nome_urna ?? person.nome ?? "").trim();
  if (!value) return;
  const aliases = Array.from(
    new Set(
      [person.nome, person.nome_urna]
        .filter((v): v is string => !!v)
        .map((v) => v.trim())
        .filter((v) => v && v.toLowerCase() !== value.toLowerCase()),
    ),
  );

  await supabase.from("org_vocabulary").upsert(
    {
      org_id: orgId,
      kind,
      value,
      aliases,
      metadata: {
        elected_id: electedId,
        source: "elected",
        cargo: person.cargo_nome ?? null,
        partido: person.partido_sigla ?? null,
      },
    },
    { onConflict: "org_id,kind,value" },
  );
}

export const setElectedAlignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        id: z.string().uuid(),
        alignment: z.enum(["ally", "opponent", "neutral", "management"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("elected_officials")
      .update({ alignment: data.alignment })
      .eq("id", data.id)
      .eq("org_id", data.orgId);
    if (error) throw new Error(error.message);
    await syncElectedToVocabulary(context.supabase, data.orgId, data.id, data.alignment);
    return { ok: true };
  });

export const deleteElected = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orgId: z.string().uuid(), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("org_vocabulary")
      .delete()
      .eq("org_id", data.orgId)
      .contains("metadata", { elected_id: data.id });
    const { error } = await context.supabase
      .from("elected_officials")
      .delete()
      .eq("id", data.id)
      .eq("org_id", data.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const syncAllElectedToVocabulary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("elected_officials")
      .select("id, alignment")
      .eq("org_id", data.orgId)
      .in("alignment", ["ally", "opponent", "management"]);
    if (error) throw new Error(error.message);
    let synced = 0;
    for (const r of rows ?? []) {
      await syncElectedToVocabulary(
        context.supabase,
        data.orgId,
        r.id,
        r.alignment as "ally" | "opponent" | "management",
      );
      synced++;
    }
    return { synced };
  });
