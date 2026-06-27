import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "../../src/index.js";
import type { ProcessInfo } from "../../src/parsers/ps.js";

const fixture = readFileSync(
  join(__dirname, "../fixtures/ps-aux.txt"),
  "utf-8",
);

describe("ps parser", () => {
  it("parses all data rows", () => {
    const result = parse<ProcessInfo[]>("ps", fixture);
    const expectedRows = fixture.trim().split("\n").length - 1;
    expect(result).toHaveLength(expectedRows);
  });

  it("parses the first row correctly", () => {
    const result = parse<ProcessInfo[]>("ps", fixture);
    expect(result[0]).toMatchObject({
      user: "root",
      pid: 1,
      command: "/sbin/init",
    });
  });

  it("keeps multi-word commands intact", () => {
    const result = parse<ProcessInfo[]>("ps", fixture);
    const withArgs = result.find((p) => p.command.includes(" "));
    expect(withArgs).toBeDefined();
  });
});
