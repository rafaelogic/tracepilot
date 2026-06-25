export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function toHttpError(error: unknown) {
  if (error instanceof HttpError) return error;

  if (isPrismaError(error) && ["P1000", "P1001", "P1003", "P1010"].includes(error.code)) {
    return new HttpError(
      503,
      "Database is not ready. Start Postgres with `docker compose up -d`, then run `npm run prisma:migrate`."
    );
  }

  return new HttpError(400, error instanceof Error ? error.message : "Unexpected server error");
}

function isPrismaError(error: unknown): error is { code: string } {
  return Boolean(error && typeof error === "object" && "code" in error && typeof (error as { code?: unknown }).code === "string");
}
