import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, NavLink, Route, Routes, useNavigate, useLocation } from "react-router-dom";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExtension from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import LinkExtension from "@tiptap/extension-link";
import ImageExtension from "@tiptap/extension-image";
import { TextStyle } from "@tiptap/extension-text-style";
import { AlignCenter, AlignLeft, AlignRight, BarChart3, Bold, Check, ExternalLink, Highlighter, Image, Italic, LayoutDashboard, Link, List, ListChecks, ListOrdered, Mail, Monitor, Moon, Paperclip, Pencil, Redo2, Save, Settings, Sun, Trash2, Underline, Undo2, Upload, X, XCircle, AlertTriangle, ChevronDown, ChevronUp, RefreshCw, SlidersHorizontal, Search, FileText } from "lucide-react";
import "./styles.css";
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: options?.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...options
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.ok === false) throw new Error(json.error?.message ?? "Request failed");
  return json.data as T;
}

function useApi<T>(path: string, refresh = 0) {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    let active = true;
    setLoading(true);
    api<T>(path)
      .then((value) => active && setData(value))
      .catch((err: Error) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [path, refresh]);
  return { data, error, loading };
}

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined);

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = React.useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) || 'system';
  });

  React.useEffect(() => {
    localStorage.setItem('theme', theme);
    
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
      
      const listener = (e: MediaQueryListEvent) => {
        root.classList.remove('light', 'dark');
        root.classList.add(e.matches ? 'dark' : 'light');
      };
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

function useTheme() {
  const context = React.useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  
  const btnStyle = (isActive: boolean): React.CSSProperties => ({
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '8px',
    border: 'none',
    borderRadius: '4px',
    background: isActive ? 'var(--primary)' : 'transparent',
    color: isActive ? 'white' : 'var(--sidebar-text-muted)',
    cursor: 'pointer',
    transition: 'all 0.2s'
  });

  return (
    <div style={{ display: 'flex', gap: '4px', background: 'var(--sidebar-hover)', padding: '4px', borderRadius: '6px', marginBottom: '28px' }}>
      <button style={btnStyle(theme === 'light')} onClick={() => setTheme('light')} title="Light Theme">
        <Sun size={16} />
      </button>
      <button style={btnStyle(theme === 'system')} onClick={() => setTheme('system')} title="System Theme">
        <Monitor size={16} />
      </button>
      <button style={btnStyle(theme === 'dark')} onClick={() => setTheme('dark')} title="Dark Theme">
        <Moon size={16} />
      </button>
    </div>
  );
}

type AuthStatus = {
  configured: boolean;
  connected: boolean;
  emailAddress: string | null;
  scope?: string;
  updatedAt?: string;
};

function GoogleAuthStatus() {
  const { data, loading } = useApi<AuthStatus>("/api/auth/status");
  if (loading) return null;
  
  if (data?.connected) {
    return (
      <div className="auth-status" title={data.emailAddress || "Connected"}>
        <span className="email">{data.emailAddress ?? "Connected"}</span>
        <span className="badge">Active</span>
      </div>
    );
  }
  
  return <a className="button secondary" href={`${API_URL}/api/auth/google`}>Connect Google</a>;
}

type Stats = {
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
};

function Shell() {
  const nav = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/recruiters", label: "Recruiters", icon: Mail },
    { to: "/compose", label: "Templates", icon: Mail },
    { to: "/cover-letter", label: "Cover Letters", icon: FileText },
    { to: "/settings", label: "Settings", icon: Settings },
    { to: "/logs", label: "Logs", icon: ListChecks },
    { to: "/statistics", label: "Statistics", icon: BarChart3 }
  ];
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">Gmail Outreach</div>
        <ThemeSwitcher />
        <nav>
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "active" : "")}>
                <Icon size={18} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </aside>
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/recruiters" element={<Recruiters />} />
          <Route path="/compose" element={<Compose />} />
          <Route path="/cover-letter" element={<CoverLetterGenerator />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/statistics" element={<Statistics />} />
        </Routes>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <section className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </section>
  );
}

