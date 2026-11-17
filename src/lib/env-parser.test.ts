import { describe, expect, it } from "vitest";
import { parseEnv } from "./env-parser";

const values = (text: string) =>
  Object.fromEntries(parseEnv(text).entries.map((e) => [e.key, e.value]));

describe("parseEnv", () => {
  it("parses simple KEY=value lines, skipping blanks and comments", () => {
    const result = parseEnv(`
# database
DATABASE_NAME=toronto-dev

DATABASE_URL=https://example.com/db
`);
    expect(result.errors).toEqual([]);
    expect(result.entries).toEqual([
      { key: "DATABASE_NAME", value: "toronto-dev", line: 3 },
      { key: "DATABASE_URL", value: "https://example.com/db", line: 5 },
    ]);
  });

  it("supports the export prefix and spaces around =", () => {
    expect(values("export API_KEY = abc123")).toEqual({ API_KEY: "abc123" });
  });

  it("keeps = signs inside values", () => {
    expect(values("URL=postgres://u:p@h/db?sslmode=require&a=b")).toEqual({
      URL: "postgres://u:p@h/db?sslmode=require&a=b",
    });
  });

  it("strips inline comments from unquoted values only", () => {
    expect(
      values(`A=value # comment
B="value # not a comment"
C=pass#word`),
    ).toEqual({ A: "value", B: "value # not a comment", C: "pass#word" });
  });

  it("handles double quotes with escapes", () => {
    expect(values(String.raw`A="line1\nline2\t\"q\"\\"`)).toEqual({
      A: 'line1\nline2\t"q"\\',
    });
  });

  it("takes single-quoted values literally", () => {
    expect(values(String.raw`A='no\nescape $HOME'`)).toEqual({
      A: String.raw`no\nescape $HOME`,
    });
  });

  it("supports multi-line quoted values", () => {
    const result = parseEnv(`KEY="-----BEGIN-----
abc
-----END-----"
NEXT=1`);
    expect(result.errors).toEqual([]);
    expect(Object.fromEntries(result.entries.map((e) => [e.key, e.value]))).toEqual({
      KEY: "-----BEGIN-----\nabc\n-----END-----",
      NEXT: "1",
    });
  });

  it("allows empty values", () => {
    expect(values(`A=\nB=""`)).toEqual({ A: "", B: "" });
  });

  it("handles Windows line endings", () => {
    expect(values("A=1\r\nB=2\r\n")).toEqual({ A: "1", B: "2" });
  });

  it("reports lines without = and invalid keys", () => {
    const result = parseEnv(`GOOD=1
not a pair
1BAD=2
has space=3`);
    expect(result.entries.map((e) => e.key)).toEqual(["GOOD"]);
    expect(result.errors.map((e) => e.line)).toEqual([2, 3, 4]);
  });

  it("reports unterminated quotes and trailing junk", () => {
    expect(parseEnv(`A="open`).errors[0].message).toMatch(/Unterminated/);
    expect(parseEnv(`A="x" junk`).errors[0].message).toMatch(/after closing quote/);
    expect(parseEnv(`A="x" # ok`).errors).toEqual([]);
  });

  it("uses the last value for duplicate keys and warns", () => {
    const result = parseEnv("A=1\nB=2\nA=3");
    expect(values("A=1\nB=2\nA=3")).toEqual({ A: "3", B: "2" });
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].line).toBe(3);
  });
});
