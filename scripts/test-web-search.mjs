// Tests: googleSearch (parse do Custom Search JSON API) e extractReadable (SSRF guard + strip de HTML).
process.env.GOOGLE_API_KEY = "test-key";
process.env.GOOGLE_CSE_ID = "test-cx";
const { googleSearch } = await import("../src/lib/web-search.server.ts");
const { extractReadable } = await import("../src/lib/readability.server.ts");

let pass = 0,
  fail = 0;
const ok = (c, m) => (c ? (pass++, console.log("✓", m)) : (fail++, console.log("✗", m)));
const res = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: String(status),
  text: async () => JSON.stringify(body),
  json: async () => body,
  arrayBuffer: async () => new TextEncoder().encode(typeof body === "string" ? body : "").buffer,
  headers: { get: () => null },
});

// 1) googleSearch parses Custom Search JSON API results into {title,url,snippet}
let seenUrl = "";
global.fetch = async (u) => {
  seenUrl = u.toString();
  return res(200, {
    items: [
      { title: "Notícia 1", link: "https://tribunadejundiai.com.br/a", snippet: "resumo 1" },
      { title: "Notícia 2", link: "https://bomdiajundiai.com.br/b", snippet: "resumo 2" },
      { title: "sem link" }, // deve ser descartado
    ],
  });
};
const r1 = await googleSearch("enchente jundiaí", 8);
ok(r1.length === 2, `googleSearch retorna 2 resultados válidos (${r1.length})`);
ok(
  r1[0].url === "https://tribunadejundiai.com.br/a" && r1[0].title === "Notícia 1",
  "mapeia title/url/snippet corretamente",
);
ok(seenUrl.includes("key=test-key") && seenUrl.includes("cx=test-cx"), "monta a URL com key e cx");

// 2) googleSearch sem env vars -> [] (noop gracioso)
delete process.env.GOOGLE_API_KEY;
const r2 = await googleSearch("qualquer coisa");
ok(Array.isArray(r2) && r2.length === 0, "googleSearch sem GOOGLE_API_KEY retorna []");
process.env.GOOGLE_API_KEY = "test-key";

// 3) googleSearch em erro HTTP -> [] (nunca lança)
global.fetch = async () => res(500, {});
const r3 = await googleSearch("teste erro");
ok(Array.isArray(r3) && r3.length === 0, "googleSearch em erro HTTP retorna [] sem lançar");

// 4) extractReadable bloqueia host privado (loopback literal)
global.fetch = async () => {
  throw new Error("fetch não deveria ser chamado para host bloqueado");
};
const r4 = await extractReadable("http://127.0.0.1/secret");
ok(r4 === null, "extractReadable bloqueia 127.0.0.1 (loopback) sem chamar fetch");

// 5) extractReadable bloqueia rede privada 10.x e 192.168.x e localhost/.local
const r5a = await extractReadable("http://10.0.0.5/internal");
const r5b = await extractReadable("http://192.168.1.1/admin");
const r5c = await extractReadable("http://localhost:3000/");
const r5d = await extractReadable("http://printer.local/");
const r5e = await extractReadable("http://169.254.169.254/latest/meta-data/"); // AWS metadata
ok(
  [r5a, r5b, r5c, r5d, r5e].every((r) => r === null),
  "bloqueia 10.x, 192.168.x, localhost, .local e metadata IP",
);

// 6) extractReadable bloqueia protocolo não-http(s)
const r6 = await extractReadable("file:///etc/passwd");
ok(r6 === null, "bloqueia protocolo file://");

// 7) extractReadable extrai texto limpo de um host público (IP literal público, sem DNS)
global.fetch = async () =>
  res(
    200,
    "<html><head><title>Título da Notícia</title></head><body><nav>menu</nav><h1>Manchete</h1><p>Primeiro parágrafo.</p><script>evil()</script><footer>rodapé</footer></body></html>",
  );
const r7 = await extractReadable("http://93.184.216.34/news");
ok(r7 !== null && r7.title === "Título da Notícia", `extrai title (${r7?.title})`);
ok(
  r7?.markdown?.includes("Manchete") && r7.markdown.includes("Primeiro parágrafo"),
  "extrai texto do corpo",
);
ok(
  !r7?.markdown?.includes("evil()") &&
    !r7?.markdown?.includes("menu") &&
    !r7?.markdown?.includes("rodapé"),
  "remove script/nav/footer",
);

console.log(`\n${pass} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
