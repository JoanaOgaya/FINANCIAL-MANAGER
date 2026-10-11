/**
 * Route guards.
 *  - ProtectedRoute: unauthenticated -> /login.
 *  - RoleGuard: authenticated but role not allowed for the module -> 403 page.
 * Access rules come exclusively from utils/roleAccess.
 */
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ForbiddenPage } from './shared/ForbiddenPage';
import { getModule, type ModuleKey } from '../utils/roleAccess';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return null;
  if (!user) {
    const isLoggedOut = typeof window !== 'undefined' && sessionStorage.getItem('loggedOut') === 'true';
    return <Navigate to="/login" replace state={isLoggedOut ? null : { from: location.pathname + (location.search || '') }} />;
  }
  return <>{children}</>;
}

export function RoleGuard({ module, children }: { module: ModuleKey; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || !getModule(module).roles[user.role]) return <ForbiddenPage />;
  return <>{children}</>;
}
