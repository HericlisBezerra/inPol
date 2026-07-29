import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- SupabaseClient<Database> tem tipo genérico complexo; o helper só usa .rpc
async function assertOrgAdmin(supabase: any, userId: string, orgId: string) {
  const { data: ok } = await supabase.rpc("is_org_admin", { _user_id: userId, _org_id: orgId });
  const { data: platAdmin } = await supabase.rpc("is_platform_admin", { _user_id: userId });
  if (!ok && !platAdmin) throw new Error("Somente owner/analyst pode editar.");
}

/* --------- tracked_members --------- */

export const upsertMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        orgId: z.string().uuid(),
        displayName: z.string().min(1).max(120),
        role: z.string().min(1).max(40),
        neighborhood: z.string().max(80).nullable().optional(),
        tags: z.array(z.string()).max(20).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOrgAdmin(context.supabase, context.userId, data.orgId);
    const payload = {
      org_id: data.orgId,
      display_name: data.displayName,
      role: data.role,
      neighborhood: data.neighborhood ?? null,
      tags: data.tags ?? [],
    };
    const q = data.id
      ? context.supabase.from("tracked_members").update(payload).eq("id", data.id)
      : context.supabase.from("tracked_members").insert(payload);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orgId: z.string().uuid(), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOrgAdmin(context.supabase, context.userId, data.orgId);
    const { error } = await context.supabase.from("tracked_members").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* --------- org_adversaries --------- */

export const upsertAdversary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        orgId: z.string().uuid(),
        displayName: z.string().min(1).max(120),
        handle: z.string().max(60).nullable().optional(),
        role: z.string().max(40).nullable().optional(),
        party: z.string().max(40).nullable().optional(),
        topTopics: z.array(z.string()).max(20).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOrgAdmin(context.supabase, context.userId, data.orgId);
    const payload = {
      org_id: data.orgId,
      display_name: data.displayName,
      handle: data.handle ?? null,
      role: data.role ?? null,
      party: data.party ?? null,
      top_topics: data.topTopics ?? [],
    };
    const q = data.id
      ? context.supabase.from("org_adversaries").update(payload).eq("id", data.id)
      : context.supabase.from("org_adversaries").insert(payload);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAdversary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orgId: z.string().uuid(), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOrgAdmin(context.supabase, context.userId, data.orgId);
    const { error } = await context.supabase.from("org_adversaries").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* --------- author_hash link (para stats) --------- */

