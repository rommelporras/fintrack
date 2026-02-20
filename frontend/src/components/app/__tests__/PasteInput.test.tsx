import { renderWithProviders, screen, waitFor } from "@/__tests__/utils";
import { PasteInput } from "@/components/app/PasteInput";
import { http, HttpResponse } from "msw";
import { server } from "@/__tests__/mocks/server";

const BASE = "http://localhost:8000";

describe("PasteInput", () => {
  it("renders textarea and parse button", () => {
    renderWithProviders(<PasteInput onParsed={vi.fn()} />);
    expect(screen.getByLabelText("AI Response")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Parse" })).toBeInTheDocument();
  });

  it("parse button is disabled when textarea is empty", () => {
    renderWithProviders(<PasteInput onParsed={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Parse" })).toBeDisabled();
  });

  it("calls onParsed with single result", async () => {
    const onParsed = vi.fn();
    const { user } = renderWithProviders(<PasteInput onParsed={onParsed} />);

    await user.type(screen.getByLabelText("AI Response"), "some text");
    await user.click(screen.getByRole("button", { name: "Parse" }));

    await waitFor(() => {
      expect(onParsed).toHaveBeenCalledWith({
        kind: "single",
        data: expect.objectContaining({ amount: "500.00", confidence: "high" }),
      });
    });
  });

  it("calls onParsed with bulk result when bulk=true", async () => {
    const onParsed = vi.fn();
    const { user } = renderWithProviders(<PasteInput onParsed={onParsed} bulk />);

    await user.type(screen.getByLabelText("AI Response"), "bulk data");
    await user.click(screen.getByRole("button", { name: "Parse" }));

    await waitFor(() => {
      expect(onParsed).toHaveBeenCalledWith({
        kind: "bulk",
        data: expect.objectContaining({ count: 2 }),
      });
    });
  });

  it("shows loading state during parse", async () => {
    // Add a delay to the handler so we can observe loading state
    server.use(
      http.post(`${BASE}/parse/paste`, async () => {
        await new Promise((r) => setTimeout(r, 100));
        return HttpResponse.json({
          amount: "500.00",
          date: "2026-02-19",
          description: "Test",
          type: "expense",
          category_hint: null,
          confidence: "high",
        });
      })
    );

    const { user } = renderWithProviders(<PasteInput onParsed={vi.fn()} />);
    await user.type(screen.getByLabelText("AI Response"), "text");
    await user.click(screen.getByRole("button", { name: "Parse" }));

    expect(screen.getByRole("button", { name: "Parsing..." })).toBeDisabled();
  });

  it("shows error message on failure", async () => {
    server.use(
      http.post(`${BASE}/parse/paste`, () =>
        HttpResponse.json({ detail: "Parse failed" }, { status: 500 })
      )
    );

    const { user } = renderWithProviders(<PasteInput onParsed={vi.fn()} />);
    await user.type(screen.getByLabelText("AI Response"), "bad data");
    await user.click(screen.getByRole("button", { name: "Parse" }));

    await waitFor(() => {
      expect(screen.getByText("Parse failed")).toBeInTheDocument();
    });
  });
});
