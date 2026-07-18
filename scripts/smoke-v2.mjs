/**
 * SSR smoke test for the v2 redesign — hits every v2/site/auth route on the running
 * dev server and asserts it renders: HTTP 200, an expected content marker present, and
 * no error/not-found boundary leaked. Zero external deps.
 *
 *   Usage: BASE=http://localhost:5177 bun scripts/smoke-v2.mjs
 */
const BASE = process.env.BASE || "http://localhost:5177";

/** [path, marker that must appear in the SSR HTML] */
const ROUTES = [
  ["/v2", "Bom dia, Marina"],
  ["/v2/alertas", "Manchete iminente"],
  ["/v2/alertas/vila-rami", "progresso do roteiro"],
  ["/v2/territorio", "Território"],
  ["/v2/sinais", "Sinais"],
  ["/v2/relatorios", "Relatórios"],
  ["/v2/relatorios/diario-18-jul", "Relatório"],
  ["/v2/rede", "Adversários"],
  ["/v2/camara", "Câmara"],
  ["/v2/camara/joao-parimoschi", "Parimoschi"],
  ["/v2/modo-eleicao", "Eleição"],
  ["/v2/ajustes", "Ajustes"],
  ["/v2/ajustes/equipe", "Equipe"],
  ["/v2/ajustes/whatsapp", "WhatsApp"],
  ["/v2/ajustes/fontes", "Fontes"],
  ["/v2/ajustes/organizacoes", "Organiza"],
  ["/v2/ajustes/eleitos", "TSE"],
  ["/v2/ajustes/notificacoes", "Notifica"],
  ["/v2/ajustes/auditoria", "Auditoria"],
  ["/v2/admin", "PLATAFORMA"],
  ["/entrar", "Inpol"],
  ["/sair", "Entrar novamente"],
  ["/comecar", "organiza"],
  ["/site", "Agendar demonstração"],
  ["/site/privacidade", "Privacidade"],
  ["/site/termos", "Termos de uso"],
  ["/site/lgpd", "titular"],
];

const ERROR_MARKERS = [
  "Esta tela não carregou",
  "Página não encontrada",
  "Internal Server Error",
  "did not match",
];

let pass = 0;
const failures = [];

for (const [path, marker] of ROUTES) {
  try {
    const res = await fetch(BASE + path, { headers: { Accept: "text/html" } });
    const html = await res.text();
    const low = html.toLowerCase();
    const problems = [];
    if (res.status !== 200) problems.push(`status ${res.status}`);
    if (!low.includes(marker.toLowerCase())) problems.push(`missing marker "${marker}"`);
    for (const em of ERROR_MARKERS) {
      if (low.includes(em.toLowerCase())) problems.push(`error boundary "${em}"`);
    }
    if (problems.length) {
      failures.push([path, problems.join("; ")]);
      console.log(`✗ ${path} — ${problems.join("; ")}`);
    } else {
      pass++;
      console.log(`✓ ${path}`);
    }
  } catch (e) {
    failures.push([path, String(e)]);
    console.log(`✗ ${path} — ${e}`);
  }
}

console.log(`\n${pass}/${ROUTES.length} routes OK`);
if (failures.length) {
  console.log(`${failures.length} FAILED`);
  process.exit(1);
}