/** @deprecated Use `linkPersonAuthorHash` — vincula à ficha única em vez de ao membro do WhatsApp. */
export const linkAuthorHash = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        memberId: z.string().uuid(),
        authorHash: z.string().min(4).max(64),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOrgAdmin(context.supabase, context.userId, data.orgId);
    const { error } = await context.supabase.from("member_author_links").upsert(
      {
        org_id: data.orgId,
        member_id: data.memberId,
        author_hash: data.authorHash,
        confirmed_by: context.userId,
      },
      { onConflict: "org_id,author_hash" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ==========================================================================
 * org_people — ficha ÚNICA da pessoa
 *
 * O ganho não está na tabela: está nos EFEITOS COLATERAIS de `upsertPerson`.
 * Antes, a mesma pessoa vivia em quatro cadastros mudos entre si — preencher o
 * handle do adversário não fazia o sistema varrer o Instagram dele, e cadastrar
 * adversário não o tornava reconhecível pela IA (isso dependia de editar
 * `org_vocabulary` em OUTRA tela). Salvar uma pessoa aqui propaga para os canais.
 * ========================================================================== */

// `types.ts` é auto-gerado e ainda não conhece `org_people` nem as colunas `person_id`
// (e não pode ser editado). O typegen recusa `.from("org_people")` e `.eq("person_id", …)`,
// então este cast é o ÚNICO ponto de escape do arquivo — a tipagem volta na saída, via
// anotação explícita das linhas lidas.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ver comentário acima
type ClienteBruto = any;
/** Cliente tipado (o que o middleware entrega) — usado nas tabelas que o typegen JÁ conhece. */
type ClienteTipado = SupabaseClient<Database>;
const bruto = (supabase: ClienteTipado): ClienteBruto => supabase as ClienteBruto;

export type PersonStance = "adversario" | "aliado" | "neutro" | "interno";

export type PersonRow = {
  id: string;
  display_name: string;
  stance: PersonStance;
  party: string | null;
  role: string | null;
  department_id: string | null;
  department_name: string | null;
  vocabulary_id: string | null;
  elected_official_id: string | null;
  elected_name: string | null;
  avatar_url: string | null;
  neighborhood: string | null;
  tags: string[];
  notes: string | null;
  instagram_handle: string | null;
  instagram_active: boolean | null;
  whatsapp_count: number;
  created_at: string;
  updated_at: string;
};

type PessoaBase = {
  id: string;
  org_id: string;
  display_name: string;
  stance: PersonStance;
  party: string | null;
  role: string | null;
  department_id: string | null;
  vocabulary_id: string | null;
  elected_official_id: string | null;
  avatar_url: string | null;
  neighborhood: string | null;
  tags: string[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** Campo de formulário vazio é ausência, não string vazia — senão gravamos "" no banco e
 *  a herança do TSE (que testa "está vazio?") nunca dispara. */
const nuloSeVazio = (v: string | null | undefined): string | null => {
  const t = (v ?? "").trim();
  return t.length > 0 ? t : null;
};

/** Handle de Instagram só é comparável normalizado: o UNIQUE de `org_instagram_targets`
 *  é (org_id, handle) cru, então "@Fulano" e "fulano" criariam DOIS alvos para a mesma conta. */
const normalizarHandle = (v: string | null | undefined): string | null => {
  const t = (v ?? "").trim().replace(/^@+/, "").toLowerCase();
  return t.length > 0 ? t : null;
};

/** stance da pessoa → `kind` do vocabulário. `null` = essa pessoa não deve ser um termo
 *  que a IA classifica como lado político. */
const kindVocabDoStance = (stance: PersonStance): "opponent" | "ally" | null =>
  stance === "adversario" ? "opponent" : stance === "aliado" ? "ally" : null;

/** stance → `kind` do alvo de Instagram (o CHECK da tabela só aceita estes quatro). */
const kindAlvoDoStance = (stance: PersonStance): "opponent" | "ally" | "other" =>
  stance === "adversario" ? "opponent" : stance === "aliado" ? "ally" : "other";

/**
 * Monta as PersonRow com os agregados de canal.
 *
 * Deliberadamente sem embeds do PostgREST: `org_people` tem DUAS FKs para `org_vocabulary`
 * (department_id e vocabulary_id), o que obrigaria a citar o nome da constraint na string de
 * select — acoplamento frágil a um detalhe do DDL. São listas de dezenas de pessoas; quatro
 * lookups paralelos e um stitch em memória custam menos que essa fragilidade.
 */
async function carregarPessoas(
  supabase: ClienteTipado,
  orgId: string,
  filtros: { stance?: PersonStance; personId?: string } = {},
): Promise<PersonRow[]> {
  const sb = bruto(supabase);
  let q = sb.from("org_people").select("*").eq("org_id", orgId);
  if (filtros.stance) q = q.eq("stance", filtros.stance);
  if (filtros.personId) q = q.eq("id", filtros.personId);

  const { data, error } = await q.order("display_name", { ascending: true });
  if (error) {
    console.error("[people] erro ao carregar pessoas:", error);
    throw new Error("Não foi possível carregar as pessoas.");
  }
  const pessoas: PessoaBase[] = data ?? [];
  if (pessoas.length === 0) return [];

  const ids = pessoas.map((p) => p.id);
  const idsEleitos = [
    ...new Set(pessoas.map((p) => p.elected_official_id).filter((v): v is string => !!v)),
  ];

  const [secretarias, eleitos, alvos, vinculos] = await Promise.all([
    supabase
      .from("org_vocabulary")
      .select("id, value")
      .eq("org_id", orgId)
      .eq("kind", "department"),
    idsEleitos.length
      ? supabase
          .from("elected_officials")
          .select("id, nome, nome_urna")
          .eq("org_id", orgId)
          .in("id", idsEleitos)
      : Promise.resolve({ data: [] as { id: string; nome: string; nome_urna: string | null }[] }),
    sb
      .from("org_instagram_targets")
      .select("person_id, handle, active")
      .eq("org_id", orgId)
      .in("person_id", ids),
    sb.from("member_author_links").select("person_id").eq("org_id", orgId).in("person_id", ids),
  ]);

  const nomeSecretaria = new Map<string, string>(
    (secretarias.data ?? []).map((d) => [d.id, d.value]),
  );
  const nomeEleito = new Map<string, string>(
    (eleitos.data ?? []).map((e) => [e.id, e.nome_urna ?? e.nome]),
  );

  // Alvo ativo tem precedência: uma pessoa pode carregar handles antigos desativados
  // (trocou de @), e o que a ficha deve mostrar é o que está sendo varrido hoje.
  const alvoPorPessoa = new Map<string, { handle: string; active: boolean }>();
  for (const t of (alvos.data ?? []) as {
    person_id: string | null;
    handle: string;
    active: boolean;
  }[]) {
    if (!t.person_id) continue;
    const atual = alvoPorPessoa.get(t.person_id);
    if (!atual || (t.active && !atual.active)) {
      alvoPorPessoa.set(t.person_id, { handle: t.handle, active: t.active });
    }
  }

  const contagemWhatsapp = new Map<string, number>();
  for (const l of (vinculos.data ?? []) as { person_id: string | null }[]) {
    if (!l.person_id) continue;
    contagemWhatsapp.set(l.person_id, (contagemWhatsapp.get(l.person_id) ?? 0) + 1);
  }

  return pessoas.map((p) => {
    const alvo = alvoPorPessoa.get(p.id);
    return {
      id: p.id,
      display_name: p.display_name,
      stance: p.stance,
      party: p.party,
      role: p.role,
      department_id: p.department_id,
      department_name: p.department_id ? (nomeSecretaria.get(p.department_id) ?? null) : null,
      vocabulary_id: p.vocabulary_id,
      elected_official_id: p.elected_official_id,
      elected_name: p.elected_official_id ? (nomeEleito.get(p.elected_official_id) ?? null) : null,
      avatar_url: p.avatar_url,
      neighborhood: p.neighborhood,
      tags: p.tags ?? [],
      notes: p.notes,
      instagram_handle: alvo?.handle ?? null,
      instagram_active: alvo ? alvo.active : null,
      whatsapp_count: contagemWhatsapp.get(p.id) ?? 0,
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
  });
}

export const listPeople = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        stance: z.enum(["adversario", "aliado", "neutro", "interno"]).optional(),
      })
      .parse(d),
  )
  .handler(
    async ({ data, context }): Promise<PersonRow[]> =>
      carregarPessoas(context.supabase, data.orgId, { stance: data.stance }),
  );

export const getPerson = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orgId: z.string().uuid(), personId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<PersonRow | null> => {
    const linhas = await carregarPessoas(context.supabase, data.orgId, {
      personId: data.personId,
    });
    return linhas[0] ?? null;
  });

const upsertPersonSchema = z.object({
  orgId: z.string().uuid(),
  id: z.string().uuid().optional(),
  displayName: z.string().min(1).max(120),
  stance: z.enum(["adversario", "aliado", "neutro", "interno"]),
  party: z.string().max(40).nullable().optional(),
  role: z.string().max(60).nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  electedOfficialId: z.string().uuid().nullable().optional(),
  avatarUrl: z.string().max(600).nullable().optional(),
  neighborhood: z.string().max(80).nullable().optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  notes: z.string().max(4000).nullable().optional(),
  instagramHandle: z.string().max(60).nullable().optional(),
});

/**
 * Salva a ficha e PROPAGA para os canais. É aqui que a centralização vira comportamento.
 *
 * Semântica: recebe a ficha INTEIRA (é um formulário). Campo ausente = campo vazio — não é
 * patch parcial. Vale inclusive para `instagramHandle`: omitir desativa a varredura.
 *
 * Idempotente por construção: o vocabulário é localizado pelo `vocabulary_id` já gravado (ou,
 * na falta dele, por nome+kind) e o alvo de Instagram pelo UNIQUE (org_id, handle). Salvar
 * duas vezes não duplica nada.
 */
export const upsertPerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertPersonSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    await assertOrgAdmin(context.supabase, context.userId, data.orgId);
    const supabase = context.supabase;
    const sb = bruto(supabase);

    const displayName = data.displayName.trim();
    let party = nuloSeVazio(data.party);
    let role = nuloSeVazio(data.role);
    let avatarUrl = nuloSeVazio(data.avatarUrl);
    const electedOfficialId = data.electedOfficialId ?? null;

    // ── Efeito 3: herança do TSE ───────────────────────────────────────────
    // A ficha do TSE é fonte oficial de partido/cargo/foto. Preenche só o que o usuário
    // deixou em branco — o que ele digitou vence sempre (pode ter corrigido troca de partido).
    if (electedOfficialId && (!party || !role || !avatarUrl)) {
      const { data: eleito, error: erroEleito } = await supabase
        .from("elected_officials")
        .select("partido_sigla, cargo_nome, foto_url")
        .eq("id", electedOfficialId)
        .eq("org_id", data.orgId)
        .maybeSingle();
      if (erroEleito) {
        console.error("[people] erro ao ler ficha do TSE:", erroEleito);
        throw new Error("Não foi possível salvar a pessoa.");
      }
      if (eleito) {
        party = party ?? nuloSeVazio(eleito.partido_sigla);
        role = role ?? nuloSeVazio(eleito.cargo_nome);
        avatarUrl = avatarUrl ?? nuloSeVazio(eleito.foto_url);
      }
    }

    const payload = {
      org_id: data.orgId,
      display_name: displayName,
      stance: data.stance,
      party,
      role,
      department_id: data.departmentId ?? null,
      elected_official_id: electedOfficialId,
      avatar_url: avatarUrl,
      neighborhood: nuloSeVazio(data.neighborhood),
      tags: data.tags ?? [],
      notes: nuloSeVazio(data.notes),
      // A migração não criou trigger de updated_at nesta tabela — sem isto o campo congela
      // no valor de criação e a UI passa a mostrar "atualizado em" errado.
      updated_at: new Date().toISOString(),
    };

    let personId = data.id ?? null;
    let vocabularyIdAtual: string | null = null;

    if (personId) {
      // Lê o estado anterior ANTES de sobrescrever: o vocabulary_id gravado é o que evita
      // criar uma segunda entrada quando o usuário renomeia a pessoa.
      const { data: anterior, error: erroAnterior } = await sb
        .from("org_people")
        .select("id, vocabulary_id")
        .eq("id", personId)
        .eq("org_id", data.orgId)
        .maybeSingle();
      if (erroAnterior) {
        console.error("[people] erro ao ler pessoa existente:", erroAnterior);
        throw new Error("Não foi possível salvar a pessoa.");
      }
      if (!anterior) throw new Error("Pessoa não encontrada nesta organização.");
      vocabularyIdAtual = (anterior as { vocabulary_id: string | null }).vocabulary_id;

      // `.select("id")` + checagem de linha afetada: UPDATE barrado por RLS afeta 0 linhas e
      // retorna SUCESSO (mesmo cuidado de reports-share.functions.ts).
      const { data: atualizado, error: erroUpdate } = await sb
        .from("org_people")
        .update(payload)
        .eq("id", personId)
        .eq("org_id", data.orgId)
        .select("id");
      if (erroUpdate) {
        console.error("[people] erro ao atualizar pessoa:", erroUpdate);
        throw new Error("Não foi possível salvar a pessoa.");
      }
      if (!atualizado || atualizado.length === 0) {
        throw new Error("Sem permissão para editar esta pessoa.");
      }
    } else {
      const { data: inserido, error: erroInsert } = await sb
        .from("org_people")
        .insert(payload)
        .select("id")
        .single();
      if (erroInsert) {
        console.error("[people] erro ao criar pessoa:", erroInsert);
        throw new Error("Não foi possível salvar a pessoa.");
      }
      personId = (inserido as { id: string }).id;
    }

    const idFinal = personId as string;

    await sincronizarVocabulario(context.supabase, {
      orgId: data.orgId,
      personId: idFinal,
      displayName,
      stance: data.stance,
      vocabularyIdAtual,
    });

    await sincronizarInstagram(context.supabase, {
      orgId: data.orgId,
      personId: idFinal,
      displayName,
      stance: data.stance,
      handle: normalizarHandle(data.instagramHandle),
      userId: context.userId,
    });

    return { id: idFinal };
  });

