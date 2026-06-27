import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "../../src/index.js";
import type { OpenFile } from "../../src/parsers/lsof.js";

const fixture = readFileSync(
  join(__dirname, "../fixtures/lsof-F.txt"),
  "utf-8",
);

describe("lsof parser", () => {
  it("parses multiple processes' open files", () => {
    const result = parse<OpenFile[]>("lsof", fixture);
    expect(result.length).toBeGreaterThan(0);
    for (const entry of result) {
      expect(typeof entry.pid).toBe("number");
      expect(entry.name.length).toBeGreaterThan(0);
    }
  });

  it("groups entries by their owning pid/command", () => {
    const result = parse<OpenFile[]>("lsof", fixture);
    const pids = new Set(result.map((r) => r.pid));
    expect(pids.size).toBeGreaterThan(1);
  });
});
