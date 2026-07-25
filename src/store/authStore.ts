import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  token: string | null;
  role: "USER" | "ADMIN" | "SUPER_ADMIN" | null;
  email: string | null;
  name: string | null;
  _hasHydrated: boolean;
  setAuth: (token: string, role: AuthState["role"], email: string, name: string) => void;
  clearAuth: () => void;
  setHasHydrated: (val: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      role: null,
      email: null,
      name: null,
      _hasHydrated: false,
      setAuth: (token, role, email, name) => set({ token, role, email, name }),
      clearAuth: () => set({ token: null, role: null, email: null, name: null }),
      setHasHydrated: (val) => set({ _hasHydrated: val }),
    }),
    {
      name: "dalyda-auth",
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
);
