import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { FullPageSpinner } from '@/features/auth/LoginPage';

/**
 * Waits for the initial silent refresh before deciding. Redirecting while the
 * session is still resolving would bounce a signed-in user to /login on every
 * hard refresh.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageSpinner />;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
