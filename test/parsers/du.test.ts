import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "../../src/index.js";
import type { DirSize } from "../../src/parsers/du.js";

const fixture = readFileSync(
  join(__dirname, "../fixtures/du-k.txt"),
  "utf-8",
);

describe("du parser", () => {
  it("parses all rows", () => {
    const result = parse<DirSize[]>("du", fixture);
    const expectedRows = fixture.trim().split("\n").length;
    expect(result).toHaveLength(expectedRows);
    for (const row of result) {
      expect(typeof row.sizeKb).toBe("number");
      expect(typeof row.path).toBe("string");
    }
  });
});
