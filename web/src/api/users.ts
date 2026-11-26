import api from './client';

export interface RoleRateLimit {
  max_messages: number;
  window_secs: number;
}

export interface RoleConfig {
  user_ids: string[];
  disabled_commands: string[];
  rate_limit?: RoleRateLimit;
}

export interface UsersSnapshot {
  configured: boolean;
  default_role?: string;
  roles?: Record<string, RoleConfig>;
}

export const getUsers = (project: string) =>
  api.get<UsersSnapshot>(`/projects/${project}/users`);

export const updateUsers = (
  project: string,
  body: { default_role: string; roles: Record<string, { user_ids: string[]; disabled_commands: string[]; rate_limit?: RoleRateLimit }> },
) => api.patch<{ message: string }>(`/projects/${project}/users`, body);
