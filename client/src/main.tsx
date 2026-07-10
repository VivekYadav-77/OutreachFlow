import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExtension from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import LinkExtension from "@tiptap/extension-link";
import ImageExtension from "@tiptap/extension-image";
import { TextStyle } from "@tiptap/extension-text-style";
import { AlignCenter, AlignLeft, AlignRight, BarChart3, Bold, Check, ExternalLink, Highlighter, Image, Italic, LayoutDashboard, Link, List, ListChecks, ListOrdered, Mail, Monitor, Moon, Redo2, Save, Settings, Sun, Trash2, Underline, Undo2, Upload, X, XCircle, AlertTriangle } from "lucide-react";
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
  const action = async (path: string) => {
    await api(path, { method: "POST" });
    setRefresh((value) => value + 1);
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
          <button onClick={() => action("/api/queue/start")}>Start</button>
          <button onClick={() => action("/api/queue/pause")}>Pause</button>
          <button onClick={() => action("/api/queue/resume")}>Resume</button>
          <button onClick={() => action("/api/queue/stop")}>Stop</button>
          <button onClick={() => action("/api/queue/retry-failed")}>Retry Failed</button>
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
  const attachmentEnabled = Boolean(settings?.attachmentEnabled ?? false);

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
              <p><strong>Attachment Enabled:</strong> {attachmentEnabled ? "Yes" : "No"}</p>
              
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
  React.useEffect(() => {
    if (!form.templateId && defaultTemplate) setForm((current) => ({ ...current, templateId: String(defaultTemplate.id) }));
  }, [defaultTemplate, form.templateId]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await api("/api/recruiters", { method: "POST", body: JSON.stringify({ ...form, templateId: form.templateId ? Number(form.templateId) : undefined }) });
    setForm({ fullName: "", company: "", email: "", designation: "", notes: "", templateId: defaultTemplate ? String(defaultTemplate.id) : "" });
    setRefresh((value) => value + 1);
  };
  const importCsv = async (file?: File) => {
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    await api("/api/recruiters/import", { method: "POST", body });
    setRefresh((value) => value + 1);
  };
  return (
    <Page title="Recruiters" actions={<a className="button secondary" href={`${API_URL}/api/recruiters/export`}>Export CSV</a>}>
      <section className="panel">
        <div className="toolbar">
          <input placeholder="Search" value={search} onChange={(event) => setSearch(event.target.value)} />
          <label className="button secondary">
            Import CSV
            <input hidden type="file" accept=".csv,text/csv" onChange={(event) => importCsv(event.target.files?.[0])} />
          </label>
        </div>
        <form className="form-grid" onSubmit={submit}>
          <input required placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <input required placeholder="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input placeholder="Designation" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
          <select value={form.templateId} onChange={(e) => setForm({ ...form, templateId: e.target.value })}>
            {(templates ?? []).map((template) => (
              <option key={template.id} value={template.id}>{template.name}{template.isDefault ? " (Default)" : ""}</option>
            ))}
          </select>
          <button>Add Recruiter</button>
        </form>
      </section>
      <DataTable
        headers={["Name", "Company", "Email", "Template", "Status"]}
        rows={(data?.rows ?? []).map((row) => [row.fullName, row.company, row.email, templates?.find((template) => template.id === row.templateId)?.name ?? defaultTemplate?.name ?? "Default", row.status])}
      />
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
  const dirty = React.useRef(false);

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
      setBodyVersion((value) => value + 1);
    }
  });

  React.useEffect(() => {
    if (!templateId && templates && templates.length > 0) {
      const selected = templates.find((template) => template.isDefault) ?? templates[0];
      setTemplateId(selected.id);
      setName(selected.name);
      setSubject(selected.subjectTemplate);
      editor?.commands.setContent(selected.htmlTemplate || "");
      setStatus(selected.isDefault ? "Default template" : "Loaded");
      dirty.current = false;
    }
  }, [editor, templateId, templates]);

  const payload = React.useCallback(() => {
    const html = editor?.getHTML() ?? "";
    return { name, subjectTemplate: subject, htmlTemplate: html, textTemplate: emailTextFromHtml(html) };
  }, [editor, name, subject]);

  const loadTemplate = (template: Template) => {
    setTemplateId(template.id);
    setName(template.name);
    setSubject(template.subjectTemplate);
    editor?.commands.setContent(template.htmlTemplate || "");
    setError("");
    setStatus(template.isDefault ? "Default template" : "Loaded");
    dirty.current = false;
  };

  const newTemplate = () => {
    setTemplateId(null);
    setName("");
    setSubject("");
    editor?.commands.clearContent();
    setStatus("New template");
    setError("");
    dirty.current = false;
  };

  const saveTemplate = React.useCallback(async () => {
    if (!editor || saving) return null;
    setSaving(true);
    setError("");
    setStatus("Saving...");
    try {
      const saved = templateId
        ? await api<Template>(`/api/templates/${templateId}`, { method: "PUT", body: JSON.stringify(payload()) })
        : await api<Template>("/api/templates", { method: "POST", body: JSON.stringify(payload()) });
      setTemplateId(saved.id);
      setName(saved.name);
      setSubject(saved.subjectTemplate);
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
  }, [editor, payload, saving, templateId]);

  React.useEffect(() => {
    if (!dirty.current) return;
    const timer = window.setTimeout(() => void saveTemplate(), 1200);
    return () => window.clearTimeout(timer);
  }, [name, subject, bodyVersion, saveTemplate]);

  const setDefault = async () => {
    const id = templateId ?? await saveTemplate();
    if (!id) return;
    await api(`/api/templates/${id}/default`, { method: "POST" });
    setStatus("Default template");
    setRefresh((value) => value + 1);
  };

  const removeTemplate = async () => {
    if (!templateId || !window.confirm("Delete this template?")) return;
    await api(`/api/templates/${templateId}`, { method: "DELETE" });
    newTemplate();
    setRefresh((value) => value + 1);
  };

  const setDefaultFromList = async (id: number, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await api(`/api/templates/${id}/default`, { method: "POST" });
      if (templateId === id) {
        setStatus("Default template");
      }
      setRefresh((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set default template");
    }
  };

  const deleteFromList = async (id: number, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!window.confirm("Delete this template?")) return;
    try {
      await api(`/api/templates/${id}`, { method: "DELETE" });
      if (templateId === id) {
        newTemplate();
      }
      setRefresh((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete template");
    }
  };

  return (
    <Page title="Template Builder" actions={<GoogleAuthStatus />}>
      {error && <p className="error">{error}</p>}
      <div className="compose-layout">
        <section className="composer-shell">
          <input className="template-name-input" placeholder="Template name" value={name} onChange={(event) => { dirty.current = true; setStatus("Unsaved changes"); setName(event.target.value); }} />
          <input className="subject-input" placeholder="Subject" value={subject} onChange={(event) => { dirty.current = true; setStatus("Unsaved changes"); setSubject(event.target.value); }} />
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
          <div className="composer-footer">
            <button onClick={() => void saveTemplate()} disabled={saving}><Save size={16} />{saving ? "Saving..." : "Save Template"}</button>
            <button className="secondary" onClick={newTemplate}>New Template</button>
            <button className="secondary" onClick={setDefault} disabled={saving || (!templateId && !name.trim())}>Set Default</button>
            <button className="secondary icon-only danger" title="Delete template" onClick={removeTemplate} disabled={!templateId}><Trash2 size={16} /></button>
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
                        onClick={(e) => setDefaultFromList(template.id, e)}
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      type="button"
                      className="card-action-btn delete-btn danger"
                      title="Delete Template"
                      onClick={(e) => deleteFromList(template.id, e)}
                    >
                      <Trash2 size={14} />
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

function SettingsPage() {
  const [refresh, setRefresh] = React.useState(0);
  const { data } = useApi<Record<string, unknown>>("/api/settings", refresh);
  const [form, setForm] = React.useState<Record<string, unknown>>({});
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  React.useEffect(() => {
    if (data) {
      setForm({
        dailyLimit: String(data.dailyLimit ?? 50),
        minDelaySeconds: String(data.minDelaySeconds ?? 45),
        maxDelaySeconds: String(data.maxDelaySeconds ?? 150),
        startTime: String(data.startTime ?? "09:00"),
        endTime: String(data.endTime ?? "18:00"),
        retryCount: String(data.retryCount ?? 4),
        attachmentEnabled: Boolean(data.attachmentEnabled)
      });
    }
  }, [data]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await api("/api/settings", { method: "PUT", body: JSON.stringify(form) });
    setRefresh((value) => value + 1);
  };
  const uploadResume = async (file?: File) => {
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    await api("/api/uploads/resume", { method: "POST", body });
  };
  return (
    <Page title="Campaign Settings" actions={<GoogleAuthStatus />}>
      <SafeSendingGuidelinesModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} settings={data} />
      
      <div className="guidelines-banner" onClick={() => setIsModalOpen(true)}>
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

      <section className="panel">
        <form className="stack" onSubmit={submit}>
          <div className="form-grid">
            {["dailyLimit", "minDelaySeconds", "maxDelaySeconds", "startTime", "endTime", "retryCount"].map((key) => (
              <label key={key}>
                {key}
                <input value={String(form[key] ?? "")} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              </label>
            ))}
          </div>
          
          <label className="inline" style={{ marginTop: '16px' }}><input type="checkbox" checked={Boolean(form.attachmentEnabled)} onChange={(e) => setForm({ ...form, attachmentEnabled: e.target.checked })} /> Attach resume</label>
          
          <button style={{ marginTop: '16px' }}>Save Settings</button>
        </form>
      </section>
      <section className="panel">
        <h2>Resume</h2>
        <label className="button secondary">
          <Upload size={16} />
          Upload Resume PDF
          <input hidden type="file" accept="application/pdf" onChange={(event) => uploadResume(event.target.files?.[0])} />
        </label>
      </section>
    </Page>
  );
}

function Logs() {
  const { data } = useApi<Array<{ id: number; level: string; event: string; message: string; createdAt: string }>>("/api/logs");
  return (
    <Page title="Logs">
      <DataTable headers={["Level", "Event", "Message", "Time"]} rows={(data ?? []).map((row) => [row.level, row.event, row.message, new Date(row.createdAt).toLocaleString()])} />
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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
