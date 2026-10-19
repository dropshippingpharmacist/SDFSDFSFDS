// llm.mjs — one way to ask Claude for structured output of any size.
// The SDK refuses a non-streaming request that may run longer than ten minutes (which, by its own estimate, is any
// request with more than ~21k max_tokens). Small answers use messages.parse; big ones stream and are parsed here.
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const SMALL = 20000;

export async function parseBig(client, req, schema) {
  const format = zodOutputFormat(schema);
  const output_config = { ...(req.output_config || {}), format };
  if ((req.max_tokens || 0) <= SMALL || typeof client.messages.stream !== "function") {
    const r = await client.messages.parse({ ...req, output_config });
    return { stop_reason: r.stop_reason, parsed: r.parsed_output || null };
  }
  const msg = await client.messages.stream({ ...req, output_config }).finalMessage();
  if (msg.stop_reason !== "end_turn") return { stop_reason: msg.stop_reason, parsed: null };
  const text = (msg.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  try { return { stop_reason: "end_turn", parsed: schema.parse(JSON.parse(text)) }; }
  catch { return { stop_reason: "end_turn", parsed: null }; }
}
