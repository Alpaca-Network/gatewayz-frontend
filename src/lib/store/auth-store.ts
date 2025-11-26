import { create } from 'zustand';
import { UserData } from '@/lib/api';

interface AuthState {
  apiKey: string | null;
  userData: UserData | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  setAuth: (apiKey: string, userData: UserData) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  apiKey: null,
  userData: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  setAuth: (apiKey, userData) => set({ apiKey, userData, isAuthenticated: true, isLoading: false, error: null }),
  clearAuth: () => set({ apiKey: null, userData: null, isAuthenticated: false, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
