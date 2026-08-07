-- Varredura do Instagram: de 12x/dia para 1x/dia.
--
-- MOTIVO (medido, não estimado). Em 01–06/08 o Apify consumiu ~US$ 0,90/dia e queimou o
-- crédito grátis de US$ 5 em 5 dias e meio — projeção de ~US$ 27/mês. O retorno não
-- justificava: 13 perfis varridos 12x por dia renderam 45 posts no total. Perfil de
-- político municipal publica 1 a 2 vezes por dia; varrer de 2 em 2 horas relia o mesmo
-- conteúdo e pagava de novo por ele.
--
-- Cadência escolhida: 07:00 UTC (04:00 BRT), uma hora antes do relatório diário
-- (`inpol-report-daily`, 08:00 UTC) — assim a varredura entrega o dia anterior fechado e
-- o relatório sai com o dado fresco. Quando o gabinete precisar de um perfil específico
-- fora do horário, existe varredura manual por alvo (`scanInstagramTargetNow`), que não
-- passa pela guarda de reentrância de `scanInstagramForOrg`.
--
-- Complemento em código: `MIN_HORAS_ENTRE_SCANS` em src/lib/instagram.server.ts. O Apify
-- registrou DUAS execuções por horário de cron, com 1 segundo de diferença e origin=API,
-- dobrando a conta. Um único cron, uma única org e uma única chamada ao scraper no
-- código — a origem da segunda invocação não foi identificada. Como a causa é
-- desconhecida, a defesa é tornar a duplicata inofensiva em vez de esperar achá-la.

select cron.alter_job(
  (select jobid from cron.job where jobname = 'inpol-scan-instagram'),
  schedule => '0 7 * * *'
);
