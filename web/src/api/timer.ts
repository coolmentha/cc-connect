import api from './client';

export interface TimerJob {
  id: string;
  project: string;
  session_key: string;
  scheduled_at: string;
  prompt: string;
  exec?: string;
  work_dir?: string;
  description: string;
  silent?: boolean | null;
  mute?: boolean;
  session_mode?: string;
  mode?: string;
  timeout_mins?: number | null;
  created_at: string;
  fired: boolean;
  fired_at?: string;
  last_error?: string;
}

export interface TimerCreate {
  project: string;
  session_key: string;
  delay: string;
  prompt?: string;
  exec?: string;
  work_dir?: string;
  description?: string;
  silent?: boolean;
  mute?: boolean;
  session_mode?: string;
  mode?: string;
  timeout_mins?: number | null;
}

export const listTimers = (project?: string) =>
  api.get<{ jobs: TimerJob[] }>('/timer', project ? { project } : undefined);
export const createTimer = (body: TimerCreate) => api.post<TimerJob>('/timer', body);
export const deleteTimer = (id: string) => api.delete(`/timer/${id}`);
