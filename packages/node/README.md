# @afmize/node

Apple Foundation Models for Bun and Node on macOS, through [afmize](https://github.com/ryangarber/afmize)'s
C ABI. It ships afmize's library prebuilt for Apple silicon, so there is nothing to build.

```ts
import { createAfmize } from "@afmize/node";

const afmize = createAfmize();
const { onDevice } = await afmize.availability();

for await (const event of afmize.stream({
  model: "on-device",
  messages: [{ role: "user", parts: [{ type: "text", text: "Hello!" }] }],
})) {
  if (event.type === "text-delta") process.stdout.write(event.delta);
}
```

- **Bun** uses its own FFI. The library is imported as a file, so `Bun.build` copies it
  beside a bundle and `bun build --compile` embeds it in the binary.
- **Node** uses [koffi](https://koffi.dev), an optional peer dependency: `npm install koffi`.
- **Browsers** get a client that reports afmize unavailable, along with the types and
  `createEventStream`, for a webview's client over its host's IPC.
- Anywhere else (Linux, Windows, Intel Macs, macOS before 26), the client reports both
  models unavailable and fails each stream with an `error` event. It never throws.

`createAfmize({ library })` loads another build of the library instead.
