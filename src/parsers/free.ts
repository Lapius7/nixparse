import { z } from "zod";
import type { ParserDefinition } from "../types.js";
import { splitNonEmptyLines } from "./_table.js";

export const MemoryInfoSchema = z.object({
  mem: z.object({
    total: z.number().int(),
    used: z.number().int(),
    free: z.number().int(),
    shared: z.number().int(),
    buffCache: z.number().int(),
    available: z.number().int(),
  }),
  swap: z.object({
    total: z.number().int(),
    used: z.number().int(),
    free: z.number().int(),
  }),
});

export type MemoryInfo = z.infer<typeof MemoryInfoSchema>;

function parseFree(raw: string): unknown {
  const lines = splitNonEmptyLines(raw);
  const memLine = lines.find((l) => l.startsWith("Mem:"));
  const swapLine = lines.find((l) => l.startsWith("Swap:"));
  if (!memLine || !swapLine) {
    throw new Error("Could not find Mem: or Swap: line in free output");
  }

  const [, total, used, free, shared, buffCache, available] = memLine
    .trim()
    .split(/\s+/);
  const [, sTotal, sUsed, sFree] = swapLine.trim().split(/\s+/);

  return {
    mem: {
      total: Number(total),
      used: Number(used),
      free: Number(free),
      shared: Number(shared),
      buffCache: Number(buffCache),
      available: Number(available),
    },
    swap: {
      total: Number(sTotal),
      used: Number(sUsed),
      free: Number(sFree),
    },
  };
}

export const freeParser: ParserDefinition<MemoryInfo> = {
  schema: MemoryInfoSchema,
  parse: parseFree,
};
