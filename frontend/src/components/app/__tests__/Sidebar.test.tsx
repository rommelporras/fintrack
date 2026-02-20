import { renderWithProviders, screen } from "@/__tests__/utils";
import { Sidebar } from "@/components/app/Sidebar";

// Need to mock useAuth since Sidebar uses it
const mockLogout = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    logout: mockLogout,
    login: vi.fn(),
    register: vi.fn(),
    error: null,
    loading: false,
  }),
}));

// Mock the api module to prevent real fetch calls from useEffect
vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the FinTrack heading", () => {
    renderWithProviders(<Sidebar />);
    expect(screen.getByText("FinTrack")).toBeInTheDocument();
    expect(screen.getByText("Personal Finance")).toBeInTheDocument();
  });

  it("renders all navigation items", () => {
    renderWithProviders(<Sidebar />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Transactions")).toBeInTheDocument();
    expect(screen.getByText("Budgets")).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();
    expect(screen.getByText("Accounts")).toBeInTheDocument();
    expect(screen.getByText("Credit Cards")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders sign out button", () => {
    renderWithProviders(<Sidebar />);
    expect(screen.getByText("Sign out")).toBeInTheDocument();
  });

  it("calls logout when sign out is clicked", async () => {
    const { user } = renderWithProviders(<Sidebar />);
    await user.click(screen.getByText("Sign out"));
    expect(mockLogout).toHaveBeenCalled();
  });
});
