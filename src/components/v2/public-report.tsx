// Renderização READ-ONLY de um relatório compartilhado publicamente (tema cream v2).
// Recebe SÓ o que é público — nunca org_id, ids internos ou outros relatórios.
// Layout editorial: folha branca sobre o cream, Fraunces nos títulos, Instrument no corpo.
// @media print embutido (escopo .v2-pub) deixa a impressão/PDF limpa: fundo branco,
// sem sombra/borda da folha, tipografia preservada.
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { V2Logo } from "./logo";

export type PublicReportData = {
  title: string;
  kind: "daily" | "weekly" | "monthly";
  periodStart: string;
  periodEnd: string;
  markdown: string;
};

const KIND_LABEL: Record<PublicReportData["kind"], string> = {
  daily: "Relatório diário",
  weekly: "Relatório semanal",
  monthly: "Análise mensal",
};

const PRINT_CSS = `
@media print {
  .v2-pub { background: #ffffff !important; }
  .v2-pub-sheet {
    box-shadow: none !important;
    border: none !important;
    border-radius: 0 !important;
    max-width: none !important;
    padding: 0 !important;
    margin: 0 !important;
  }
  .v2-pub-frame { padding: 0 !important; }
  .v2-pub a { color: inherit !important; text-decoration: none !important; }
  .v2-pub h2, .v2-pub h3 { break-after: avoid; }
  .v2-pub blockquote, .v2-pub table, .v2-pub pre { break-inside: avoid; }
}
@page { margin: 22mm 18mm; }
`;

export function PublicReport({ report }: { report: PublicReportData }) {
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="v2-pub v2-site min-h-screen">
      <style>{PRINT_CSS}</style>

      <div className="v2-pub-frame mx-auto w-full max-w-[820px] px-4 py-8 sm:px-6 sm:py-12">
        {/* Folha editorial */}
        <div className="v2-pub-sheet rounded-2xl border border-v2-line bg-v2-card px-6 py-9 shadow-[0_1px_2px_rgba(33,31,28,0.04),0_10px_32px_rgba(33,31,28,0.06)] sm:px-12 sm:py-12">
          {/* Cabeçalho: wordmark + meta do período */}
          <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3 border-b border-v2-line pb-6">
            <V2Logo size={22} />
            <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-v2-ink-3">
              {KIND_LABEL[report.kind]}
              <span className="mx-2 text-v2-faint">·</span>
              {fmt(report.periodStart)} — {fmt(report.periodEnd)}
            </div>
          </header>

          {/* Título */}
          <h1 className="mt-8 font-display text-[30px] font-[600] leading-[1.18] tracking-[-0.02em] text-v2-ink sm:text-[36px]">
            {report.title}
          </h1>
          <div className="mt-5 h-px w-12 bg-v2-green" aria-hidden="true" />

          {/* Corpo em markdown */}
          <article
            className={[
              "prose mt-7 max-w-none",
              // corpo
              "text-[15.5px] leading-[1.75] text-v2-ink-2",
              "prose-p:my-[0.9em]",
              // headings em Fraunces, escala editorial contida
              "prose-headings:font-display prose-headings:tracking-[-0.015em] prose-headings:text-v2-ink",
              "prose-h1:text-[24px] prose-h1:font-[600]",
              "prose-h2:mt-[1.8em] prose-h2:text-[21px] prose-h2:font-[600]",
              "prose-h3:mt-[1.5em] prose-h3:text-[17px] prose-h3:font-[650]",
              // ênfases e links
              "prose-strong:font-[650] prose-strong:text-v2-ink",
              "prose-a:font-medium prose-a:text-v2-green prose-a:no-underline hover:prose-a:text-v2-green-hover",
              // citações (voz de cidadão): serifa itálica, fio verde
              "prose-blockquote:border-l-2 prose-blockquote:border-v2-green-border prose-blockquote:pl-4",
              "prose-blockquote:font-display prose-blockquote:text-[15px] prose-blockquote:font-normal prose-blockquote:italic prose-blockquote:text-v2-ink",
              // listas, tabelas, código, hr
              "prose-li:my-[0.35em] prose-li:marker:text-v2-faint",
              "prose-table:text-[13.5px] prose-th:border-b prose-th:border-v2-line-strong prose-th:text-left prose-th:font-[650] prose-th:text-v2-ink prose-td:border-b prose-td:border-v2-line prose-td:py-2",
              "prose-code:rounded prose-code:bg-v2-track prose-code:px-1.5 prose-code:py-0.5 prose-code:font-mono prose-code:text-[13px] prose-code:text-v2-ink prose-code:before:content-none prose-code:after:content-none",
              "prose-hr:my-9 prose-hr:border-v2-line",
            ].join(" ")}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.markdown}</ReactMarkdown>
          </article>

          {/* Rodapé discreto */}
          <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-v2-line pt-5 font-mono text-[10.5px] tracking-[0.06em] text-v2-faint">
            <span>gerado pelo inPol</span>
            <span>inpolapp.com</span>
          </footer>
        </div>

        {/* Assinatura fora da folha — some na impressão junto com o frame padding */}
        <div className="mt-6 text-center font-mono text-[10.5px] text-v2-faint print:hidden">
          Inteligência Política Municipal
        </div>
      </div>
    </div>
  );
}
