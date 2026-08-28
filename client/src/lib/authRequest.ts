const DEFAULT_AUTH_REQUEST_TIMEOUT_MS = 15_000;

export function withAuthRequestTimeout<T>(
  request: PromiseLike<T>,
  timeoutMs = DEFAULT_AUTH_REQUEST_TIMEOUT_MS,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("AUTH_REQUEST_TIMEOUT"));
    }, timeoutMs);
  });

  return Promise.race([Promise.resolve(request), timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}
