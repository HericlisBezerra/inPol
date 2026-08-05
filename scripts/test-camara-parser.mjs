// Parser da Câmara — importado direto do módulo puro (sem Supabase, sem env).
const mod = await import("../src/lib/camara-parser.ts");
const { parseTranscript, extrairVideoId, resolverPessoa, normalizarNome } = mod;

let pass = 0,
  fail = 0;
const ok = (c, m) => (c ? (pass++, console.log("✓", m)) : (fail++, console.log("✗", m)));

/* ── 1. fala normal de vereador ─────────────────────────────────────────── */
{
  const r = parseTranscript("[00:21:40] Ver. Henrique do Cardume (PSOL): Muito bem, obrigado.");
  const f = r.falas[0];
  ok(r.falas.length === 1 && r.avisos.length === 0, "fala normal: 1 fala, 0 avisos");
  ok(f.atSeconds === 21 * 60 + 40, "fala normal: timestamp em segundos (" + f.atSeconds + ")");
  ok(f.speakerName === "Henrique do Cardume", "fala normal: nome sem o prefixo Ver.");
  ok(f.speakerParty === "PSOL", "fala normal: partido extraído");
  ok(f.speakerRole === "vereador", "fala normal: papel vereador");
  ok(f.content === "Muito bem, obrigado." && f.wordCount === 3, "fala normal: texto e palavras");
}

/* ── 2. presidente ──────────────────────────────────────────────────────── */
{
  const r = parseTranscript("[01:02:03] Pres. Edicarlos Vieira (UNIÃO): Registrem a presença.");
  const f = r.falas[0];
  ok(f.speakerRole === "presidente", "presidente: papel presidente");
  ok(f.speakerName === "Edicarlos Vieira", "presidente: nome sem o prefixo Pres.");
  ok(f.speakerParty === "UNIÃO", "presidente: partido com acento preservado");
  ok(f.atSeconds === 3723, "presidente: HH:MM:SS convertido (" + f.atSeconds + ")");
}

/* ── 3. convidado (com aposto e marca) ──────────────────────────────────── */
{
  const r = parseTranscript(
    "[00:19:33] Giovana Silva Fernandes — Colégio MOVA (convidada): Boa tarde a todos.",
  );
  const f = r.falas[0];
  ok(f.speakerRole === "convidado", "convidado: papel convidado pela marca (convidada)");
  ok(f.speakerName === "Giovana Silva Fernandes", "convidado: aposto fora do nome");
  ok(f.speakerParty === null, "convidado: sem partido");
  ok(r.avisos.length === 0, "convidado: sem avisos");
}

/* ── 3b. convidado genérico: o aposto É a identificação ─────────────────── */
{
  const r = parseTranscript(
    "[00:00:00] Convidado — moção dos bancos (fechamento de agências): Obrigado.",
  );
  const f = r.falas[0];
  ok(f.speakerRole === "convidado", "convidado genérico: papel convidado");
  ok(
    f.speakerName === "Convidado — moção dos bancos",
    "convidado genérico: aposto mantido no nome (" + f.speakerName + ")",
  );
  ok(
    f.speakerParty === null,
    "convidado genérico: descrição em caixa baixa NÃO vira partido (" + f.speakerParty + ")",
  );
}

/* ── 4. nome com barra ──────────────────────────────────────────────────── */
{
  const r = parseTranscript("[00:10:00] Ver. Zé Dias / José Dias (REP): Presidente.");
  const f = r.falas[0];
  ok(f.speakerName === "Zé Dias", "barra: nome principal é o primeiro");
  ok(
    f.speakerNames.length === 2 && f.speakerNames[1] === "José Dias",
    "barra: as duas grafias preservadas",
  );
  ok(f.speakerParty === "REP", "barra: partido extraído mesmo com barra");
  // A ficha pode estar cadastrada com QUALQUER uma das duas grafias.
  const fichas = [{ id: "p1", display_name: "JOSE DIAS" }];
  ok(resolverPessoa(f.speakerNames, fichas).personId === "p1", "barra: casa pela 2ª grafia");
}

/* ── 5. linha malformada não some em silêncio ───────────────────────────── */
{
  const r = parseTranscript(
    [
      "[00:01:00] Ver. Fulano de Tal (PL): Primeira.",
      "[00:02:00 Ver. Beltrano (PT): cabeçalho quebrado",
      "texto solto sem fala anterior",
    ].join("\n"),
  );
  ok(r.falas.length === 1, "malformada: só a fala válida entrou");
  ok(
    r.avisos.some((a) => a.includes("linha 2")),
    "malformada: cabeçalho quebrado virou aviso",
  );
  // A 3ª linha é continuação legítima da 1ª fala (tem fala anterior), então NÃO é aviso.
  ok(
    r.falas[0].content.endsWith("texto solto sem fala anterior"),
    "malformada: linha seguinte anexada à fala válida",
  );
}