/**
 * Efeito 1 — vocabulário. É ISTO que faz a IA passar a reconhecer o nome nas mensagens;
 * sem essa entrada, cadastrar um adversário não muda nada na análise.
 *
 * DECISÃO (stance vira `neutro`/`interno`): a entrada de opponent/ally passa a ser ERRADA —
 * manter faria a IA seguir classificando a pessoa por um lado que ela não ocupa mais, que é
 * exatamente o desalinhamento que esta migração existe para acabar. Mas apagar às cegas
 * destrói `aliases` que o usuário pode ter curado à mão em Ajustes → Vocabulário. Meio-termo:
 * se a entrada não tem alias (é só o espelho do nome, criado por nós), apaga; se tem aliases
 * curados, preserva a entrada e apenas DESVINCULA — o dado do usuário nunca some em silêncio,
 * e ele continua podendo editá-la na tela de vocabulário.
 */
async function sincronizarVocabulario(
  supabase: ClienteTipado,
  args: {
    orgId: string;
    personId: string;
    displayName: string;
    stance: PersonStance;
    vocabularyIdAtual: string | null;
  },
) {
  const sb = bruto(supabase);
  const kind = kindVocabDoStance(args.stance);

  if (!kind) {
    if (!args.vocabularyIdAtual) return;
    const { data: entrada } = await supabase
      .from("org_vocabulary")
      .select("id, aliases")
      .eq("id", args.vocabularyIdAtual)
      .eq("org_id", args.orgId)
      .maybeSingle();
    if (entrada && (entrada.aliases ?? []).length === 0) {
      const { error } = await supabase
        .from("org_vocabulary")
        .delete()
        .eq("id", args.vocabularyIdAtual)
        .eq("org_id", args.orgId);
      if (error) console.error("[people] erro ao remover vocabulário órfão:", error);
    }
    // Em ambos os casos a pessoa deixa de apontar para a entrada.
    const { error } = await sb
      .from("org_people")
      .update({ vocabulary_id: null })
      .eq("id", args.personId)
      .eq("org_id", args.orgId);
    if (error) console.error("[people] erro ao desvincular vocabulário:", error);
    return;
  }

  // Renomear a pessoa ATUALIZA a entrada existente (não cria uma segunda); trocar
  // adversário↔aliado só troca o `kind` da mesma linha.
  if (args.vocabularyIdAtual) {
    const { data: atualizado, error } = await supabase
      .from("org_vocabulary")
      .update({ kind, value: args.displayName })
      .eq("id", args.vocabularyIdAtual)
      .eq("org_id", args.orgId)
      .select("id");
    if (error) {
      console.error("[people] erro ao atualizar vocabulário da pessoa:", error);
      throw new Error("Pessoa salva, mas o vocabulário não pôde ser sincronizado.");
    }
    if (atualizado && atualizado.length > 0) return;
    // Entrada sumiu (apagada na tela de vocabulário): cai adiante e recria.
  }

  // Sem vínculo: reaproveita uma entrada de mesmo nome se o usuário já tinha cadastrado o
  // termo à mão — caso contrário criaríamos a duplicata que este trabalho veio eliminar.
  const { data: existentes, error: erroBusca } = await supabase
    .from("org_vocabulary")
    .select("id, value, kind")
    .eq("org_id", args.orgId)
    .in("kind", ["opponent", "ally"]);
  if (erroBusca) {
    console.error("[people] erro ao buscar vocabulário existente:", erroBusca);
    throw new Error("Pessoa salva, mas o vocabulário não pôde ser sincronizado.");
  }
  const alvoNome = args.displayName.toLowerCase();
  const reaproveitavel = (existentes ?? []).find((v) => v.value.toLowerCase() === alvoNome);

  let vocabularyId: string;
  if (reaproveitavel) {
    vocabularyId = reaproveitavel.id;
    if (reaproveitavel.kind !== kind) {
      const { error } = await supabase
        .from("org_vocabulary")
        .update({ kind })
        .eq("id", vocabularyId)
        .eq("org_id", args.orgId);
      if (error) console.error("[people] erro ao ajustar kind do vocabulário:", error);
    }
  } else {
    const { data: criado, error } = await supabase
      .from("org_vocabulary")
      .insert({ org_id: args.orgId, kind, value: args.displayName })
      .select("id")
      .single();
    if (error || !criado) {
      console.error("[people] erro ao criar vocabulário da pessoa:", error);
      throw new Error("Pessoa salva, mas o vocabulário não pôde ser sincronizado.");
    }
    vocabularyId = criado.id;
  }

  const { error: erroVinculo } = await sb
    .from("org_people")
    .update({ vocabulary_id: vocabularyId })
    .eq("id", args.personId)
    .eq("org_id", args.orgId);
  if (erroVinculo) console.error("[people] erro ao vincular vocabulário:", erroVinculo);
}

