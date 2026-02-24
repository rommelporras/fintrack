import { renderWithProviders, screen } from "@/__tests__/utils";
import { CurrencyInput } from "@/components/app/CurrencyInput";

describe("CurrencyInput", () => {
  it("renders currency symbol and text input", () => {
    renderWithProviders(<CurrencyInput value="" onChange={vi.fn()} />);
    expect(screen.getByText("₱")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("displays formatted value with commas from prop", () => {
    renderWithProviders(<CurrencyInput value="10500.50" onChange={vi.fn()} />);
    expect(screen.getByRole("textbox")).toHaveValue("10,500.50");
  });

  it("emits raw numeric string without commas on change", async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <CurrencyInput value="" onChange={onChange} />
    );
    await user.type(screen.getByRole("textbox"), "1500");
    expect(onChange).toHaveBeenLastCalledWith("1500");
  });

  it("enforces max 2 decimal places", async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <CurrencyInput value="" onChange={onChange} />
    );
    await user.type(screen.getByRole("textbox"), "10.505");
    expect(onChange).toHaveBeenLastCalledWith("10.50");
  });

  it("allows a leading minus for negative values", async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <CurrencyInput value="" onChange={onChange} />
    );
    await user.type(screen.getByRole("textbox"), "-500");
    expect(onChange).toHaveBeenLastCalledWith("-500");
  });

  it("strips non-numeric chars on paste (e.g. ₱10,500.50 → 10500.50)", async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <CurrencyInput value="" onChange={onChange} />
    );
    await user.click(screen.getByRole("textbox"));
    await user.paste("₱10,500.50");
    expect(onChange).toHaveBeenLastCalledWith("10500.50");
  });

  it("renders a custom currency symbol", () => {
    renderWithProviders(
      <CurrencyInput value="" onChange={vi.fn()} currency="$" />
    );
    expect(screen.getByText("$")).toBeInTheDocument();
  });

  it("is disabled when disabled prop is set", () => {
    renderWithProviders(
      <CurrencyInput value="" onChange={vi.fn()} disabled />
    );
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("updates display when value prop changes externally", () => {
    const { rerender } = renderWithProviders(
      <CurrencyInput value="" onChange={vi.fn()} />
    );
    expect(screen.getByRole("textbox")).toHaveValue("");

    rerender(<CurrencyInput value="10500.50" onChange={vi.fn()} />);
    expect(screen.getByRole("textbox")).toHaveValue("10,500.50");
  });
});
