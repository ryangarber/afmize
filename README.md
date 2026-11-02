# afmize

Apple's FoundationModels SDK (macOS 26 / iOS 26 and later), both the **on-device** model
and **Private Cloud Compute**, behind a JSON protocol and a C ABI that any host can reach.

| Package | For | How |
| --- | --- | --- |
| `afmize` (this Swift package) | Swift, C, Rust | `import afmize`, or link it and call [`include/afmize.h`](include/afmize.h) |
| [`@afmize/node`](packages/node) | Bun and Node on macOS | FFI to a prebuilt `libafmize.dylib` it ships |
| [`@afmize/capacitor`](packages/capacitor) | Capacitor apps on iOS | A plugin that `cap sync` adds; no Xcode changes |

All three are released together, under one version: `@afmize/capacitor@x.y.z` builds the
Swift package tagged `vx.y.z`, and `@afmize/node@x.y.z` ships its library.

It speaks an [AI SDK](https://ai-sdk.dev)-flavored JSON protocol:

- **In:** `LanguageModelV3Message[]`-like transcripts (system/user/assistant/tool roles with
  text / file / reasoning / tool-call / tool-result parts) and
  `LanguageModelV3FunctionTool[]`-like tool definitions (name, description, JSON Schema input).
- **Out:** a realtime event stream (`text-delta`, `reasoning-delta`, `file`, `tool-call`,
  `error`, `finish` with usage).

For the AI SDK itself, [`@ryangarber/ai-sdk-providers/afm`](https://github.com/ryangarber/ai-sdk-providers)
is a provider over any of the JavaScript clients.

Tools are **never executed in Swift**. When the model calls one or more tools, all tool calls
of the turn are emitted as `tool-call` events and the stream finishes with reason
`tool-calls`. The host app executes the tools and starts a **new** request with the tool-call
and tool-result parts appended to the message list.

## Requirements

- macOS 26 / iOS 26 or later; Xcode 27 / Swift 6.4 to build.
- Private Cloud Compute, tool calling (which needs transcript preservation), reasoning,
  and image parts require macOS 27 / iOS 27. Requests using these features on 26 fail
  with an error event followed by `finish`, using the existing stream error protocol.
- On 26, on-device text streaming is supported; token usage is omitted.
  Null schemas require 26.4 or later.
- Apple Intelligence enabled on the device for the on-device model; PCC eligibility for the
  cloud model. Check at runtime via `afmize_availability()` / `Afmize.availabilityJSON()`.

## API

### Swift

```swift
import afmize

// {"onDevice":{"available":true},"privateCloudCompute":{"available":false,"reason":"..."}}
let availability = Afmize.availabilityJSON()

for await eventJSON in Afmize.eventStream(requestJSON: requestJSON) {
    // each element is one event as a JSON string
}
```

### C ABI

Declared in [`include/afmize.h`](include/afmize.h), which every release attaches along with
a prebuilt `libafmize.dylib` (Apple silicon):

```c
// Heap-allocated JSON string; free with afmize_string_free.
char *afmize_availability(void);
void afmize_string_free(char *ptr);

// Starts a stream; returns a stream id (-1 on invalid arguments).
// The callback is invoked serially, once per event, from afmize's own threads,
// with a NUL-terminated UTF-8 JSON string that the callee owns: free it with
// afmize_string_free (it may be read after the callback returns). After the
// final "finish" event the callback is invoked once more with NULL (no further
// calls will occur; safe point to free `context`).
typedef void (*afmize_event_callback)(void *context, char *event_json);
int64_t afmize_stream_start(const char *request_json, void *context, afmize_event_callback callback);

// Cancels a running stream. A "finish" (reason "other") and the NULL sentinel
// are still delivered.
void afmize_stream_cancel(int64_t stream_id);
```

### JavaScript

`@afmize/node` and `@afmize/capacitor` both create an `AfmizeClient`:

```ts
import { createAfmize } from "@afmize/node"; // or "@afmize/capacitor"

const afmize = createAfmize();

// { onDevice: { available: true }, privateCloudCompute: { available: false, reason: "..." } }
const availability = await afmize.availability();

for await (const event of afmize.stream(request, { signal })) {
  // each element is one event, parsed
}
```

A client never throws: where afmize can't be reached (another platform, an older OS, a
missing plugin), it reports both models unavailable, and each stream ends with an `error`
event and `finish`. Each package also exports `createEventStream`, for a client of your own
over another transport (e.g. a webview's IPC to a process using `@afmize/node`).

## Request JSON

```jsonc
{
  "model": "on-device",              // or "private-cloud-compute"
  "temperature": 0.7,                 // optional
  "maximumResponseTokens": 1024,      // optional
  "reasoningLevel": "moderate",       // optional: "light" | "moderate" | "deep" | custom string
  "toolChoice": "auto",               // optional: "auto" | "required" | "none"
  "tools": [                          // optional
    {
      "name": "get_weather",
      "description": "Get the current weather for a city.",
      "inputSchema": {                // JSON Schema
        "type": "object",
        "properties": { "city": { "type": "string" } },
        "required": ["city"]
      }
    }
  ],
  "messages": [
    { "role": "system", "parts": [{ "type": "text", "text": "Be concise." }] },
    { "role": "user", "parts": [
      { "type": "text", "text": "What's in this image and what's the weather in Paris?" },
      { "type": "file", "mediaType": "image/png", "data": "<base64 | data: URL | file:/http(s): URL>" }
    ]},

    // On subsequent turns, echo back what was streamed:
    { "role": "assistant", "parts": [
      { "type": "reasoning", "text": "..." },
      { "type": "text", "text": "..." },
      { "type": "tool-call", "toolCallId": "call-1", "toolName": "get_weather", "input": { "city": "Paris" } }
    ]},
    { "role": "tool", "parts": [
      { "type": "tool-result", "toolCallId": "call-1", "toolName": "get_weather",
        "output": { "type": "json", "value": { "temperatureCelsius": 21 } } }
    ]}
  ]
}
```

Notes:

- Only `image/*` file parts are supported (the FoundationModels transcript only accepts image
  attachments).
- If the last message is a `user` message it becomes the new prompt; otherwise (e.g. a
  trailing tool-result message) the model continues from the transcript.

## Event stream

Each event is a single JSON object. Order: `stream-start` first, `finish` last (exactly once).

| type | fields | meaning |
| --- | --- | --- |
| `stream-start` | — | stream opened |
| `text-delta` | `id`, `delta` | incremental response text |
| `text-replace` | `id`, `text` | full replacement of the text block (rare) |
| `reasoning-delta` | `id`, `delta` | incremental reasoning text (per reasoning block) |
| `reasoning-replace` | `id`, `text` | full replacement of a reasoning block (rare) |
| `file` | `mediaType`, `data` | file emitted by the model (base64 or URL) |
| `tool-call` | `toolCallId`, `toolName`, `input` | tool call; `input` is a JSON-encoded string |
| `error` | `code`, `message` | fatal error; followed by `finish` |
| `finish` | `finishReason`, `usage?` | `stop` \| `tool-calls` \| `error` \| `other` |

`usage` contains `inputTokens`, `cachedInputTokens`, `outputTokens`, `reasoningTokens`,
`totalTokens`.

Error codes include `model-unavailable`, `context-size-exceeded`, `rate-limited`,
`guardrail-violation`, `refusal`, `timeout`, `pcc-network-failure`, `pcc-quota-limit-reached`,
`pcc-service-unavailable`, `assets-unavailable`, `concurrent-requests`, `invalid-request`,
`unsupported-content`, and `unknown`.

## Using from Rust

The core depends on nothing, so [`swift-rs`](https://crates.io/crates/swift-rs)'s
`SwiftLinker` can build and link it, and the C ABI needs no SwiftRs types:

```toml
[build-dependencies]
swift-rs = { version = "1", features = ["build"] }
```

```rust
// build.rs
use swift_rs::SwiftLinker;

fn main() {
    SwiftLinker::new("26.0")            // macOS deployment target
        .with_ios("26.0")               // iOS deployment target
        .with_package("afmize", "../path/to/afmize") // path to this repo
        .link();
}
```

```rust
use std::ffi::{c_char, c_void, CStr};

type EventCallback = unsafe extern "C" fn(*mut c_void, *mut c_char);

unsafe extern "C" {
    fn afmize_availability() -> *mut c_char;
    fn afmize_string_free(ptr: *mut c_char);
    fn afmize_stream_start(request_json: *const c_char, context: *mut c_void, callback: EventCallback) -> i64;
    fn afmize_stream_cancel(stream_id: i64);
}

unsafe extern "C" fn on_event(context: *mut c_void, event_json: *mut c_char) {
    if event_json.is_null() {
        // Terminal sentinel: reclaim `context` here.
        return;
    }
    let json = unsafe { CStr::from_ptr(event_json) }.to_string_lossy().into_owned();
    unsafe { afmize_string_free(event_json) };
    // handle `json`
}
```

On iOS, the Rust static library and the Swift package are linked together into the app;
the same `extern "C"` symbols resolve on both platforms.

## Development

```bash
swift build          # macOS build
swift test           # unit tests + live smoke tests (auto-skip without Apple Intelligence)
xcodebuild -scheme afmize -destination 'generic/platform=iOS' build   # iOS compile check

pnpm install
pnpm prebuild debug  # packages/node/prebuilds/darwin-arm64/libafmize.dylib
pnpm build && pnpm test
(cd packages/capacitor && pnpm verify:ios)   # the plugin, against this checkout's core
```

Inside this repository, the Capacitor plugin's `Package.swift` uses the core beside it, so
an app can `link:` to `packages/capacitor` (and `packages/node`) to develop against a
checkout; installed from npm, it uses the release tagged with its version.
