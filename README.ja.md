# nixparse

[![npm version](https://img.shields.io/npm/v/nixparse.svg)](https://www.npmjs.com/package/nixparse)

`ps`, `df`, `du`, `free`, `lsof`, `mount`, `who`, `uptime`, `ip`, `ss` といった古典的なUnixコマンドの出力を、[Zod](https://zod.dev)で実行時検証しながら型安全にパースするライブラリです。

**npm:** https://www.npmjs.com/package/nixparse

[English README](./README.md)

これらのコマンドの多くは`docker`や`kubectl`のような`--json`オプションを持たず、出力は長らく場当たり的な正規表現でスクレイピングされてきました。`nixparse`はそれらすべてに対して、単一の・型付けされた・拡張可能なインターフェースを提供します。

- **実行時検証**: すべてのパース結果はZodスキーマで検証されるため、フォーマットが想定と異なる場合は黒魔術的に誤った値を返すのではなく`ZodError`が投げられます。
- **シェルを使わない＝インジェクションのリスクがない**: `run()`は`child_process.execFile`を使い、シェルを経由しません。引数が文字列としてコマンドラインに展開されることはありません。
- **拡張可能**: `registerParser()`で任意のコマンド用パーサーを自分で追加登録できます。
- **ESM/CJS両対応**のビルドと完全な`.d.ts`型定義付き。

## 目次

- [インストール](#インストール)
- [クイックスタート](#クイックスタート)
- [基本概念](#基本概念)
- [APIリファレンス](#apiリファレンス)
  - [`parse(name, raw)`](#parsename-raw)
  - [`run(name, args?)`](#runname-args)
  - [`registerParser(name, definition)`](#registerparsername-definition)
- [対応コマンド一覧(全フィールド解説)](#対応コマンド一覧全フィールド解説)
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
- [エラーハンドリング](#エラーハンドリング)
- [実用例](#実用例)
- [対応範囲・制限事項](#対応範囲制限事項)
- [開発](#開発)
- [ライセンス](#ライセンス)

## インストール

```sh
npm install nixparse
```

Node.js 18以上が必要です。コマンドはホストOS上で実際に実行されるため(Linux想定。詳細は[対応範囲・制限事項](#対応範囲制限事項)を参照)、対象のバイナリ(`ps`, `df`等)が事前にインストールされ`PATH`上にある必要があります。

## クイックスタート

```ts
import { run, type ProcessInfo } from "nixparse";

const processes = await run<ProcessInfo[]>("ps");
console.log(processes[0].pid, processes[0].command);
```

これだけです。`run()`は内部で`ps aux`を実行し、標準出力をパースし、Zodスキーマで検証してから、完全に型付けされた配列を返します。

## 基本概念

nixparseでデータを取得する方法は2つあります。すでに生の出力を持っているか、nixparseに取得させたいかで選びます。

| | すでにテキストを持っている場合 | nixparseにコマンドを実行させたい場合 |
|---|---|---|
| 関数 | [`parse(name, raw)`](#parsename-raw) | [`run(name, args?)`](#runname-args) |
| 用途 | 他所からパイプされた出力、エージェントが取得済みの出力、ログ/fixtureファイルから読んだ出力 | 通常のアプリケーションコード |
| 副作用 | なし(純粋関数) | 子プロセスを起動する |

どちらも同じパーサーレジストリを経由するため、返る型や検証の挙動は同一です。

## APIリファレンス

### `parse(name, raw)`

```ts
function parse<T = unknown>(name: string, raw: string): T;
```

`name`に登録されたパーサーで生文字列`raw`をパースし、そのパーサーのZodスキーマで結果を検証して返します。

- `name` — パーサー名([対応コマンド一覧](#対応コマンド一覧全フィールド解説)を参照)。組み込みパーサーについては文字列リテラル型`BuiltinCommandName`によって補完が効きます。
- `raw` — 対応コマンドの標準出力そのもの(各パーサーがどの実行形式を想定しているかは「`run()`が実行するコマンド」列を参照)。
- `name`が未登録の場合は`UnknownParserError`を投げます。
- パース結果がスキーマと一致しない場合(例: 間違ったコマンドの出力を渡した場合)はZodの`ZodError`を投げます。

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

**組み込み**パーサーに対応するバイナリを実行し、その出力を一度にパースします。組み込みの11コマンド名でのみ動作します(`registerParser`で追加したカスタムパーサーは実行できません — `run()`はそのパーサーがどのバイナリ・引数を必要とするかを知らないためです)。

- `name` — `"ps" | "df" | "du" | "free" | "lsof" | "mount" | "who" | "uptime" | "ip-addr" | "ip-route" | "ss"`のいずれか。
- `args` — 省略可能。パーサーのデフォルト引数を上書きします(例: `du`はパスが必須なので、ほぼ必ず指定することになります)。省略時は各パーサーのドキュメント化されたデフォルトが使われます(下表参照)。
- 内部的には`child_process.execFile(binary, args)`を使用しており、**シェルは一切起動されません**。そのため`args`にユーザー入力由来の文字列が含まれていてもコマンドインジェクションのリスクはありません。
- バイナリが`PATH`上にない場合は`CommandNotFoundError`を投げます。
- 出力がスキーマと一致しない場合(想定外のOS/出力フォーマット等)は`parse()`と同様にZodのエラーを投げます。

```ts
import { run, type DirSize } from "nixparse";

// デフォルト引数を上書き — duはパスの明示が必要
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

グローバルなレジストリにパーサーを追加(または上書き)し、すぐに`parse()`から使えるようにします。これがnixparseに同梱されていないコマンドへ対応を広げる方法です。

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

注意: `registerParser`は`parse()`から使えるようにするだけです。`run()`のような一発実行も欲しい場合は、自分でコマンドを実行して`parse()`を呼ぶ薄いラッパーを書いてください。

## 対応コマンド一覧(全フィールド解説)

すべての組み込みパーサーは**Linux(GNU coreutils / iproute2 / util-linux)**の出力を前提としています。他プラットフォームについては[対応範囲・制限事項](#対応範囲制限事項)を参照してください。

### `ps`

- 名前: `"ps"` · デフォルトコマンド: `ps aux` · 返り値: `ProcessInfo[]`

| フィールド | 型 | 元の列 | 補足 |
|---|---|---|---|
| `user` | `string` | `USER` | |
| `pid` | `number` | `PID` | |
| `cpu` | `number` | `%CPU` | |
| `mem` | `number` | `%MEM` | |
| `vsz` | `number` | `VSZ` | 仮想メモリサイズ(KB) |
| `rss` | `number` | `RSS` | 実メモリ使用量(KB) |
| `tty` | `string` | `TTY` | 制御端末がない場合は`?` |
| `stat` | `string` | `STAT` | プロセス状態コード(例: `Ss`, `R+`) |
| `start` | `string` | `START` | `ps`がそのまま出力した文字列(時刻または日付) |
| `time` | `string` | `TIME` | 累積CPU時間 |
| `command` | `string` | `COMMAND` | 引数を含む完全なコマンドライン。スペースで切れることはありません |

```ts
const procs = await run<ProcessInfo[]>("ps");
const highCpu = procs.filter((p) => p.cpu > 50);
```

### `df`

- 名前: `"df"` · デフォルトコマンド: `df -k` · 返り値: `DiskUsage[]`

| フィールド | 型 | 元の列 | 補足 |
|---|---|---|---|
| `filesystem` | `string` | `Filesystem` | |
| `blocksKb` | `number` | `1K-blocks` | 合計サイズ(KB) |
| `usedKb` | `number` | `Used` | KB |
| `availableKb` | `number` | `Available` | KB |
| `usePercent` | `number` | `Use%` | 数値型。`%`記号は除去済み(例: `"42%"`ではなく`42`) |
| `mountedOn` | `string` | `Mounted on` | |

```ts
const disks = await run<DiskUsage[]>("df");
const full = disks.filter((d) => d.usePercent >= 90);
```

### `du`

- 名前: `"du"` · デフォルトコマンド: `du -k`(パス指定なし — 自分で指定すべき) · 返り値: `DirSize[]`

| フィールド | 型 | 補足 |
|---|---|---|
| `sizeKb` | `number` | サイズ(KB) |
| `path` | `string` | `du`が出力したままのパス |

`du`は対象パスを引数として必要とするため、(パス指定のない)デフォルトに頼るのではなく、ほぼ常に`run("du", ["-k", "/some/path"])`の形で呼び出すことになります。

```ts
const sizes = await run<DirSize[]>("du", ["-k", "-d", "1", "/home/me/projects"]);
```

### `free`

- 名前: `"free"` · デフォルトコマンド: `free -b` · 返り値: `MemoryInfo`

`-b`(バイト単位)をデフォルトにしているのは、値を単純な数値として保つためです。`-h`(人間が読みやすい形式、例: `"3.8Gi"`)は単位が文字列に混在するため**対応していません**。

| フィールド | 型 | 補足 |
|---|---|---|
| `mem.total` | `number` | バイト |
| `mem.used` | `number` | バイト |
| `mem.free` | `number` | バイト |
| `mem.shared` | `number` | バイト |
| `mem.buffCache` | `number` | バイト(`buff/cache`列) |
| `mem.available` | `number` | バイト |
| `swap.total` | `number` | バイト |
| `swap.used` | `number` | バイト |
| `swap.free` | `number` | バイト |

```ts
const mem = await run<MemoryInfo>("free");
const usedPercent = (mem.mem.used / mem.mem.total) * 100;
```

### `lsof`

- 名前: `"lsof"` · デフォルトコマンド: `lsof -F pcufTtn` · 返り値: `OpenFile[]`

人間向けのテーブル表示をスクレイピングするのではなく、lsofの`-F`フィールド出力モードを使用しています。スペースを含むファイル名や長いコマンド名に対してもはるかに頑健です。開いているファイルディスクリプタごとに1エントリとなり、それを所有するプロセスのPID/コマンド名/ユーザーも併せて持ちます。

| フィールド | 型 | 補足 |
|---|---|---|
| `pid` | `number` | 所有プロセスのID |
| `command` | `string` | 所有プロセスのコマンド名 |
| `user` | `string` | 所有プロセスのユーザー(lsofが出力した数値UIDのまま) |
| `fd` | `string` | ファイルディスクリプタ(例: `cwd`, `txt`, `mem`、または数値) |
| `type` | `string` | ファイル種別(例: `DIR`, `REG`, `IPv4`, `unknown`) |
| `name` | `string` | パス、またはソケット/デバイスの説明 |

```ts
// /var/log 以下のファイルを開いている全プロセス
const open = await run<OpenFile[]>("lsof");
const logUsers = open.filter((f) => f.name.startsWith("/var/log"));
```

root権限がない場合、lsofは自分自身のプロセスが開いているファイルしか見えません。これはOSの権限による制約であり、nixparse自体の制限ではありません。

### `mount`

- 名前: `"mount"` · デフォルトコマンド: `mount` · 返り値: `MountPoint[]`

| フィールド | 型 | 補足 |
|---|---|---|
| `device` | `string` | 例: `/dev/sda1`, `none`, `tmpfs` |
| `path` | `string` | マウントポイント |
| `fsType` | `string` | 例: `ext4`, `overlay`, `tmpfs` |
| `options` | `string[]` | `,`で分割されたマウントオプション(例: `["rw", "relatime"]`) |

```ts
const mounts = await run<MountPoint[]>("mount");
const readOnly = mounts.filter((m) => m.options.includes("ro"));
```

### `who`

- 名前: `"who"` · デフォルトコマンド: `who` · 返り値: `LoggedInUser[]`

| フィールド | 型 | 補足 |
|---|---|---|
| `user` | `string` | |
| `tty` | `string` | 例: `pts/1` |
| `loginTime` | `string` | `who`がそのまま出力した文字列(ロケール依存のフォーマットのため、`Date`型へ変換せず文字列のまま保持) |

### `uptime`

- 名前: `"uptime"` · デフォルトコマンド: `uptime` · 返り値: `UptimeInfo`

| フィールド | 型 | 補足 |
|---|---|---|
| `currentTime` | `string` | 出力された現在時刻(例: `"14:32:10"`) |
| `upDays` | `number` | 稼働時間が1日未満なら`0` |
| `upHours` | `number` | |
| `upMinutes` | `number` | |
| `users` | `number` | ログイン中のユーザー数 |
| `loadAverage1m` | `number` | |
| `loadAverage5m` | `number` | |
| `loadAverage15m` | `number` | |

```ts
const up = await run<UptimeInfo>("uptime");
if (up.loadAverage1m > 4) console.warn("システム負荷が高い");
```

### `ip-addr`

- 名前: `"ip-addr"` · デフォルトコマンド: `ip -j addr` · 返り値: `NetworkInterface[]`

`ip -j`は元からネイティブなJSONを出力します。このパーサーはテキストのスクレイピングを**一切行わず**、`JSON.parse`の後にZod検証をかけるだけです。たまたまJSON対応していたコマンドの上に、保証された形(と完全なTypeScript型)を載せている形です。

| フィールド | 型 | 補足 |
|---|---|---|
| `ifindex` | `number` | |
| `ifname` | `string` | 例: `eth0`, `lo` |
| `flags` | `string[]` | 例: `["BROADCAST", "MULTICAST", "UP"]` |
| `mtu` | `number` | |
| `qdisc` | `string` | |
| `operstate` | `string` | 例: `UP`, `DOWN`, `UNKNOWN` |
| `group` | `string` | |
| `txqlen` | `number?` | 省略可能 — 全てのインターフェース種別に存在するわけではない |
| `link_type` | `string` | 例: `ether`, `loopback` |
| `address` | `string` | MACアドレス |
| `broadcast` | `string?` | 省略可能 |
| `addr_info` | `AddrInfo[]` | 下記参照 |

`AddrInfo`:

| フィールド | 型 | 補足 |
|---|---|---|
| `family` | `string` | `"inet"`または`"inet6"` |
| `local` | `string` | IPアドレス |
| `prefixlen` | `number` | |
| `broadcast` | `string?` | 省略可能 |
| `scope` | `string` | 例: `global`, `host`, `link` |
| `label` | `string?` | 省略可能 |
| `valid_life_time` | `number` | |
| `preferred_life_time` | `number` | |

```ts
const ifaces = await run<NetworkInterface[]>("ip-addr");
const eth0 = ifaces.find((i) => i.ifname === "eth0");
const ipv4 = eth0?.addr_info.find((a) => a.family === "inet")?.local;
```

### `ip-route`

- 名前: `"ip-route"` · デフォルトコマンド: `ip -j route` · 返り値: `RouteEntry[]`

`ip-addr`と同じアプローチです。ネイティブJSONをパースではなく検証します。

| フィールド | 型 | 補足 |
|---|---|---|
| `dst` | `string` | 宛先(例: `"default"`またはCIDR) |
| `gateway` | `string?` | 省略可能 |
| `dev` | `string?` | 省略可能、送出インターフェース |
| `protocol` | `string?` | 省略可能 |
| `scope` | `string?` | 省略可能 |
| `prefsrc` | `string?` | 省略可能、優先送信元アドレス |
| `flags` | `string[]` | |

```ts
const routes = await run<RouteEntry[]>("ip-route");
const defaultRoute = routes.find((r) => r.dst === "default");
```

### `ss`

- 名前: `"ss"` · デフォルトコマンド: `ss -tln` · 返り値: `Socket[]`

`[::1]:631`のような括弧付きIPv6アドレスを、先頭の`:`ではなく**最後の**`:`で分割することで正しく扱います。権限が許せば所有プロセスも取得したい場合は、デフォルトの代わりに`["-tlnp"]`を渡してください。

| フィールド | 型 | 補足 |
|---|---|---|
| `state` | `string` | 例: `LISTEN` |
| `recvQ` | `number` | |
| `sendQ` | `number` | |
| `localAddress` | `string` | IPv4、または`[...]`形式のIPv6、または`*` |
| `localPort` | `string` | `*`も有効な値であるため文字列のまま保持 |
| `peerAddress` | `string` | |
| `peerPort` | `string` | |
| `process` | `string?` | `-p`オプション付きかつ権限がある場合のみ存在(例: `users:(("node",pid=123,fd=10))`) |

```ts
const sockets = await run<Socket[]>("ss", ["-tlnp"]);
const listeningOn8080 = sockets.find((s) => s.localPort === "8080");
```

## エラーハンドリング

```ts
import { run, parse, CommandNotFoundError, UnknownParserError } from "nixparse";
import { ZodError } from "zod";

try {
  const procs = await run("ps");
} catch (err) {
  if (err instanceof CommandNotFoundError) {
    console.error(`バイナリが見つかりません: ${err.command}`);
  } else if (err instanceof ZodError) {
    console.error("出力が想定の形式と一致しませんでした", err.issues);
  } else {
    throw err;
  }
}

try {
  parse("not-a-real-parser", "...");
} catch (err) {
  if (err instanceof UnknownParserError) {
    console.error(`"${err.name}" という名前のパーサーは存在しません`);
  }
}
```

## 実用例

**メモリ使用量トップ5のプロセスを探す:**

```ts
import { run, type ProcessInfo } from "nixparse";

const procs = await run<ProcessInfo[]>("ps");
const top5 = [...procs].sort((a, b) => b.rss - a.rss).slice(0, 5);
```

**ディスクがほぼ満杯になっていないかチェックする:**

```ts
import { run, type DiskUsage } from "nixparse";

const disks = await run<DiskUsage[]>("df");
for (const d of disks) {
  if (d.usePercent >= 90) {
    console.warn(`${d.mountedOn} が ${d.usePercent}% 使用中 (${d.filesystem})`);
  }
}
```

**LLMエージェントへ渡すプロンプト用に、構造化したシステム状態を作る:**

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
// JSON.stringify(summary) → 既に検証済みなのでプロンプトに埋め込んでも安全
```

## 対応範囲・制限事項

- 組み込みパーサーは**Linux**の出力(GNU coreutils, iproute2, util-linux)を前提としています。macOS/BSD系の`ps`, `df`等はオプションや列構成が異なるため未検証です。固定の列レイアウトと一致しないため、誤った値を黒魔術的に返すのではなく、エラーを投げる可能性が高いです。macOS対応のPRは歓迎します。
- `lsof`で見える範囲は、`lsof`を直接実行した場合と同様にプロセスの権限に制限されます。
- `who`の`loginTime`はロケール依存の生文字列のまま保持しており、`Date`型へは変換していません。`who`の日付フォーマットはロケールをまたいで確実に機械的にパースできるとは言えないためです。
- `df`のパーサーは、ファイルシステム名が長くて行が折れない(NFS形式の長いデバイス文字列等で発生しうる)ことを前提としています。行が折れた場合は誤ったデータを黒魔術的に返すのではなく、検証エラーになります。

## 開発

```sh
git clone <このリポジトリ>
cd nixparse
npm install
npm run build       # tsup → dist/ (ESM + CJS + .d.ts)
npm run test        # vitest。test/fixtures/ 内のfixtureに対して実行
npm run test:watch  # ウォッチモード
npm run typecheck   # tsc --noEmit
```

`test/fixtures/*.txt`内のfixtureは、各コマンドを実際に実行して取得した本物の出力です。新しいコマンド対応を追加したりエッジケースを修正する際は、手書きで作るのではなく実際にサンプルを取得してください(`<command> > test/fixtures/<name>.txt`)。テストが実際のツールの挙動を反映するようにするためです。

## ライセンス

MIT
