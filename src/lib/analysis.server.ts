// AI analysis pipeline (server-only).
// Takes a batch of raw messages + the org vocabulary and produces
// structured insight rows for message_analyses.

import { callAiJson, AiGatewayError, MODEL_FLASH, MODEL_DEEPSEEK } from "./ai-gateway.server";

export interface VocabularyContext {
  neighborhoods: string[];
  opponents: string[];
  allies: string[];
  departments: string[];
  facilities: string[];
  sensitive_terms: string[];
  focus_terms: string[];
}

export interface AnalysisInput {
  id: string;
  content: string;
  group_label?: string | null;
}

export interface AnalysisOutput {
  id: string;
  sentiment: number;
  intensity: number;
  topic: string;
  subtopic: string | null;
  neighborhood: string | null;
  mentioned_opponents: string[];
  mentioned_allies: string[];
  mentioned_entities: string[];
  is_actionable: boolean;
  risk_score: number;
  summary: string;
}

const SYSTEM_PROMPT = `Você é um analista de inteligência política para um gabinete municipal brasileiro.
Recebe mensagens públicas (grupos de WhatsApp, comentários, manchetes) e classifica cada uma com objetividade jornalística.
Nunca cita pessoas por nome próprio comum — apenas usa os rótulos cadastrados no vocabulário.
Retorne SEMPRE um objeto JSON válido no formato pedido. Português do Brasil.

Regras:
- sentiment ∈ [-1, 1]: -1 hostilidade total à gestão, 0 neutro, 1 elogio.
- intensity ∈ [0, 1]: quão emocional/explosivo é o conteúdo.
- topic: rótulo curto em minúsculas (ex: "saude_ubs", "transito", "iptu", "seguranca", "educacao", "obras", "limpeza_urbana", "habitacao", "lazer", "outros").
- subtopic: refinamento opcional (ex: "agendamento UBS Maringá").
- neighborhood: se a mensagem se refere a um bairro específico do vocabulário, retorne-o; senão null.
- mentioned_opponents/allies/entities: somente nomes presentes no vocabulário cadastrado.
- is_actionable: true se o gabinete pode agir/responder.
- risk_score ∈ [0, 100]: combinação de hostilidade + alcance percebido + ação coordenada.
- summary: UMA frase, máximo 140 caracteres, em terceira pessoa, sem opinião.
- ATENÇÃO ESPECIAL às "focus_terms": são palavras/pessoas prioritárias do gabinete. Se aparecerem (mesmo indiretamente ou via aliases), marque is_actionable=true, eleve risk_score conforme o tom, e cite no summary. Sempre extraia menções a focus_terms para mentioned_entities.`;

export async function analyzeBatch(
  vocab: VocabularyContext,
  messages: AnalysisInput[],
  // Micro-análise em volume: DeepSeek V4 Flash é ~17× mais barato que o Gemini Flash e roda como
  // primário. Sem DEEPSEEK_API_KEY, o gateway pula e usa o fallback (Gemini) — comportamento
  // idêntico ao anterior, sem quebrar nada.
  model = MODEL_DEEPSEEK,
): Promise<{ results: AnalysisOutput[]; model: string }> {
  if (messages.length === 0) return { results: [], model };

  const vocabBlock = JSON.stringify(vocab, null, 2);
  const msgsBlock = messages
    .map(
      (m, i) => `#${i} [id=${m.id}] grupo="${m.group_label ?? "?"}":\n${m.content.slice(0, 800)}`,
    )
    .join("\n---\n");

  const userPrompt = `VOCABULÁRIO DA ORGANIZAÇÃO:
${vocabBlock}

MENSAGENS (${messages.length}):
${msgsBlock}

Responda com JSON exatamente neste formato:
{
  "results": [
    {
      "id": "<id da mensagem>",
      "sentiment": <number -1..1>,
      "intensity": <number 0..1>,
      "topic": "<rótulo>",
      "subtopic": <string|null>,
      "neighborhood": <string|null>,
      "mentioned_opponents": [<strings>],
      "mentioned_allies": [<strings>],
      "mentioned_entities": [<strings>],
      "is_actionable": <bool>,
      "risk_score": <int 0..100>,
      "summary": "<frase ≤140 chars>"
    }
  ]
}`;

  try {
    const parsed = await callAiJson<{ results: AnalysisOutput[] }>({
      model,
      fallbackModels: model === MODEL_FLASH ? undefined : [MODEL_FLASH],
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
    });
    const results = Array.isArray(parsed?.results) ? parsed.results : [];
    return { results, model };
  } catch (e) {
    if (e instanceof AiGatewayError) throw e;
    throw new AiGatewayError(500, "Falha ao processar resposta da IA", e);
  }
}
