import { registry, registerParser, type BuiltinCommandName } from "./registry.js";
import { runCommand } from "./exec.js";
import { UnknownParserError } from "./types.js";

export { registerParser };
export type { BuiltinCommandName };
export {
  CommandNotFoundError,
  UnknownParserError,
  type ParserDefinition,
} from "./types.js";

export type { ProcessInfo } from "./parsers/ps.js";
export type { DiskUsage } from "./parsers/df.js";
export type { DirSize } from "./parsers/du.js";
export type { MemoryInfo } from "./parsers/free.js";
export type { OpenFile } from "./parsers/lsof.js";
export type { MountPoint } from "./parsers/mount.js";
export type { LoggedInUser } from "./parsers/who.js";
export type { UptimeInfo } from "./parsers/uptime.js";
export type { NetworkInterface, RouteEntry } from "./parsers/ip.js";
export type { Socket } from "./parsers/ss.js";

/**
 * 生のコマンド出力テキストをパースし、Zodで検証した結果を返す。
 * コマンドの実行は行わない(エージェント等が既に取得した出力を渡すケースを想定)。
 */
export function parse<T = unknown>(name: string, raw: string): T {
  const definition = registry.get(name);
  if (!definition) {
    throw new UnknownParserError(name);
  }
  const result = definition.parse(raw);
  return definition.schema.parse(result) as T;
}

interface CommandSpec {
  binary: string;
  defaultArgs: string[];
}

const commandSpecs = new Map<BuiltinCommandName, CommandSpec>([
  ["ps", { binary: "ps", defaultArgs: ["aux"] }],
  ["df", { binary: "df", defaultArgs: ["-k"] }],
  ["du", { binary: "du", defaultArgs: ["-k"] }],
  ["free", { binary: "free", defaultArgs: ["-b"] }],
  ["lsof", { binary: "lsof", defaultArgs: ["-F", "pcufTtn"] }],
  ["mount", { binary: "mount", defaultArgs: [] }],
  ["who", { binary: "who", defaultArgs: [] }],
  ["uptime", { binary: "uptime", defaultArgs: [] }],
  ["ip-addr", { binary: "ip", defaultArgs: ["-j", "addr"] }],
  ["ip-route", { binary: "ip", defaultArgs: ["-j", "route"] }],
  ["ss", { binary: "ss", defaultArgs: ["-tln"] }],
]);

/**
 * 組み込みコマンドを実行し、その出力をパースして返す。
 * 引数を省略すると各パーサーの想定するデフォルト引数(`ps aux`等)を使う。
 */
export async function run<T = unknown>(
  name: BuiltinCommandName,
  args?: string[],
): Promise<T> {
  const spec = commandSpecs.get(name);
  if (!spec) {
    throw new UnknownParserError(name);
  }
  const raw = await runCommand(spec.binary, args ?? spec.defaultArgs);
  return parse<T>(name, raw);
}
