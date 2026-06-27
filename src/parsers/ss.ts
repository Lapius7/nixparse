import { z } from "zod";
import type { ParserDefinition } from "../types.js";
import { splitNonEmptyLines } from "./_table.js";

export const SocketSchema = z.object({
  state: z.string(),
  recvQ: z.number().int(),
  sendQ: z.number().int(),
  localAddress: z.string(),
  localPort: z.string(),
  peerAddress: z.string(),
  peerPort: z.string(),
  process: z.string().optional(),
});

export type Socket = z.infer<typeof SocketSchema>;

/**
 * "host:port" 形式からportを切り出す。IPv6は `[::1]:631` のように
 * 括弧で囲まれるため、最後の `:` で分割すれば host/port とも安全に取れる。
 */
function splitAddrPort(token: string): { address: string; port: string } {
  const lastColon = token.lastIndexOf(":");
  if (lastColon === -1) {
    return { address: token, port: "" };
  }
  return {
    address: token.slice(0, lastColon),
    port: token.slice(lastColon + 1),
  };
}

function parseSs(raw: string): unknown {
  const lines = splitNonEmptyLines(raw);
  const dataLines = lines.slice(1);

  return dataLines.map((line) => {
    const parts = line.trim().split(/\s+/);
    const [state, recvQ, sendQ, localToken, peerAndRest] = parts;
    const local = splitAddrPort(localToken ?? "");

    // peer列の直後にProcess列がスペースなしで連結されるケース(`*:*    users:(...)`)があるため
    // 残りの文字列から最初の空白までをpeerトークンとし、それ以降をprocessとする
    const rest = parts.slice(4).join(" ");
    const peerMatch = rest.match(/^(\S+)\s*(.*)$/);
    const peerToken = peerMatch?.[1] ?? peerAndRest ?? "";
    const processPart = peerMatch?.[2]?.trim();
    const peer = splitAddrPort(peerToken);

    return {
      state,
      recvQ: Number(recvQ),
      sendQ: Number(sendQ),
      localAddress: local.address,
      localPort: local.port,
      peerAddress: peer.address,
      peerPort: peer.port,
      process: processPart || undefined,
    };
  });
}

export const ssParser: ParserDefinition<Socket[]> = {
  schema: z.array(SocketSchema),
  parse: parseSs,
};
