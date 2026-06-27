import type { AnyParserDefinition } from "./types.js";
import { psParser } from "./parsers/ps.js";
import { dfParser } from "./parsers/df.js";
import { duParser } from "./parsers/du.js";
import { freeParser } from "./parsers/free.js";
import { lsofParser } from "./parsers/lsof.js";
import { mountParser } from "./parsers/mount.js";
import { whoParser } from "./parsers/who.js";
import { uptimeParser } from "./parsers/uptime.js";
import { ipAddrParser, ipRouteParser } from "./parsers/ip.js";
import { ssParser } from "./parsers/ss.js";

const builtinParsers: Record<string, AnyParserDefinition> = {
  ps: psParser as AnyParserDefinition,
  df: dfParser as AnyParserDefinition,
  du: duParser as AnyParserDefinition,
  free: freeParser as AnyParserDefinition,
  lsof: lsofParser as AnyParserDefinition,
  mount: mountParser as AnyParserDefinition,
  who: whoParser as AnyParserDefinition,
  uptime: uptimeParser as AnyParserDefinition,
  "ip-addr": ipAddrParser as AnyParserDefinition,
  "ip-route": ipRouteParser as AnyParserDefinition,
  ss: ssParser as AnyParserDefinition,
};

export const registry = new Map<string, AnyParserDefinition>(
  Object.entries(builtinParsers),
);

export function registerParser<T>(
  name: string,
  definition: AnyParserDefinition,
): void {
  registry.set(name, definition as AnyParserDefinition);
}

export type BuiltinCommandName = keyof typeof builtinParsers;
