import assert from "node:assert/strict";
import { test } from "node:test";
import { type AfmEvent, type AfmRequest, createAfmize } from "../src/index.ts";

// Runs anywhere: without Apple Intelligence (or off macOS), afmize still
// reports why, and every stream still starts and finishes.
const afmize = createAfmize();

const request: AfmRequest = {
	model: "on-device",
	maximumResponseTokens: 16,
	messages: [{ role: "user", parts: [{ type: "text", text: "Say hi." }] }],
};

const collect = async (events: AsyncIterable<AfmEvent>) => {
	const all: AfmEvent[] = [];
	for await (const event of events) all.push(event);
	return all;
};

test("reports availability", async () => {
	const report = await afmize.availability();
	assert.equal(typeof report.onDevice.available, "boolean");
	assert.equal(typeof report.privateCloudCompute.available, "boolean");
});

test("streams from stream-start to finish", async () => {
	const events = await collect(afmize.stream(request));
	assert.equal(events.at(0)?.type, "stream-start");
	assert.equal(events.at(-1)?.type, "finish");
	assert.equal(events.filter((event) => event.type === "finish").length, 1);
});

test("finishes a cancelled stream", async () => {
	const controller = new AbortController();
	controller.abort();
	const events = await collect(
		afmize.stream(request, { signal: controller.signal }),
	);
	assert.equal(events.at(-1)?.type, "finish");
});

test("reports an invalid request as an error", async () => {
	const events = await collect(
		afmize.stream({ model: "nope" } as unknown as AfmRequest),
	);
	assert.ok(events.some((event) => event.type === "error"));
	assert.equal(events.at(-1)?.type, "finish");
});
