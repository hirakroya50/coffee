export function extractJson(text: string): unknown {
  const raw = (text ?? "").trim();
  const unfenced = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const jsonSlice = firstJsonObject(unfenced);
  if (!jsonSlice) {
    const preview = raw.slice(0, 500) || "(empty)";
    throw new Error(`Agent did not return JSON. Got: ${preview}`);
  }
  try {
    return JSON.parse(jsonSlice);
  } catch (err) {
    throw new Error(
      `Agent JSON was invalid: ${(err as Error).message}. Got: ${jsonSlice.slice(0, 500)}`
    );
  }
}

function firstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}
