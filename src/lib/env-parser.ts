/**
 * Parses a pasted `.env` block into key/value pairs.
 *
 * Supported:
 * - `KEY=value`, with an optional leading `export `
 * - blank lines and `#` comment lines
 * - unquoted values (an inline ` # comment` after whitespace is stripped)
 * - "double quoted" values with \n, \r, \t, \" and \\ escapes, which may span lines
 * - 'single quoted' values taken literally, which may span lines
 *
 * Used on the client for the import preview and again on the server before
 * anything is written, so it must stay free of server-only imports.
 */

export type EnvEntry = { key: string; value: string; line: number };
export type EnvIssue = { line: number; message: string };
export type ParseEnvResult = {
  entries: EnvEntry[];
  errors: EnvIssue[];
  warnings: EnvIssue[];
};

export const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

const DOUBLE_QUOTE_ESCAPES: Record<string, string> = {
  n: "\n",
  r: "\r",
  t: "\t",
  '"': '"',
  "\\": "\\",
};

export function parseEnv(text: string): ParseEnvResult {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const errors: EnvIssue[] = [];
  const warnings: EnvIssue[] = [];
  const byKey = new Map<string, EnvEntry>();

  let i = 0;
  while (i < lines.length) {
    const lineNo = i + 1;
    const trimmed = lines[i].trim();
    i++;

    if (trimmed === "" || trimmed.startsWith("#")) continue;

    const withoutExport = trimmed.replace(/^export\s+/, "");
    const eq = withoutExport.indexOf("=");
    if (eq === -1) {
      errors.push({ line: lineNo, message: "Expected KEY=value" });
      continue;
    }

    const key = withoutExport.slice(0, eq).trim();
    if (!ENV_KEY_PATTERN.test(key)) {
      errors.push({
        line: lineNo,
        message: `Invalid key "${key}". Use letters, digits, _ . - and don't start with a digit.`,
      });
      continue;
    }

    const rest = withoutExport.slice(eq + 1).replace(/^\s+/, "");
    const quote = rest[0];

    let value: string;
    if (quote === '"' || quote === "'") {
      // Consume (possibly across lines) until the matching closing quote.
      let body = rest.slice(1);
      let closed = -1;
      let collected = "";
      for (;;) {
        closed = findClosingQuote(body, quote);
        if (closed !== -1) {
          collected += body.slice(0, closed);
          break;
        }
        if (i >= lines.length) break;
        collected += body + "\n";
        body = lines[i];
        i++;
      }
      if (closed === -1) {
        errors.push({
          line: lineNo,
          message: `Unterminated ${quote === '"' ? "double" : "single"}-quoted value for ${key}`,
        });
        continue;
      }
      const trailing = body.slice(closed + 1).trim();
      if (trailing !== "" && !trailing.startsWith("#")) {
        errors.push({
          line: lineNo,
          message: `Unexpected text after closing quote for ${key}`,
        });
        continue;
      }
      value = quote === '"' ? unescapeDoubleQuoted(collected) : collected;
    } else {
      value = rest.replace(/\s+#.*$/, "").trimEnd();
    }

    const previous = byKey.get(key);
    if (previous) {
      warnings.push({
        line: lineNo,
        message: `${key} is defined more than once (line ${previous.line}); the last value is used`,
      });
      byKey.delete(key); // re-insert so order reflects the last definition
    }
    byKey.set(key, { key, value, line: lineNo });
  }

  return { entries: [...byKey.values()], errors, warnings };
}

function findClosingQuote(s: string, quote: string): number {
  for (let j = 0; j < s.length; j++) {
    if (quote === '"' && s[j] === "\\") {
      j++; // skip the escaped character
      continue;
    }
    if (s[j] === quote) return j;
  }
  return -1;
}

function unescapeDoubleQuoted(s: string): string {
  return s.replace(/\\(.)/g, (match, ch: string) =>
    ch in DOUBLE_QUOTE_ESCAPES ? DOUBLE_QUOTE_ESCAPES[ch] : match,
  );
}
