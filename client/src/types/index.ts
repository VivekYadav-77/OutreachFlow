export type Theme = 'light' | 'dark' | 'system';

export interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export type AuthStatus = {
  configured: boolean;
  connected: boolean;
  status: "CONNECTED" | "AUTH_REQUIRED" | "CONNECTING" | "DISCONNECTED" | "ERROR";
  emailAddress: string | null;
  scope?: string;
  readScopeGranted?: boolean;
  lastConnectedAt?: string | null;
  lastRefreshAt?: string | null;
  lastAuthFailureAt?: string | null;
  lastAuthFailureReason?: string | null;
  lastReconnectAt?: string | null;
  updatedAt?: string;
};

export type QueueItem = {
  id: number;
  state: string;
  attempts: number;
  maxAttempts: number;
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
  replies: number;
  bounces: number;
  temporaryFailures: number;
  invalidAddresses: number;
  queuedRecruiters: number;
  successRate: number;
  averageSendTimeMs: number;
  remainingRecruiters: number;
  estimatedCompletionDate: string | null;
  workerStatus: string;
  authStatus?: AuthStatus;
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
  lastEmailSentAt?: string | null;
  lastReplyAt?: string | null;
  lastBounceAt?: string | null;
  lastGmailThreadId?: string | null;
  lastGmailMessageId?: string | null;
  gmailThreadLink?: string | null;
};

export type MonitorSummary = {
  processed?: number;
  trackedThreads?: number;
  checked?: number;
  detected: number;
  permanent?: number;
  temporary?: number;
  duplicates: number;
  skipped: number;
};

export type SentImportSummary = {
  processed: number;
  imported: number;
  updated: number;
  duplicates: number;
  skipped: number;
  errors: number;
};

export type EmailActivitySummary = {
  replies: number;
  bounces: number;
  invalidAddresses: number;
  importedEmails: number;
  lastActivityAt: string | null;
};

export type EmailActivityItem = {
  id: number;
  eventType: string;
  recruiterId: number | null;
  campaignId: number | null;
  queueId: number | null;
  gmailMessageId: string | null;
  gmailThreadId: string | null;
  gmailThreadLink: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  recruiterName: string | null;
  recruiterCompany: string | null;
  recruiterEmail: string | null;
};

export type EmailActivityList = {
  rows: EmailActivityItem[];
  total: number;
  page: number;
  pageSize: number;
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