/**
 * Efeito 2 — Instagram. É ISTO que faz preencher o @ REALMENTE ativar o monitoramento.
 *
 * Não reusa `upsertInstagramTarget` de instagram.functions.ts: aquela é uma server fn (não é
 * chamável de dentro de outra sem round-trip HTTP) e o shape dela não conhece `person_id`,
 * que é justamente o vínculo que precisamos gravar.
 *
 * Handle removido DESATIVA o alvo em vez de apagar: o histórico de varredura (last_scanned_at,
 * posts já ingeridos) tem valor e o alvo pode ser rearmado sem perder a série.
 */
async function sincronizarInstagram(
  supabase: ClienteTipado,
  args: {
    orgId: string;
    personId: string;
    displayName: string;
    stance: PersonStance;
    handle: string | null;
    userId: string;
  },
) {
  const sb = bruto(supabase);

  const { data: vinculados, error: erroBusca } = await sb
    .from("org_instagram_targets")
    .select("id, handle, active")
    .eq("org_id", args.orgId)
    .filter("person_id", "eq", args.personId);
  if (erroBusca) {
    console.error("[people] erro ao buscar alvos de Instagram da pessoa:", erroBusca);
    throw new Error("Pessoa salva, mas o monitoramento de Instagram não pôde ser sincronizado.");
  }
  const atuais: { id: string; handle: string; active: boolean }[] = vinculados ?? [];

  if (!args.handle) {
    const paraDesativar = atuais.filter((t) => t.active).map((t) => t.id);
    if (paraDesativar.length === 0) return;
    const { error } = await sb
      .from("org_instagram_targets")
      .update({ active: false })
      .eq("org_id", args.orgId)
      .in("id", paraDesativar);
    if (error) console.error("[people] erro ao desativar alvo de Instagram:", error);
    return;
  }

  const kind = kindAlvoDoStance(args.stance);

  // Busca por handle além do vínculo: o alvo pode já existir cadastrado avulso na tela de
  // Instagram (é o cenário comum). Adotá-lo é o que fecha o buraco — criar outro esbarraria
  // no UNIQUE (org_id, handle) e quebraria o save.
  const { data: porHandle, error: erroHandle } = await sb
    .from("org_instagram_targets")
    .select("id")
    .eq("org_id", args.orgId)
    .eq("handle", args.handle)
    .maybeSingle();
  if (erroHandle) {
    console.error("[people] erro ao buscar alvo de Instagram por handle:", erroHandle);
    throw new Error("Pessoa salva, mas o monitoramento de Instagram não pôde ser sincronizado.");
  }

  const alvoId = (porHandle as { id: string } | null)?.id ?? null;
  if (alvoId) {
    const { error } = await sb
      .from("org_instagram_targets")
      .update({ person_id: args.personId, active: true, kind, label: args.displayName })
      .eq("id", alvoId)
      .eq("org_id", args.orgId);
    if (error) {
      console.error("[people] erro ao ativar alvo de Instagram:", error);
      throw new Error("Pessoa salva, mas o monitoramento de Instagram não pôde ser sincronizado.");
    }
  } else {
    const { error } = await sb.from("org_instagram_targets").insert({
      org_id: args.orgId,
      handle: args.handle,
      label: args.displayName,
      kind,
      active: true,
      person_id: args.personId,
      created_by: args.userId,
    });
    if (error) {
      console.error("[people] erro ao criar alvo de Instagram:", error);
      throw new Error("Pessoa salva, mas o monitoramento de Instagram não pôde ser sincronizado.");
    }
  }

  // Pessoa trocou de @: os handles antigos param de ser varridos (deixar ligado gastaria
  // scrape em conta que não é mais dela), mas continuam vinculados para não perder o histórico.
  const antigos = atuais.filter((t) => t.id !== alvoId && t.active).map((t) => t.id);
  if (antigos.length > 0) {
    const { error } = await sb
      .from("org_instagram_targets")
      .update({ active: false })
      .eq("org_id", args.orgId)
      .in("id", antigos);
    if (error) console.error("[people] erro ao desativar handle antigo:", error);
  }
}

