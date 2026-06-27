import { z } from "zod";
import type { ParserDefinition } from "../types.js";
import { splitNonEmptyLines } from "./_table.js";

export const LoggedInUserSchema = z.object({
  user: z.string(),
  tty: z.string(),
  loginTime: z.string(),
});

export type LoggedInUser = z.infer<typeof LoggedInUserSchema>;

const WHO_LINE_RE = /^(\S+)\s+(\S+)\s+(.+)$/;

function parseWho(raw: string): unknown {
  const lines = splitNonEmptyLines(raw);

  return lines.map((line) => {
    const match = line.match(WHO_LINE_RE);
    if (!match) {
      throw new Error(`Unrecognized who line: ${line}`);
    }
    const [, user, tty, loginTime] = match;
    return { user, tty, loginTime: loginTime?.trim() };
  });
}

export const whoParser: ParserDefinition<LoggedInUser[]> = {
  schema: z.array(LoggedInUserSchema),
  parse: parseWho,
};
