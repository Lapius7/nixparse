import type { z } from "zod";

export interface ParserDefinition<T> {
  schema: z.ZodType<T>;
  parse: (raw: string) => unknown;
}

export type AnyParserDefinition = ParserDefinition<unknown>;

export class CommandNotFoundError extends Error {
  constructor(public readonly command: string) {
    super(`Command not found: "${command}". Is it installed and on PATH?`);
    this.name = "CommandNotFoundError";
  }
}

export class UnknownParserError extends Error {
  constructor(public readonly name: string) {
    super(
      `No parser registered for "${name}". Use registerParser() to add a custom one.`,
    );
    this.name = "UnknownParserError";
  }
}
