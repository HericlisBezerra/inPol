# Roteamento e domínios — redesign v2

O redesign v2 é composto por **dois produtos separados**, que no cutover vão para **domínios distintos**.
A separação já está refletida na estrutura de pastas de `src/routes/`.

## Mapa produto → pasta → domínio

| Produto                            | Pasta (`src/routes/`) | Rotas hoje (parallel-run)                                  | Domínio no cutover                                                                                    |
| ---------------------------------- | --------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Site público** (vendas + legais) | `site/`               | `/site`, `/site/privacidade`, `/site/termos`, `/site/lgpd` | **domínio principal** — `inpolapp.com` (mapeado para a raiz: `/`, `/privacidade`, `/termos`, `/lgpd`) |
| **Painel do cliente** (app)        | `v2/` + auth solta    | `/v2/*`, `/entrar`, `/sair`, `/comecar`                    | **subdomínio** — `dash.inpol…` (mapeado para a raiz do subdomínio: `/`, `/entrar`, …)                 |

- **Produto site** (`site/`): tema claro/cream (`.v2-site`), header/footer próprios por página, sem shell de app.
  Não depende de auth nem de backend. É estático o suficiente para servir da raiz do domínio principal.
- **Produto app** (`v2/` + `entrar`/`sair`/`comecar`): tema cream (`.v2-root`), shell compartilhado (topnav + ⌘K +
  notificações). As telas de auth ficam **fora** do layout `v2/` (tela cheia, sem topnav) mas pertencem ao produto app.

## Como o split de domínio acontece (cutover)

O split é por **hostname**, não por pasta de build — não é preciso quebrar o codebase em dois apps:

- No cutover (na Lovable / hosting), configurar roteamento por host:
  - `inpolapp.com` → serve o produto **site** na raiz.
  - `dash.inpol…` → serve o produto **app** na raiz.
- Os prefixos `/site` e `/v2` de hoje são **andaime de parallel-run** (rodar novo e antigo lado a lado sem
  sobrepor o `/app/` atual). No cutover cada produto é "promovido" para a raiz do seu domínio.

## Regras de negócio do site (decisão 2026-07-18)

- **Sem Stripe e sem preços** na página de vendas. Todos os planos exibem **"Sob consulta"**.
- CTAs de vendas/demonstração ("Agendar demonstração", "Falar com vendas") apontam para `#` por enquanto
  (destino real definido em refino posterior). Links internos reais (Entrar, Ver o painel, legais) seguem funcionais.
