export type QueryResult<T> = { rows: T[] };

export type SqlClient = {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>>;
  transact<T>(fn: (client: SqlClient) => Promise<T>): Promise<T>;
};

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "23505"
  );
}
