# nixparse

[![npm version](https://img.shields.io/npm/v/nixparse.svg)](https://www.npmjs.com/package/nixparse)

Type-safe parsers for classic Unix command output — `ps`, `df`, `du`, `free`, `lsof`, `mount`, `who`, `uptime`, `ip`, `ss` — validated at runtime with [Zod](https://zod.dev).

**npm:** https://www.npmjs.com/package/nixparse

[日本語版 README はこちら](./README.ja.md)

Most of these commands have no `--json` flag (unlike `docker` or `kubectl`), so their output has historically been scraped with one-off regexes. `nixparse` gives you a single, typed, pluggable interface for all of them.

- **Runtime-validated**: every parser result is checked against a Zod schema, so malformed input throws a `ZodError` instead of silently producing garbage.
- **No shell, no injection risk**: `run()` uses `child_process.execFile`, never a shell — arguments are never string-interpolated into a command line.
- **Pluggable**: register your own parser for any command with `registerParser()`.
- **Dual ESM/CJS** build with full `.d.ts` types.

## Table of contents

- [Install](#install)
- [Quick start](#quick-start)
- [Before / after](#before--after)
- [Core concepts](#core-concepts)
- [API reference](#api-reference)
  - [`parse(name, raw)`](#parsename-raw)
  - [`run(name, args?)`](#runname-args)
  - [`registerParser(name, definition)`](#registerparsername-definition)
- [Supported commands (full field reference)](#supported-commands-full-field-reference)
  - [`ps`](#ps)
  - [`df`](#df)
  - [`du`](#du)
  - [`free`](#free)
  - [`lsof`](#lsof)
  - [`mount`](#mount)
  - [`who`](#who)
  - [`uptime`](#uptime)
  - [`ip-addr`](#ip-addr)
  - [`ip-route`](#ip-route)
  - [`ss`](#ss)
- [Error handling](#error-handling)
- [Recipes](#recipes)
- [Scope and limitations](#scope-and-limitations)
- [Development](#development)
- [License](#license)

## Install

```sh
npm install nixparse
```

Requires Node.js 18+. Commands are run on the host system (Linux assumed — see [Scope](#scope-and-limitations)), so the underlying binaries (`ps`, `df`, etc.) must already be installed and on `PATH`.

## Quick start

```ts
import { run, type ProcessInfo } from "nixparse";

const processes = await run<ProcessInfo[]>("ps");
console.log(processes[0].pid, processes[0].command);
```

That's it — `run()` executes `ps aux` under the hood, parses stdout, validates it against a Zod schema, and hands back a fully-typed array.

## Before / after

**Without nixparse**, `ps aux` gives you a wall of text:

```
USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root           1  0.0  0.1  22384  6892 ?        Ss   01:31   0:01 /sbin/init
root         599  0.1  0.5 712104 21000 ?        Sl   01:31   0:42 syncthing -no-browser
node       21070  0.3  1.2 987344 49200 ?        Sl   01:42   1:10 node server.js
```

To use that in JavaScript, you'd have to write your own column-splitting/regex logic — and redo it for every command, since `df`, `free`, `mount`, etc. all use different layouts:

```js
const lines = stdout.trim().split("\n").slice(1);
const procs = lines.map((line) => {
  const parts = line.trim().split(/\s+/);
  return {
    user: parts[0],
    pid: Number(parts[1]),
    cpu: Number(parts[2]),
    // ...and so on, with no guarantee any of this matches what you assumed
  };
});
```

**With nixparse**, the same data arrives as a typed, validated array — no parsing code, and a thrown error instead of silent garbage if the format doesn't match:

```ts
import { run, type ProcessInfo } from "nixparse";

const procs = await run<ProcessInfo[]>("ps");
console.log(procs[0]);
```

```js
{
  user: 'root',
  pid: 1,
  cpu: 0,
  mem: 0.1,
  vsz: 22384,
  rss: 6892,
  tty: '?',
  stat: 'Ss',
  start: '01:31',
  time: '0:01',
  command: '/sbin/init'
}
```

`pid`/`cpu`/`mem`/`vsz`/`rss` are already numbers (not strings), every field is type-checked by your editor, and the exact same pattern (`run("df")`, `run("free")`, `run("mount")`, ...) works across all 10 commands instead of learning a new text format each time.

## Core concepts

There are two ways to get data out of nixparse, depending on whether you already have the raw command output or want nixparse to fetch it for you:

| | You already have the text | You want nixparse to execute the command |
|---|---|---|
| Function | [`parse(name, raw)`](#parsename-raw) | [`run(name, args?)`](#runname-args) |
| Use case | Output piped in from elsewhere, captured by an agent, read from a log/fixture file | Normal application code |
| Side effects | None — pure function | Spawns a child process |

Both funnel through the same registry of parsers, so the returned types and validation behavior are identical.

## API reference

### `parse(name, raw)`

```ts
function parse<T = unknown>(name: string, raw: string): T;
```

Parses a raw string with the parser registered under `name`, validates the result against that parser's Zod schema, and returns it.

- `name` — the parser name (see [the command table](#supported-commands-full-field-reference) below). For built-ins, the string literal type `BuiltinCommandName` gives you autocomplete.
- `raw` — the exact stdout text of the corresponding command (see the "Command run by `run()`" column per parser for which exact invocation each parser expects).
- Throws `UnknownParserError` if `name` isn't registered.
- Throws a Zod `ZodError` if the parsed shape doesn't match the schema (e.g. you passed the wrong command's output by mistake).

```ts
import { parse, type DiskUsage } from "nixparse";
import { execSync } from "node:child_process";

const raw = execSync("df -k").toString();
const disks = parse<DiskUsage[]>("df", raw);
```

### `run(name, args?)`

```ts
function run<T = unknown>(
  name: BuiltinCommandName,
  args?: string[],
): Promise<T>;
```

Executes the underlying binary for a **built-in** parser and parses its output in one step. Only works with the 11 built-in command names (custom parsers registered via `registerParser` are not executable — `run()` has no way to know what binary/args they'd need).

- `name` — one of `"ps" | "df" | "du" | "free" | "lsof" | "mount" | "who" | "uptime" | "ip-addr" | "ip-route" | "ss"`.
- `args` — optional. Overrides the parser's default arguments (e.g. `du` needs a path, so you'll almost always pass `args` for it). When omitted, each parser's documented default is used (see the table below).
- Internally uses `child_process.execFile(binary, args)` — **no shell is invoked**, so there is no command-injection risk even if `args` includes user-controlled strings.
- Throws `CommandNotFoundError` if the binary isn't on `PATH`.
- Throws the same Zod errors as `parse()` if the output doesn't match the schema (e.g. an unexpected OS/output format).

```ts
import { run, type DirSize } from "nixparse";

// override the default args — du requires an explicit path
const sizes = await run<DirSize[]>("du", ["-k", "/var/log"]);
const biggest = sizes.sort((a, b) => b.sizeKb - a.sizeKb)[0];
```

### `registerParser(name, definition)`

```ts
function registerParser<T>(
  name: string,
  definition: { schema: ZodType<T>; parse: (raw: string) => unknown },
): void;
```

Adds (or overwrites) a parser in the global registry, immediately usable via `parse()`. This is how you extend nixparse to cover a command it doesn't ship with.

```ts
import { registerParser, parse } from "nixparse";
import { z } from "zod";

const UserSchema = z.object({ name: z.string(), shell: z.string() });

registerParser("getent-passwd", {
  schema: z.array(UserSchema),
  parse: (raw) =>
    raw
      .trim()
      .split("\n")
      .map((line) => {
        const fields = line.split(":");
        return { name: fields[0], shell: fields[6] };
      }),
});

const users = parse("getent-passwd", rawGetentOutput);
```

Note: `registerParser` only makes the parser usable via `parse()`. If you also want one-call execution like `run()` provides, write your own thin wrapper that shells out and calls `parse()`.

## Supported commands (full field reference)

All built-in parsers are based on **Linux (GNU coreutils / iproute2 / util-linux)** output. See [Scope and limitations](#scope-and-limitations) for other platforms.

### `ps`

- Name: `"ps"` · Default command: `ps aux` · Returns: `ProcessInfo[]`

| Field | Type | Source column | Notes |
|---|---|---|---|
| `user` | `string` | `USER` | |
| `pid` | `number` | `PID` | |
| `cpu` | `number` | `%CPU` | |
| `mem` | `number` | `%MEM` | |
| `vsz` | `number` | `VSZ` | Virtual memory size, KB |
| `rss` | `number` | `RSS` | Resident set size, KB |
| `tty` | `string` | `TTY` | `?` if no controlling terminal |
| `stat` | `string` | `STAT` | Process state code, e.g. `Ss`, `R+` |
| `start` | `string` | `START` | As printed by `ps` (time or date) |
| `time` | `string` | `TIME` | Cumulative CPU time |
| `command` | `string` | `COMMAND` | Full command line, including all arguments — never truncated at a space |

```ts
const procs = await run<ProcessInfo[]>("ps");
const highCpu = procs.filter((p) => p.cpu > 50);
```

### `df`

- Name: `"df"` · Default command: `df -k` · Returns: `DiskUsage[]`

| Field | Type | Source column | Notes |
|---|---|---|---|
| `filesystem` | `string` | `Filesystem` | |
| `blocksKb` | `number` | `1K-blocks` | Total size in KB |
| `usedKb` | `number` | `Used` | KB |
| `availableKb` | `number` | `Available` | KB |
| `usePercent` | `number` | `Use%` | Numeric, `%` sign stripped (e.g. `42`, not `"42%"`) |
| `mountedOn` | `string` | `Mounted on` | |

```ts
const disks = await run<DiskUsage[]>("df");
const full = disks.filter((d) => d.usePercent >= 90);
```

### `du`

- Name: `"du"` · Default command: `du -k` (no path — you should pass one) · Returns: `DirSize[]`

| Field | Type | Notes |
|---|---|---|
| `sizeKb` | `number` | Size in KB |
| `path` | `string` | Path as printed by `du` |

`du` requires a target path as an argument, so you'll virtually always call `run("du", ["-k", "/some/path"])` rather than relying on the (path-less) default.

```ts
const sizes = await run<DirSize[]>("du", ["-k", "-d", "1", "/home/me/projects"]);
```

### `free`

- Name: `"free"` · Default command: `free -b` · Returns: `MemoryInfo`

`-b` (bytes) is the default specifically so values stay plain numbers — `-h` ("human readable", e.g. `"3.8Gi"`) is **not supported**, since it mixes units into the string.

| Field | Type | Notes |
|---|---|---|
| `mem.total` | `number` | Bytes |
| `mem.used` | `number` | Bytes |
| `mem.free` | `number` | Bytes |
| `mem.shared` | `number` | Bytes |
| `mem.buffCache` | `number` | Bytes (`buff/cache` column) |
| `mem.available` | `number` | Bytes |
| `swap.total` | `number` | Bytes |
| `swap.used` | `number` | Bytes |
| `swap.free` | `number` | Bytes |

```ts
const mem = await run<MemoryInfo>("free");
const usedPercent = (mem.mem.used / mem.mem.total) * 100;
```

### `lsof`

- Name: `"lsof"` · Default command: `lsof -F pcufTtn` · Returns: `OpenFile[]`

Uses lsof's `-F` field-output mode rather than scraping the human-readable table — far more robust against filenames with spaces, long command names, etc. Each open file descriptor becomes one entry, carrying the PID/command/user of the process that owns it.

| Field | Type | Notes |
|---|---|---|
| `pid` | `number` | Owning process ID |
| `command` | `string` | Owning process's command name |
| `user` | `string` | Owning process's user (numeric UID as printed by lsof) |
| `fd` | `string` | File descriptor, e.g. `cwd`, `txt`, `mem`, or a number |
| `type` | `string` | File type, e.g. `DIR`, `REG`, `IPv4`, `unknown` |
| `name` | `string` | Path, or socket/device description |

```ts
// all processes with files open under /var/log
const open = await run<OpenFile[]>("lsof");
const logUsers = open.filter((f) => f.name.startsWith("/var/log"));
```

Without root, lsof can only see your own processes' files — this is an OS permission limit, not a nixparse limitation.

### `mount`

- Name: `"mount"` · Default command: `mount` · Returns: `MountPoint[]`

| Field | Type | Notes |
|---|---|---|
| `device` | `string` | e.g. `/dev/sda1`, `none`, `tmpfs` |
| `path` | `string` | Mount point |
| `fsType` | `string` | e.g. `ext4`, `overlay`, `tmpfs` |
| `options` | `string[]` | Mount options split on `,`, e.g. `["rw", "relatime"]` |

```ts
const mounts = await run<MountPoint[]>("mount");
const readOnly = mounts.filter((m) => m.options.includes("ro"));
```

### `who`

- Name: `"who"` · Default command: `who` · Returns: `LoggedInUser[]`

| Field | Type | Notes |
|---|---|---|
| `user` | `string` | |
| `tty` | `string` | e.g. `pts/1` |
| `loginTime` | `string` | As printed by `who` (locale-dependent format, kept as a raw string rather than parsed into a `Date`) |

### `uptime`

- Name: `"uptime"` · Default command: `uptime` · Returns: `UptimeInfo`

| Field | Type | Notes |
|---|---|---|
| `currentTime` | `string` | Wall clock time as printed, e.g. `"14:32:10"` |
| `upDays` | `number` | `0` if uptime is under a day |
| `upHours` | `number` | |
| `upMinutes` | `number` | |
| `users` | `number` | Number of logged-in users |
| `loadAverage1m` | `number` | |
| `loadAverage5m` | `number` | |
| `loadAverage15m` | `number` | |

```ts
const up = await run<UptimeInfo>("uptime");
if (up.loadAverage1m > 4) console.warn("system is under heavy load");
```

### `ip-addr`

- Name: `"ip-addr"` · Default command: `ip -j addr` · Returns: `NetworkInterface[]`

`ip -j` already emits native JSON. This parser does **not** do any text scraping — it's `JSON.parse` followed by Zod validation, so you get a guaranteed shape (and full TypeScript types) on top of a command that already happened to support JSON.

| Field | Type | Notes |
|---|---|---|
| `ifindex` | `number` | |
| `ifname` | `string` | e.g. `eth0`, `lo` |
| `flags` | `string[]` | e.g. `["BROADCAST", "MULTICAST", "UP"]` |
| `mtu` | `number` | |
| `qdisc` | `string` | |
| `operstate` | `string` | e.g. `UP`, `DOWN`, `UNKNOWN` |
| `group` | `string` | |
| `txqlen` | `number?` | Optional — not present on all interface types |
| `link_type` | `string` | e.g. `ether`, `loopback` |
| `address` | `string` | MAC address |
| `broadcast` | `string?` | Optional |
| `addr_info` | `AddrInfo[]` | See below |

`AddrInfo`:

| Field | Type | Notes |
|---|---|---|
| `family` | `string` | `"inet"` or `"inet6"` |
| `local` | `string` | The IP address |
| `prefixlen` | `number` | |
| `broadcast` | `string?` | Optional |
| `scope` | `string` | e.g. `global`, `host`, `link` |
| `label` | `string?` | Optional |
| `valid_life_time` | `number` | |
| `preferred_life_time` | `number` | |

```ts
const ifaces = await run<NetworkInterface[]>("ip-addr");
const eth0 = ifaces.find((i) => i.ifname === "eth0");
const ipv4 = eth0?.addr_info.find((a) => a.family === "inet")?.local;
```

### `ip-route`

- Name: `"ip-route"` · Default command: `ip -j route` · Returns: `RouteEntry[]`

Same approach as `ip-addr`: native JSON, validated rather than parsed.

| Field | Type | Notes |
|---|---|---|
| `dst` | `string` | Destination, e.g. `"default"` or a CIDR |
| `gateway` | `string?` | Optional |
| `dev` | `string?` | Optional, outgoing interface |
| `protocol` | `string?` | Optional |
| `scope` | `string?` | Optional |
| `prefsrc` | `string?` | Optional, preferred source address |
| `flags` | `string[]` | |

```ts
const routes = await run<RouteEntry[]>("ip-route");
const defaultRoute = routes.find((r) => r.dst === "default");
```

### `ss`

- Name: `"ss"` · Default command: `ss -tln` · Returns: `Socket[]`

Handles bracketed IPv6 addresses (`[::1]:631`) correctly by splitting on the *last* `:` rather than the first. Pass `["-tlnp"]` instead of the default to also get the owning process when permissions allow it.

| Field | Type | Notes |
|---|---|---|
| `state` | `string` | e.g. `LISTEN` |
| `recvQ` | `number` | |
| `sendQ` | `number` | |
| `localAddress` | `string` | IPv4, or IPv6 in `[...]` form, or `*` |
| `localPort` | `string` | Kept as a string since `*` is a valid value |
| `peerAddress` | `string` | |
| `peerPort` | `string` | |
| `process` | `string?` | Only present with `-p` and sufficient permissions, e.g. `users:(("node",pid=123,fd=10))` |

```ts
const sockets = await run<Socket[]>("ss", ["-tlnp"]);
const listeningOn8080 = sockets.find((s) => s.localPort === "8080");
```

## Error handling

```ts
import { run, parse, CommandNotFoundError, UnknownParserError } from "nixparse";
import { ZodError } from "zod";

try {
  const procs = await run("ps");
} catch (err) {
  if (err instanceof CommandNotFoundError) {
    console.error(`missing binary: ${err.command}`);
  } else if (err instanceof ZodError) {
    console.error("output didn't match the expected shape", err.issues);
  } else {
    throw err;
  }
}

try {
  parse("not-a-real-parser", "...");
} catch (err) {
  if (err instanceof UnknownParserError) {
    console.error(`no parser named "${err.name}"`);
  }
}
```

## Recipes

**Find the top 5 memory-hungry processes:**

```ts
import { run, type ProcessInfo } from "nixparse";

const procs = await run<ProcessInfo[]>("ps");
const top5 = [...procs].sort((a, b) => b.rss - a.rss).slice(0, 5);
```

**Alert if any disk is nearly full:**

```ts
import { run, type DiskUsage } from "nixparse";

const disks = await run<DiskUsage[]>("df");
for (const d of disks) {
  if (d.usePercent >= 90) {
    console.warn(`${d.mountedOn} is at ${d.usePercent}% (${d.filesystem})`);
  }
}
```

**Feed structured system state to an LLM agent prompt:**

```ts
import { run, type ProcessInfo, type MemoryInfo } from "nixparse";

const [procs, mem] = await Promise.all([
  run<ProcessInfo[]>("ps"),
  run<MemoryInfo>("free"),
]);

const summary = {
  topProcessesByCpu: procs.sort((a, b) => b.cpu - a.cpu).slice(0, 5),
  memoryUsedPercent: (mem.mem.used / mem.mem.total) * 100,
};
// JSON.stringify(summary) → safe to embed in a prompt, already validated
```

## Scope and limitations

- Built-in parsers target **Linux** output (GNU coreutils, iproute2, util-linux). They have not been tested against macOS/BSD variants of `ps`, `df`, etc., which use different flags and columns — these will likely throw, not silently misparse, since the fixed column layout won't match. PRs adding macOS variants are welcome.
- `lsof` visibility is limited by your process's permissions, same as running `lsof` directly.
- `who`'s `loginTime` is kept as a raw, locale-dependent string rather than parsed into a `Date`, since `who`'s date format isn't reliably machine-parseable across locales.
- `df`'s parser assumes the filesystem name doesn't cause the line to wrap (which can happen with very long NFS-style device strings) — wrapped lines will fail validation rather than silently producing wrong data.

## Development

```sh
git clone <this repo>
cd nixparse
npm install
npm run build       # tsup → dist/ (ESM + CJS + .d.ts)
npm run test        # vitest, runs against fixtures in test/fixtures/
npm run test:watch  # watch mode
npm run typecheck   # tsc --noEmit
```

Fixtures in `test/fixtures/*.txt` are real captured output from each command. When adding support for a new command or fixing an edge case, capture a real sample (`<command> > test/fixtures/<name>.txt`) rather than hand-writing one, so tests reflect actual tool behavior.

## License

MIT
