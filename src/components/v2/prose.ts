/**
 * Tipografia editorial dos textos longos gerados por IA (relatório periódico, relatório de
 * sessão da Câmara).
 *
 * POR QUÊ existir como constante compartilhada: esses textos são lidos em voz alta numa reunião,
 * projetados. A hierarquia (h2/h3), o respiro entre parágrafos e o tratamento de citação são o que
 * permite achar a linha certa enquanto alguém fala. Duas telas com tratamentos diferentes fariam o
 * mesmo tipo de conteúdo parecer dois produtos.
 */
export const PROSE = [
  "prose max-w-none",
  "text-[15px] leading-[1.75] text-v2-ink-2",
  "prose-p:my-[0.9em]",
  "prose-headings:font-display prose-headings:tracking-[-0.015em] prose-headings:text-v2-ink",
  "prose-h1:text-[22px] prose-h1:font-[600] prose-h1:mt-0",
  "prose-h2:mt-[1.6em] prose-h2:text-[19px] prose-h2:font-[600]",
  "prose-h3:mt-[1.4em] prose-h3:text-[16px] prose-h3:font-[650]",
  "prose-strong:font-[650] prose-strong:text-v2-ink",
  "prose-a:font-medium prose-a:text-v2-green prose-a:no-underline hover:prose-a:text-v2-green-hover",
  "prose-blockquote:border-l-2 prose-blockquote:border-v2-green-border prose-blockquote:pl-4",
  "prose-blockquote:font-display prose-blockquote:text-[15px] prose-blockquote:font-normal prose-blockquote:italic prose-blockquote:text-v2-ink",
  "prose-li:my-[0.35em] prose-li:marker:text-v2-faint",
  "prose-table:text-[13.5px] prose-th:border-b prose-th:border-v2-line-strong prose-th:text-left prose-th:font-[650] prose-th:text-v2-ink prose-td:border-b prose-td:border-v2-line prose-td:py-2",
  "prose-code:rounded prose-code:bg-v2-track prose-code:px-1.5 prose-code:py-0.5 prose-code:font-mono prose-code:text-[13px] prose-code:text-v2-ink prose-code:before:content-none prose-code:after:content-none",
  "prose-hr:my-9 prose-hr:border-v2-line",
].join(" ");