export const deletePerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orgId: z.string().uuid(), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertOrgAdmin(context.supabase, context.userId, data.orgId);
    const sb = bruto(context.supabase);

    const { data: pessoa, error: erroBusca } = await sb
      .from("org_people")
      .select("id, display_name, vocabulary_id")
      .eq("id", data.id)
      .eq("org_id", data.orgId)
      .maybeSingle();
    if (erroBusca) {
      console.error("[people] erro ao buscar pessoa para exclusão:", erroBusca);
      throw new Error("Não foi possível excluir a pessoa.");
    }
    if (!pessoa) throw new Error("Pessoa não encontrada nesta organização.");

    // As FKs são ON DELETE SET NULL, então o alvo de Instagram SOBREVIVERIA ativo e órfão —
    // continuaria consumindo scrape de alguém que a org removeu. Desativa antes.
    const { error: erroAlvos } = await sb
      .from("org_instagram_targets")
      .update({ active: false })
      .eq("org_id", data.orgId)
      .filter("person_id", "eq", data.id);
    if (erroAlvos) console.error("[people] erro ao desativar alvos da pessoa excluída:", erroAlvos);

    // Mesma regra do stance neutro: entrada sem alias era só espelho nosso e vai junto;
    // entrada com aliases curados fica de pé na tela de vocabulário.
    await sincronizarVocabulario(context.supabase, {
      orgId: data.orgId,
      personId: data.id,
      displayName: (pessoa as { display_name: string }).display_name,
      stance: "neutro",
      vocabularyIdAtual: (pessoa as { vocabulary_id: string | null }).vocabulary_id,
    });

    const { data: removido, error } = await sb
      .from("org_people")
      .delete()
      .eq("id", data.id)
      .eq("org_id", data.orgId)
      .select("id");
    if (error) {
      console.error("[people] erro ao excluir pessoa:", error);
      throw new Error("Não foi possível excluir a pessoa.");
    }
    if (!removido || removido.length === 0) {
      throw new Error("Sem permissão para excluir esta pessoa.");
    }
    return { ok: true };
  });

