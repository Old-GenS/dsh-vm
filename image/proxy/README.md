# Egress proxy

`egress.ts` is vendored unchanged from [ogsapps/agent-hive](https://github.com/ogsapps/agent-hive)
(`src/egress.ts`, MIT). It is the one way out of the VM: an HTTP/HTTPS proxy that resolves every destination itself,
refuses anything that is not public space, and connects to the vetted address. `serve.ts` runs it
as its own container: `egress.ts` only listens on 127.0.0.1, so `serve.ts` adds a byte-for-byte TCP
forwarder on `0.0.0.0:3128` that the VM, on the internal network, can reach.

Keep the vendored file byte-identical so security fixes can be diffed against upstream; put local
changes in `serve.ts`, not in `egress.ts`.

This directory is copied into the image at `/opt/egress` and is not part of the agent's filesystem.
