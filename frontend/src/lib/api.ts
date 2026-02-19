function getBaseUrl(): string {
  // Server-side (SSR, RSC): use Docker service name
  if (typeof window === "undefined") {
    return process.env.API_URL || "http://api:8000";
  }
  // Client-side: use public URL (mapped port)
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    credentials: "include", // send httpOnly cookies on every request
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      window.location.href = "/login";
      // Return a never-resolving promise — the redirect is already happening
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
    const response = await fetch(`${getBaseUrl()}${path}`, {
      method: "POST",
      credentials: "include",
      body: form,
      // Do NOT set Content-Type — browser sets multipart boundary automatically
    });
    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ detail: "Upload failed" }));
      throw new Error(error.detail || response.statusText);
    }
    return response.json();
  },
};
