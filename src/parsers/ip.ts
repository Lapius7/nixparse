import { z } from "zod";
import type { ParserDefinition } from "../types.js";

export const AddrInfoSchema = z.object({
  family: z.string(),
  local: z.string(),
  prefixlen: z.number().int(),
  broadcast: z.string().optional(),
  scope: z.string(),
  label: z.string().optional(),
  valid_life_time: z.number(),
  preferred_life_time: z.number(),
});

export const NetworkInterfaceSchema = z.object({
  ifindex: z.number().int(),
  ifname: z.string(),
  flags: z.array(z.string()),
  mtu: z.number().int(),
  qdisc: z.string(),
  operstate: z.string(),
  group: z.string(),
  txqlen: z.number().int().optional(),
  link_type: z.string(),
  address: z.string(),
  broadcast: z.string().optional(),
  addr_info: z.array(AddrInfoSchema),
});

export type NetworkInterface = z.infer<typeof NetworkInterfaceSchema>;

/**
 * `ip -j addr` はネイティブでJSONを出力するため、変換は不要。
 * JSON.parse + Zodスキーマ検証のみを行い、構造保証された型を返す。
 */
function parseIpAddr(raw: string): unknown {
  return JSON.parse(raw);
}

export const ipAddrParser: ParserDefinition<NetworkInterface[]> = {
  schema: z.array(NetworkInterfaceSchema),
  parse: parseIpAddr,
};

export const RouteEntrySchema = z.object({
  dst: z.string(),
  gateway: z.string().optional(),
  dev: z.string().optional(),
  protocol: z.string().optional(),
  scope: z.string().optional(),
  prefsrc: z.string().optional(),
  flags: z.array(z.string()),
});

export type RouteEntry = z.infer<typeof RouteEntrySchema>;

function parseIpRoute(raw: string): unknown {
  return JSON.parse(raw);
}

export const ipRouteParser: ParserDefinition<RouteEntry[]> = {
  schema: z.array(RouteEntrySchema),
  parse: parseIpRoute,
};
