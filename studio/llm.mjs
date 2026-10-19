// llm.mjs — one way to ask Claude for structured output of any size.
// The SDK refuses a non-streaming request that may run longer than ten minutes (which, by its own estimate, is any
// request with more than ~21k max_tokens). Small answers use messages.parse; big ones stream and are parsed here.
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const SMALL = 20000;

// rate limits and overloads (429 / 529 / network blips) get three tries with growing waits; everything else surfaces
export async function withRetry(fn, { tries = 3, waits = [8000, 25000] } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e) {
      last = e;
      const st = e?.status, retriable = st === 429 || st === 529 || st === 503 || (!st && /ECONN|ETIMEDOUT|fetch failed|socket|network/i.test(String(e?.message)));
      if (!retriable || i === tries - 1) throw e;
      await new Promise(r => setTimeout(r, waits[Math.min(i, waits.length - 1)]));
    }
  }
  throw last;
}
export const why = e => (e?.status ? `Claude answered ${e.status}` : `Claude could not be reached (${String(e?.message || e).slice(0, 160)})`);

export async function parseBig(client, req, schema) {
  const format = zodOutputFormat(schema);
  const output_config = { ...(req.output_config || {}), format };
  if ((req.max_tokens || 0) <= SMALL || typeof client.messages.stream !== "function") {
    const r = await withRetry(() => client.messages.parse({ ...req, output_config }));
    return { stop_reason: r.stop_reason, parsed: r.parsed_output || null };
  }
  // streaming: the schema goes in the prompt, the answer is JSON text, zod checks it here
  const { format: _f, ...plain } = output_config;
  const system = String(req.system || "") + "\n\nReply with ONE JSON object only (no prose, no code fences) matching this JSON Schema exactly:\n" + JSON.stringify(z.toJSONSchema(schema));
  const msg = await withRetry(() => client.messages.stream({ ...req, system, output_config: plain }).finalMessage());
  if (msg.stop_reason !== "end_turn") return { stop_reason: msg.stop_reason, parsed: null };
  let text = (msg.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(text); if (fence) text = fence[1].trim();
  const a = text.indexOf("{"), b = text.lastIndexOf("}"); if (a > 0 || b < text.length - 1) text = text.slice(Math.max(0, a), b + 1);
  try { return { stop_reason: "end_turn", parsed: schema.parse(JSON.parse(text)) }; }
  catch { return { stop_reason: "end_turn", parsed: null }; }
}
