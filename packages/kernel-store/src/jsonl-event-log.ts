import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  EventSchema,
  type Event
} from "../../kernel-contracts/src/index.js";
import { redactSecretLikeFields } from "../../governance-internal-redaction/src/index.js";

export type JsonlEventLogReadIssue = {
  lineNumber: number;
  code: "invalid_json" | "invalid_event";
  message: string;
  line: string;
};

export type JsonlEventLogOrderIssue = {
  previousEventId: string;
  currentEventId: string;
  previousCreatedAt: string;
  currentCreatedAt: string;
};

export type JsonlEventLogOrderResult = {
  ok: boolean;
  issues: JsonlEventLogOrderIssue[];
};

export type JsonlEventLogOptions = {
  path: string;
};

export class JsonlEventLogReadError extends Error {
  readonly errors: JsonlEventLogReadIssue[];

  constructor(errors: JsonlEventLogReadIssue[], options: { cause?: unknown } = {}) {
    super(
      "jsonl_event_log_read_error",
      "cause" in options ? { cause: options.cause } : undefined
    );
    this.name = "JsonlEventLogReadError";
    this.errors = errors;
  }
}

export class JsonlEventLog {
  private readonly path: string;

  constructor(options: JsonlEventLogOptions) {
    this.path = options.path;
  }

  async append(event: Event): Promise<Event> {
    await mkdir(dirname(this.path), { recursive: true });
    const redacted = redactEventSecrets(EventSchema.parse(event));
    const line = JSON.stringify(redacted) + "\n";
    await writeFile(this.path, line, { flag: "a", encoding: "utf8" });
    return redacted;
  }

  async readAll(): Promise<Event[]> {
    const content = await readFile(this.path, "utf8").catch((error: unknown) => {
      if (isNodeError(error) && error.code === "ENOENT") {
        return "";
      }

      throw error;
    });

    if (!content) {
      return [];
    }

    return parseJsonlEvents(content);
  }

  async readByRunId(runId: string): Promise<Event[]> {
    return (await this.readAll()).filter((event) => event.runId === runId);
  }

  async readByTaskId(taskId: string): Promise<Event[]> {
    return (await this.readAll()).filter((event) => event.taskId === taskId);
  }

  async verifyOrder(): Promise<JsonlEventLogOrderResult> {
    const events = await this.readAll();
    const issues: JsonlEventLogOrderIssue[] = [];

    for (let index = 1; index < events.length; index += 1) {
      const previous = events[index - 1];
      const current = events[index];

      if (!previous || !current) {
        continue;
      }

      if (Date.parse(previous.createdAt) > Date.parse(current.createdAt)) {
        issues.push({
          previousEventId: previous.eventId,
          currentEventId: current.eventId,
          previousCreatedAt: previous.createdAt,
          currentCreatedAt: current.createdAt
        });
      }
    }

    return {
      ok: issues.length === 0,
      issues
    };
  }
}

export function redactEventSecrets(event: Event): Event {
  return EventSchema.parse(redactSecretLikeFields(event, {
    redactArgvSecrets: true,
    redactStrings: true
  }));
}

function parseJsonlEvents(content: string): Event[] {
  const events: Event[] = [];
  const errors: JsonlEventLogReadIssue[] = [];
  let firstCause: unknown;
  const lines = content.split(/\r?\n/);

  for (const [index, rawLine] of lines.entries()) {
    if (!rawLine.trim()) {
      continue;
    }

    const lineNumber = index + 1;
    let parsedJson: unknown;

    try {
      parsedJson = JSON.parse(rawLine);
    } catch (error) {
      firstCause ??= error;
      errors.push({
        lineNumber,
        code: "invalid_json",
        message: formatInvalidJsonMessage(lineNumber),
        line: rawLine
      });
      continue;
    }

    const parsedEvent = EventSchema.safeParse(parsedJson);
    if (!parsedEvent.success) {
      errors.push({
        lineNumber,
        code: "invalid_event",
        message: parsedEvent.error.message,
        line: rawLine
      });
      continue;
    }

    events.push(parsedEvent.data);
  }

  if (errors.length > 0) {
    throw new JsonlEventLogReadError(
      errors,
      firstCause === undefined ? {} : { cause: firstCause }
    );
  }

  return events;
}

function formatInvalidJsonMessage(lineNumber: number): string {
  return `Expected JSONL event log line ${lineNumber} to contain valid JSON.`;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
