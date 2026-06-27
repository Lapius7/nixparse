import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "../../src/index.js";
import type { MemoryInfo } from "../../src/parsers/free.js";

const fixture = readFileSync(
  join(__dirname, "../fixtures/free-b.txt"),
  "utf-8",
);

describe("free parser", () => {
  it("parses mem and swap sections", () => {
    const result = parse<MemoryInfo>("free", fixture);
    expect(result.mem.total).toBeGreaterThan(0);
    expect(result.swap.total).toBeGreaterThanOrEqual(0);
  });
});
