import { http, HttpResponse } from "msw";

const BASE = "http://localhost:8000";

export const handlers = [
  // Auth
  http.post(`${BASE}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as Record<string, string>;
    if (body.email === "fail@test.com") {
      return HttpResponse.json({ detail: "Invalid credentials" }, { status: 401 });
    }
    return HttpResponse.json({ id: "u1", email: body.email, name: "Test", avatar: null });
  }),

  http.post(`${BASE}/auth/register`, async ({ request }) => {
    const body = (await request.json()) as Record<string, string>;
    if (body.email === "exists@test.com") {
      return HttpResponse.json({ detail: "Email already registered" }, { status: 409 });
    }
    return HttpResponse.json({ id: "u1", email: body.email, name: body.name, avatar: null });
  }),

  http.post(`${BASE}/auth/logout`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${BASE}/auth/me`, () => {
    return HttpResponse.json({ id: "u1", email: "test@test.com", name: "Test", avatar: null });
  }),

  // Parse
  http.post(`${BASE}/parse/paste`, () => {
    return HttpResponse.json({
      amount: "500.00",
      date: "2026-02-19",
      description: "Test Transaction",
      type: "expense",
      category_hint: null,
      confidence: "high",
    });
  }),

  http.post(`${BASE}/parse/bulk`, () => {
    return HttpResponse.json({
      transactions: [
        { amount: "100.00", date: "2026-02-01", description: "Item 1", type: "expense", category_hint: null, confidence: "high" },
        { amount: "200.00", date: "2026-02-02", description: "Item 2", type: "income", category_hint: null, confidence: "medium" },
      ],
      count: 2,
    });
  }),

  // Transactions
  http.post(`${BASE}/transactions`, async ({ request }) => {
    const body = (await request.json()) as Record<string, string>;
    return HttpResponse.json({ id: "t1", ...body }, { status: 201 });
  }),

  // Notifications
  http.get(`${BASE}/notifications`, () => {
    return HttpResponse.json({ items: [], total: 0 });
  }),
];
