// Regressão SSRF do extractReadable — inclui o furo IPv4-mapeado em IPv6 achado na revisão.
const { extractReadable } = await import("../src/lib/readability.server.ts");
let pass = 0,
  fail = 0;
const ok = (c, m) => (c ? (pass++, console.log("✓", m)) : (fail++, console.log("✗", m)));

const blocked = [
  ["http://[::ffff:192.168.0.1]/", "IPv4-mapeado ::ffff:192.168 (o furo do reviewer)"],
  ["http://[::ffff:172.16.0.1]/", "IPv4-mapeado ::ffff:172.16"],
  ["http://[::ffff:7f00:1]/", "IPv4-mapeado em hex (127.0.0.1)"],
  ["http://[::1]/", "loopback IPv6 literal"],
  ["http://127.0.0.1/", "loopback IPv4"],
  ["http://192.168.0.1/", "privado 192.168"],
  ["http://10.0.0.5/", "privado 10.x"],
  ["http://169.254.169.254/latest/meta-data/", "metadata cloud (link-local)"],
  ["http://2130706433/", "127.0.0.1 em decimal"],
  ["http://0x7f000001/", "127.0.0.1 em hex"],
  ["http://foo@127.0.0.1/", "userinfo mascarando 127.0.0.1"],
  ["http://localhost/", "localhost"],
  ["http://x.local/", "hostname .local"],
  ["file:///etc/passwd", "protocolo file://"],
  ["gopher://127.0.0.1/", "protocolo gopher://"],
];
for (const [url, label] of blocked) {
  ok((await extractReadable(url)) === null, `bloqueado: ${label}`);
}

console.log(`\n${pass} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
