import { renderHook, act, waitFor } from "@testing-library/react";
import { useAuth } from "@/hooks/useAuth";

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
    back: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

const mockPost = vi.fn();
vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: (...args: unknown[]) => mockPost(...args),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPost.mockResolvedValue({
      id: "u1",
      email: "test@test.com",
      name: "Test",
      avatar: null,
    });
  });

  it("login navigates to / on success", async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.login("user@test.com", "password123");
    });
    expect(mockPost).toHaveBeenCalledWith("/auth/login", {
      email: "user@test.com",
      password: "password123",
      remember_me: false,
    });
    expect(mockPush).toHaveBeenCalledWith("/");
    expect(mockRefresh).toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it("login sets error on failure", async () => {
    mockPost.mockRejectedValueOnce(new Error("Invalid credentials"));
    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.login("fail@test.com", "password123");
    });
    expect(result.current.error).toBe("Invalid credentials");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("register navigates to / on success", async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.register("new@test.com", "New User", "password123");
    });
    expect(mockPost).toHaveBeenCalledWith("/auth/register", {
      email: "new@test.com",
      name: "New User",
      password: "password123",
    });
    expect(mockPush).toHaveBeenCalledWith("/");
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("register sets error for existing email", async () => {
    mockPost.mockRejectedValueOnce(new Error("Email already registered"));
    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.register("exists@test.com", "User", "password123");
    });
    expect(result.current.error).toBe("Email already registered");
  });

  it("logout navigates to /login", async () => {
    mockPost.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.logout();
    });
    expect(mockPush).toHaveBeenCalledWith("/login");
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("loading is true during login", async () => {
    let resolvePost!: (v: unknown) => void;
    mockPost.mockReturnValueOnce(
      new Promise((r) => {
        resolvePost = r;
      }),
    );

    const { result } = renderHook(() => useAuth());
    expect(result.current.loading).toBe(false);

    // Start login without awaiting
    let loginDone = false;
    act(() => {
      result.current.login("user@test.com", "password123").then(() => {
        loginDone = true;
      });
    });

    // loading should be true while the promise is pending
    expect(result.current.loading).toBe(true);

    // Resolve the API call
    await act(async () => {
      resolvePost({ id: "u1" });
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });
});
