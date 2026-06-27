import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "../../src/index.js";
import type { DiskUsage } from "../../src/parsers/df.js";

const fixture = readFileSync(
  join(__dirname, "../fixtures/df-k.txt"),
  "utf-8",
);

describe("df parser", () => {
  it("parses all rows with numeric fields", () => {
    const result = parse<DiskUsage[]>("df", fixture);
    const expectedRows = fixture.trim().split("\n").length - 1;
    expect(result).toHaveLength(expectedRows);
    for (const row of result) {
      expect(typeof row.blocksKb).toBe("number");
      expect(typeof row.usePercent).toBe("number");
    }
  });

  it("finds the root filesystem", () => {
    const result = parse<DiskUsage[]>("df", fixture);
    const root = result.find((r) => r.mountedOn === "/");
    expect(root).toBeDefined();
  });
});
