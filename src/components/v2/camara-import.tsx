import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { importSession } from "@/lib/camara.functions";
import { BlindNote } from "./empty-signal";

/**
 * Importar uma sessão: colar a transcrição do YouTube (AssemblyAI, com diarização) e deixar o
 * parser do servidor quebrar em falas.
 *
 * DUAS decisões de produto moram nesta tela:
 *
 * 1. O resultado NÃO é um "pronto!". É uma prestação de contas: quantas falas saíram, quantas
 *    casaram com ficha de pessoa, quantas não casaram, e — principalmente — a lista de `avisos`
 *    do parser. Linha que o parser não reconheceu é fala que sumiu da sessão; engolir isso faria
 *    a transcrição parecer completa quando não está, que é exatamente o tipo de silêncio
 *    fabricado que este produto não pode produzir.
 * 2. `semVinculo` > 0 é caso NORMAL, não erro: convidado, secretário, público. Por isso aparece
 *    em tom neutro, com a explicação, e não em vermelho.
 */

const TIPOS = ["ordinária", "extraordinária", "solene"] as const;

const FIELD =
  "w-full rounded-lg border border-v2-line bg-v2-bg px-3 py-2 text-[13px] text-v2-ink placeholder:text-v2-faint focus:border-v2-green focus:outline-none";
const LABEL = "block text-[11.5px] font-[650] uppercase tracking-[0.06em] text-v2-ink-3";

type ImportResult = Awaited<ReturnType<typeof importSession>>;

