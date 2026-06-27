import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "../../src/index.js";
import type { Socket } from "../../src/parsers/ss.js";

const fixture = readFileSync(
  join(__dirname, "../fixtures/ss-tln.txt"),
  "utf-8",
);

describe("ss parser", () => {
  it("parses all listening sockets", () => {
    const result = parse<Socket[]>("ss", fixture);
    const expectedRows = fixture.trim().split("\n").length - 1;
    expect(result).toHaveLength(expectedRows);
  });

  it("splits ipv4 host:port correctly", () => {
    const result = parse<Socket[]>("ss", fixture);
    const entry = result.find((s) => s.localPort === "8384");
    expect(entry).toBeDefined();
    expect(entry?.localAddress).toBe("127.0.0.1");
  });

  it("extracts process info when present", () => {
    const result = parse<Socket[]>("ss", fixture);
    const withProcess = result.find((s) => s.process?.includes("syncthing"));
    expect(withProcess).toBeDefined();
  });

  it("handles ipv6 bracketed addresses", () => {
    const result = parse<Socket[]>("ss", fixture);
    const ipv6 = result.find((s) => s.localAddress === "[::1]");
    expect(ipv6).toBeDefined();
    expect(ipv6?.localPort).toBe("631");
  });
});
