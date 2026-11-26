/**
 * Standalone entry point for the egress proxy, run as its own container by bin/dsh-vm.
 *
 * The proxy itself is vendored unchanged from ogsapps/agent-hive (src/egress.ts, MIT). See
 * ./README.md for why and how to keep the two in sync.
 *
 * egress.ts always listens on 127.0.0.1, which in this container is unreachable from the VM. So
 * the proxy listens on an ephemeral loopback port and a plain TCP forwarder on 0.0.0.0:EGRESS_PORT
 * passes bytes through to it. Every connection still meets the proxy's checks: the forwarder only
 * moves bytes, it never opens a connection anywhere else.
 *
 * Environment:
 *   EGRESS_PORT   port the forwarder listens on, on every interface (default 3128)
 *   EGRESS_DEBUG  1 to log refused destinations to stderr
 */
import { createServer, connect } from "node:net";
import { startEgressProxy } from "./egress.ts";

const rawPort = process.env.EGRESS_PORT ?? "3128";
const port = Number(rawPort);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`egress: invalid EGRESS_PORT: ${rawPort}`);
  process.exit(2);
}

const debug = process.env.EGRESS_DEBUG === "1";
const proxy = await startEgressProxy({
  log: debug ? (line: string) => console.error(`egress: ${line}`) : undefined,
});

const forwarder = createServer((client) => {
  const upstream = connect(proxy.port, "127.0.0.1");
  const drop = () => {
    client.destroy();
    upstream.destroy();
  };
  client.on("error", drop);
  upstream.on("error", drop);
  client.on("close", drop);
  upstream.on("close", drop);
  client.pipe(upstream);
  upstream.pipe(client);
});

await new Promise<void>((resolve, reject) => {
  forwarder.once("error", reject);
  forwarder.listen(port, "0.0.0.0", () => resolve());
});
// bin/dsh-vm waits for this line before it starts the VM.
console.log(`egress: listening on 0.0.0.0:${port} -> ${proxy.url}`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    forwarder.close();
    void proxy.close().finally(() => process.exit(0));
  });
}
