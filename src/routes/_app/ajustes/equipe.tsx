import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Rota legada mantida como redirecionamento.
 *
 * A tela mudou de lugar na reorganização de Ajustes por intenção, mas /ajustes/equipe
 * ainda circula em links salvos, no histórico do navegador e em telas fora de
 * src/routes/_app/ajustes. Apagar a rota quebraria esses caminhos sem aviso — o
 * redirect resolve sem exigir mudança em nenhum arquivo de terceiros.
 */
export const Route = createFileRoute("/_app/ajustes/equipe")({
  beforeLoad: () => {
    throw redirect({ to: "/ajustes/acesso/equipe", replace: true });
  },
});
