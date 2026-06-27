import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "../../src/index.js";
import type { NetworkInterface, RouteEntry } from "../../src/parsers/ip.js";

const addrFixture = readFileSync(
  join(__dirname, "../fixtures/ip-addr.txt"),
  "utf-8",
);
const routeFixture = readFileSync(
  join(__dirname, "../fixtures/ip-route.txt"),
  "utf-8",
);

describe("ip-addr parser", () => {
  it("validates native JSON output and finds loopback", () => {
    const result = parse<NetworkInterface[]>("ip-addr", addrFixture);
    const lo = result.find((i) => i.ifname === "lo");
    expect(lo).toBeDefined();
    expect(lo?.addr_info.some((a) => a.local === "127.0.0.1")).toBe(true);
  });
});

describe("ip-route parser", () => {
  it("validates native JSON route output", () => {
    const result = parse<RouteEntry[]>("ip-route", routeFixture);
    expect(result.length).toBeGreaterThan(0);
    const def = result.find((r) => r.dst === "default");
    expect(def?.gateway).toBeDefined();
  });
});
