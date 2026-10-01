// Tests for server.js against a fake Claude API (no real key, no cost).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

let reply = { text: "{}", stop: "end_turn" };
let lastBody = null;

// Minimal SSE stream in the shape of the Messages API.
const mock = http.createServer(async (req, res) => {
  let raw = "";
  for await (const c of req) raw += c;
  lastBody = JSON.parse(raw);
  const ev = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
  res.writeHead(200, { "content-type": "text/event-stream" });
  ev("message_start", { message: { id: "m1", type: "message", role: "assistant", model: lastBody.model, content: [], stop_reason: null, usage: { input_tokens: 1, output_tokens: 0 } } });
  ev("content_block_start", { index: 0, content_block: { type: "text", text: "" } });
  ev("content_block_delta", { index: 0, delta: { type: "text_delta", text: reply.text } });
  ev("content_block_stop", { index: 0 });
  ev("message_delta", { delta: { stop_reason: reply.stop }, usage: { output_tokens: 1 } });
  ev("message_stop", {});
  res.end();
});

const servers = [];
function startApp(port, env) {
  const child = spawn(process.execPath, [fileURLToPath(new URL("../server.js", import.meta.url))], {
    env: { PATH: process.env.PATH, PORT: String(port), HOST: "127.0.0.1", ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  servers.push(child);
  return new Promise((resolve, reject) => {
    child.stdout.on("data", (d) => { if (String(d).includes(String(port))) resolve(); });
    child.on("exit", (c) => reject(new Error("server exited " + c)));
  });
}
const post = (port, body) =>
  fetch(`http://127.0.0.1:${port}/api/generate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    .then(async (r) => ({ status: r.status, json: await r.json() }));

before(async () => {
  await new Promise((r) => mock.listen(3961, "127.0.0.1", r));
  await startApp(3962, { ANTHROPIC_API_KEY: "test", ANTHROPIC_BASE_URL: "http://127.0.0.1:3961" });
  await startApp(3963, {}); // no key
});
after(() => { servers.forEach((s) => s.kill()); mock.close(); });

test("serves the page and blocks path traversal", async () => {
  const page = await fetch("http://127.0.0.1:3962/");
  assert.equal(page.status, 200);
  assert.match(await page.text(), /claude-shim\.js/);
  const bad = await fetch("http://127.0.0.1:3962/%2e%2e/server.js");
  assert.notEqual(bad.status, 200);
});

test("returns the JSON object from Claude's answer, even inside a code fence", async () => {
  reply = { text: '```json\n{"sections":[{"no":1,"blocks":[]}]}\n```', stop: "end_turn" };
  const r = await post(3962, { prompt: "hello" });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.data, { sections: [{ no: 1, blocks: [] }] });
  assert.equal(lastBody.model, "claude-opus-5-5");
  assert.equal(lastBody.messages[0].content, "hello");
});

test("rejects an empty prompt", async () => {
  const r = await post(3962, { prompt: "  " });
  assert.equal(r.status, 400);
});

test("reports unreadable answers as invalid_json", async () => {
  reply = { text: "no json here", stop: "end_turn" };
  const r = await post(3962, { prompt: "x" });
  assert.equal(r.status, 502);
  assert.equal(r.json.code, "invalid_json");
});

test("reports a refusal", async () => {
  reply = { text: "", stop: "refusal" };
  const r = await post(3962, { prompt: "x" });
  assert.equal(r.status, 422);
  assert.equal(r.json.code, "refused");
});

test("reports a missing API key clearly", async () => {
  const r = await post(3963, { prompt: "x" });
  assert.equal(r.status, 401);
  assert.equal(r.json.code, "auth");
});
