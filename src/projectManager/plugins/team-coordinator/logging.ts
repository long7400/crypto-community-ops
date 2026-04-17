export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function stringifyForLog(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