export function CamaraImportDialog({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const firstRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [numero, setNumero] = useState("");
  const [legislatura, setLegislatura] = useState("");
  const [tipo, setTipo] = useState<string>("ordinária");
  const [videoUrl, setVideoUrl] = useState("");
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const mut = useMutation({
    mutationFn: () =>
      importSession({
        data: {
          orgId,
          title: title.trim(),
          sessionDate,
          numero: numero.trim() || undefined,
          legislatura: legislatura.trim() || undefined,
          tipo: tipo || undefined,
          videoUrl: videoUrl.trim() || undefined,
          transcript,
        },
      }),
    onSuccess: (r) => {
      setResult(r);
      // A lista de sessões da tela de trás precisa refletir a importação sem F5.
      void qc.invalidateQueries({ queryKey: ["camara-sessions", orgId] });
    },
  });

  const canSubmit =
    title.trim().length > 0 && sessionDate.length > 0 && transcript.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-v2-panel/40 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Importar sessão da Câmara"
    >
      {/* Clique fora fecha — mas só no overlay, nunca no cartão (transcrição colada é trabalho
          perdido se um clique errado descartar). */}
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
      />
      <div className="relative my-8 w-full max-w-[720px] rounded-[13px] border border-v2-line bg-v2-card px-6 py-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[11px] font-bold tracking-[0.1em] text-v2-ink-3">
              IMPORTAR SESSÃO
            </div>
            <p className="mt-1.5 max-w-[520px] text-[12.5px] leading-normal text-v2-ink-2">
              Cole a transcrição exportada do vídeo, com marcação de tempo e nome de quem fala —{" "}
              <code className="rounded bg-v2-track px-1 py-0.5 font-mono text-[11.5px] text-v2-ink">
                [00:21:40] Ver. Fulano (PSOL): texto…
              </code>
              . O vínculo com as fichas de pessoas é feito na importação.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-none rounded-lg border border-v2-line px-2.5 py-1 text-[12.5px] text-v2-ink-3 hover:text-v2-ink"
          >
            fechar
          </button>
        </div>

        {result ? (
          <ImportOutcome result={result} onClose={onClose} />
        ) : (
          <form
            className="mt-4 flex flex-col gap-3.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit && !mut.isPending) mut.mutate();
            }}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.6fr_1fr]">
              <label className="flex flex-col gap-1">
                <span className={LABEL}>Título *</span>
                <input
                  ref={firstRef}
                  className={FIELD}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="62ª Sessão Ordinária"
                  required
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={LABEL}>Data da sessão *</span>
                <input
                  type="date"
                  className={FIELD}
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  required
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1">
                <span className={LABEL}>Número</span>
                <input
                  className={FIELD}
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  placeholder="62ª"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={LABEL}>Legislatura</span>
                <input
                  className={FIELD}
                  value={legislatura}
                  onChange={(e) => setLegislatura(e.target.value)}
                  placeholder="19ª"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={LABEL}>Tipo</span>
                <select className={FIELD} value={tipo} onChange={(e) => setTipo(e.target.value)}>
                  {TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-1">
              <span className={LABEL}>URL do vídeo</span>
              <input
                className={FIELD}
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
              />
              {/* Sem vídeo a transcrição existe, mas o minuto clicável não: vale avisar antes. */}
              <BlindNote>
                Sem a URL, as falas ficam sem o link para o minuto exato do vídeo.
              </BlindNote>
            </label>

            <label className="flex flex-col gap-1">
              <span className={LABEL}>Transcrição *</span>
              <textarea
                className={`${FIELD} min-h-[220px] resize-y font-mono text-[12px] leading-[1.6]`}
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder={"[00:00:12] Ver. Fulano (PSOL): Sr. Presidente, peço a palavra…"}
                required
              />
              <BlindNote>
                {transcript.trim()
                  ? `${transcript.split("\n").filter((l) => l.trim()).length} linhas coladas · o parser dirá quantas viraram fala.`
                  : "O texto original fica guardado na sessão, para reprocessar depois sem depender do arquivo."}
              </BlindNote>
            </label>

            {mut.isError && (
              <div className="rounded-lg border border-v2-crit/40 bg-v2-crit-bg px-3.5 py-2.5 text-[12.5px] text-v2-crit">
                {mut.error instanceof Error
                  ? mut.error.message
                  : "Não foi possível importar a sessão."}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-v2-line-strong bg-v2-card px-3.5 py-2 text-[12.5px] font-[650] text-v2-ink"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!canSubmit || mut.isPending}
                className="rounded-lg bg-v2-green px-4 py-2 text-[12.5px] font-[650] text-white hover:bg-v2-green-hover disabled:opacity-50"
              >
                {mut.isPending ? "Importando…" : "Importar sessão"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/** O que a importação de fato produziu — incluindo o que ela NÃO conseguiu reconhecer. */
function ImportOutcome({ result, onClose }: { result: ImportResult; onClose: () => void }) {
  const avisos = result.avisos ?? [];
  return (
    <div className="mt-4">
      <div className="grid grid-cols-3 gap-2.5">
        <Tile label="Falas reconhecidas" value={result.speeches} tone="text-v2-ink" />
        <Tile label="Vinculadas a fichas" value={result.vinculadas} tone="text-v2-green" />
        <Tile label="Sem vínculo" value={result.semVinculo} tone="text-v2-ink-3" />
      </div>
      <BlindNote className="mt-2">
        Fala sem vínculo continua na sessão com o nome de quem falou — convidado, secretário ou
        público não têm ficha, e isso não é erro.
      </BlindNote>

      {avisos.length > 0 ? (
        <div className="mt-3.5 rounded-lg border border-v2-warn-strong/40 bg-v2-warn-bg/50 px-3.5 py-3">
          <div className="text-[12.5px] font-[650] text-v2-ink">
            {avisos.length} {avisos.length === 1 ? "aviso do parser" : "avisos do parser"}
          </div>
          <ul className="mt-2 max-h-[220px] overflow-y-auto pr-1">
            {avisos.map((a, i) => (
              <li
                key={i}
                className="border-b border-v2-line/60 py-1.5 font-mono text-[11.5px] leading-snug text-v2-ink-2 last:border-b-0"
              >
                {a}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-3.5 text-[12.5px] text-v2-ink-2">
          O parser não reportou nenhuma linha fora de formato.
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-2.5">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-v2-line-strong bg-v2-card px-3.5 py-2 text-[12.5px] font-[650] text-v2-ink"
        >
          Fechar
        </button>
        <Link
          to="/camara/sessao/$sessionId"
          params={{ sessionId: result.sessionId }}
          className="rounded-lg bg-v2-green px-4 py-2 text-[12.5px] font-[650] text-white hover:bg-v2-green-hover"
        >
          Abrir a sessão →
        </Link>
      </div>
    </div>
  );
}

/** Aqui o `0` é legítimo: houve importação e o parser contou. Não é ausência de medição. */
function Tile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-[11px] border border-v2-line bg-v2-bg px-3.5 py-3">
      <div className="text-[11.5px] text-v2-ink-3">{label}</div>
      <div className={`mt-0.5 text-[20px] font-[650] ${tone}`}>{value}</div>
    </div>
  );
}
