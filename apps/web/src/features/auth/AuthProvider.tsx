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

/** 202 from /register, /resend-verification and /forgot-password. */
export interface VerificationSentResult {
  status: string;
  /** Present only in dev with email sending disabled. */
  devCode?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** True until the initial silent refresh settles — gates route rendering. */
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

  /**
   * Re-refreshes a minute before the access token expires, so a long session
   * never breaks mid-action and never depends on catching a 401.
   */
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

  // On mount, try the refresh cookie. Success means the tab reopens signed in.
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

  /** Confirming the address also signs the new account in — no second step. */
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

  /** A completed reset signs them straight in — they just proved who they are. */
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
