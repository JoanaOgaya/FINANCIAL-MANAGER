import { http } from './apiClient';
import { toPaged } from './resource';
import type { AuditLog, ListQuery, Paged } from '../types/entities';

export const auditLogsService = {
  list: async (query?: ListQuery) => toPaged(await http.get<AuditLog[] | Paged<AuditLog>>('/audit-logs', query)),
  create: async (data: Partial<AuditLog>) => http.post<AuditLog>('/audit-logs', data),
};
