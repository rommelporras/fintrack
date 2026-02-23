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

  it("joins array detail from Pydantic validation errors", async () => {
    server.use(
      http.post(`${BASE}/validate`, () =>
        HttpResponse.json(
          {
            detail: [
              { msg: "field required", loc: ["body", "amount"] },
              { msg: "value is not a valid number", loc: ["body", "amount"] },
            ],
          },
          { status: 422 }
        )
      )
    );
    await expect(api.post("/validate", {})).rejects.toThrow(
      "field required; value is not a valid number"
    );
  });

  it("handles 204 with no body", async () => {
    server.use(
      http.post(`${BASE}/empty`, () => new HttpResponse(null, { status: 204 }))
    );
    const data = await api.post("/empty", {});
    expect(data).toBeUndefined();
  });

  it("second 401 after completed refresh cycle triggers a new refresh, not the stale promise", async () => {
    // Regression test for the stale refreshPromise bug (A4).
    //
    // The bug: the .finally() block only reset isRefreshing, leaving
    // refreshPromise holding the old resolved Promise. Any concurrent
    // request that checked isRefreshing=true (and therefore skipped the
    // if-block) after the finally ran would await that stale Promise<boolean>.
    //
    // This test verifies the end-to-end sequential behaviour: two independent
    // 401/refresh cycles each complete successfully and each call /auth/refresh
    // exactly once, confirming refreshPromise is properly cleared between cycles.
    let refreshCallCount = 0;
    let resource1Calls = 0;
    let resource2Calls = 0;

    server.use(
      // resource1: 401 on first call (triggers refresh), 200 on retry
      http.get(`${BASE}/resource1`, () => {
        resource1Calls++;
        if (resource1Calls === 1) {
          return HttpResponse.json({ detail: "Unauthorized" }, { status: 401 });
        }
        return HttpResponse.json({ data: 1 });
      }),
      // resource2: 401 on first call (triggers a second refresh), 200 on retry
      http.get(`${BASE}/resource2`, () => {
        resource2Calls++;
        if (resource2Calls === 1) {
          return HttpResponse.json({ detail: "Unauthorized" }, { status: 401 });
        }
        return HttpResponse.json({ data: 2 });
      }),
      // Refresh endpoint: always succeeds
      http.post(`${BASE}/auth/refresh`, () => {
        refreshCallCount++;
        return new HttpResponse(null, { status: 200 });
      })
    );

    // First request: hits 401, triggers refresh cycle, retries and succeeds
    const result1 = await api.get<{ data: number }>("/resource1");
    expect(result1).toEqual({ data: 1 });
    expect(refreshCallCount).toBe(1);

    // Second request: hits 401 after the first cycle is fully complete.
    // Must resolve successfully (not redirect to /login) and trigger a second
    // call to /auth/refresh, proving the module state is clean between cycles.
    const result2 = await api.get<{ data: number }>("/resource2");
    expect(result2).toEqual({ data: 2 });

    // Both 401s must have each triggered exactly one refresh call (2 total)
    expect(refreshCallCount).toBe(2);
  });
});
