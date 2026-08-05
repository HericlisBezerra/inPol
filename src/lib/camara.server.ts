// Análise de UMA sessão da Câmara (server-only).
//
// PRINCÍPIO QUE REGE ESTE ARQUIVO: número nunca passa por IA, citação nunca é parafraseada.
//   • Tudo que é contável — falas, palavras, tempo de tribuna, quem dominou, quem não falou,
//     menções entre vereadores — é agregado aqui em JS sobre `camara_speeches` e gravado em
//     `camara_sessions.analysis`. A IA recebe esses números prontos; nunca os produz.
//   • As citações que a IA usa vêm do `content` literal da fala, com o `at_seconds` junto, para
//     o relatório linkar o minuto exato do vídeo (`?v=<video_id>&t=<segundos>`).
//   • A IA escreve só a NARRATIVA: o que foi debatido, quem defendeu o quê, o que atinge a
//     gestão, o que exige resposta.
//
// A transcrição é FALA, não ata: ela registra o que foi dito, não o que foi votado ou decidido.
// O prompt proíbe explicitamente afirmar resultado/encaminhamento que não esteja no texto.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAi, MODEL_PRO, MODEL_FLASH, MODEL_DEEPSEEK } from "./ai-gateway.server";
import { fetchAllPages } from "./pg-paginate";
import {
  agregar,
  hhmmss,
  montarFalasPrompt,
  montarRelatorioFallback,
  normalizar,
  type FalaRow,
  type PessoaRow,
  type SessaoRow,
  type SessionAnalysis,
  type SessionAnalysisResult,
} from "./camara-analysis";

// `types.ts` é auto-gerado e ainda não conhece `camara_sessions`/`camara_speeches`/`org_people`
// (e não pode ser editado). O typegen recusa `.from("camara_speeches")` — este cast é o ÚNICO
// ponto de escape do arquivo. `.returns<T[]>()` não ajuda aqui (o builder já é `any`), então a
// tipagem volta na SAÍDA: cada `data` lido é anotado com a linha declarada logo abaixo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ver comentário acima
const bruto = supabaseAdmin as any;

/* ─────────────────────────── entrada pública ─────────────────────────── */

/**
 * Analisa UMA sessão: agrega os números, pede a narrativa à IA e grava
 * `analysis` + `markdown` + `model_version` + `analyzed_at` em `camara_sessions`.
 *
 * Idempotente: reanalisar sobrescreve. A ingestão (`camara.functions.ts`) é quem cria a sessão
 * e as falas — aqui nada é criado, só lido e analisado.
 */
