import { http } from './apiClient';
import type { DashboardSummary, NavBadges } from '../types/entities';

export const dashboardService = {
  /** KPIs, attention items, charts and recent activity — already scoped to the caller's role. */
  summary: (params?: { period?: 'weekly' | 'monthly'; clientId?: string }) => http.get<DashboardSummary>('/dashboard/summary', params),
  navBadges: () => http.get<NavBadges>('/dashboard/nav-badges'),
};
