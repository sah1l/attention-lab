import OpenAI from "openai";

export function getAiGateway() {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL;
  const model = process.env.AI_MODEL;

  if (!apiKey || !model) {
    return null;
  }

  return {
    client: new OpenAI({ apiKey, baseURL }),
    model
  };
}

export function extractText(message: { content?: string | null }) {
  const raw = message.content ?? "";
  return raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

export function extractJsonObject(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? text;
  const start = raw.indexOf("{");

  if (start === -1) {
    throw new Error("No JSON object found.");
  }

  const slice = scanBalancedObject(raw, start);
  if (!slice) {
    throw new Error("No JSON object found.");
  }

  const candidates = [slice, sanitizeJson(slice), repairTruncatedJson(slice)];

  let lastError: unknown;
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate) as unknown;
    } catch (error) {
      lastError = error;
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`No JSON object found. Parse error: ${message}`);
}

function scanBalancedObject(raw: string, from: number): string | null {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = from; i < raw.length; i++) {
    const ch = raw[i];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }

    if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return raw.slice(from, i + 1);
      }
      if (depth < 0) {
        break;
      }
    }
  }

  // No balanced close — fall back to the slice from `from` to end so the
  // truncation repair pass can attempt to close it.
  return raw.slice(from);
}

function sanitizeJson(text: string): string {
  return text
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, "$1");
}

function repairTruncatedJson(text: string): string | null {
  // Handle outputs cut off mid-string or mid-structure by closing open
  // strings, arrays, and objects in the order they were opened.
  const stack: string[] = [];
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }
    if (ch === "\"") {
      inString = true;
    } else if (ch === "{" || ch === "[") {
      stack.push(ch);
    } else if (ch === "}" || ch === "]") {
      stack.pop();
    }
  }

  if (!inString && stack.length === 0) {
    return null;
  }

  let repaired = text;
  if (inString) {
    repaired += "\"";
  }
  // Drop any trailing comma that would now be invalid.
  repaired = repaired.replace(/,\s*$/, "");
  while (stack.length > 0) {
    const open = stack.pop();
    repaired += open === "{" ? "}" : "]";
  }
  return sanitizeJson(repaired);
}
