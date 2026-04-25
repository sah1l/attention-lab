import { readFileSync } from "node:fs";
import OpenAI from "openai";

for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = match[2];
  }
}

const model = process.env.AI_MODEL;
console.log("Model:", model);
console.log("Base URL:", process.env.OPENAI_BASE_URL || "(SDK default)");
console.log();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL
});

const start = Date.now();

try {
  const completion = await client.chat.completions.create({
    model,
    max_tokens: 3000,
    temperature: 0.99,
    top_p: 0.95,
    messages: [
      { role: "system", content: "You generate strict JSON. Return one object only." },
      { role: "user", content: "Give me {\"sentence\":\"hello\",\"answer\":\"world\"} verbatim and nothing else." }
    ],
    stream: false,
    extra_body: { chat_template_kwargs: { thinking: false } }
  });

  const ms = Date.now() - start;
  console.log(`Round-trip: ${ms} ms`);
  console.log("Finish reason:", completion.choices[0]?.finish_reason);
  console.log("Usage:", completion.usage);
  console.log("Message keys:", Object.keys(completion.choices[0]?.message ?? {}));
  console.log("\nContent:");
  console.log(completion.choices[0]?.message?.content);

  const reasoning =
    completion.choices[0]?.message?.reasoning ??
    completion.choices[0]?.message?.reasoning_content ??
    null;
  if (reasoning) {
    console.log("\nReasoning preview (first 200 chars):");
    console.log(String(reasoning).slice(0, 200));
  }
} catch (error) {
  const ms = Date.now() - start;
  console.error(`Failed after ${ms} ms:`, error?.message || error);
  if (error?.status) console.error("HTTP status:", error.status);
  if (error?.error) console.error("Provider error body:", JSON.stringify(error.error, null, 2));
}
