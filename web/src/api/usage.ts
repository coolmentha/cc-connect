import api from './client';

export interface ProjectUsage {
  project: string;
  input_tokens: number;
  output_tokens: number;
  turns: number;
}

export interface UsageResponse {
  projects: ProjectUsage[];
  total: {
    input_tokens: number;
    output_tokens: number;
    turns: number;
  };
}

export const getUsage = () => api.get<UsageResponse>('/usage');