export async function analyzeSession(
  orgId: string,
  sessionId: string,
): Promise<SessionAnalysisResult> {
  const colsSessao: string =
    "id, org_id, session_date, numero, legislatura, tipo, title, video_url, video_id, duration_seconds";
  // O cast `bruto` apaga a tipagem da query (o typegen não conhece a tabela), então a tipagem
  // volta na SAÍDA: cada resultado é anotado explicitamente com a linha declarada acima.
  const { data: sessoes, error: erroSessao } = await bruto
    .from("camara_sessions")
    .select(colsSessao)
    .eq("org_id", orgId) // multi-tenant: o id sozinho nunca basta
    .eq("id", sessionId)
    .limit(1);
  if (erroSessao) throw new Error(erroSessao.message);
  const sessao = (sessoes as SessaoRow[] | null)?.[0];
  if (!sessao) throw new Error("Sessão não encontrada nesta organização.");

  const colsFalas: string =
    "id, order_index, at_seconds, speaker_name, speaker_party, speaker_role, person_id, content, word_count, topic, sentiment, risk_score, summary";
  const falas = await fetchAllPages<FalaRow>((from, to) =>
    bruto
      .from("camara_speeches")
      .select(colsFalas)
      .eq("org_id", orgId)
      .eq("session_id", sessionId)
      .order("order_index", { ascending: true }) // ordem estável E cronológica
      .range(from, to),
  );
  if (falas.length === 0) throw new Error("Sessão sem falas ingeridas — nada a analisar.");

  // Fichas: `stance` dos falantes (para a IA saber quem é da base e quem é oposição, sem
  // adivinhar) e a lista de vereadores da org (para saber quem NÃO falou).
  const personIds = [...new Set(falas.map((f) => f.person_id).filter((x): x is string => !!x))];
  const colsPessoa: string = "id, display_name, stance, party, role";
  const [respFalantes, respVereadores] = await Promise.all([
    personIds.length
      ? bruto.from("org_people").select(colsPessoa).eq("org_id", orgId).in("id", personIds)
      : Promise.resolve({ data: [] }),
    bruto.from("org_people").select(colsPessoa).eq("org_id", orgId).ilike("role", "vereador%"), // `role` vem do TSE (`cargo_nome`), em caixa alta
  ]);
  const fichasFalantes = (respFalantes.data ?? []) as PessoaRow[];
  const fichasVereadores = (respVereadores.data ?? []) as PessoaRow[];

  const pessoasPorId = new Map<string, PessoaRow>(fichasFalantes.map((p) => [p.id, p]));
  const agregados = agregar(falas, pessoasPorId);
  agregados.cobertura.duracao_registrada_seconds = sessao.duration_seconds;

  // Quem não falou: só é afirmável se a org tem cadastro de vereadores. Sem base, fica `null` —
  // lista vazia significaria "todos falaram", que é uma afirmação que não podemos sustentar.
  if (fichasVereadores.length > 0) {
    const falantesIds = new Set(personIds);
    const falantesNomes = new Set(falas.map((f) => normalizar(f.speaker_name)));
    agregados.participacao.nao_falaram = fichasVereadores
      .filter((p) => !falantesIds.has(p.id) && !falantesNomes.has(normalizar(p.display_name)))
      .map((p) => ({ person_id: p.id, nome: p.display_name, partido: p.party }));
    agregados.participacao.base_nao_falaram = `org_people (role ~ vereador): ${fichasVereadores.length} cadastrados`;
  }

  const { itens: falasPrompt, recorte } = montarFalasPrompt(falas);

  const analysis: SessionAnalysis = {
    versao: 1,
    sessao: {
      id: sessao.id,
      data: sessao.session_date,
      numero: sessao.numero,
      legislatura: sessao.legislatura,
      tipo: sessao.tipo,
      title: sessao.title,
      video_id: sessao.video_id,
      video_url: sessao.video_url,
    },
    ...agregados,
    recorte,
    modo: "ia",
    gerado_em: new Date().toISOString(),
  };

  const linkMinuto = (s: number): string | null =>
    sessao.video_id
      ? `https://www.youtube.com/watch?v=${sessao.video_id}&t=${Math.floor(s)}`
      : null;

  const titulo = sessao.title;
  const avisoRecorte = recorte.aplicado
    ? `\n\n⚠️ RECORTE: esta sessão excedeu o teto de contexto. ${recorte.falas_integrais} falas vão na íntegra e ${recorte.falas_resumidas} vêm truncadas (marcadas com "[fala truncada]"). Diga isso ao leitor em uma linha logo abaixo do título e NÃO analise o conteúdo das falas truncadas além do que está visível.`
    : "";

  let markdown: string;
  let modelVersion: string;
  let degraded = false;
  try {
    const resp = await callAi({
      model: MODEL_PRO,
      fallbackModels: [MODEL_FLASH, MODEL_DEEPSEEK], // PRO → Flash → DeepSeek → determinístico
      temperature: 0.4,
      maxTokens: 8000,
      timeoutMs: 120_000, // sessão inteira é prompt grande; 90s do relatório de período é curto aqui
      messages: [
        {
          role: "system",
          content:
            "Você é o analista-chefe de inteligência política de um gabinete municipal brasileiro. Escreve em português do Brasil, markdown limpo, tom sério, técnico e direto — briefing de gabinete, não jornalismo de opinião. REGRAS INEGOCIÁVEIS: (1) Você recebe a transcrição de uma sessão da Câmara e os agregados JÁ CALCULADOS. Nunca recalcule, arredonde ou invente número — se for citar quantidade, tempo de tribuna, percentual ou contagem, copie do bloco `agregados`. (2) Toda citação é LITERAL, entre aspas, exatamente como está no campo `texto` da fala, seguida do marcador de tempo daquela fala. Nunca parafraseie dentro de aspas. (3) A transcrição é FALA, não ata: ela registra o que foi dito, não o que foi votado, aprovado, rejeitado ou encaminhado. É PROIBIDO afirmar votação, resultado, placar, aprovação, rejeição ou encaminhamento que não esteja dito explicitamente no texto — se o desfecho não aparece, escreva que a transcrição não registra o desfecho. (4) Não atribua intenção oculta nem acordo de bastidor: descreva o que foi dito e o efeito prático. Hipótese, quando útil, vai marcada como hipótese a verificar. (5) Falante marcado como `stance` vem do cadastro do gabinete (aliado/adversário/neutro), é dado de ficha e não julgamento seu — use, mas não trate como prova de posição na sessão; a posição na sessão sai do que a pessoa disse.",
        },
        {
          role: "user",
          content: `Escreva a análise da sessão abaixo para o gabinete, usando EXCLUSIVAMENTE os dados fornecidos.${avisoRecorte}

Estruture assim (mantenha exatamente estes títulos):

# ${titulo}

## 🎯 Resumo executivo
Máximo 5 linhas. Diga: (a) o que essa sessão foi, (b) o assunto que dominou, (c) o ponto mais sensível para a gestão, (d) se há algo que não pode esperar.

## 📊 A sessão em números
Interprete os \`agregados\` — quem dominou a tribuna, concentração das falas, distribuição por partido, quem não falou (só se \`participacao.nao_falaram\` não for nulo). Copie os números do bloco; não recalcule. Se \`nao_falaram\` for nulo, diga em uma linha que a org não tem cadastro de vereadores suficiente para essa leitura.

## 🔥 O que foi debatido — por tema
Agrupe o debate em 4 a 8 temas. Para cada um: o que estava em jogo, quem puxou, como evoluiu na sessão, e **pelo menos uma citação literal** entre aspas com o marcador de tempo. Se um tema começou e não teve desfecho registrado, diga isso.

## 🗣️ Posição de cada vereador relevante
Um bloco por vereador com peso na sessão (use \`agregados.por_vereador\` para saber quem tem peso). Em cada bloco: qual posição ele defendeu, contra o quê ou a favor do quê, **citação literal com o minuto**, e se ele mudou de tom ao longo da sessão. Vereador que só fez pedido protocolar ou aparte curto entra em uma linha só.

## 🎯 O que atinge a gestão
Críticas, cobranças, denúncias e insinuações dirigidas à Prefeitura, a secretarias ou a serviços municipais. Para cada uma: quem disse, citação literal com o minuto, o que exatamente foi alegado, e qual o grau de exposição (é fato verificável, é queixa de bairro, é acusação grave?). Separe o que é reclamação de serviço do que é ataque político.

## 🤝 O que favorece a gestão
Elogios, defesas, entregas reconhecidas e vereadores que sustentaram a posição do governo. Mesma exigência: citação literal com o minuto. Se não houve nada nesse sentido, diga em uma linha — não invente equilíbrio.

## 🔗 Quem citou quem
Analise \`agregados.mencoes\` (contagem exata de menções nominais entre oradores). Diga o que o padrão mostra: alinhamento, embate direto, isolamento. Se o array estiver vazio, diga em uma linha que não houve menção nominal detectável e siga.

## 🚨 O que exige resposta do gabinete
Divida por prazo, e cada item precisa apontar a fala que o originou (com o minuto):
- **Hoje/amanhã** — o que vira notícia ou cobrança pública se ficar sem resposta
- **Nesta semana** — o que precisa de dado, ofício ou posicionamento preparado
- **Monitorar** — o que ainda é sinal fraco mas pode escalar na próxima sessão

## 📌 O que a transcrição NÃO diz
Liste explicitamente o que ficou em aberto: matérias citadas sem desfecho registrado, promessas sem prazo, números citados em plenário que precisam de conferência na fonte oficial. Esta seção é obrigatória — é o que impede o gabinete de tratar fala como ata.

REGRAS DE ESCRITA:
- Densidade > brevidade. Mínimo ~1500 palavras.
- Nome de vereador, partido, secretaria e bairro em **negrito**.
- Toda citação entre aspas, literal, com o marcador de tempo do campo \`t\` da fala.
- Emojis só nos títulos das seções.

AGREGADOS (números exatos, contados — use estes, não recalcule):
\`\`\`json
${JSON.stringify(
  {
    sessao: analysis.sessao,
    cobertura: analysis.cobertura,
    por_vereador: analysis.por_vereador,
    por_partido: analysis.por_partido,
    participacao: analysis.participacao,
    mencoes: analysis.mencoes,
    mencoes_metodo: analysis.mencoes_metodo,
    recorte: analysis.recorte,
  },
  null,
  2,
)}
\`\`\`

TRANSCRIÇÃO (ordem cronológica; \`t\` é o marcador de tempo do vídeo):
\`\`\`json
${JSON.stringify(falasPrompt)}
\`\`\``,
        },
      ],
    });
    const texto = (resp.text ?? "").trim();
    // Saída fina ou truncada (teto de tokens, stub de modelo) conta como falha → determinístico.
    if (texto.length < 800 || !texto.includes("#")) {
      throw new Error(`Saída da IA muito curta/incompleta (${texto.length} chars).`);
    }
    markdown = texto;
    modelVersion = resp.model;
  } catch (e) {
    console.error(
      `[camara] narrativa por IA falhou (org ${orgId}, sessão ${sessionId}) — usando fallback determinístico:`,
      e,
    );
    analysis.modo = "fallback";
    markdown = montarRelatorioFallback(analysis, falas, linkMinuto);
    modelVersion = "fallback-deterministico";
    degraded = true;
  }

  const { error: erroUpdate } = await bruto
    .from("camara_sessions")
    .update({
      analysis,
      markdown,
      model_version: modelVersion,
      analyzed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", orgId)
    .eq("id", sessionId);
  if (erroUpdate) throw new Error(erroUpdate.message);

  await supabaseAdmin.from("audit_log").insert({
    org_id: orgId,
    action: `camara.session.analyzed${degraded ? ".degraded" : ""}`,
    target_kind: "camara_session",
    target_id: sessionId,
  });

  return { sessionId, markdown, modelVersion, degraded, analysis };
}
