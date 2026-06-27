import { z } from "zod";
import type { ParserDefinition } from "../types.js";
import { splitNonEmptyLines } from "./_table.js";

export const OpenFileSchema = z.object({
  pid: z.number().int(),
  command: z.string(),
  user: z.string(),
  fd: z.string(),
  type: z.string(),
  name: z.string(),
});

export type OpenFile = z.infer<typeof OpenFileSchema>;

/**
 * lsof -F pcuTtn の出力をパースする。
 * `-F` モードは1フィールド1行で、行頭の1文字がフィールド識別子(p,c,u,T,t,n等)。
 * p(PID)行が新しいプロセスの開始を意味し、以降のレコードはそのPID/COMMAND/USERを継承する。
 */
function parseLsof(raw: string): unknown {
  const lines = splitNonEmptyLines(raw);
  const results: Record<string, unknown>[] = [];

  let currentPid: number | undefined;
  let currentCommand: string | undefined;
  let currentUser: string | undefined;
  let pendingFd: string | undefined;
  let pendingType: string | undefined;

  const flush = (name: string) => {
    if (currentPid === undefined) return;
    results.push({
      pid: currentPid,
      command: currentCommand ?? "",
      user: currentUser ?? "",
      fd: pendingFd ?? "",
      type: pendingType ?? "",
      name,
    });
  };

  for (const line of lines) {
    const tag = line[0];
    const value = line.slice(1);
    switch (tag) {
      case "p":
        currentPid = Number(value);
        break;
      case "c":
        currentCommand = value;
        break;
      case "u":
        currentUser = value;
        break;
      case "f":
        pendingFd = value;
        break;
      case "T":
        // protocol state line (TCP state etc.) — TYPE行の前に来る場合があるため独立フィールドとして無視
        break;
      case "t":
        pendingType = value;
        break;
      case "n":
        flush(value);
        break;
      default:
        break;
    }
  }

  return results;
}

export const lsofParser: ParserDefinition<OpenFile[]> = {
  schema: z.array(OpenFileSchema),
  parse: parseLsof,
};
