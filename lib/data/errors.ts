import { failFromDatabase, type DatabaseErrorLike } from "@/lib/actions/errors";
import type { ActionErrorCode } from "@/lib/actions/result";

/** Thrown by server-side read helpers; carries the same stable codes as Server Actions. */
export class DataAccessError extends Error {
  readonly code: ActionErrorCode;

  constructor(code: ActionErrorCode, message: string) {
    super(message);
    this.name = "DataAccessError";
    this.code = code;
  }
}

export function toDataAccessError(context: string, error: DatabaseErrorLike): DataAccessError {
  const failure = failFromDatabase(context, error);
  return new DataAccessError(failure.error.code, failure.error.message);
}
