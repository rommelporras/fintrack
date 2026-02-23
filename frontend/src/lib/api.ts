import { enqueue } from "./sync-queue";

function getBaseUrl(): string {
  // Server-side (SSR, RSC): use Docker service name
  if (typeof window === "undefined") {
    return process.env.API_URL || "http://api:8000";
  }
  // Client-side: use public URL (mapped port)
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${getBaseUrl()}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

const WRITE_METHODS = new Set(["POST", "PATCH", "DELETE"]);

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();

  let response: Response;
  try {
    response = await fetch(`${getBaseUrl()}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch (err) {
    // Network error (offline)
    if (
      err instanceof TypeError &&
      typeof window !== "undefined" &&
      WRITE_METHODS.has(method)
    ) {
      await enqueue(
        method,
        path,
        typeof options.body === "string" ? options.body : null,
      );
      return undefined as T;
    }
    throw err;
  }

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      // Don't try to refresh the refresh endpoint itself
      if (path === "/auth/refresh") {
        window.location.href = "/login";
        return new Promise(() => {}) as Promise<T>;
      }
      // Mutex: only one refresh at a time
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = tryRefresh().finally(() => {
          isRefreshing = false;
          refreshPromise = null;
        });
      }
      const refreshed = await refreshPromise;
      if (refreshed) {
        return request<T>(path, options);
      }
      window.location.href = "/login";
      return new Promise(() => {}) as Promise<T>;
    }
    const error = await response
      .json()
      .catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || response.statusText);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: async <T>(path: string, form: FormData): Promise<T> => {
    const url = `${getBaseUrl()}${path}`;
    const doUpload = async (): Promise<Response> => {
      return fetch(url, {
        method: "POST",
        credentials: "include",
        body: form,
      });
    };

    let response = await doUpload();

    if (response.status === 401) {
      const refreshed = await tryRefresh();
      if (refreshed) {
        response = await doUpload();
      } else {
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        return undefined as T;
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Upload failed" }));
      const detail = error.detail;
      const message = Array.isArray(detail)
        ? detail.map((e: { msg: string }) => e.msg).join("; ")
        : (detail as string) || response.statusText;
      throw new Error(message);
    }
    return response.json();
  },
};
