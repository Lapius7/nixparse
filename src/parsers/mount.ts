import { z } from "zod";
import type { ParserDefinition } from "../types.js";
import { splitNonEmptyLines } from "./_table.js";

export const MountPointSchema = z.object({
  device: z.string(),
  path: z.string(),
  fsType: z.string(),
  options: z.array(z.string()),
});

export type MountPoint = z.infer<typeof MountPointSchema>;

const MOUNT_LINE_RE = /^(\S+) on (.+) type (\S+) \((.*)\)$/;

function parseMount(raw: string): unknown {
  const lines = splitNonEmptyLines(raw);

  return lines.map((line) => {
    const match = line.match(MOUNT_LINE_RE);
    if (!match) {
      throw new Error(`Unrecognized mount line: ${line}`);
    }
    const [, device, path, fsType, optionsStr] = match;
    return {
      device,
      path,
      fsType,
      options: optionsStr ? optionsStr.split(",") : [],
    };
  });
}

export const mountParser: ParserDefinition<MountPoint[]> = {
  schema: z.array(MountPointSchema),
  parse: parseMount,
};
