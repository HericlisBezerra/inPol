import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  deletePerson,
  getPerson,
  linkPersonAuthorHash,
  listDepartments,
  listPersonAuthors,
  searchAuthors,
  unlinkPersonAuthorHash,
  upsertPerson,
} from "@/lib/people.functions";
import { STANCE_TONE, STANCES, initialsOfName, type Stance } from "./person-shared";

/**
 * Ficha única da pessoa (org_people).
 *
 * POR QUÊ: até aqui a mesma pessoa vivia em quatro cadastros que não se conversavam
 * (org_adversaries, org_instagram_targets, tracked_members, org_vocabulary), cada um
 * numa tela diferente — o usuário preenchia o @ do adversário achando que tinha ligado
 * a varredura, e não tinha. Esta ficha é o lugar ÚNICO de edição: o que o painel
 * escreve em `org_people` a camada de server fns propaga para os canais.
 *
 * Como cada campo tem uma consequência invisível (ativar varredura, tornar a pessoa
 * reconhecível pela IA), todo campo carrega um microtexto dizendo o que ele dispara.
 * Sem isso o usuário volta a achar que "preencheu e não aconteceu nada".
 */

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];

/**
 * Autor do WhatsApp vinculado. Só `author_hash` é garantido: o hash é pseudônimo por
 * design (LGPD) e `display_name` vem nulo na maioria das vezes. "Só hash" é o caso
 * NORMAL, não um erro — a UI trata isso como estado legítimo.
 */
type PersonAuthor = {
  author_hash: string;
  display_name: string | null;
  message_count: number | null;
  last_seen_at: string | null;
};

function normalizeAuthor(raw: unknown): PersonAuthor | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const hash = typeof r.author_hash === "string" ? r.author_hash : null;
  if (!hash) return null;
  return {
    author_hash: hash,
    display_name: typeof r.display_name === "string" && r.display_name ? r.display_name : null,
    message_count: typeof r.message_count === "number" ? r.message_count : null,
    last_seen_at: typeof r.last_seen_at === "string" ? r.last_seen_at : null,
  };
}

type Draft = {
  displayName: string;
  stance: Stance;
  party: string;
  role: string;
  departmentId: string;
  neighborhood: string;
  tags: string;
  notes: string;
  instagramHandle: string;
  avatarUrl: string | null;
};

const EMPTY_DRAFT: Draft = {
  displayName: "",
  stance: "neutro",
  party: "",
  role: "",
  departmentId: "",
  neighborhood: "",
  tags: "",
  notes: "",
  instagramHandle: "",
  avatarUrl: null,
};

