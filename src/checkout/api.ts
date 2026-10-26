// SDK API client of the hosted page. Keyed by the page's store, not by the
// funnel's global config; it never touches cookies or customers.

export interface ApiClientOptions {
  apiHost: string;
  apiKey: string;
  retries?: number;
  retryDelay?: number;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
    message: string,
  ) {
    super(message);
  }
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

export interface ApiClient {
  post: (path: string, body: unknown) => Promise<ApiResponse>;
}

declare global {
  interface Window {
    ApphudCheckoutVersion?: string;
  }
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const readBody = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

export function createApiClient(options: ApiClientOptions): ApiClient {
  const retries = options.retries ?? 2;
  const retryDelay = options.retryDelay ?? 1000;
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    Authorization: `Bearer ${options.apiKey}`,
    "X-SDK": "web2web",
    "X-SDK-VERSION":
      (typeof window !== "undefined" && window.ApphudCheckoutVersion) ||
      "unknown",
    "X-Platform": "web2web",
    "X-Store": "web2web",
  };

  // Network errors and 5xx are retried with a growing delay; any other status
  // is the caller's answer (sync reads 202, 404, 422 and 429 itself).
  async function post(path: string, body: unknown): Promise<ApiResponse> {
    let delay = retryDelay;
    for (let attempt = 0; ; attempt++) {
      let error: unknown;
      try {
        const response = await fetch(options.apiHost + path, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
        if (response.status < 500) {
          return { status: response.status, body: await readBody(response) };
        }
        error = new HttpError(
          response.status,
          await readBody(response),
          `HTTP ${response.status}`,
        );
      } catch (e) {
        error = e;
      }
      if (attempt >= retries) throw error;
      await sleep(delay);
      delay *= 2;
    }
  }

  return { post };
}
