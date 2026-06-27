import { z } from "zod";
import type { ParserDefinition } from "../types.js";
import { splitNonEmptyLines } from "./_table.js";

export const ProcessInfoSchema = z.object({
  user: z.string(),
  pid: z.number().int(),
  cpu: z.number(),
  mem: z.number(),
  vsz: z.number().int(),
  rss: z.number().int(),
  tty: z.string(),
  stat: z.string(),
  start: z.string(),
  time: z.string(),
  command: z.string(),
});

export type ProcessInfo = z.infer<typeof ProcessInfoSchema>;

const NUM_FIXED_COLUMNS = 10;

function parsePsAux(raw: string): unknown {
  const lines = splitNonEmptyLines(raw);
  const dataLines = lines.slice(1);

  return dataLines.map((line) => {
    const parts = line.trim().split(/\s+/);
    const fixed = parts.slice(0, NUM_FIXED_COLUMNS);
    const command = parts.slice(NUM_FIXED_COLUMNS).join(" ");
    const [user, pid, cpu, mem, vsz, rss, tty, stat, start, time] = fixed;

    return {
      user,
      pid: Number(pid),
      cpu: Number(cpu),
      mem: Number(mem),
      vsz: Number(vsz),
      rss: Number(rss),
      tty,
      stat,
      start,
      time,
      command,
    };
  });
}

export const psParser: ParserDefinition<ProcessInfo[]> = {
  schema: z.array(ProcessInfoSchema),
  parse: parsePsAux,
};
