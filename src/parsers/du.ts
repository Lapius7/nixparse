import { z } from "zod";
import type { ParserDefinition } from "../types.js";
import { splitNonEmptyLines } from "./_table.js";

export const DirSizeSchema = z.object({
  sizeKb: z.number().int(),
  path: z.string(),
});

export type DirSize = z.infer<typeof DirSizeSchema>;

function parseDu(raw: string): unknown {
  const lines = splitNonEmptyLines(raw);

  return lines.map((line) => {
    const match = line.match(/^(\d+)\s+(.+)$/);
    if (!match) {
      throw new Error(`Unrecognized du line: ${line}`);
    }
    const [, sizeKb, path] = match;
    return { sizeKb: Number(sizeKb), path };
  });
}

export const duParser: ParserDefinition<DirSize[]> = {
  schema: z.array(DirSizeSchema),
  parse: parseDu,
};