/**
 * Vincula um autor de WhatsApp à ficha da pessoa.
 *
 * `member_author_links.member_id` é NOT NULL e aponta para `tracked_members` — não dá para
 * gravar um vínculo só com `person_id`. Então garantimos um `tracked_members` espelho da
 * pessoa e usamos o id dele. Vantagem colateral: as estatísticas que já rodam sobre
 * `member_daily_stats`/`tracked_members` continuam valendo sem tocar em nada.
 */
export const linkPersonAuthorHash = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        personId: z.string().uuid(),
        authorHash: z.string().min(4).max(64),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertOrgAdmin(context.supabase, context.userId, data.orgId);
    const sb = bruto(context.supabase);

    const { data: pessoa, error: erroPessoa } = await sb
      .from("org_people")
      .select("id, display_name, role, neighborhood, tags")
      .eq("id", data.personId)
      .eq("org_id", data.orgId)
      .maybeSingle();
    if (erroPessoa) {
      console.error("[people] erro ao buscar pessoa para vínculo:", erroPessoa);
      throw new Error("Não foi possível vincular o autor.");
    }
    if (!pessoa) throw new Error("Pessoa não encontrada nesta organização.");
    const p = pessoa as {
      display_name: string;
      role: string | null;
      neighborhood: string | null;
      tags: string[] | null;
    };

    const { data: espelhos, error: erroEspelho } = await sb
      .from("tracked_members")
      .select("id")
      .eq("org_id", data.orgId)
      .filter("person_id", "eq", data.personId)
      .limit(1);
    if (erroEspelho) {
      console.error("[people] erro ao buscar membro espelho:", erroEspelho);
      throw new Error("Não foi possível vincular o autor.");
    }

    let memberId: string | undefined = (espelhos as { id: string }[] | null)?.[0]?.id;
    if (!memberId) {
      const { data: criado, error } = await sb
        .from("tracked_members")
        .insert({
          org_id: data.orgId,
          person_id: data.personId,
          display_name: p.display_name,
          // `role` de tracked_members é NOT NULL com default próprio; só repassa se a ficha tiver.
          ...(p.role ? { role: p.role } : {}),
          neighborhood: p.neighborhood,
          tags: p.tags ?? [],
        })
        .select("id")
        .single();
      if (error || !criado) {
        console.error("[people] erro ao criar membro espelho:", error);
        throw new Error("Não foi possível vincular o autor.");
      }
      memberId = (criado as { id: string }).id;
    }

    // UNIQUE (org_id, author_hash): o upsert reaponta um hash já vinculado a outra pessoa em
    // vez de estourar — corrigir uma atribuição errada é o caso de uso, não um erro.
    const { error } = await sb.from("member_author_links").upsert(
      {
        org_id: data.orgId,
        member_id: memberId,
        person_id: data.personId,
        author_hash: data.authorHash,
        confirmed_by: context.userId,
      },
      { onConflict: "org_id,author_hash" },
    );
    if (error) {
      console.error("[people] erro ao vincular author_hash à pessoa:", error);
      throw new Error("Não foi possível vincular o autor.");
    }
    return { ok: true };
  });

