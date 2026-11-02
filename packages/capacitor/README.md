# @afmize/capacitor

Apple Foundation Models for Capacitor apps on iOS 26 and later, through
[afmize](https://github.com/ryangarber/afmize).

```sh
npm install @afmize/capacitor
npx cap sync ios
```

`cap sync` adds the plugin's Swift package (which builds afmize's core from the release
tagged with the plugin's version) and registers it; there is nothing to change in Xcode.

```ts
import { createAfmize } from "@afmize/capacitor";

const afmize = createAfmize();
const { onDevice } = await afmize.availability();

for await (const event of afmize.stream({
  model: "on-device",
  messages: [{ role: "user", parts: [{ type: "text", text: "Hello!" }] }],
})) {
  if (event.type === "text-delta") console.log(event.delta);
}
```

On the web and Android, the client reports both models unavailable and fails each stream
with an `error` event. It never throws.