function Dashboard() {
  const [refresh, setRefresh] = React.useState(0);
  const { data, error } = useApi<Stats>("/api/statistics", refresh);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);

  const action = async (path: string) => {
    setActionLoading(path);
    try {
      await api(path, { method: "POST" });
      setRefresh((value) => value + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  };
  return (
    <Page title="Dashboard" actions={<GoogleAuthStatus />}>
      {error && <p className="error">{error}</p>}
      <div className="stats-grid">
        <StatCard label="Today's sent" value={data?.todaySent ?? 0} />
        <StatCard label="Pending" value={data?.pending ?? 0} />
        <StatCard label="Failed" value={data?.failed ?? 0} />
        <StatCard label="Worker" value={data?.workerStatus ?? "unknown"} />
      </div>
      <section className="panel">
        <div className="toolbar">
          <button disabled={actionLoading !== null} onClick={() => action("/api/queue/start")}>
            {actionLoading === "/api/queue/start" && <RefreshCw size={14} className="refresh-spin" />}
            Start
          </button>
          <button disabled={actionLoading !== null} onClick={() => action("/api/queue/pause")}>
            {actionLoading === "/api/queue/pause" && <RefreshCw size={14} className="refresh-spin" />}
            Pause
          </button>
          <button disabled={actionLoading !== null} onClick={() => action("/api/queue/resume")}>
            {actionLoading === "/api/queue/resume" && <RefreshCw size={14} className="refresh-spin" />}
            Resume
          </button>
          <button disabled={actionLoading !== null} onClick={() => action("/api/queue/stop")}>
            {actionLoading === "/api/queue/stop" && <RefreshCw size={14} className="refresh-spin" />}
            Stop
          </button>
          <button disabled={actionLoading !== null} onClick={() => action("/api/queue/retry-failed")}>
            {actionLoading === "/api/queue/retry-failed" && <RefreshCw size={14} className="refresh-spin" />}
            Retry Failed
          </button>
        </div>
      </section>
      <section className="panel">
        <h2>Queue</h2>
        <pre>{JSON.stringify(data?.queue ?? {}, null, 2)}</pre>
      </section>
    </Page>
  );
}

function Page({ title, actions, children, titleIcon }: { title: string; actions?: React.ReactNode; children: React.ReactNode; titleIcon?: React.ReactNode }) {
  return (
    <>
      <header className="page-header">
        <div className="page-header-title">
          <h1>{title}</h1>
          {titleIcon}
        </div>
        <div>{actions}</div>
      </header>
      {children}
    </>
  );
}

function SafeSendingGuidelinesModal({ isOpen, onClose, settings }: { isOpen: boolean; onClose: () => void; settings: Record<string, unknown> | null }) {
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const dailyLimit = Number(settings?.dailyLimit ?? 50);
  const minDelay = Number(settings?.minDelaySeconds ?? 45);
  const startTime = String(settings?.startTime ?? "09:00");
  const endTime = String(settings?.endTime ?? "18:00");
  const retryCount = Number(settings?.retryCount ?? 4);

  const isSafe = dailyLimit <= 100 && minDelay >= 45;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Google Safe Sending Guidelines</h2>
          <button className="modal-close" onClick={onClose}><X size={24} /></button>
        </div>
        <div className="modal-body">
          <section className="guideline-section">
            <h3>Why These Limits Exist</h3>
            <div className="info-card">
              <p>Google limits email sending to:</p>
              <ul className="checklist">
                <li><Check size={16} /> prevent spam</li>
                <li><Check size={16} /> protect accounts</li>
                <li><Check size={16} /> stop compromised accounts</li>
                <li><Check size={16} /> maintain Gmail reputation</li>
              </ul>
            </div>
          </section>

          <section className="guideline-section">
            <h3>Recommended Safe Settings</h3>
            <table className="guideline-table">
              <thead>
                <tr>
                  <th>Setting</th>
                  <th>Recommended</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Daily Emails</td><td>50–100</td></tr>
                <tr><td>Minimum Delay</td><td>45–90 seconds</td></tr>
                <tr><td>Maximum Delay</td><td>120–180 seconds</td></tr>
                <tr><td>Working Hours</td><td>Business hours</td></tr>
                <tr><td>One Email</td><td>One Recruiter</td></tr>
                <tr><td>Attachments</td><td>Only when needed</td></tr>
                <tr><td>Retry Failed</td><td>Yes</td></tr>
                <tr><td>Bulk Sending</td><td>Avoid</td></tr>
              </tbody>
            </table>
            <p className="note-text">These are recommendations for this application. Google may change limits without notice.</p>
          </section>

          <section className="guideline-section">
            <h3>Personal Gmail Limits</h3>
            <table className="guideline-table">
              <tbody>
                <tr><td>Approx Daily Emails</td><td>≈500 recipients / rolling 24 hours</td></tr>
                <tr><td>One Email</td><td>One recruiter</td></tr>
                <tr><td>Recipients per API message</td><td>500 maximum</td></tr>
                <tr><td>If exceeded</td><td>Sending may be temporarily blocked for up to 24 hours.</td></tr>
              </tbody>
            </table>
            <p className="note-text">This application intentionally uses one personalized email per recruiter instead of bulk email.</p>
          </section>

          <section className="guideline-section">
            <h3>Gmail API Limits</h3>
            <table className="guideline-table">
              <tbody>
                <tr><td>Per User</td><td>6000 quota units/minute</td></tr>
                <tr><td>Per Project</td><td>1,200,000 quota units/minute</td></tr>
                <tr><td>messages.send cost</td><td>100 quota units</td></tr>
              </tbody>
            </table>
            <p className="note-text">Our application sends far below these API limits.</p>
          </section>

          <section className="guideline-section">
            <h3>Best Practices</h3>
            <ul className="checklist">
              <li><Check size={16} /> Personalize every email</li>
              <li><Check size={16} /> Verify recruiter email addresses</li>
              <li><Check size={16} /> Avoid sending identical content repeatedly</li>
              <li><Check size={16} /> Respect replies</li>
              <li><Check size={16} /> Use professional language</li>
              <li><Check size={16} /> Send during business hours</li>
              <li><Check size={16} /> Keep attachments small</li>
              <li><Check size={16} /> Stop sending if Google temporarily suspends sending</li>
              <li><Check size={16} /> Don't scrape Gmail</li>
              <li><Check size={16} /> Don't automate browser interaction</li>
            </ul>
          </section>

          <section className="guideline-section">
            <h3>Things That Can Get Your Account Restricted</h3>
            <div className="warning-box">
              <ul className="checklist">
                <li><XCircle size={16} /> Sending hundreds of emails quickly</li>
                <li><XCircle size={16} /> Ignoring Gmail sending limits</li>
                <li><XCircle size={16} /> Sending unsolicited spam</li>
                <li><XCircle size={16} /> Invalid recipient lists</li>
                <li><XCircle size={16} /> High bounce rates</li>
                <li><XCircle size={16} /> Misleading subject lines</li>
                <li><XCircle size={16} /> Attempting to bypass Google quotas</li>
                <li><XCircle size={16} /> Browser automation of Gmail</li>
              </ul>
            </div>
            <p className="note-text">This application uses the official Gmail API with OAuth 2.0 and does not attempt to bypass Google's protections.</p>
          </section>

          <section className="guideline-section">
            <h3>How This Application Keeps You Safe</h3>
            <div className="success-box">
              <ul className="checklist">
                <li><Check size={16} /> Uses official Gmail API</li>
                <li><Check size={16} /> Uses OAuth 2.0</li>
                <li><Check size={16} /> Uses Google authorization</li>
                <li><Check size={16} /> Sends one email at a time</li>
                <li><Check size={16} /> Random delay between emails</li>
                <li><Check size={16} /> Daily sending limit</li>
                <li><Check size={16} /> Working hours restriction</li>
                <li><Check size={16} /> Queue system</li>
                <li><Check size={16} /> Automatic retry</li>
                <li><Check size={16} /> No browser automation</li>
                <li><Check size={16} /> No password login</li>
                <li><Check size={16} /> No quota bypass</li>
              </ul>
            </div>
          </section>

          <section className="guideline-section">
            <h3>Current Configuration</h3>
            <div className="config-box">
              <p><strong>Daily Limit:</strong> {dailyLimit}</p>
              <p><strong>Current Delay:</strong> &ge;{minDelay} seconds</p>
              <p><strong>Working Hours:</strong> {startTime} - {endTime}</p>
              <p><strong>Retry Count:</strong> {retryCount}</p>
              
              <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong>Status:</strong>
                <span className={`status-badge ${isSafe ? 'safe' : 'needs-review'}`}>
                  {isSafe ? 'Safe' : 'Needs Review'}
                </span>
              </div>
              {!isSafe && (
                <p className="note-text" style={{ color: '#b45309', marginTop: '8px' }}>
                  Recommendations: Keep Daily Limit &le;100 and Delay &ge;45 seconds. Check if you are operating strictly during business hours.
                </p>
              )}
            </div>
          </section>

          <section className="guideline-section">
            <h3>Official Google Documentation</h3>
            <div className="doc-links">
              <a className="doc-card" href="https://developers.google.com/workspace/gmail/api/reference/quota" target="_blank" rel="noreferrer">
                <strong>Gmail API Usage Limits</strong>
                <span>Open Documentation <ExternalLink size={14} /></span>
              </a>
              <a className="doc-card" href="https://knowledge.workspace.google.com/admin/gmail/gmail-sending-limits-in-google-workspace" target="_blank" rel="noreferrer">
                <strong>Gmail Sending Limits</strong>
                <span>Open Documentation <ExternalLink size={14} /></span>
              </a>
              <a className="doc-card" href="https://support.google.com/mail/answer/22839" target="_blank" rel="noreferrer">
                <strong>Personal Gmail Limits</strong>
                <span>Open Documentation <ExternalLink size={14} /></span>
              </a>
              <a className="doc-card" href="https://support.google.com/mail/answer/81126" target="_blank" rel="noreferrer">
                <strong>Email Sender Guidelines</strong>
                <span>Open Documentation <ExternalLink size={14} /></span>
              </a>
              <a className="doc-card" href="https://support.google.com/mail/answer/14229414" target="_blank" rel="noreferrer">
                <strong>Email Sender FAQ</strong>
                <span>Open Documentation <ExternalLink size={14} /></span>
              </a>
            </div>
          </section>
          
          <div className="modal-footer-note">
            <p>Information summarized from Google's official documentation (Reference: July 2026). Google may update limits or policies at any time. Always refer to the official documentation for the latest information.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

type Recruiter = {
  id: number;
  fullName: string;
  company: string;
  designation?: string;
  email: string;
  status: string;
  templateId?: number | null;
};

type Template = {
  id: number;
  name: string;
  subjectTemplate: string;
  htmlTemplate: string;
  textTemplate: string;
  isDefault: boolean;
  updatedAt: string;
};

function Recruiters() {
  const [refresh, setRefresh] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const { data } = useApi<{ rows: Recruiter[]; total: number }>(`/api/recruiters?search=${encodeURIComponent(search)}`, refresh);
  const { data: templates } = useApi<Template[]>("/api/templates", refresh);
  const defaultTemplate = templates?.find((template) => template.isDefault) ?? templates?.[0];
  const [form, setForm] = React.useState({ fullName: "", company: "", email: "", designation: "", notes: "", templateId: "" });
  
  // State for Loading and Editing
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<number | null>(null);
  const [editingRecruiter, setEditingRecruiter] = React.useState<Recruiter | null>(null);
  const [editForm, setEditForm] = React.useState({ fullName: "", company: "", email: "", designation: "", templateId: "" });
  const [editError, setEditError] = React.useState("");
  const [editSubmitting, setEditSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (form.templateId && templates && !templates.some((t) => String(t.id) === form.templateId)) {
      setForm((current) => ({ ...current, templateId: "" }));
    }
  }, [templates, form.templateId]);

  React.useEffect(() => {
    if (!form.templateId && defaultTemplate) setForm((current) => ({ ...current, templateId: String(defaultTemplate.id) }));
  }, [defaultTemplate, form.templateId]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.templateId) {
      alert("Please select a template first.");
      return;
    }
    setIsSubmitting(true);
    try {
      await api("/api/recruiters", { method: "POST", body: JSON.stringify({ ...form, templateId: Number(form.templateId) }) });
      setForm({ fullName: "", company: "", email: "", designation: "", notes: "", templateId: defaultTemplate ? String(defaultTemplate.id) : "" });
      setRefresh((value) => value + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add recruiter");
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (recruiter: Recruiter) => {
    setEditingRecruiter(recruiter);
    setEditForm({
      fullName: recruiter.fullName,
      company: recruiter.company,
      email: recruiter.email,
      designation: recruiter.designation || "",
      templateId: recruiter.templateId ? String(recruiter.templateId) : ""
    });
    setEditError("");
  };

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingRecruiter) return;
    setEditSubmitting(true);
    try {
      await api(`/api/recruiters/${editingRecruiter.id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...editForm,
          templateId: editForm.templateId ? Number(editForm.templateId) : null
        })
      });
      setEditingRecruiter(null);
      setRefresh((value) => value + 1);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update recruiter");
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this recruiter?")) return;
    setDeletingId(id);
    try {
      await api(`/api/recruiters/${id}`, { method: "DELETE" });
      setRefresh((value) => value + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete recruiter");
    } finally {
      setDeletingId(null);
    }
  };

  const importCsv = async (file?: File) => {
    if (!file) return;
    setIsImporting(true);
    try {
      const body = new FormData();
      body.append("file", file);
      await api("/api/recruiters/import", { method: "POST", body });
      setRefresh((value) => value + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to import CSV");
    } finally {
      setIsImporting(false);
    }
  };

  const hasTemplates = templates && templates.length > 0;

  return (
    <Page title="Recruiters" actions={<a className={`button secondary ${isImporting ? "disabled" : ""}`} href={`${API_URL}/api/recruiters/export`}>Export CSV</a>}>
      <section className="panel">
        <div className="toolbar">
          <input placeholder="Search" value={search} onChange={(event) => setSearch(event.target.value)} disabled={isImporting} />
          <label className={`button secondary ${isImporting ? "disabled" : ""}`}>
            {isImporting ? (
              <>
                <RefreshCw size={14} className="refresh-spin" />
                Importing CSV...
              </>
            ) : (
              "Import CSV"
            )}
            <input hidden type="file" accept=".csv,text/csv" disabled={isImporting} onChange={(event) => importCsv(event.target.files?.[0])} />
          </label>
        </div>
        
        {!hasTemplates && (
          <div className="warning-box" style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "16px", marginBottom: "8px" }}>
            <AlertTriangle size={18} />
            <span>
              <strong>No templates available.</strong> Please create an email template on the <NavLink to="/compose" style={{ color: "var(--primary)", textDecoration: "underline", fontWeight: "bold" }}>Template Builder</NavLink> page before adding recruiters.
            </span>
          </div>
        )}

        <form className="form-grid" onSubmit={submit}>
          <label htmlFor="add-fullName">
            <span>Full Name<span className="required-star">*</span></span>
            <input
              id="add-fullName"
              disabled={!hasTemplates || isSubmitting}
              required
              placeholder="Full name"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </label>
          <label htmlFor="add-company">
            <span>Company<span className="required-star">*</span></span>
            <input
              id="add-company"
              disabled={!hasTemplates || isSubmitting}
              required
              placeholder="Company"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
            />
          </label>
          <label htmlFor="add-email">
            <span>Email<span className="required-star">*</span></span>
            <input
              id="add-email"
              disabled={!hasTemplates || isSubmitting}
              required
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label htmlFor="add-designation">
            <span>Designation<span className="required-star">*</span></span>
            <input
              id="add-designation"
              disabled={!hasTemplates || isSubmitting}
              placeholder="Designation"
              value={form.designation}
              onChange={(e) => setForm({ ...form, designation: e.target.value })}
            />
          </label>
          <label htmlFor="add-templateId">
            <span>Template<span className="required-star">*</span></span>
            <select
              id="add-templateId"
              disabled={!hasTemplates || isSubmitting}
              required
              value={form.templateId}
              onChange={(e) => setForm({ ...form, templateId: e.target.value })}
            >
              <option value="">Select a template...</option>
              {(templates ?? []).map((template) => (
                <option key={template.id} value={template.id}>{template.name}{template.isDefault ? " (Default)" : ""}</option>
              ))}
            </select>
          </label>
          <div className="form-submit-container">
            <button disabled={!hasTemplates || isSubmitting}>
              {isSubmitting && <RefreshCw size={14} className="refresh-spin" />}
              Add Recruiter
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Company</th>
              <th>Email</th>
              <th>Template</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data?.rows ?? []).map((row) => (
              <tr key={row.id}>
                <td>{row.fullName}</td>
                <td>{row.company}</td>
                <td>{row.email}</td>
                <td>
                  {templates?.find((template) => template.id === row.templateId)?.name ?? (row.templateId ? "Deleted Template" : "No Template Attached")}
                </td>
                <td>
                  <span className={`status-${row.status.toLowerCase()}`}>{row.status}</span>
                </td>
                <td>
                  <div className="action-buttons-cell">
                    <button
                      type="button"
                      className="action-btn"
                      title="Edit Recruiter"
                      disabled={deletingId !== null}
                      onClick={() => startEdit(row)}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      className="action-btn danger"
                      title="Delete Recruiter"
                      disabled={deletingId !== null}
                      onClick={() => handleDelete(row.id)}
                    >
                      {deletingId === row.id ? <RefreshCw size={14} className="refresh-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {(!data?.rows || data.rows.length === 0) && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px" }}>
                  No recruiters found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Edit Recruiter Modal */}
      {editingRecruiter && (
        <div className="modal-overlay" onClick={() => !editSubmitting && setEditingRecruiter(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>Edit Recruiter</h2>
              <button className="modal-close" disabled={editSubmitting} onClick={() => setEditingRecruiter(null)}><X size={24} /></button>
            </div>
            <div className="modal-body">
              {editError && <p className="error" style={{ marginBottom: "16px" }}>{editError}</p>}
              <form className="stack" onSubmit={handleUpdate}>
                <label htmlFor="edit-fullName">
                  <span>Full Name<span className="required-star">*</span></span>
                  <input id="edit-fullName" required disabled={editSubmitting} value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} />
                </label>
                <label htmlFor="edit-company">
                  <span>Company<span className="required-star">*</span></span>
                  <input id="edit-company" required disabled={editSubmitting} value={editForm.company} onChange={(e) => setEditForm({ ...editForm, company: e.target.value })} />
                </label>
                <label htmlFor="edit-email">
                  <span>Email<span className="required-star">*</span></span>
                  <input id="edit-email" required disabled={editSubmitting} type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                </label>
                <label htmlFor="edit-designation">
                  <span>Designation<span className="required-star">*</span></span>
                  <input id="edit-designation" disabled={editSubmitting} value={editForm.designation} onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })} />
                </label>
                <label htmlFor="edit-templateId">
                  <span>Template<span className="required-star">*</span></span>
                  <select id="edit-templateId" required disabled={editSubmitting} value={editForm.templateId} onChange={(e) => setEditForm({ ...editForm, templateId: e.target.value })}>
                    <option value="">Select a template...</option>
                    {(templates ?? []).map((template) => (
                      <option key={template.id} value={template.id}>{template.name}{template.isDefault ? " (Default)" : ""}</option>
                    ))}
                  </select>
                </label>
                <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                  <button type="submit" disabled={editSubmitting}>
                    {editSubmitting && <RefreshCw size={14} className="refresh-spin" />}
                    Save Changes
                  </button>
                  <button type="button" className="secondary" disabled={editSubmitting} onClick={() => setEditingRecruiter(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}

function emailTextFromHtml(html: string) {
  const element = document.createElement("div");
  element.innerHTML = html;
  return element.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function ComposerToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;
  return (
    <div className="composer-toolbar">
      <button type="button" title="Undo" onClick={() => editor.chain().focus().undo().run()}><Undo2 size={16} /></button>
      <button type="button" title="Redo" onClick={() => editor.chain().focus().redo().run()}><Redo2 size={16} /></button>
      <button type="button" title="Bold" className={editor.isActive("bold") ? "active" : ""} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={16} /></button>
      <button type="button" title="Italic" className={editor.isActive("italic") ? "active" : ""} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={16} /></button>
      <button type="button" title="Underline" className={editor.isActive("underline") ? "active" : ""} onClick={() => editor.chain().focus().toggleUnderline().run()}><Underline size={16} /></button>
      <button type="button" title="Bullet list" className={editor.isActive("bulletList") ? "active" : ""} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={16} /></button>
      <button type="button" title="Numbered list" className={editor.isActive("orderedList") ? "active" : ""} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={16} /></button>
      <button type="button" title="Align left" onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft size={16} /></button>
      <button type="button" title="Align center" onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter size={16} /></button>
      <button type="button" title="Align right" onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight size={16} /></button>
      <label title="Text color" className="color-tool"><input type="color" onChange={(event) => editor.chain().focus().setColor(event.target.value).run()} /></label>
      <button type="button" title="Highlight" onClick={() => editor.chain().focus().toggleHighlight({ color: "#fef08a" }).run()}><Highlighter size={16} /></button>
      <button type="button" title="Link" onClick={() => {
        const href = window.prompt("Link URL");
        if (href) editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
      }}><Link size={16} /></button>
      <button type="button" title="Image" onClick={() => {
        const src = window.prompt("Image URL");
        if (src) editor.chain().focus().setImage({ src }).run();
      }}><Image size={16} /></button>
    </div>
  );
}

function Compose() {
  const [refresh, setRefresh] = React.useState(0);
  const { data: templates } = useApi<Template[]>("/api/templates", refresh);
  const [templateId, setTemplateId] = React.useState<number | null>(null);
  const [name, setName] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [status, setStatus] = React.useState("Not saved");
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [bodyVersion, setBodyVersion] = React.useState(0);
  const [attachments, setAttachments] = React.useState<Array<{ id: number; originalName: string; size: number }>>([]);
  const [uploadingAttachment, setUploadingAttachment] = React.useState(false);
  const [hasLoadedInitial, setHasLoadedInitial] = React.useState(false);
  const [isSettingDefault, setIsSettingDefault] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [cardAction, setCardAction] = React.useState<{ id: number; type: 'default' | 'delete' } | null>(null);
  const dirty = React.useRef(false);

  const location = useLocation();
  const stateTemplateId = location.state?.selectTemplateId;

  const editor = useEditor({
    extensions: [
      StarterKit,
      UnderlineExtension,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      LinkExtension.configure({ openOnClick: false }),
      ImageExtension,
      TextAlign.configure({ types: ["heading", "paragraph"] })
    ],
    content: "",
    editorProps: { attributes: { class: "composer-editor-content" } },
    onUpdate: () => {
      dirty.current = true;
      setStatus("Unsaved changes");
      setError("");
      setBodyVersion((value) => value + 1);
    }
  });

  React.useEffect(() => {
    if (templates && templates.length > 0) {
      // If a template ID was passed in location state (e.g. from Cover Letter generator), prioritize loading it
      const targetId = stateTemplateId || (hasLoadedInitial ? templateId : null);
      if (targetId) {
        const selected = templates.find((t) => t.id === targetId);
        if (selected && selected.id !== templateId) {
          setTemplateId(selected.id);
          setName(selected.name);
          setSubject(selected.subjectTemplate);
          editor?.commands.setContent(selected.htmlTemplate || "");
          setAttachments((selected as any).attachments || []);
          setStatus("Loaded from generator");
          dirty.current = false;
          setHasLoadedInitial(true);
          return;
        }
      }

      if (!hasLoadedInitial && !templateId) {
        const selected = templates.find((template) => template.isDefault) ?? templates[0];
        setTemplateId(selected.id);
        setName(selected.name);
        setSubject(selected.subjectTemplate);
        editor?.commands.setContent(selected.htmlTemplate || "");
        setAttachments((selected as any).attachments || []);
        setStatus(selected.isDefault ? "Default template" : "Loaded");
        dirty.current = false;
        setHasLoadedInitial(true);
      }
    }
  }, [editor, templateId, templates, hasLoadedInitial, stateTemplateId]);

  const payload = React.useCallback(() => {
    const html = editor?.getHTML() ?? "";
    const attachmentIds = attachments.map((att) => att.id);
    return { name, subjectTemplate: subject, htmlTemplate: html, textTemplate: emailTextFromHtml(html), attachmentIds };
  }, [editor, name, subject, attachments]);

  const loadTemplate = (template: Template & { attachments?: Array<{ id: number; originalName: string; size: number }> }) => {
    setTemplateId(template.id);
    setName(template.name);
    setSubject(template.subjectTemplate);
    editor?.commands.setContent(template.htmlTemplate || "");
    setAttachments(template.attachments || []);
    setError("");
    setStatus(template.isDefault ? "Default template" : "Loaded");
    dirty.current = false;
  };

  const newTemplate = () => {
    setTemplateId(null);
    setName("");
    setSubject("");
    editor?.commands.clearContent();
    setAttachments([]);
    setStatus("New template");
    setError("");
    dirty.current = false;
  };

  const isTemplateValid = React.useCallback(() => {
    const html = editor?.getHTML() ?? "";
    const textContent = html.replace(/<[^>]*>/g, "").trim();
    return name.trim().length > 0 && subject.trim().length > 0 && textContent.length > 0;
  }, [editor, name, subject]);

  const saveTemplate = React.useCallback(async (showValidationError = true) => {
    if (!editor || saving) return null;
    if (!isTemplateValid()) {
      if (showValidationError) {
        const missing: string[] = [];
        if (!name.trim()) missing.push("name");
        if (!subject.trim()) missing.push("subject");
        const html = editor?.getHTML() ?? "";
        if (!html.replace(/<[^>]*>/g, "").trim()) missing.push("body");
        setError(`Please fill in: ${missing.join(", ")}`);
        setStatus("Unsaved changes");
      }
      return null;
    }
    setSaving(true);
    setError("");
    setStatus("Saving...");
    try {
      const saved = templateId
        ? await api<Template & { attachments?: any[] }>(`/api/templates/${templateId}`, { method: "PUT", body: JSON.stringify(payload()) })
        : await api<Template & { attachments?: any[] }>("/api/templates", { method: "POST", body: JSON.stringify(payload()) });
      setTemplateId(saved.id);
      setName(saved.name);
      setSubject(saved.subjectTemplate);
      setAttachments(saved.attachments || []);
      setStatus(`Saved ${new Date().toLocaleTimeString()}`);
      dirty.current = false;
      setRefresh((value) => value + 1);
      return saved.id;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Template save failed");
      setStatus("Save failed");
      return null;
    } finally {
      setSaving(false);
    }
  }, [editor, isTemplateValid, name, payload, saving, subject, templateId]);

  React.useEffect(() => {
    if (!dirty.current) return;
    const timer = window.setTimeout(() => void saveTemplate(false), 1200);
    return () => window.clearTimeout(timer);
  }, [name, subject, bodyVersion, attachments, saveTemplate]);

  const setDefault = async () => {
    setIsSettingDefault(true);
    try {
      const id = templateId ?? await saveTemplate();
      if (!id) return;
      await api(`/api/templates/${id}/default`, { method: "POST" });
      setStatus("Default template");
      setRefresh((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set default template");
    } finally {
      setIsSettingDefault(false);
    }
  };

  const removeTemplate = async () => {
    if (!templateId || !window.confirm("Delete this template?")) return;
    setIsDeleting(true);
    try {
      await api(`/api/templates/${templateId}`, { method: "DELETE" });
      newTemplate();
      setRefresh((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete template");
    } finally {
      setIsDeleting(false);
    }
  };

  const setDefaultFromList = async (id: number, event: React.MouseEvent) => {
    event.stopPropagation();
    setCardAction({ id, type: 'default' });
    try {
      await api(`/api/templates/${id}/default`, { method: "POST" });
      if (templateId === id) {
        setStatus("Default template");
      }
      setRefresh((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set default template");
    } finally {
      setCardAction(null);
    }
  };

  const deleteFromList = async (id: number, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!window.confirm("Delete this template?")) return;
    setCardAction({ id, type: 'delete' });
    try {
      await api(`/api/templates/${id}`, { method: "DELETE" });
      if (templateId === id) {
        newTemplate();
      }
      setRefresh((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete template");
    } finally {
      setCardAction(null);
    }
  };

  const uploadAttachment = async (file?: File) => {
    if (!file) return;
    setUploadingAttachment(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await api<{ id: number; originalName: string; size: number }>("/api/uploads/attachments", {
        method: "POST",
        body
      });
      setAttachments((current) => [...current, res]);
      dirty.current = true;
      setStatus("Unsaved changes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload attachment");
    } finally {
      setUploadingAttachment(false);
    }
  };

  const removeAttachment = (id: number) => {
    setAttachments((current) => current.filter((att) => att.id !== id));
    dirty.current = true;
    setStatus("Unsaved changes");
  };

  return (
    <Page
      title="Template Builder"
      actions={
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button className="button secondary" onClick={newTemplate}>New Template</button>
          <GoogleAuthStatus />
        </div>
      }
    >
      {error && <p className="error">{error}</p>}
      <div className="compose-layout">
        <section className="composer-shell">
          <input className="template-name-input" placeholder="Template name" value={name} onChange={(event) => { dirty.current = true; setStatus("Unsaved changes"); setError(""); setName(event.target.value); }} />
          <input className="subject-input" placeholder="Subject" value={subject} onChange={(event) => { dirty.current = true; setStatus("Unsaved changes"); setError(""); setSubject(event.target.value); }} />
          <div className="placeholder-strip">
            <span>Supported placeholders:</span>
            <code>{"{{fullName}}"}</code>
            <code>{"{{company}}"}</code>
            <code>{"{{designation}}"}</code>
          </div>
          <ComposerToolbar editor={editor} />
          <div className="composer-editor">
            <EditorContent editor={editor} />
          </div>

          <div className="composer-attachments-section">
            <div className="attachments-header">
              <span className="attachments-title">Template Attachments</span>
              <label className="attachment-upload-btn">
                <Paperclip size={14} />
                Attach File
                <input
                  type="file"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      void uploadAttachment(file);
                    }
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {uploadingAttachment && (
              <div className="attachment-uploading">
                <RefreshCw size={14} className="refresh-spin" /> Uploading attachment...
              </div>
            )}
            <div className="attachments-list">
              {attachments.map((att) => (
                <div key={att.id} className="attachment-item">
                  <Paperclip size={14} className="attachment-icon" />
                  <span className="attachment-name" title={att.originalName}>{att.originalName}</span>
                  <span className="attachment-size">({(att.size / 1024).toFixed(1)} KB)</span>
                  <button
                    type="button"
                    className="attachment-remove-btn"
                    title="Remove Attachment"
                    onClick={() => removeAttachment(att.id)}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {attachments.length === 0 && !uploadingAttachment && (
                <p className="no-attachments-text">No attachments for this template. Click "Attach File" to add files.</p>
              )}
            </div>
          </div>

          <div className="composer-footer">
            <button onClick={() => void saveTemplate()} disabled={saving || isSettingDefault || isDeleting}>
              {saving ? (
                <>
                  <RefreshCw size={16} className="refresh-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save Template
                </>
              )}
            </button>
            <button className="secondary" onClick={setDefault} disabled={saving || isSettingDefault || isDeleting || (!templateId && !name.trim())}>
              {isSettingDefault && <RefreshCw size={14} className="refresh-spin" />}
              Set Default
            </button>
            <button className="secondary icon-only danger" title="Delete template" onClick={removeTemplate} disabled={saving || isSettingDefault || isDeleting || !templateId}>
              {isDeleting ? <RefreshCw size={16} className="refresh-spin" /> : <Trash2 size={16} />}
            </button>
            <span className="save-status">{status}</span>
          </div>
        </section>
        <aside className="drafts-panel">
          <h2>Templates</h2>
          <div className="draft-list">
            {(templates ?? []).map((template) => (
              <div
                key={template.id}
                className={`template-card ${template.id === templateId ? "active" : ""} ${template.isDefault ? "is-default" : ""}`}
                onClick={() => loadTemplate(template)}
              >
                <div className="template-card-header">
                  <strong className="template-card-title">{template.name}</strong>
                  <div className="template-card-actions">
                    {!template.isDefault && (
                      <button
                        type="button"
                        className="card-action-btn set-default-btn"
                        title="Set as Default"
                        disabled={cardAction !== null}
                        onClick={(e) => setDefaultFromList(template.id, e)}
                      >
                        {cardAction?.id === template.id && cardAction.type === 'default' && <RefreshCw size={12} className="refresh-spin" />}
                        Set Default
                      </button>
                    )}
                    <button
                      type="button"
                      className="card-action-btn delete-btn danger"
                      title="Delete Template"
                      disabled={cardAction !== null}
                      onClick={(e) => deleteFromList(template.id, e)}
                    >
                      {cardAction?.id === template.id && cardAction.type === 'delete' ? <RefreshCw size={14} className="refresh-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
                <span className="template-card-subject">{template.subjectTemplate}</span>
                <div className="template-card-footer">
                  {template.isDefault ? (
                    <span className="default-badge">Default</span>
                  ) : (
                    <span className="update-time">
                      Updated {new Date(template.updatedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {(!templates || templates.length === 0) && <p className="note-text">No templates yet. Create one to start sending.</p>}
          </div>
        </aside>
      </div>
    </Page>
  );
}

const SETTING_METADATA: Record<string, {
  title: string;
  description: string;
  presets: string[];
  unit?: string;
  inputType: 'number' | 'text' | 'time';
  validate?: (value: string, formValues: Record<string, unknown>) => string | null;
  warning?: string;
}> = {
  dailyLimit: {
    title: "Daily Email Limit",
    description: "The maximum number of emails to send per day. Safe limits keep your account's reputation healthy.",
    presets: ["30", "50", "80", "100"],
    inputType: "number",
    validate: (val) => {
      const num = Number(val);
      if (isNaN(num) || num < 1) return "Must be at least 1";
      if (num > 2000) return "Cannot exceed Google's maximum API limit of 2000";
      return null;
    },
    warning: "Custom daily limits should be configured with caution. Exceeding 100 emails/day on standard accounts is highly likely to trigger Google's spam algorithms and lead to suspension."
  },
  minDelaySeconds: {
    title: "Minimum Delay Between Emails",
    description: "The minimum time to wait before sending the next email (in seconds). Higher delays mimic natural human behavior.",
    presets: ["45", "60", "90"],
    unit: "seconds",
    inputType: "number",
    validate: (val, form) => {
      const num = Number(val);
      if (isNaN(num) || num < 1) return "Must be at least 1 second";
      const maxDelay = Number(form.maxDelaySeconds);
      if (!isNaN(maxDelay) && num > maxDelay) return `Minimum delay cannot be greater than Maximum delay (${maxDelay}s)`;
      return null;
    },
    warning: "Setting a low minimum delay (below 45 seconds) causes rapid back-to-back delivery, which is a major signal for automated spam detection."
  },
  maxDelaySeconds: {
    title: "Maximum Delay Between Emails",
    description: "The maximum time to wait before sending the next email (in seconds). Adds randomized spacing between sends.",
    presets: ["120", "150", "180"],
    unit: "seconds",
    inputType: "number",
    validate: (val, form) => {
      const num = Number(val);
      if (isNaN(num) || num < 1) return "Must be at least 1 second";
      const minDelay = Number(form.minDelaySeconds);
      if (!isNaN(minDelay) && num < minDelay) return `Maximum delay cannot be less than Minimum delay (${minDelay}s)`;
      return null;
    },
    warning: "A low maximum delay compresses the randomization interval. Keeping this interval wide helps simulate authentic human activity."
  },
  startTime: {
    title: "Send Start Time",
    description: "The hour at which email campaign activity should begin each day.",
    presets: ["08:00", "09:00", "10:00"],
    inputType: "time",
    validate: (val) => {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(val)) return "Invalid time format (HH:MM)";
      return null;
    },
    warning: "Configuring a custom start time. Sending outside of regular business hours (especially overnight) significantly increases spam scoring."
  },
  endTime: {
    title: "Send End Time",
    description: "The hour at which email campaign activity should pause each day.",
    presets: ["17:00", "18:00", "19:00"],
    inputType: "time",
    validate: (val) => {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(val)) return "Invalid time format (HH:MM)";
      return null;
    },
    warning: "Configuring a custom end time. Late-night sending is flagged by anti-abuse policies and lowers engagement."
  },
  retryCount: {
    title: "Max Retry Attempts",
    description: "The number of times the queue will try to send a failed message before marking it as permanently failed.",
    presets: ["2", "3", "4", "5"],
    inputType: "number",
    validate: (val) => {
      const num = Number(val);
      if (isNaN(num) || num < 0) return "Must be 0 or more";
      if (num > 10) return "Max retries cannot exceed 10";
      return null;
    },
    warning: "High retry counts consume API quotas rapidly during outages and can create sending loops that look suspicious to Gmail security."
  }
};

const FORMATTED_LABELS: Record<string, string> = {
  dailyLimit: "Daily Email Limit",
  minDelaySeconds: "Minimum Delay (Seconds)",
  maxDelaySeconds: "Maximum Delay (Seconds)",
  startTime: "Send Start Time (HH:MM)",
  endTime: "Send End Time (HH:MM)",
  retryCount: "Max Retry Attempts"
};

interface SettingOptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  settingKey: string;
  currentValue: string;
  onConfirm: (newValue: string) => void;
  formValues: Record<string, unknown>;
}

function SettingOptionModal({ isOpen, onClose, settingKey, currentValue, onConfirm, formValues }: SettingOptionModalProps) {
  const meta = SETTING_METADATA[settingKey];
  const [selectedPreset, setSelectedPreset] = React.useState<string | null>(null);
  const [customValue, setCustomValue] = React.useState("");
  const [validationError, setValidationError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen && meta) {
      if (meta.presets.includes(currentValue)) {
        setSelectedPreset(currentValue);
        setCustomValue("");
      } else {
        setSelectedPreset("other");
        setCustomValue(currentValue);
      }
      setValidationError(null);
    }
  }, [isOpen, currentValue, meta, settingKey]);

  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen || !meta) return null;

  const handlePresetSelect = (val: string) => {
    setSelectedPreset(val);
    setValidationError(null);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomValue(val);
    if (meta.validate) {
      const tempForm = { ...formValues, [settingKey]: val };
      const err = meta.validate(val, tempForm);
      setValidationError(err);
    }
  };

  const handleConfirm = () => {
    const finalValue = selectedPreset === "other" ? customValue : selectedPreset;
    if (!finalValue) {
      setValidationError("Value cannot be empty");
      return;
    }

    if (meta.validate) {
      const tempForm = { ...formValues, [settingKey]: finalValue };
      const err = meta.validate(finalValue, tempForm);
      if (err) {
        setValidationError(err);
        return;
      }
    }

    onConfirm(finalValue);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '550px' }}>
        <div className="modal-header">
          <h2>Select {meta.title}</h2>
          <button className="modal-close" onClick={onClose}><X size={24} /></button>
        </div>
        <div className="modal-body" style={{ padding: '20px' }}>
          <p className="note-text" style={{ marginBottom: '16px', fontSize: '14px' }}>
            {meta.description}
          </p>

          <label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>
            Recommended Options:
          </label>
          <div className="option-modal-presets">
            {meta.presets.map((preset) => (
              <div
                key={preset}
                className={`preset-card ${selectedPreset === preset ? 'active' : ''}`}
                onClick={() => handlePresetSelect(preset)}
              >
                <span className="preset-card-value">{preset}</span>
                {meta.unit && <span className="preset-card-label">{meta.unit}</span>}
              </div>
            ))}
            <div
              className={`preset-card other-card ${selectedPreset === 'other' ? 'active' : ''}`}
              onClick={() => handlePresetSelect('other')}
            >
              Other / Custom
            </div>
          </div>

          {selectedPreset === "other" && (
            <div className="custom-input-section">
              {meta.warning && (
                <div className="warning-alert">
                  <AlertTriangle size={18} />
                  <div>
                    <strong>Safety Notice:</strong> {meta.warning}
                  </div>
                </div>
              )}

              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                Enter Custom Value:
                <input
                  type={meta.inputType}
                  value={customValue}
                  onChange={handleCustomChange}
                  autoFocus
                  style={{ width: '100%', fontSize: '15px', padding: '10px' }}
                />
              </label>

              {validationError && (
                <div className="error-alert">
                  <XCircle size={18} />
                  <div>{validationError}</div>
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" className="button secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="button"
              onClick={handleConfirm}
              disabled={selectedPreset === "other" && !!validationError}
            >
              Apply Selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsPage() {
  const [refresh, setRefresh] = React.useState(0);
  const { data } = useApi<Record<string, unknown>>("/api/settings", refresh);
  const [form, setForm] = React.useState<Record<string, unknown>>({});
  const [isGuidelinesOpen, setIsGuidelinesOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [modalState, setModalState] = React.useState<{ isOpen: boolean; key: string; value: string }>({
    isOpen: false,
    key: "",
    value: ""
  });

  React.useEffect(() => {
    if (data) {
      setForm({
        dailyLimit: String(data.dailyLimit ?? 50),
        minDelaySeconds: String(data.minDelaySeconds ?? 45),
        maxDelaySeconds: String(data.maxDelaySeconds ?? 150),
        startTime: String(data.startTime ?? "09:00"),
        endTime: String(data.endTime ?? "18:00"),
        retryCount: String(data.retryCount ?? 4)
      });
    }
  }, [data]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Final safety validations
    const minDelay = Number(form.minDelaySeconds);
    const maxDelay = Number(form.maxDelaySeconds);
    if (minDelay > maxDelay) {
      alert("Validation Error: Minimum delay cannot exceed maximum delay.");
      return;
    }

    setIsSaving(true);
    try {
      await api("/api/settings", { method: "PUT", body: JSON.stringify(form) });
      setRefresh((value) => value + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const openModalFor = (key: string) => {
    setModalState({
      isOpen: true,
      key,
      value: String(form[key] ?? "")
    });
  };

  const handleConfirmModal = (newValue: string) => {
    setForm((prev) => ({
      ...prev,
      [modalState.key]: newValue
    }));
  };

  // Calculate safety metrics
  const dailyLimitVal = Number(form.dailyLimit ?? 50);
  const minDelayVal = Number(form.minDelaySeconds ?? 45);
  const maxDelayVal = Number(form.maxDelaySeconds ?? 150);

  const getSafetyLevel = () => {
    let score = 0;
    
    // Daily Limit scoring
    if (dailyLimitVal <= 100) score += 100;
    else if (dailyLimitVal <= 200) score += 70;
    else if (dailyLimitVal <= 500) score += 40;
    else score += 10;

    // Min Delay scoring
    if (minDelayVal >= 45) score += 100;
    else if (minDelayVal >= 30) score += 60;
    else if (minDelayVal >= 15) score += 30;
    else score += 10;

    // Max Delay scoring
    if (maxDelayVal >= 120) score += 100;
    else if (maxDelayVal >= 90) score += 70;
    else if (maxDelayVal >= 60) score += 40;
    else score += 10;

    const avg = Math.round(score / 3);
    if (avg >= 90) return { label: "Safe Outreach Mode", status: "safe", pct: avg, desc: "Your settings fully adhere to Google's safe outreach guidelines. Suspension risk is extremely low." };
    if (avg >= 50) return { label: "Moderate Outreach Risk", status: "warning", pct: avg, desc: "Some parameters exceed standard recommendations. Monitor logs for temporary blocks." };
    return { label: "High Outreach Risk", status: "danger", pct: avg, desc: "Dangerous rate or delay parameters. High probability of Gmail spam folder routing or API suspension." };
  };

  const safety = getSafetyLevel();

  return (
    <Page title="Campaign Settings" actions={<GoogleAuthStatus />}>
      <SafeSendingGuidelinesModal isOpen={isGuidelinesOpen} onClose={() => setIsGuidelinesOpen(false)} settings={data} />
      
      {modalState.isOpen && (
        <SettingOptionModal
          isOpen={modalState.isOpen}
          onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
          settingKey={modalState.key}
          currentValue={modalState.value}
          onConfirm={handleConfirmModal}
          formValues={form}
        />
      )}

      <div className="guidelines-banner" onClick={() => setIsGuidelinesOpen(true)}>
        <div className="guidelines-banner-icon">
          <AlertTriangle size={24} />
        </div>
        <div className="guidelines-banner-text">
          <strong>Important: Read Google's Safe Sending Guidelines</strong>
          <span>Understand Gmail's limits to avoid account suspension or spam filters. Click to view recommended settings.</span>
        </div>
        <button type="button" className="button guidelines-banner-button">
          View Guidelines
        </button>
      </div>

      <div className="safety-meter-card">
        <div className="safety-meter-header">
          <div className="safety-meter-title">Outreach Safety Status</div>
          <span className={`safety-meter-badge ${safety.status}`}>
            {safety.label} ({safety.pct}%)
          </span>
        </div>
        <div className="safety-meter-bar-container">
          <div
            className={`safety-meter-bar ${safety.status}`}
            style={{ width: `${safety.pct}%` }}
          />
        </div>
        <p className="safety-meter-desc">{safety.desc}</p>
      </div>

      <section className="panel">
        <form className="stack" onSubmit={submit}>
          <div className="form-grid">
            {["dailyLimit", "minDelaySeconds", "maxDelaySeconds", "startTime", "endTime", "retryCount"].map((key) => (
              <label key={key} style={{ cursor: isSaving ? 'not-allowed' : 'pointer' }} onClick={() => !isSaving && openModalFor(key)}>
                {FORMATTED_LABELS[key]}
                <div className="clickable-setting-input-wrapper">
                  <input
                    type="text"
                    readOnly
                    disabled={isSaving}
                    value={String(form[key] ?? "")}
                  />
                  <SlidersHorizontal className="clickable-setting-input-icon" size={16} />
                </div>
              </label>
            ))}
          </div>
          
          <button style={{ marginTop: '16px' }} disabled={isSaving}>
            {isSaving && <RefreshCw size={14} className="refresh-spin" />}
            Save Settings
          </button>
        </form>
      </section>
    </Page>
  );
}


function Logs() {
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(25);
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [level, setLevel] = React.useState("");
  const [refresh, setRefresh] = React.useState(0);
  const [expandedRows, setExpandedRows] = React.useState<Record<number, boolean>>({});

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const queryParams = new URLSearchParams();
  queryParams.append("page", String(page));
  queryParams.append("limit", String(limit));
  if (debouncedSearch) queryParams.append("search", debouncedSearch);
  if (level) queryParams.append("level", level);

  const { data, error, loading } = useApi<{
    rows: Array<{
      id: number;
      level: "info" | "warn" | "error";
      event: string;
      message: string;
      metadata: Record<string, unknown>;
      createdAt: string;
    }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>(`/api/logs?${queryParams.toString()}`, refresh);

  const toggleRow = (id: number, hasMetadata: boolean) => {
    if (!hasMetadata) return;
    setExpandedRows((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleRefresh = () => {
    setRefresh((prev) => prev + 1);
  };

  const handleClearFilters = () => {
    setSearch("");
    setLevel("");
    setPage(1);
  };

  const hasFiltersActive = search !== "" || level !== "";
  const logsList = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 0;

  const getPageNumbers = () => {
    const pages: Array<number | string> = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);

      if (start > 2) {
        pages.push("...");
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < totalPages - 1) {
        pages.push("...");
      }

      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <Page 
      title="Logs" 
      titleIcon={
        <button 
          onClick={handleRefresh} 
          className="help-icon-button" 
          title="Refresh Logs"
          style={{ padding: "8px", margin: "0 0 0 12px" }}
        >
          <RefreshCw size={16} className={loading ? "refresh-spin" : ""} />
        </button>
      }
    >
      <section className="panel" style={{ overflow: "visible" }}>
        <div className="toolbar" style={{ justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: "10px", flex: 1, minWidth: "280px" }}>
            <div style={{ position: "relative", flex: 1, maxWidth: "340px" }}>
              <input 
                placeholder="Search event or message..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                style={{ paddingLeft: "36px" }}
              />
              <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", display: "flex", alignItems: "center" }}>
                <Search size={16} />
              </span>
            </div>
            <select 
              value={level} 
              onChange={(e) => setLevel(e.target.value)} 
              style={{ maxWidth: "160px" }}
            >
              <option value="">All Levels</option>
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
            </select>
            {hasFiltersActive && (
              <button 
                type="button" 
                className="secondary" 
                onClick={handleClearFilters}
                style={{ minHeight: "40px" }}
              >
                Clear Filters
              </button>
            )}
          </div>
          <div>
            <select 
              value={limit} 
              onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} 
              style={{ width: "140px" }}
            >
              <option value="10">10 per page</option>
              <option value="25">25 per page</option>
              <option value="50">50 per page</option>
              <option value="100">100 per page</option>
            </select>
          </div>
        </div>
      </section>

      {error && <p className="error" style={{ marginBottom: "18px" }}>{error}</p>}

      <section className="panel" style={{ position: "relative" }}>
        {loading && (
          <div style={{ 
            position: "absolute", 
            top: 0, left: 0, right: 0, bottom: 0, 
            background: "rgba(255, 255, 255, 0.15)", 
            backdropFilter: "blur(1px)",
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            zIndex: 5 
          }}>
            <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--primary)" }}>Loading logs...</span>
          </div>
        )}
        
        <table>
          <thead>
            <tr>
              <th style={{ width: "40px" }}></th>
              <th style={{ width: "100px" }}>Level</th>
              <th style={{ width: "200px" }}>Event</th>
              <th>Message</th>
              <th style={{ width: "220px" }}>Time</th>
            </tr>
          </thead>
          <tbody>
            {logsList.map((row) => {
              const hasMetadata = row.metadata && Object.keys(row.metadata).length > 0;
              const isExpanded = !!expandedRows[row.id];
              return (
                <React.Fragment key={row.id}>
                  <tr 
                    className={hasMetadata ? "log-row-expandable" : ""} 
                    onClick={() => toggleRow(row.id, hasMetadata)}
                  >
                    <td style={{ textAlign: "center" }}>
                      {hasMetadata && (
                        isExpanded ? <ChevronUp size={16} style={{ color: "var(--text-muted)" }} /> : <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />
                      )}
                    </td>
                    <td>
                      <span className={`badge ${row.level}`}>
                        {row.level}
                      </span>
                    </td>
                    <td>
                      <span className="log-event-code">
                        {row.event}
                      </span>
                    </td>
                    <td style={{ fontWeight: hasMetadata ? "500" : "normal" }}>{row.message}</td>
                    <td style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                  </tr>
                  {hasMetadata && isExpanded && (
                    <tr className="metadata-row">
                      <td></td>
                      <td colSpan={4}>
                        <div className="metadata-container">
                          <div className="metadata-title">
                            <SlidersHorizontal size={12} /> Log Metadata Context Details
                          </div>
                          <pre className="metadata-pre">
                            {JSON.stringify(row.metadata, null, 2)}
                          </pre>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {logsList.length === 0 && !loading && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)", padding: "28px" }}>
                  No logs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {totalPages > 1 && (
        <div className="pagination-container">
          <div className="pagination-info">
            Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} entries
          </div>
          <div className="pagination-buttons">
            <button
              className="pagination-btn inactive"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            {getPageNumbers().map((p, idx) => {
              if (p === "...") {
                return (
                  <span key={`ellipsis-${idx}`} style={{ padding: "0 8px", color: "var(--text-muted)" }}>
                    ...
                  </span>
                );
              }
              const pageNum = p as number;
              return (
                <button
                  key={`page-${pageNum}`}
                  className={`pagination-btn ${page === pageNum ? "active" : "inactive"}`}
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              className="pagination-btn inactive"
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </Page>
  );
}

function Statistics() {
  const { data } = useApi<Stats>("/api/statistics");
  return (
    <Page title="Statistics">
      <div className="stats-grid">
        <StatCard label="Total sent" value={data?.totalSent ?? 0} />
        <StatCard label="Success rate" value={`${data?.successRate ?? 0}%`} />
        <StatCard label="Retries" value={data?.retries ?? 0} />
        <StatCard label="Estimated completion" value={data?.estimatedCompletionDate ?? "Done"} />
      </div>
    </Page>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <section className="panel">
      <table>
        <thead>
          <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function CoverLetterGenerator() {
  const [activeResume, setActiveResume] = React.useState<any>(null);
  const [loadingResume, setLoadingResume] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [saveStatus, setSaveStatus] = React.useState("");
  const [mode, setMode] = React.useState<"specific" | "general">("specific");
  const navigate = useNavigate();

  const [form, setForm] = React.useState({
    role: "",
    company: "",
    tone: "Professional & Formal",
    jobDescription: "",
    focusSkills: ""
  });

  const [subject, setSubject] = React.useState("");
  const [saveName, setSaveName] = React.useState("");

  const editor = useEditor({
    extensions: [
      StarterKit,
      UnderlineExtension,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      LinkExtension.configure({ openOnClick: false }),
      ImageExtension,
      TextAlign.configure({ types: ["heading", "paragraph"] })
    ],
    content: ""
  });

  React.useEffect(() => {
    fetchActiveResume();
  }, []);

  const fetchActiveResume = async () => {
    setLoadingResume(true);
    try {
      const res = await api<any>("/api/uploads/resume/active");
      setActiveResume(res);
    } catch (err) {
      console.error("Failed to load active resume:", err);
      setActiveResume(null);
    } finally {
      setLoadingResume(false);
    }
  };

  const uploadResume = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await api<any>("/api/uploads/resume", { method: "POST", body });
      setActiveResume(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload resume");
    } finally {
      setUploading(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeResume) {
      setError("Please upload a resume first");
      return;
    }
    setGenerating(true);
    setError("");
    setSaveStatus("");
    try {
      const skillsArray = form.focusSkills
        ? form.focusSkills.split(",").map(s => s.trim()).filter(Boolean)
        : [];
      
      const result = await api<{ subject: string; html: string }>("/api/cover-letter/generate", {
        method: "POST",
        body: JSON.stringify({
          role: mode === "specific" ? form.role : undefined,
          company: mode === "specific" ? form.company : undefined,
          tone: form.tone,
          jobDescription: form.jobDescription,
          focusSkills: skillsArray
        })
      });

      setSubject(result.subject);
      setSaveName(mode === "specific" ? `Cover Letter - ${form.role} - ${form.company}` : `General Cover Letter Template - ${form.tone}`);
      editor?.commands.setContent(result.html);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed. Check that GEMINI_API_KEY is configured.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!editor || !subject.trim() || !saveName.trim()) {
      setError("Please generate a cover letter first and provide a template name");
      return;
    }
    setSaving(true);
    setError("");
    setSaveStatus("Saving...");
    try {
      const html = editor.getHTML();
      const saved = await api<any>("/api/templates", {
        method: "POST",
        body: JSON.stringify({
          name: saveName,
          subjectTemplate: subject,
          htmlTemplate: html,
          textTemplate: emailTextFromHtml(html),
          attachmentIds: []
        })
      });
      setSaveStatus("Saved successfully! Redirecting...");
      setTimeout(() => {
        navigate("/compose", { state: { selectTemplateId: saved.id } });
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template");
      setSaveStatus("Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page title="AI Cover Letter Generator">
      {error && <p className="error" style={{ marginBottom: "16px" }}>{error}</p>}
      
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>
        
        {/* Left Side: Setup & Input */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* Resume Upload / Active Card */}
          <section className="panel" style={{ padding: "16px" }}>
            <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "18px" }}>Active Resume</h2>
            {loadingResume ? (
              <p style={{ color: "var(--text-muted)" }}>Loading active resume...</p>
            ) : activeResume ? (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--info-bg)", border: "1px solid var(--info-border)", borderRadius: "6px", padding: "12px" }}>
                <div>
                  <strong style={{ display: "block", color: "var(--info-text)" }}>{activeResume.originalName}</strong>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Uploaded: {new Date(activeResume.createdAt).toLocaleDateString()}</span>
                </div>
                <label className={`button secondary ${uploading ? "disabled" : ""}`} style={{ minHeight: "32px", padding: "0 10px", fontSize: "14px", margin: 0 }}>
                  {uploading ? <RefreshCw size={12} className="refresh-spin" /> : <Upload size={12} />}
                  Replace
                  <input hidden type="file" accept=".pdf" disabled={uploading} onChange={(e) => e.target.files?.[0] && uploadResume(e.target.files[0])} />
                </label>
              </div>
            ) : (
              <div style={{ textAlign: "center", border: "2px dashed var(--border)", borderRadius: "6px", padding: "24px", color: "var(--text-muted)" }}>
                <p style={{ margin: "0 0 12px 0" }}>No resume uploaded yet</p>
                <label className={`button ${uploading ? "disabled" : ""}`}>
                  {uploading ? <RefreshCw size={14} className="refresh-spin" /> : <Upload size={14} />}
                  Upload PDF Resume
                  <input hidden type="file" accept=".pdf" disabled={uploading} onChange={(e) => e.target.files?.[0] && uploadResume(e.target.files[0])} />
                </label>
              </div>
            )}
          </section>

          {/* Form Parameters */}
          <section className="panel" style={{ padding: "16px" }}>
            <h2 style={{ marginTop: 0, marginBottom: "16px", fontSize: "18px" }}>Generation Settings</h2>
            
            <div style={{ display: "flex", gap: "10px", marginBottom: "20px", background: "var(--sidebar-hover)", padding: "4px", borderRadius: "6px" }}>
              <button
                type="button"
                style={{ flex: 1, minHeight: "32px", fontSize: "14px", background: mode === "specific" ? "var(--primary)" : "transparent", color: mode === "specific" ? "white" : "var(--sidebar-text-muted)", transition: "all 0.2s" }}
                onClick={() => setMode("specific")}
              >
                Target Specific Job
              </button>
              <button
                type="button"
                style={{ flex: 1, minHeight: "32px", fontSize: "14px", background: mode === "general" ? "var(--primary)" : "transparent", color: mode === "general" ? "white" : "var(--sidebar-text-muted)", transition: "all 0.2s" }}
                onClick={() => setMode("general")}
              >
                General Template
              </button>
            </div>

            <form className="stack" onSubmit={handleGenerate}>
              {mode === "specific" && (
                <>
                  <label htmlFor="gen-role">
                    <span>Target Job Role<span className="required-star">*</span></span>
                    <input
                      id="gen-role"
                      required
                      placeholder="e.g. Senior React Developer"
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value })}
                    />
                  </label>

                  <label htmlFor="gen-company">
                    <span>Target Company Name<span className="required-star">*</span></span>
                    <input
                      id="gen-company"
                      required
                      placeholder="e.g. Google"
                      value={form.company}
                      onChange={(e) => setForm({ ...form, company: e.target.value })}
                    />
                  </label>
                </>
              )}

              <label htmlFor="gen-tone">
                <span>Template Style / Tone<span className="required-star">*</span></span>
                <select
                  id="gen-tone"
                  required
                  value={form.tone}
                  onChange={(e) => setForm({ ...form, tone: e.target.value })}
                >
                  <option value="Professional & Formal">Professional & Formal (Structured, polite, standard layout)</option>
                  <option value="Short & Crisp">Short & Crisp (Concise email focus, quick reading)</option>
                  <option value="Story-Driven">Story-Driven (Highlights personal story, connection to mission)</option>
                  <option value="Technical & Skills Focus">Technical & Skills Focus (Dives deep into scale, frameworks, and architecture)</option>
                  <option value="Bold & Persuasive">Bold & Persuasive (Confident, clear value-proposition)</option>
                </select>
              </label>

              <label htmlFor="gen-skills">
                <span>Focus Skills (Comma-separated)</span>
                <input
                  id="gen-skills"
                  placeholder="e.g. React, Node.js, GraphQL, AWS"
                  value={form.focusSkills}
                  onChange={(e) => setForm({ ...form, focusSkills: e.target.value })}
                />
              </label>

              <label htmlFor="gen-description">
                <span>Job Description / Context (Optional)</span>
                <textarea
                  id="gen-description"
                  placeholder="Paste target job description snippet here..."
                  rows={6}
                  style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid var(--border)", background: "var(--bg-body)", color: "var(--text-main)", resize: "vertical", font: "inherit" }}
                  value={form.jobDescription}
                  onChange={(e) => setForm({ ...form, jobDescription: e.target.value })}
                />
              </label>

              <div style={{ marginTop: "12px" }}>
                <button type="submit" disabled={generating || !activeResume} style={{ width: "100%", justifyContent: "center" }}>
                  {generating ? (
                    <>
                      <RefreshCw size={14} className="refresh-spin" />
                      Generating Cover Letter...
                    </>
                  ) : (
                    "Generate Cover Letter"
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>

        {/* Right Side: Generated Content & Editor */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <section className="panel" style={{ padding: "16px", minHeight: "500px" }}>
            <h2 style={{ marginTop: 0, marginBottom: "16px", fontSize: "18px" }}>Generated Cover Letter</h2>
            
            {editor ? (
              <div className="composer" style={{ border: "1px solid var(--border)", borderRadius: "6px", display: "flex", flexDirection: "column", height: "100%" }}>
                
                {/* Subject Field */}
                <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid var(--border)", padding: "10px 14px", gap: "8px" }}>
                  <span style={{ fontWeight: "bold", color: "var(--text-muted)" }}>Subject:</span>
                  <input
                    type="text"
                    placeholder="Subject Line"
                    style={{ flex: 1, border: "none", background: "transparent", fontSize: "15px", color: "var(--text-main)", fontWeight: "500", padding: 0 }}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>

                {/* Toolbar */}
                <ComposerToolbar editor={editor} />

                {/* Editor Content Area */}
                <div style={{ padding: "14px", minHeight: "350px", overflowY: "auto" }}>
                  <EditorContent editor={editor} />
                </div>
              </div>
            ) : (
              <p style={{ color: "var(--text-muted)" }}>Initializing editor...</p>
            )}

            {/* Save Template controls */}
            {editor?.getHTML() && subject.trim() && (
              <div style={{ marginTop: "20px", borderTop: "1px solid var(--border-light)", paddingTop: "16px" }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <label htmlFor="save-name" style={{ flex: 1 }}>
                    <span style={{ fontSize: "13px", fontWeight: "bold", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Save as Template Name</span>
                    <input
                      id="save-name"
                      placeholder="e.g. Google React Dev Cover Letter"
                      value={saveName}
                      onChange={(e) => setSaveName(e.target.value)}
                    />
                  </label>
                  <button onClick={handleSaveTemplate} disabled={saving} style={{ marginTop: "20px" }}>
                    {saving && <RefreshCw size={14} className="refresh-spin" />}
                    Save as Email Template
                  </button>
                </div>
                {saveStatus && (
                  <p style={{ marginTop: "8px", fontSize: "14px", fontWeight: "bold", color: saveStatus.includes("successfully") ? "var(--success-text)" : "var(--error-text)" }}>
                    {saveStatus}
                  </p>
                )}
              </div>
            )}
          </section>
        </div>

      </div>
    </Page>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
