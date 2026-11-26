import api from './client';

export interface LogLine {
  time: string;
  level: string;
  message: string;
  attrs?: string;
}

export const getLogs = (limit = 200) =>
  api.get<{ lines: LogLine[]; total: number }>('/logs', { limit: String(limit) });
