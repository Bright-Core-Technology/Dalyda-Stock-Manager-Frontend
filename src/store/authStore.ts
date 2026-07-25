import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  token: string | null;
  role: "USER" | "ADMIN" | "SUPER_ADMIN" | null;
  email: string | null;
  name: string | null;
  setAuth: (token: string, role: AuthState["role"], email: string, name: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      role: null,
      email: null,
      name: null,
      setAuth: (token, role, email, name) => set({ token, role, email, name }),
      clearAuth: () => set({ token: null, role: null, email: null, name: null }),
    }),
    { name: "dalyda-auth", skipHydration: false }
  )
);
