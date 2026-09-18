export interface TransportInit {
  readonly method: "POST";
  readonly headers: Record<string, string>;
  readonly body: string;
  readonly signal?: AbortSignal;
}

export interface TransportResponse {
  readonly status: number;
  json(): Promise<unknown>;
}

/** Subset of fetch, injectable so tests and --dry-run never touch the network. */
export type Transport = (url: string, init: TransportInit) => Promise<TransportResponse>;

export const fetchTransport: Transport = async (url, init) => {
  const res = await fetch(url, init);
  return { status: res.status, json: () => res.json() as Promise<unknown> };
};

export type Sleep = (ms: number) => Promise<void>;
export const realSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Carries only the status and the provider's error type — never headers, keys or bodies. */
export class EngineHttpError extends Error {
  constructor(
    readonly status: number,
    readonly providerErrorType: string | null,
  ) {
    super(`engine request failed: HTTP ${status}${providerErrorType ? ` (${providerErrorType})` : ""}`);
    this.name = "EngineHttpError";
  }
}

const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 504, 529]);
const TIMEOUT_MS = 120_000;

const providerErrorType = (body: unknown): string | null => {
  if (typeof body !== "object" || body === null || !("error" in body)) return null;
  const error = (body as { error: unknown }).error;
  if (typeof error === "object" && error !== null && "type" in error && typeof error.type === "string") {
    return error.type.slice(0, 80);
  }
  return null;
};

export interface PostJsonInput {
  readonly transport: Transport;
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly body: unknown;
  readonly sleep: Sleep;
  readonly retries?: number;
  readonly baseDelayMs?: number;
}

/** POST with exponential backoff + jitter on 429/5xx and network errors; 4xx client errors fail fast. */
export const postJson = async ({ transport, url, headers, body, sleep, retries = 3, baseDelayMs = 1000 }: PostJsonInput): Promise<unknown> => {
  const payload = JSON.stringify(body);
  for (let attempt = 0; ; attempt += 1) {
    let res: TransportResponse;
    try {
      res = await transport(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: payload,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      if (attempt >= retries) throw new Error(`engine request failed: network error after ${attempt + 1} attempts`);
      await sleep(baseDelayMs * 2 ** attempt + Math.floor(Math.random() * 250));
      continue;
    }
    if (res.status >= 200 && res.status < 300) return res.json();
    const errorBody = await res.json().catch(() => null);
    if (!RETRYABLE.has(res.status) || attempt >= retries) {
      throw new EngineHttpError(res.status, providerErrorType(errorBody));
    }
    await sleep(baseDelayMs * 2 ** attempt + Math.floor(Math.random() * 250));
  }
};
