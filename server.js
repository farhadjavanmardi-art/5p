// پنج ستون (5P) — a tiny server: serves the page and forwards its prompts to the Claude API.
// The API key stays on the server; the browser only talks to /api/generate.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(here, "public");
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "127.0.0.1";
const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";
const MAX_BODY = 2_000_000;

const client = new Anthropic();

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json" };

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw Object.assign(new Error("body too large"), { code: "prompt_too_large" });
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

// The page asks for JSON in the prompt; take the outermost object from the answer.
function extractJson(text) {
  const t = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) throw Object.assign(new Error("no JSON in answer"), { code: "invalid_json" });
  try { return JSON.parse(t.slice(a, b + 1)); }
  catch { throw Object.assign(new Error("answer is not valid JSON"), { code: "invalid_json" }); }
}

async function generate(req, res) {
  let prompt;
  try {
    ({ prompt } = await readBody(req));
  } catch (e) {
    return send(res, 400, { code: e.code || "bad_request", message: "درخواست نامعتبر است." });
  }
  if (typeof prompt !== "string" || !prompt.trim()) return send(res, 400, { code: "bad_request", message: "متن درخواست خالی است." });

  const abort = new AbortController();
  res.on("close", () => { if (!res.writableEnded) abort.abort(); });

  try {
    const stream = client.beta.messages.stream(
      {
        model: MODEL,
        max_tokens: 64000,
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        messages: [{ role: "user", content: prompt }],
      },
      { signal: abort.signal },
    );
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") {
      return send(res, 422, { code: "refused", message: "Claude به این درخواست پاسخ نداد." });
    }
    const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    if (msg.stop_reason === "max_tokens") {
      return send(res, 502, { code: "invalid_json", message: "پاسخ ناقص ماند. دوباره امتحان کنید." });
    }
    send(res, 200, { data: extractJson(text), usage: msg.usage });
  } catch (e) {
    if (abort.signal.aborted) return;
    if (e.code === "invalid_json") return send(res, 502, { code: "invalid_json", message: "پاسخ Claude قابل خواندن نبود." });
    if (e instanceof Anthropic.AuthenticationError) return send(res, 401, { code: "auth", message: "کلید API معتبر نیست. فایل .env را بررسی کنید." });
    if (e instanceof Anthropic.RateLimitError) return send(res, 429, { code: "rate_limited", message: "درخواست‌ها زیاد شد." });
    if (e instanceof Anthropic.BadRequestError) return send(res, 400, { code: "bad_request", message: e.message });
    if (e instanceof Anthropic.APIError) return send(res, 502, { code: "api_error", message: `خطای Claude API (${e.status ?? "شبکه"})` });
    if (e instanceof Anthropic.AnthropicError) return send(res, 401, { code: "auth", message: "کلید API تنظیم نشده است. ANTHROPIC_API_KEY را در فایل .env بگذارید." });
    console.error(e);
    send(res, 500, { code: "server_error", message: "خطای سرور." });
  }
}

async function serveStatic(req, res) {
  const url = new URL(req.url, "http://x");
  const rel = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname).replace(/^\/+/, "");
  const file = path.join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  try {
    const body = await fs.readFile(file);
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404); res.end("not found");
  }
}

http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/generate") return generate(req, res);
  if (req.method === "GET") return serveStatic(req, res);
  res.writeHead(405); res.end();
}).listen(PORT, HOST, () => {
  console.log(`پنج ستون: http://${HOST}:${PORT}  (مدل: ${MODEL})`);
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) console.warn("هشدار: ANTHROPIC_API_KEY تنظیم نشده؛ نوشتن متن کار نمی‌کند تا آن را در .env بگذارید.");
});
