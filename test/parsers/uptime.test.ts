import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "../../src/index.js";
import type { UptimeInfo } from "../../src/parsers/uptime.js";

const fixture = readFileSync(
  join(__dirname, "../fixtures/uptime.txt"),
  "utf-8",
);

describe("uptime parser", () => {
  it("parses time, uptime duration, users and load averages", () => {
    const result = parse<UptimeInfo>("uptime", fixture);
    expect(result.users).toBe(1);
    expect(result.upHours).toBe(1);
    expect(result.upMinutes).toBe(8);
    expect(result.loadAverage1m).toBeCloseTo(0.17);
    expect(result.loadAverage5m).toBeCloseTo(0.28);
    expect(result.loadAverage15m).toBeCloseTo(0.56);
  });
});