/* ── 5b. texto antes da primeira fala ───────────────────────────────────── */
{
  const r = parseTranscript("Transcrição gerada por AssemblyAI\n\n[00:01:00] Ver. X Y (PL): Oi.");
  ok(r.falas.length === 1, "cabeçalho de arquivo: 1 fala");
  ok(
    r.avisos.some((a) => a.includes("antes da primeira fala")),
    "cabeçalho de arquivo: avisa em vez de descartar mudo",
  );
}

/* ── 6. fala multi-linha ────────────────────────────────────────────────── */
{
  const r = parseTranscript(
    [
      "[00:01:00] Ver. Carla Basílio (PSD): Primeira parte da fala",
      "que continua aqui",
      "e termina aqui.",
      "",
      "[00:02:00] Ver. João Victor (PL): Outra fala.",
    ].join("\n"),
  );
  ok(r.falas.length === 2, "multi-linha: continuação NÃO virou fala nova (" + r.falas.length + ")");
  ok(
    r.falas[0].content === "Primeira parte da fala que continua aqui e termina aqui.",
    "multi-linha: texto concatenado com espaço",
  );
  ok(
    r.falas[0].wordCount === 10,
    "multi-linha: wordCount recontado (" + r.falas[0].wordCount + ")",
  );
  ok(r.avisos.length === 0, "multi-linha: sem avisos");
}

/* ── 6b. fala sem conteúdo é descartada COM aviso ───────────────────────── */
{
  const r = parseTranscript("[00:03:00] Ver. Fantasma Silva (PL):");
  ok(r.falas.length === 0, "fala vazia: descartada");
  ok(
    r.avisos.some((a) => a.includes("sem conteúdo")),
    "fala vazia: descarte reportado",
  );
}

/* ── 7. normalização e vínculo ──────────────────────────────────────────── */
{
  ok(normalizarNome("Carla Basílio") === "carla basilio", "normaliza acento e caixa");
  ok(
    normalizarNome("Dika Xique-Xique") === normalizarNome("Dika Xique Xique"),
    "hífen e espaço convergem para a mesma forma",
  );
  const fichas = [
    { id: "a", display_name: "CARLA BASILIO" },
    { id: "b", display_name: "Dika Xique-Xique" },
    { id: "c", display_name: "Paulo Sérgio" },
  ];
  ok(
    resolverPessoa(["Carla Basílio"], fichas).motivo === "exato",
    "vínculo exato por acento/caixa",
  );
  ok(resolverPessoa(["Dika Xique Xique"], fichas).personId === "b", "vínculo exato por hífen");
  const r = resolverPessoa(["Delegado Paulo Sérgio"], fichas);
  ok(r.personId === "c" && r.motivo === "tokens", "vínculo por interseção de tokens");
  ok(
    resolverPessoa(["Missão Belém"], fichas).personId === null,
    "sem ficha correspondente devolve null (nunca inventa vínculo)",
  );
  // Um token em comum não basta — senão "João Silva" casaria com "Maria Silva".
  ok(
    resolverPessoa(["Maria Basilio"], [{ id: "x", display_name: "Carla Basilio" }]).personId ===
      null,
    "1 token em comum não vincula",
  );
}

/* ── 8. video_id do YouTube ─────────────────────────────────────────────── */
{
  ok(
    extrairVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ") === "dQw4w9WgXcQ",
    "video_id: watch?v=",
  );
  ok(
    extrairVideoId("https://youtu.be/dQw4w9WgXcQ?t=120") === "dQw4w9WgXcQ",
    "video_id: youtu.be com querystring",
  );
  ok(
    extrairVideoId("https://www.youtube.com/watch?list=PL123&v=dQw4w9WgXcQ&t=9") === "dQw4w9WgXcQ",
    "video_id: parâmetro extra antes do v=",
  );
  ok(extrairVideoId("https://exemplo.com/video") === null, "video_id: url sem id devolve null");
  ok(extrairVideoId(null) === null, "video_id: null não quebra");
}

/* ── 9. arquivo real (opcional — só roda se estiver na máquina) ─────────── */
{
  const caminho = process.env.CAMARA_FIXTURE;
  if (caminho) {
    const { readFileSync } = await import("node:fs");
    const r = parseTranscript(readFileSync(caminho, "utf8"));
    const falantes = new Set(r.falas.map((f) => f.speakerName));
    console.log(
      `\n[arquivo real] ${r.falas.length} falas, ${falantes.size} falantes, ${r.avisos.length} avisos`,
    );
    for (const a of r.avisos) console.log("  ·", a);
    ok(r.falas.length > 100, "arquivo real: parseou as falas");
    ok(r.avisos.length === 0, "arquivo real: nenhum aviso");
  }
}

console.log(`\n${pass} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
