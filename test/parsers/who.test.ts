import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "../../src/index.js";
import type { LoggedInUser } from "../../src/parsers/who.js";

const fixture = readFileSync(
  join(__dirname, "../fixtures/who.txt"),
  "utf-8",
);

describe("who parser", () => {
  it("parses logged in users", () => {
    const result = parse<LoggedInUser[]>("who", fixture);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toMatchObject({ user: "lap7", tty: "pts/1" });
  });
});
