import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { CommandNotFoundError } from "./types.js";

const execFileAsync = promisify(execFile);

export async function runCommand(
  command: string,
  args: string[],
): Promise<string> {
  try {
    const { stdout } = await execFileAsync(command, args, {
      maxBuffer: 1024 * 1024 * 32,
    });
    return stdout;
  } catch (err) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code === "ENOENT") {
      throw new CommandNotFoundError(command);
    }
    throw err;
  }
}