export const unlinkPersonAuthorHash = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        personId: z.string().uuid(),
        authorHash: z.string().min(4).max(64),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertOrgAdmin(context.supabase, context.userId, data.orgId);
    // Filtra por personId também: sem isso, um pedido com o hash de outra pessoa apagaria
    // o vínculo dela.
    const { error } = await bruto(context.supabase)
      .from("member_author_links")
      .delete()
      .eq("org_id", data.orgId)
      .eq("author_hash", data.authorHash)
      .filter("person_id", "eq", data.personId);
    if (error) {
      console.error("[people] erro ao desvincular author_hash:", error);
      throw new Error("Não foi possível desvincular o autor.");
    }
    return { ok: true };
  });

/** Secretarias = vocabulário kind='department'. Reusa o cadastro existente em vez de
 *  inventar uma tabela paralela de secretarias. */
export const listDepartments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ id: string; value: string }[]> => {
    const { data: linhas, error } = await context.supabase
      .from("org_vocabulary")
      .select("id, value")
      .eq("org_id", data.orgId)
      .eq("kind", "department")
      .order("value", { ascending: true });
    if (error) {
      console.error("[people] erro ao listar secretarias:", error);
      throw new Error("Não foi possível carregar as secretarias.");
    }
    return linhas ?? [];
  });

/**
 * Autores de WhatsApp vinculados à pessoa.
 *
 * `member_author_links` não guarda nome — o hash é pseudônimo por design (LGPD). O único nome
 * disponível é o que alguém já tinha digitado em `tracked_members.author_hash`, na tela antiga;
 * quando não existe, volta `null` e a UI mostra só o hash.
 */
export const listPersonAuthors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orgId: z.string().uuid(), personId: z.string().uuid() }).parse(d),
  )
  .handler(
    async ({ data, context }): Promise<{ author_hash: string; display_name: string | null }[]> => {
      const sb = bruto(context.supabase);
      const { data: vinculos, error } = await sb
        .from("member_author_links")
        .select("author_hash")
        .eq("org_id", data.orgId)
        .filter("person_id", "eq", data.personId);
      if (error) {
        console.error("[people] erro ao listar autores da pessoa:", error);
        throw new Error("Não foi possível carregar os autores vinculados.");
      }
      const hashes = ((vinculos ?? []) as { author_hash: string }[]).map((v) => v.author_hash);
      if (hashes.length === 0) return [];

      const { data: nomeados } = await context.supabase
        .from("tracked_members")
        .select("author_hash, display_name")
        .eq("org_id", data.orgId)
        .in("author_hash", hashes);
      const nomePorHash = new Map<string, string>(
        (nomeados ?? [])
          .filter((m): m is { author_hash: string; display_name: string } => !!m.author_hash)
          .map((m) => [m.author_hash, m.display_name]),
      );

      return hashes.map((h) => ({ author_hash: h, display_name: nomePorHash.get(h) ?? null }));
    },
  );

