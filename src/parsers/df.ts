import { z } from "zod";
import type { ParserDefinition } from "../types.js";
import { splitNonEmptyLines } from "./_table.js";

export const DiskUsageSchema = z.object({
  filesystem: z.string(),
  blocksKb: z.number().int(),
  usedKb: z.number().int(),
  availableKb: z.number().int(),
  usePercent: z.number(),
  mountedOn: z.string(),
});

export type DiskUsage = z.infer<typeof DiskUsageSchema>;

function parseDf(raw: string): unknown {
  const lines = splitNonEmptyLines(raw);
  const dataLines = lines.slice(1);

  return dataLines.map((line) => {
    const parts = line.trim().split(/\s+/);
    const filesystem = parts[0];
    const blocksKb = parts[1];
    const usedKb = parts[2];
    const availableKb = parts[3];
    const usePercent = parts[4];
    const mountedOn = parts.slice(5).join(" ");

    return {
      filesystem,
      blocksKb: Number(blocksKb),
      usedKb: Number(usedKb),
      availableKb: Number(availableKb),
      usePercent: Number(String(usePercent).replace("%", "")),
      mountedOn,
    };
  });
}

export const dfParser: ParserDefinition<DiskUsage[]> = {
  schema: z.array(DiskUsageSchema),
  parse: parseDf,
};
