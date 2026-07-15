## Situação atual

Duas organizações coexistem:

- **Prefeitura de Jundiaí (DEMO)** — populada pela função `enter_demo_mode()` com **dados fictícios de amostra** (mensagens, alertas, relatórios, agregados) misturados a **dados curados úteis** (adversários, vocabulário, lideranças, portais).
- **[GM] Jundiaí** — organização real, com 3 grupos de WhatsApp conectados, mas ainda **vazia de contexto** (0 adversários, 0 lideranças, 0 portais de imprensa, só 5 termos de vocabulário, 0 eleitos importados).

## O que faz sentido migrar

Copiar só o que é **conhecimento reutilizável sobre Jundiaí**, descartando o que é amostra fabricada:

| Tabela | Copiar? | Motivo |
|---|---|---|
| `org_adversaries` (6) | Sim | Parimoschi, Daniel Lima, Bloco Jundiaí Justa, Tribuna — atores políticos reais |
| `org_vocabulary` (9) | Sim (deduplicando) | Bairros, opositores, equipamentos, domínios de notícia |
| `tracked_members` (15) | **Não** por padrão | São nomes inventados ("Dona Cida", "Seu Joaquim"). Perguntar antes |
| `elected_officials` | N/A | Já existem 283 no [GM], DEMO não tem |
| Portais de notícia (news_domain no vocab) | Sim | Tribuna, Bom Dia Jundiaí — reais |

## O que **não** migrar

- `raw_messages` (600) — texto fabricado, contaminaria o histórico real
- `message_analyses` (600) — análises sobre texto fake
- `daily_aggregates` (1.080) — agregados sobre mensagens fake
- `alerts` (9), `reports` (14), `topics` (12) — narrativas fabricadas
- `whatsapp_groups` / `whatsapp_instances` do DEMO — o [GM] já tem os grupos reais conectados

Copiar qualquer um destes faria o dashboard do [GM] mostrar sentimento, tendências e crises que **não existem**.

## Plano de execução

1. **Migração idempotente** (script SQL executado uma vez):
   - `INSERT ... SELECT` de `org_adversaries` do DEMO para [GM], com `ON CONFLICT DO NOTHING` por `(org_id, display_name)`.
   - `INSERT ... SELECT` de `org_vocabulary` (todos os 9 registros, incluindo `news_domain`), deduplicando por `(org_id, kind, value)`.
   - Deixar `tracked_members`, `alerts`, `reports`, `raw_messages` fora.

2. **Verificação pós-migração** — contar linhas em `org_adversaries` e `org_vocabulary` do [GM] e confirmar que o painel "Adversários" e "Fontes → Imprensa" mostram os itens.

3. **Encerrar o DEMO** (opcional, decisão sua):
   - Manter o DEMO como sandbox para novos usuários testarem, **ou**
   - Arquivar/ocultar da lista de organizações do seu usuário para não confundir na barra lateral.

## Perguntas antes de executar

1. Copio também os 15 `tracked_members` fictícios ("Dona Cida", "Seu Joaquim"…) como placeholders para você editar, ou deixo essa lista vazia para você cadastrar apenas lideranças reais?
2. Depois de migrar, quer que eu **oculte o DEMO** da sua barra lateral (removendo você de `org_members` daquela org), ou prefere mantê-lo visível?