export function PersonSheet({
  orgId,
  personId,
  onClose,
}: {
  orgId: string;
  /** `null` abre a ficha em modo criação. */
  personId: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isNew = personId === null;
  const nameRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Devolve o foco para onde estava (a linha clicada na tabela) ao fechar.
  const openerRef = useRef<Element | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [uploading, setUploading] = useState(false);
  const [newHash, setNewHash] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const {
    data: person,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["person", orgId, personId],
    enabled: !isNew,
    queryFn: () => getPerson({ data: { orgId, personId: personId as string } }),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments", orgId],
    queryFn: () => listDepartments({ data: { orgId } }),
  });

  const { data: rawAuthors = [], isLoading: authorsLoading } = useQuery({
    queryKey: ["person-authors", orgId, personId],
    enabled: !isNew,
    queryFn: () => listPersonAuthors({ data: { orgId, personId: personId as string } }),
  });

  const authors = useMemo(
    () => (Array.isArray(rawAuthors) ? rawAuthors : []).map(normalizeAuthor).filter(Boolean),
    [rawAuthors],
  ) as PersonAuthor[];

  // Busca de autores para vínculo. Debounce porque cada tecla dispara varredura de 90 dias
  // de mensagens no servidor.
  const [buscaAutor, setBuscaAutor] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setBuscaAutor(newHash.trim()), 350);
    return () => clearTimeout(t);
  }, [newHash]);
  const candidatos = useQuery({
    queryKey: ["author-candidates", orgId, buscaAutor],
    enabled: !isNew,
    queryFn: () =>
      searchAuthors({ data: { orgId, q: buscaAutor.length >= 3 ? buscaAutor : undefined } }),
  });

  // Carrega o registro no formulário. Só reage a `person` para não sobrescrever digitação.
  useEffect(() => {
    if (!person) return;
    setDraft({
      displayName: person.display_name ?? "",
      stance: (person.stance as Stance) ?? "neutro",
      party: person.party ?? "",
      role: person.role ?? "",
      departmentId: person.department_id ?? "",
      neighborhood: person.neighborhood ?? "",
      tags: (person.tags ?? []).join(", "),
      notes: person.notes ?? "",
      instagramHandle: person.instagram_handle ?? "",
      avatarUrl: person.avatar_url ?? null,
    });
  }, [person]);

  useEffect(() => {
    openerRef.current = document.activeElement;
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("keydown", onEsc);
      const opener = openerRef.current;
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [onClose]);

  // Foco inicial no nome: é o único campo obrigatório e o primeiro passo em ambos os modos.
  useEffect(() => {
    if (isNew || person) nameRef.current?.focus();
  }, [isNew, person]);

  /** Invalidação central: qualquer escrita mexe na ficha e nas listas que a exibem. */
  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["people", orgId] });
    qc.invalidateQueries({ queryKey: ["person", orgId, personId] });
    qc.invalidateQueries({ queryKey: ["person-authors", orgId, personId] });
    // O @ da ficha alimenta org_instagram_targets — o painel "Instagram monitorado" reflete.
    qc.invalidateQueries({ queryKey: ["ig-targets", orgId] });
  }

  // `upsertPerson` é FULL-REPLACE, não patch: campo ausente = campo apagado — omitir
  // `instagramHandle` DESATIVA a varredura daquela pessoa. Por isso existe um único
  // caminho de escrita nesta tela (o botão Salvar) e ele monta o registro INTEIRO a
  // partir do draft, que por sua vez espelha a ficha carregada. Nada de autosave por
  // campo nem toggle rápido de stance: qualquer atalho desses apagaria o resto.
  const save = useMutation({
    mutationFn: () =>
      upsertPerson({
        data: {
          orgId,
          ...(isNew ? {} : { id: personId as string }),
          displayName: draft.displayName.trim(),
          stance: draft.stance,
          party: draft.party.trim() || null,
          role: draft.role.trim() || null,
          departmentId: draft.departmentId || null,
          avatarUrl: draft.avatarUrl,
          neighborhood: draft.neighborhood.trim() || null,
          tags: draft.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          notes: draft.notes.trim() || null,
          instagramHandle: draft.instagramHandle.trim().replace(/^@/, "") || null,
        },
      }),
    onSuccess: () => {
      invalidateAll();
      toast.success(isNew ? "Pessoa cadastrada" : "Ficha atualizada");
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  const remove = useMutation({
    mutationFn: () => deletePerson({ data: { orgId, id: personId as string } }),
    onSuccess: () => {
      invalidateAll();
      toast.success("Pessoa removida");
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao remover"),
  });

  const link = useMutation({
    mutationFn: (authorHash: string) =>
      linkPersonAuthorHash({ data: { orgId, personId: personId as string, authorHash } }),
    onSuccess: () => {
      invalidateAll();
      setNewHash("");
      toast.success("WhatsApp vinculado");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao vincular"),
  });

  const unlink = useMutation({
    mutationFn: (authorHash: string) =>
      unlinkPersonAuthorHash({ data: { orgId, personId: personId as string, authorHash } }),
    onSuccess: () => {
      invalidateAll();
      toast.success("Vínculo removido");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao desvincular"),
  });

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite reenviar o mesmo arquivo
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type)) {
      toast.error("Formato inválido — use PNG, JPG ou WEBP.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Imagem grande demais (máx. 5 MB).");
      return;
    }
    setUploading(true);
    try {
      // A policy do bucket `avatars` é por pasta do usuário — por isso o prefixo é o uid
      // de quem envia, não o id da pessoa retratada.
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Sessão expirada.");
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${uid}/pessoa-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      setDraft((d) => ({ ...d, avatarUrl: pub.publicUrl }));
      toast.success("Foto carregada — salve a ficha para confirmar.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload");
    } finally {
      setUploading(false);
    }
  }

  // Trava crítica por causa do full-replace: em modo edição só liberamos o Salvar depois
  // que a ficha carregou. Salvar com o draft ainda vazio gravaria um registro em branco
  // por cima do real — apagando @ do Instagram, secretaria e notas de uma vez.
  const draftReady = isNew || (!!person && !isLoading && !isError);
  const canSave = draftReady && draft.displayName.trim().length > 0 && !save.isPending;
  const tone = STANCE_TONE[draft.stance];
  const fromTse = !!person?.elected_name;
  const whatsappCount = person?.whatsapp_count ?? authors.length;

  return (
    <div
      className="fixed inset-0 z-[110] flex justify-end bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? "Nova pessoa" : `Ficha de ${draft.displayName || "pessoa"}`}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-[600px] flex-col border-l border-v2-line bg-v2-surface shadow-[0_0_64px_rgba(33,31,28,0.24)]"
      >
        {/* Cabeçalho */}
        <div className="flex flex-none items-start gap-3.5 border-b border-v2-line px-6 py-4">
          <span
            className={`grid h-[46px] w-[46px] flex-none place-items-center overflow-hidden rounded-full text-[15px] font-semibold ${tone.chip}`}
          >
            {draft.avatarUrl ? (
              <img
                src={draft.avatarUrl}
                alt=""
                className="h-full w-full object-cover"
                onError={() => setDraft((d) => ({ ...d, avatarUrl: null }))}
              />
            ) : (
              initialsOfName(draft.displayName || "?")
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[17px] font-[650] leading-tight text-v2-ink">
              {draft.displayName.trim() || (isNew ? "Nova pessoa" : "Sem nome")}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span
                className={`rounded px-[7px] py-0.5 font-mono text-[9.5px] font-bold uppercase ${tone.chip}`}
              >
                {tone.label}
              </span>
              {fromTse && (
                <span className="rounded bg-v2-blue-bg px-[7px] py-0.5 font-mono text-[9.5px] font-bold uppercase text-v2-blue">
                  TSE · {person?.elected_name}
                </span>
              )}
              {!isNew && (
                <span className="font-mono text-[10.5px] text-v2-faint">
                  {whatsappCount} vínculo{whatsappCount === 1 ? "" : "s"} WhatsApp
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar ficha"
            className="flex-none rounded-lg border border-v2-line bg-v2-card px-2.5 py-1 text-[13px] text-v2-ink-2"
          >
            ✕
          </button>
        </div>

        {/* Corpo */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {isError && (
            <div className="rounded-[13px] border border-v2-line bg-v2-crit-bg px-5 py-4 text-[12.5px] text-v2-crit">
              Não foi possível carregar esta ficha. Feche e tente novamente.
            </div>
          )}
          {!isNew && isLoading && (
            <div className="text-[12.5px] text-v2-ink-3">Carregando ficha…</div>
          )}
          {/* Ficha existente que voltou vazia. Sem isto o painel renderiza um formulário em
              branco idêntico ao de criação — o usuário acha que a pessoa perdeu os dados, e
              um Salvar ali sobrescreveria a ficha real com vazio. */}
          {!isNew && !isLoading && !isError && !person && (
            <div className="rounded-[13px] border border-v2-line bg-v2-warn-bg px-5 py-4 text-[12.5px] text-v2-ink">
              Ficha não encontrada. Ela pode ter sido removida — feche e recarregue a lista.
            </div>
          )}

          {(isNew || (!isLoading && !isError && !!person)) && (
            <div className="space-y-4">
              {/* Identidade */}
              <Card title="Identidade">
                <Field
                  label="Nome"
                  hint="É por este nome que a pessoa aparece em alertas e relatórios."
                >
                  <input
                    ref={nameRef}
                    value={draft.displayName}
                    onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))}
                    maxLength={120}
                    placeholder="Ex.: Ana Ribeiro"
                    className={inputCls}
                  />
                </Field>

                <Field
                  label="Posicionamento"
                  hint="Adversário ou aliado faz a IA reconhecer esta pessoa nas mensagens e citá-la nas análises."
                >
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {STANCES.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        aria-pressed={draft.stance === s.value}
                        onClick={() => setDraft((d) => ({ ...d, stance: s.value }))}
                        className={`rounded-lg px-3 py-1.5 text-[12.5px] font-[650] transition-colors ${
                          draft.stance === s.value
                            ? STANCE_TONE[s.value].chip
                            : "border border-v2-line bg-v2-card text-v2-ink-3"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  {/* Consequência real e nada óbvia: rebaixar para neutro/interno pode remover a
                      entrada de vocabulário criada como espelho do nome. Avisar ANTES de salvar. */}
                  {(draft.stance === "neutro" || draft.stance === "interno") &&
                    (person?.stance === "adversario" || person?.stance === "aliado") && (
                      <span className="mt-1.5 block rounded-lg bg-v2-warn-bg px-3 py-2 text-[11.5px] leading-snug text-v2-warn">
                        ⚠ Ao salvar, a IA pode deixar de reconhecer o nome desta pessoa nas
                        mensagens — a entrada de vocabulário criada a partir dela é removida.
                      </span>
                    )}
                </Field>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Partido" hint="Aparece junto do nome nos cards da Rede.">
                    <input
                      value={draft.party}
                      onChange={(e) => setDraft((d) => ({ ...d, party: e.target.value }))}
                      maxLength={40}
                      placeholder="Ex.: PSDB"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Cargo" hint="Vereador, secretário, liderança comunitária…">
                    <input
                      value={draft.role}
                      onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
                      maxLength={60}
                      placeholder="Ex.: Vereador"
                      className={inputCls}
                    />
                  </Field>
                </div>

                <Field
                  label="Secretaria"
                  hint="Vincula a pessoa a uma secretaria do vocabulário — as menções à pasta passam a ser cruzadas com ela."
                >
                  <select
                    value={draft.departmentId}
                    onChange={(e) => setDraft((d) => ({ ...d, departmentId: e.target.value }))}
                    className={inputCls}
                  >
                    <option value="">Sem secretaria</option>
                    {departments.map((dep) => (
                      <option key={dep.id} value={dep.id}>
                        {dep.value}
                      </option>
                    ))}
                  </select>
                  {departments.length === 0 && (
                    <div className="mt-1 text-[11.5px] text-v2-faint">
                      Nenhuma secretaria cadastrada em Ajustes → Vocabulário.
                    </div>
                  )}
                </Field>

                <Field label="Bairro" hint="Usado para cruzar a pessoa com o mapa do território.">
                  <input
                    value={draft.neighborhood}
                    onChange={(e) => setDraft((d) => ({ ...d, neighborhood: e.target.value }))}
                    maxLength={80}
                    placeholder="Ex.: Retiro"
                    className={inputCls}
                  />
                </Field>

                {/* Foto */}
                <div className="mt-3 flex items-center gap-3 rounded-lg border border-v2-line bg-v2-track px-3.5 py-3">
                  <span className="grid h-11 w-11 flex-none place-items-center overflow-hidden rounded-full bg-v2-card text-[13px] font-semibold text-v2-ink-3">
                    {draft.avatarUrl ? (
                      <img src={draft.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      initialsOfName(draft.displayName || "?")
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-[650] text-v2-ink">Foto</div>
                    <div className="text-[11.5px] text-v2-ink-3">PNG, JPG ou WEBP · até 5 MB</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="flex-none rounded-lg border border-v2-line-strong bg-v2-card px-3 py-1.5 text-[12px] font-[650] text-v2-ink disabled:opacity-60"
                  >
                    {uploading ? "Enviando…" : draft.avatarUrl ? "Trocar" : "Enviar"}
                  </button>
                  {draft.avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, avatarUrl: null }))}
                      className="flex-none text-[12px] font-[650] text-v2-crit"
                    >
                      Remover
                    </button>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept={AVATAR_TYPES.join(",")}
                    onChange={onPickAvatar}
                    className="hidden"
                  />
                </div>
              </Card>

              {/* Instagram */}
              <Card title="Instagram">
                <Field
                  label="@ do perfil"
                  hint="Preencher o @ ATIVA a varredura automática do perfil — os posts passam a entrar na análise. Apagar o @ pausa a varredura."
                >
                  <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-v2-line bg-v2-surface px-3 py-2 focus-within:border-v2-green">
                    <span className="font-mono text-[13px] text-v2-faint">@</span>
                    <input
                      value={draft.instagramHandle.replace(/^@/, "")}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, instagramHandle: e.target.value.trim() }))
                      }
                      maxLength={60}
                      placeholder="perfil.oficial"
                      className="w-full bg-transparent font-mono text-[13.5px] text-v2-ink outline-none placeholder:text-v2-faint"
                    />
                  </div>
                </Field>
                {!isNew && person?.instagram_handle && (
                  <div
                    className={`mt-1 font-mono text-[11px] ${person.instagram_active ? "text-v2-green" : "text-v2-warn"}`}
                  >
                    {person.instagram_active
                      ? "● varredura ativa"
                      : "○ cadastrado, varredura pausada"}
                  </div>
                )}
              </Card>

              {/* WhatsApp */}
              <Card title="WhatsApp vinculado">
                <p className="text-[12px] leading-relaxed text-v2-ink-3">
                  Cada vínculo liga um autor dos grupos monitorados a esta pessoa. É o que faz as
                  mensagens dela contarem no volume e no sentimento da ficha. Os autores são
                  pseudonimizados — na maioria dos casos existe só o hash, sem nome.
                </p>

                {isNew && (
                  <div className="mt-3 rounded-lg border border-v2-line bg-v2-track px-3.5 py-3 text-[12px] text-v2-ink-3">
                    Salve a ficha primeiro — o vínculo de WhatsApp precisa de uma pessoa já criada.
                  </div>
                )}

                {!isNew && (
                  <>
                    {authorsLoading && (
                      <div className="mt-3 text-[12px] text-v2-ink-3">Carregando vínculos…</div>
                    )}
                    {!authorsLoading && authors.length === 0 && (
                      <div className="mt-3 rounded-lg border border-v2-line bg-v2-track px-3.5 py-3 text-[12px] text-v2-ink-3">
                        Nenhum WhatsApp vinculado ainda.
                      </div>
                    )}
                    {authors.length > 0 && (
                      <div className="mt-3 overflow-hidden rounded-lg border border-v2-line">
                        {authors.map((a, i) => (
                          <div
                            key={a.author_hash}
                            className={`flex items-center gap-3 bg-v2-card px-3.5 py-2.5 ${
                              i < authors.length - 1 ? "border-b border-v2-track" : ""
                            }`}
                          >
                            {/* Sem nome é o normal: o hash é pseudônimo por design (LGPD).
                                Mostramos o hash truncado como identificador legítimo. */}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12.5px] text-v2-ink">
                                {a.display_name ?? "Autor sem nome"}
                              </span>
                              <span className="block truncate font-mono text-[10.5px] text-v2-faint">
                                {a.author_hash.slice(0, 20)}…
                              </span>
                            </span>
                            <span className="flex-none font-mono text-[10.5px] text-v2-faint">
                              {a.message_count != null ? `${a.message_count} msgs` : "—"}
                            </span>
                            <button
                              type="button"
                              onClick={() => unlink.mutate(a.author_hash)}
                              disabled={unlink.isPending}
                              className="flex-none text-[12px] font-[650] text-v2-crit disabled:opacity-50"
                            >
                              Desvincular
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <Field
                      label="Vincular novo autor"
                      hint="Autores não têm nome (o identificador é pseudonimizado). Reconheça pelo que a pessoa escreve — busque por um trecho de mensagem."
                    >
                      <input
                        value={newHash}
                        onChange={(e) => setNewHash(e.target.value)}
                        maxLength={80}
                        placeholder="Buscar por trecho de mensagem — ex.: fila na UBS"
                        className={`${inputCls} mt-1.5`}
                      />
                      <div className="mt-2 max-h-[260px] space-y-1.5 overflow-y-auto">
                        {candidatos.isLoading && (
                          <div className="text-[12px] text-v2-ink-3">Buscando autores…</div>
                        )}
                        {!candidatos.isLoading && (candidatos.data ?? []).length === 0 && (
                          <div className="text-[12px] text-v2-ink-3">
                            Nenhum autor encontrado nos últimos 90 dias.
                          </div>
                        )}
                        {(candidatos.data ?? []).map((c) => {
                          const jaEhDaFicha = authors.some((a) => a.author_hash === c.author_hash);
                          const deOutro = !!c.vinculado_a && !jaEhDaFicha;
                          return (
                            <div
                              key={c.author_hash}
                              className="rounded-[10px] border border-v2-line bg-v2-surface px-3 py-2"
                            >
                              <div className="flex items-center gap-2 font-mono text-[10px] text-v2-faint">
                                <span>{c.msgs} msgs</span>
                                <span>
                                  · {c.grupos} grupo{c.grupos === 1 ? "" : "s"}
                                </span>
                                {c.ultima && (
                                  <span>
                                    · até{" "}
                                    {new Date(c.ultima).toLocaleDateString("pt-BR", {
                                      day: "2-digit",
                                      month: "short",
                                    })}
                                  </span>
                                )}
                              </div>
                              {c.amostra && (
                                <div className="mt-1 font-display text-[12.5px] italic leading-snug text-v2-ink">
                                  &ldquo;{c.amostra}&rdquo;
                                </div>
                              )}
                              <div className="mt-1.5 flex items-center gap-2">
                                {jaEhDaFicha ? (
                                  <span className="text-[11.5px] font-[650] text-v2-green">
                                    ✓ já vinculado a esta ficha
                                  </span>
                                ) : deOutro ? (
                                  // Vincular o mesmo autor a duas fichas silenciosamente
                                  // duplicaria a mesma pessoa no monitoramento.
                                  <span className="text-[11.5px] text-v2-warn">
                                    já é de {c.vinculado_a}
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => link.mutate(c.author_hash)}
                                    disabled={link.isPending}
                                    className="rounded-lg bg-v2-green px-3 py-1 text-[11.5px] font-[650] text-white transition-colors hover:bg-v2-green-hover disabled:opacity-50"
                                  >
                                    Vincular
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Field>
                  </>
                )}
              </Card>

              {/* Contexto */}
              <Card title="Contexto">
                <Field
                  label="Tags"
                  hint="Separe por vírgula. Servem para agrupar pessoas nos filtros da Rede."
                >
                  <input
                    value={draft.tags}
                    onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))}
                    placeholder="saúde, oposição, zona norte"
                    className={inputCls}
                  />
                </Field>
                <Field label="Notas" hint="Anotações internas da equipe. Não vão para relatórios.">
                  <textarea
                    value={draft.notes}
                    onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                    rows={4}
                    placeholder="Histórico, relações, o que observar…"
                    className={`${inputCls} resize-y`}
                  />
                </Field>
              </Card>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex flex-none items-center gap-2 border-t border-v2-line bg-v2-card px-6 py-3.5">
          {!isNew &&
            (confirmDelete ? (
              <>
                <span className="text-[12px] text-v2-crit">Excluir esta pessoa?</span>
                <button
                  onClick={() => remove.mutate()}
                  disabled={remove.isPending}
                  className="rounded-lg bg-v2-crit-bg px-3 py-1.5 text-[12.5px] font-[650] text-v2-crit disabled:opacity-50"
                >
                  {remove.isPending ? "Excluindo…" : "Confirmar"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-[12.5px] font-[650] text-v2-ink-3"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-[12.5px] font-[650] text-v2-crit"
              >
                Excluir
              </button>
            ))}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="rounded-lg border border-v2-line-strong bg-v2-card px-3.5 py-2 text-[13px] font-[650] text-v2-ink"
          >
            Cancelar
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={!canSave}
            className="rounded-lg bg-v2-green px-4 py-2 text-[13px] font-[650] text-white transition-colors hover:bg-v2-green-hover disabled:opacity-50"
          >
            {save.isPending ? "Salvando…" : isNew ? "Criar pessoa" : "Salvar ficha"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "mt-1.5 w-full rounded-lg border border-v2-line bg-v2-surface px-3 py-2 text-[13.5px] text-v2-ink outline-none focus:border-v2-green placeholder:text-v2-faint";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[13px] border border-v2-line bg-v2-card px-5 py-4">
      <div className="text-[13.5px] font-[650] text-v2-ink">{title}</div>
      <div className="mt-2.5 space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[12px] font-semibold uppercase tracking-wide text-v2-faint">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] leading-snug text-v2-ink-3">{hint}</span>}
    </label>
  );
}
