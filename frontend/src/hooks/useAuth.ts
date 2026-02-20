"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface UserResponse {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
}

export function useAuth() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function login(
    email: string,
    password: string,
    rememberMe: boolean = false,
  ) {
    setLoading(true);
    setError(null);
    try {
      await api.post<UserResponse>("/auth/login", {
        email,
        password,
        remember_me: rememberMe,
      });
      // Cookie is set by the server response — no localStorage needed
      router.push("/");
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function register(email: string, name: string, password: string) {
    setLoading(true);
    setError(null);
    try {
      await api.post<UserResponse>("/auth/register", { email, name, password });
      router.push("/");
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await api.post("/auth/logout", {});
    router.push("/login");
    router.refresh();
  }

  return { login, register, logout, error, loading };
}
