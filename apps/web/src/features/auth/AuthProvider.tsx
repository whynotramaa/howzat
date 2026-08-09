import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  AuthSession,
  AuthUser,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from '@howzat/shared';
import { api, refreshAccessToken, setAccessToken } from '@/lib/api';

export interface VerificationSentResult {
  status: string;
  devCode?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  register: (input: RegisterInput) => Promise<VerificationSentResult>;
  verifyEmail: (email: string, code: string) => Promise<AuthUser>;
  resendVerification: (email: string) => Promise<VerificationSentResult>;
  login: (input: LoginInput) => Promise<AuthUser>;
  forgotPassword: (email: string) => Promise<VerificationSentResult>;
  resetPassword: (input: ResetPasswordInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimer = useRef<number | null>(null);

  const scheduleRefresh = useCallback((expiresIn: number) => {
    if (refreshTimer.current) window.clearTimeout(refreshTimer.current);

    const delay = Math.max((expiresIn - 60) * 1000, 30_000);

    refreshTimer.current = window.setTimeout(() => {
      void refreshAccessToken().then((token) => {
        if (token) scheduleRefresh(expiresIn);
        else setUser(null);
      });
    }, delay);
  }, []);

  const adoptSession = useCallback(
    (session: AuthSession) => {
      setAccessToken(session.accessToken);
      setUser(session.user);
      scheduleRefresh(session.expiresIn);
    },
    [scheduleRefresh],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const token = await refreshAccessToken();

      if (cancelled) return;

      if (token) {
        try {
          const me = await api.get<AuthUser>('/auth/me');
          if (!cancelled) {
            setUser(me);
            scheduleRefresh(15 * 60);
          }
        } catch {
          if (!cancelled) setUser(null);
        }
      }

      if (!cancelled) setIsLoading(false);
    })();

    return () => {
      cancelled = true;
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    };
  }, [scheduleRefresh]);

  const register = useCallback(
    (input: RegisterInput) => api.post<VerificationSentResult>('/auth/register', input),
    [],
  );

  const resendVerification = useCallback(
    (email: string) => api.post<VerificationSentResult>('/auth/resend-verification', { email }),
    [],
  );

  const verifyEmail = useCallback(
    async (email: string, code: string) => {
      const session = await api.post<AuthSession>('/auth/verify-email', { email, code });
      adoptSession(session);
      return session.user;
    },
    [adoptSession],
  );

  const login = useCallback(
    async (input: LoginInput) => {
      const session = await api.post<AuthSession>('/auth/login', input);
      adoptSession(session);
      return session.user;
    },
    [adoptSession],
  );

  const forgotPassword = useCallback(
    (email: string) => api.post<VerificationSentResult>('/auth/forgot-password', { email }),
    [],
  );

  const resetPassword = useCallback(
    async (input: ResetPasswordInput) => {
      const session = await api.post<AuthSession>('/auth/reset-password', input);
      adoptSession(session);
      return session.user;
    },
    [adoptSession],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      register,
      verifyEmail,
      resendVerification,
      login,
      forgotPassword,
      resetPassword,
      logout,
    }),
    [
      user,
      isLoading,
      register,
      verifyEmail,
      resendVerification,
      login,
      forgotPassword,
      resetPassword,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