/* --------- busca de autores para vínculo de WhatsApp --------- */

export type AuthorCandidate = {
  author_hash: string;
  msgs: number;
  grupos: number;
  ultima: string | null;
  amostra: string | null;
  vinculado_a: string | null; // nome da pessoa que já tem esse autor, se houver
};

/**
 * Candidatos a vínculo de WhatsApp, ordenados por volume.
 *
 * O `author_hash` é pseudônimo por design (LGPD) — não existe nome do autor em lugar
 * nenhum. Então a única forma honesta de a pessoa reconhecer quem é: **o que o autor
 * escreve**, quanto escreve, em quantos grupos e quando falou pela última vez. Colar
 * hash à mão, que era a alternativa, ninguém faria.
 *
 * `q` filtra por trecho de mensagem — é assim que o usuário acha alguém ("quem falou
 * da UBS do Retiro?"), já que não há nome para buscar.
 */
export const searchAuthors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orgId: z.string().uuid(), q: z.string().trim().max(80).optional() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<AuthorCandidate[]> => {
    const { fetchAllPages } = await import("@/lib/pg-paginate");
    const cli = bruto(context.supabase);
    // 90 dias: janela suficiente para reconhecer quem é ativo hoje, sem varrer o histórico.
    const desde = new Date(Date.now() - 90 * 86400_000).toISOString();

    // Passe leve (sem `content`, que é o que pesa) sobre o período inteiro.
    type Leve = { author_hash: string | null; group_id: string | null; posted_at: string | null };
    const linhas = await fetchAllPages<Leve>((from, to) => {
      let q = cli
        .from("raw_messages")
        .select("author_hash, group_id, posted_at")
        .eq("org_id", data.orgId)
        .gte("posted_at", desde)
        .not("author_hash", "is", null);
      if (data.q) q = q.ilike("content", `%${data.q}%`);
      return q.order("id", { ascending: true }).range(from, to);
    });

    const agg = new Map<string, { msgs: number; grupos: Set<string>; ultima: string }>();
    for (const l of linhas) {
      const h = l.author_hash;
      if (!h) continue;
      const a = agg.get(h) ?? { msgs: 0, grupos: new Set<string>(), ultima: "" };
      a.msgs += 1;
      if (l.group_id) a.grupos.add(l.group_id);
      if (l.posted_at && l.posted_at > a.ultima) a.ultima = l.posted_at;
      agg.set(h, a);
    }

    const top = [...agg.entries()].sort((x, y) => y[1].msgs - x[1].msgs).slice(0, 20);
    if (top.length === 0) return [];

    // Quem já pertence a alguém — evita vincular o mesmo autor a duas fichas sem perceber.
    const { data: vinculos } = await cli
      .from("member_author_links")
      .select("author_hash, person_id, org_people(display_name)")
      .eq("org_id", data.orgId)
      .in(
        "author_hash",
        top.map(([h]) => h),
      );
    const dono = new Map<string, string>();
    for (const v of (vinculos ?? []) as Array<{
      author_hash?: string;
      org_people?: { display_name?: string } | { display_name?: string }[] | null;
    }>) {
      const p = Array.isArray(v.org_people) ? v.org_people[0] : v.org_people;
      if (v.author_hash && p?.display_name) dono.set(v.author_hash, p.display_name);
    }

    // Só agora paga o custo do texto, e só uma mensagem por autor do topo.
    const amostras = new Map<string, string>();
    await Promise.all(
      top.map(async ([h]) => {
        let q = cli
          .from("raw_messages")
          .select("content")
          .eq("org_id", data.orgId)
          .eq("author_hash", h)
          .gte("posted_at", desde);
        if (data.q) q = q.ilike("content", `%${data.q}%`);
        const { data: m } = await q.order("posted_at", { ascending: false }).limit(1);
        const txt = (m ?? [])[0]?.content;
        if (txt) amostras.set(h, String(txt).replace(/\s+/g, " ").trim().slice(0, 140));
      }),
    );

    return top.map(([h, a]) => ({
      author_hash: h,
      msgs: a.msgs,
      grupos: a.grupos.size,
      ultima: a.ultima || null,
      amostra: amostras.get(h) ?? null,
      vinculado_a: dono.get(h) ?? null,
    }));
  });
