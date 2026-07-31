import { createContext, ReactNode, useEffect, useState } from 'react';
import { api, setAuthToken } from '../api/client';
import { LoginResponse, MeResponse } from '../types/api';

const TOKEN_STORAGE_KEY = 'gap_analysis_token';

interface AuthContextValue {
  user: MeResponse | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!stored) {
      setLoading(false);
      return;
    }
    setAuthToken(stored);
    api
      .get<MeResponse>('/auth/me')
      .then(setUser)
      .catch(() => {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setAuthToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const { accessToken } = await api.post<LoginResponse>('/auth/login', { email, password });
    localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
    setAuthToken(accessToken);
    setUser(await api.get<MeResponse>('/auth/me'));
  }

  function logout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setAuthToken(null);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}
