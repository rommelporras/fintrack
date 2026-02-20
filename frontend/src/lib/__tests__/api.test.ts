import { http, HttpResponse } from "msw";
import { server } from "@/__tests__/mocks/server";
import { api } from "@/lib/api";

const BASE = "http://localhost:8000";

describe("api", () => {
  it("GET returns parsed JSON", async () => {
    server.use(
      http.get(`${BASE}/test`, () => HttpResponse.json({ ok: true }))
    );
    const data = await api.get<{ ok: boolean }>("/test");
    expect(data).toEqual({ ok: true });
  });

  it("POST sends body and returns JSON", async () => {
    server.use(
      http.post(`${BASE}/test`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json(body, { status: 201 });
      })
    );
    const data = await api.post<{ name: string }>("/test", { name: "hello" });
    expect(data).toEqual({ name: "hello" });
  });

  it("PATCH sends body and returns JSON", async () => {
    server.use(
      http.patch(`${BASE}/test/1`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json(body);
      })
    );
    const data = await api.patch<{ updated: boolean }>("/test/1", { updated: true });
    expect(data).toEqual({ updated: true });
  });

  it("DELETE returns undefined on 204", async () => {
    server.use(
      http.delete(`${BASE}/test/1`, () => new HttpResponse(null, { status: 204 }))
    );
    const data = await api.delete("/test/1");
    expect(data).toBeUndefined();
  });

  it("redirects to /login on 401", async () => {
    const originalLocation = window.location.href;
    // Mock window.location
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...window.location, href: originalLocation },
    });

    server.use(
      http.get(`${BASE}/protected`, () =>
        HttpResponse.json({ detail: "Not authenticated" }, { status: 401 })
      )
    );

    // The promise never resolves (by design), so we race it with a timeout
    const result = await Promise.race([
      api.get("/protected").then(() => "resolved"),
      new Promise<string>((r) => setTimeout(() => r("pending"), 100)),
    ]);

    expect(result).toBe("pending");
    expect(window.location.href).toBe("/login");
  });

  it("throws with error detail on failure", async () => {
    server.use(
      http.post(`${BASE}/fail`, () =>
        HttpResponse.json({ detail: "Validation error" }, { status: 422 })
      )
    );
    await expect(api.post("/fail", {})).rejects.toThrow("Validation error");
  });

  it("handles 204 with no body", async () => {
    server.use(
      http.post(`${BASE}/empty`, () => new HttpResponse(null, { status: 204 }))
    );
    const data = await api.post("/empty", {});
    expect(data).toBeUndefined();
  });
});
