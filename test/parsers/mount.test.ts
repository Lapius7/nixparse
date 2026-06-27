import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "../../src/index.js";
import type { MountPoint } from "../../src/parsers/mount.js";

const fixture = readFileSync(
  join(__dirname, "../fixtures/mount.txt"),
  "utf-8",
);

describe("mount parser", () => {
  it("parses all mount entries with options split", () => {
    const result = parse<MountPoint[]>("mount", fixture);
    expect(result.length).toBeGreaterThan(0);
    for (const m of result) {
      expect(Array.isArray(m.options)).toBe(true);
      expect(m.options.length).toBeGreaterThan(0);
    }
  });

  it("finds the root mount", () => {
    const result = parse<MountPoint[]>("mount", fixture);
    const root = result.find((m) => m.path === "/");
    expect(root).toBeDefined();
    expect(root?.fsType).toBe("ext4");
  });
});
