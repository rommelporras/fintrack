import { renderWithProviders, screen, waitFor } from "@/__tests__/utils";
import { BulkImportTable } from "@/components/app/BulkImportTable";
import { http, HttpResponse } from "msw";
import { server } from "@/__tests__/mocks/server";
import type { ParsedTransaction } from "@/types/parse";

const BASE = "http://localhost:8000";

const rows: ParsedTransaction[] = [
  {
    amount: "100.00",
    date: "2026-02-01",
    description: "Item 1",
    type: "expense",
    category_hint: null,
    confidence: "high",
  },
  {
    amount: "200.00",
    date: "2026-02-02",
    description: "Item 2",
    type: "income",
    category_hint: null,
    confidence: "medium",
  },
  {
    amount: "300.00",
    date: "2026-02-03",
    description: "Item 3",
    type: "expense",
    category_hint: null,
    confidence: "low",
  },
];

describe("BulkImportTable", () => {
  it("renders all rows", () => {
    renderWithProviders(
      <BulkImportTable rows={rows} accountId="a1" onSuccess={vi.fn()} />
    );
    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("Item 2")).toBeInTheDocument();
    expect(screen.getByText("Item 3")).toBeInTheDocument();
  });

  it("all rows are selected by default", () => {
    renderWithProviders(
      <BulkImportTable rows={rows} accountId="a1" onSuccess={vi.fn()} />
    );
    const checkboxes = screen.getAllByRole("checkbox");
    checkboxes.forEach((cb) => expect(cb).toBeChecked());
    expect(
      screen.getByRole("button", { name: "Import 3 transactions" })
    ).toBeInTheDocument();
  });

  it("toggling a checkbox updates selection count", async () => {
    const { user } = renderWithProviders(
      <BulkImportTable rows={rows} accountId="a1" onSuccess={vi.fn()} />
    );
    // Uncheck first row
    await user.click(screen.getByLabelText("Select row 1"));
    expect(
      screen.getByRole("button", { name: "Import 2 transactions" })
    ).toBeInTheDocument();
  });

  it("import button is disabled when none selected", async () => {
    const { user } = renderWithProviders(
      <BulkImportTable rows={rows} accountId="a1" onSuccess={vi.fn()} />
    );
    // Uncheck all
    for (const cb of screen.getAllByRole("checkbox")) {
      await user.click(cb);
    }
    expect(
      screen.getByRole("button", { name: "Import 0 transactions" })
    ).toBeDisabled();
  });

  it("calls onSuccess with count after import", async () => {
    const onSuccess = vi.fn();
    const { user } = renderWithProviders(
      <BulkImportTable rows={rows} accountId="a1" onSuccess={onSuccess} />
    );
    await user.click(
      screen.getByRole("button", { name: "Import 3 transactions" })
    );

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(3);
    });
  });

  it("shows error on partial failure", async () => {
    let callCount = 0;
    server.use(
      http.post(`${BASE}/transactions`, () => {
        callCount++;
        if (callCount === 2) {
          return HttpResponse.json({ detail: "Failed" }, { status: 500 });
        }
        return HttpResponse.json({ id: `t${callCount}` }, { status: 201 });
      })
    );

    const { user } = renderWithProviders(
      <BulkImportTable rows={rows} accountId="a1" onSuccess={vi.fn()} />
    );
    await user.click(
      screen.getByRole("button", { name: "Import 3 transactions" })
    );

    await waitFor(() => {
      expect(screen.getByText(/2 imported, 1 failed/)).toBeInTheDocument();
    });
  });
});
