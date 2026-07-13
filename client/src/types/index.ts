export type Theme = 'light' | 'dark' | 'system';

export interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export type AuthStatus = {
  configured: boolean;
  connected: boolean;
  emailAddress: string | null;
  scope?: string;
  updatedAt?: string;
};

export type QueueItem = {
  id: number;
  state: string;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: string | null;
  sentAt: string | null;
  updatedAt: string;
  recruiterName: string | null;
  recruiterCompany: string | null;
  recruiterEmail: string | null;
};

export type Stats = {
  todaySent: number;
  totalSent: number;
  pending: number;
  failed: number;
  retries: number;
  successRate: number;
  averageSendTimeMs: number;
  remainingRecruiters: number;
  estimatedCompletionDate: string | null;
  workerStatus: string;
  queue: Record<string, number>;
  queueItems?: QueueItem[];
};

export type Recruiter = {
  id: number;
  fullName: string;
  company: string;
  designation?: string;
  email: string;
  status: string;
  templateId?: number | null;
};

export type Template = {
  id: number;
  name: string;
  subjectTemplate: string;
  htmlTemplate: string;
  textTemplate: string;
  isDefault: boolean;
  updatedAt: string;
  attachments?: Array<{ id: number; originalName: string; size: number }>;
};

export type ImportResult = {
  imported: number;
  skipped: number;
  invalid: number;
  duplicates: number;
  errors: { row: number; reason: string }[];
};
