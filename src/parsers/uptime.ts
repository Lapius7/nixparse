import { z } from "zod";
import type { ParserDefinition } from "../types.js";

export const UptimeInfoSchema = z.object({
  currentTime: z.string(),
  upDays: z.number().int(),
  upHours: z.number().int(),
  upMinutes: z.number().int(),
  users: z.number().int(),
  loadAverage1m: z.number(),
  loadAverage5m: z.number(),
  loadAverage15m: z.number(),
});

export type UptimeInfo = z.infer<typeof UptimeInfoSchema>;

const UPTIME_RE =
  /^\s*(\S+)\s+up\s+(.+?),\s+(\d+)\s+users?,\s+load average:\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)/;

function parseUpDuration(upStr: string): {
  days: number;
  hours: number;
  minutes: number;
} {
  // 例: "1:08", "1 day,  2:03", "5 min"
  const dayMatch = upStr.match(/(\d+)\s+days?/);
  const days = dayMatch ? Number(dayMatch[1]) : 0;

  const hmMatch = upStr.match(/(\d+):(\d+)/);
  if (hmMatch) {
    return { days, hours: Number(hmMatch[1]), minutes: Number(hmMatch[2]) };
  }

  const minMatch = upStr.match(/(\d+)\s+min/);
  if (minMatch) {
    return { days, hours: 0, minutes: Number(minMatch[1]) };
  }

  return { days, hours: 0, minutes: 0 };
}

function parseUptime(raw: string): unknown {
  const line = raw.trim();
  const match = line.match(UPTIME_RE);
  if (!match) {
    throw new Error(`Unrecognized uptime output: ${line}`);
  }
  const [, currentTime, upStr, users, l1, l5, l15] = match;
  const { days, hours, minutes } = parseUpDuration(upStr ?? "");

  return {
    currentTime,
    upDays: days,
    upHours: hours,
    upMinutes: minutes,
    users: Number(users),
    loadAverage1m: Number(l1),
    loadAverage5m: Number(l5),
    loadAverage15m: Number(l15),
  };
}

export const uptimeParser: ParserDefinition<UptimeInfo> = {
  schema: UptimeInfoSchema,
  parse: parseUptime,
};
