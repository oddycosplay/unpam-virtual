export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const isForm = init.body instanceof FormData;
  const res = await fetch(path, {
    method: init.method ?? "GET",
    credentials: "include",
    headers: init.body === undefined || isForm ? undefined : { "content-type": "application/json" },
    body: init.body === undefined ? undefined : isForm ? (init.body as FormData) : JSON.stringify(init.body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError((data as { error?: string }).error ?? `Error ${res.status}`, res.status);
  return data as T;
}
