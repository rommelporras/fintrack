import { renderWithProviders, screen, waitFor } from "@/__tests__/utils";
import { TransactionConfirm } from "@/components/app/TransactionConfirm";
import type { ParsedTransaction } from "@/types/parse";

const highConfParsed: ParsedTransaction = {
  amount: "500.00",
  date: "2026-02-19",
  description: "Lunch at Jollibee",
  type: "expense",
  category_hint: null,
  confidence: "high",
};

const lowConfParsed: ParsedTransaction = {
  amount: null,
  date: null,
  description: null,
  type: null,
  category_hint: null,
  confidence: "low",
};

describe("TransactionConfirm", () => {
  it("pre-fills fields from parsed data", () => {
    renderWithProviders(
      <TransactionConfirm parsed={highConfParsed} accountId="a1" onSuccess={vi.fn()} />
    );
    expect(screen.getByLabelText("Amount")).toHaveValue("500.00");
    expect(screen.getByLabelText("Date")).toHaveValue("2026-02-19");
    expect(screen.getByLabelText("Description")).toHaveValue("Lunch at Jollibee");
  });

  it("shows confidence badge", () => {
    renderWithProviders(
      <TransactionConfirm parsed={highConfParsed} accountId="a1" onSuccess={vi.fn()} />
    );
    expect(screen.getByText("high")).toBeInTheDocument();
  });

  it("shows review message for non-high confidence", () => {
    renderWithProviders(
      <TransactionConfirm parsed={lowConfParsed} accountId="a1" onSuccess={vi.fn()} />
    );
    expect(screen.getByText("low")).toBeInTheDocument();
    expect(screen.getByText("Review highlighted fields")).toBeInTheDocument();
  });

  it("applies amber border to empty fields when uncertain", () => {
    renderWithProviders(
      <TransactionConfirm parsed={lowConfParsed} accountId="a1" onSuccess={vi.fn()} />
    );
    const amountInput = screen.getByLabelText("Amount");
    expect(amountInput.className).toContain("border-amber-400");
  });

  it("shows validation error when amount is empty", async () => {
    const { user } = renderWithProviders(
      <TransactionConfirm parsed={highConfParsed} accountId="a1" onSuccess={vi.fn()} />
    );
    // Clear the amount field
    const amountInput = screen.getByLabelText("Amount");
    await user.clear(amountInput);
    await user.click(screen.getByRole("button", { name: "Add Transaction" }));

    await waitFor(() => {
      expect(screen.getByText("A valid amount is required.")).toBeInTheDocument();
    });
  });

  it("shows validation error when date is empty", async () => {
    const parsedNoDate: ParsedTransaction = { ...highConfParsed, date: "" };
    const { user } = renderWithProviders(
      <TransactionConfirm parsed={parsedNoDate} accountId="a1" onSuccess={vi.fn()} />
    );
    await user.click(screen.getByRole("button", { name: "Add Transaction" }));

    await waitFor(() => {
      expect(screen.getByText("A date is required.")).toBeInTheDocument();
    });
  });

  it("calls onSuccess after successful submit", async () => {
    const onSuccess = vi.fn();
    const { user } = renderWithProviders(
      <TransactionConfirm parsed={highConfParsed} accountId="a1" onSuccess={onSuccess} />
    );
    await user.click(screen.getByRole("button", { name: "Add Transaction" }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
