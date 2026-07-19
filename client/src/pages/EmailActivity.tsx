import React from "react";
import { AlertTriangle, Download, ExternalLink, Inbox, MailCheck, RefreshCw, Reply, Search, X } from "lucide-react";
import { API_URL, api, useApi } from "../api/client";
import { Page } from "../components/Page";
import { Spinner } from "../components/Spinner";
import { StatCard } from "../components/StatCard";
import { useToast } from "../context/ToastContext";
import type { AuthStatus, EmailActivityItem, EmailActivityList, EmailActivitySummary, MonitorSummary, SentImportSummary } from "../types";

type ActivityFilter = "all" | "replies" | "bounces" | "imports";
type ActivityAction = "replies" | "bounces" | "import";
type ExportMode = "all" | "withoutBounces";
type ActionResult =
  | { kind: "replies"; title: string; summary: MonitorSummary }
  | { kind: "bounces"; title: string; summary: MonitorSummary }
  | { kind: "import"; title: string; summary: SentImportSummary };

const FILTERS: Array<{ value: ActivityFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "replies", label: "Replies" },
  { value: "bounces", label: "Bounces" },
  { value: "imports", label: "Imports" }
];

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatEventType(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function metadataPreview(value: Record<string, unknown>) {
  const entries = Object.entries(value ?? {}).filter(([, item]) => item !== null && item !== undefined && item !== "");
  if (entries.length === 0) return "-";
  return entries
    .slice(0, 3)
    .map(([key, item]) => `${key}: ${String(item)}`)
    .join(" | ");
}

function ResultModal({ result, onClose, onFilter }: { result: ActionResult; onClose: () => void; onFilter: (filter: ActivityFilter) => void }) {
  const cards =
    result.kind === "import"
      ? [
          ["Processed", result.summary.processed],
          ["Imported", result.summary.imported],
          ["Updated", result.summary.updated],
          ["Duplicates", result.summary.duplicates],
          ["Skipped", result.summary.skipped],
          ["Errors", result.summary.errors]
        ]
      : [
          ["Processed", result.summary.processed ?? result.summary.checked ?? 0],
          ["Detected", result.summary.detected],
          ["Duplicates", result.summary.duplicates],
          ["Skipped", result.summary.skipped],
          ["Permanent", result.summary.permanent ?? 0],
          ["Temporary", result.summary.temporary ?? 0]
        ];

  const targetFilter: ActivityFilter = result.kind === "import" ? "imports" : result.kind;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content activity-result-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>{result.title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close result dialog">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body activity-result-body">
          <div className="activity-result-grid">
            {cards.map(([label, value]) => (
              <div className="activity-result-stat" key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <div className="activity-result-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => {
                onFilter(targetFilter);
                onClose();
              }}
            >
              View matching activity
            </button>
            <button type="button" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExportDialog({
  exportMode,
  exporting,
  filterSummary,
  onClose,
  onDownload,
  onExportModeChange
}: {
  exportMode: ExportMode;
  exporting: boolean;
  filterSummary: string[];
  onClose: () => void;
  onDownload: () => void;
  onExportModeChange: (mode: ExportMode) => void;
}) {
  return (
    <div className="modal-overlay" onClick={() => !exporting && onClose()}>
      <div className="modal-content activity-export-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>Download Email Activity</h2>
          <button className="modal-close" onClick={onClose} disabled={exporting} aria-label="Close export dialog">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body activity-export-body">
          <label className="activity-export-mode">
            <span>Export mode</span>
            <select value={exportMode} onChange={(event) => onExportModeChange(event.target.value as ExportMode)} disabled={exporting}>
              <option value="all">All email activity</option>
              <option value="withoutBounces">Exclude bounced recipients</option>
            </select>
          </label>

          <div className="activity-export-summary">
            <span>Current filters</span>
            <div>
              {filterSummary.map((item) => (
                <strong key={item}>{item}</strong>
              ))}
            </div>
          </div>

          <div className="activity-result-actions">
            <button type="button" className="secondary" onClick={onClose} disabled={exporting}>
              Cancel
            </button>
            <button type="button" onClick={onDownload} disabled={exporting}>
              {exporting ? <Spinner size={14} /> : <Download size={16} />}
              Download Excel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EmailActivity() {
  const [refresh, setRefresh] = React.useState(0);
  const [filter, setFilter] = React.useState<ActivityFilter>("all");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const [fromTime, setFromTime] = React.useState("");
  const [toTime, setToTime] = React.useState("");
  const [exportMode, setExportMode] = React.useState<ExportMode>("all");
  const [exportDialogOpen, setExportDialogOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [runningAction, setRunningAction] = React.useState<ActivityAction | null>(null);
  const [result, setResult] = React.useState<ActionResult | null>(null);
  const toast = useToast();

  const query = React.useMemo(() => {
    const params = new URLSearchParams();
    params.set("type", filter);
    params.set("page", String(page));
    params.set("pageSize", "25");
    if (search) params.set("search", search);
    if (fromDate) params.set("fromDate", fromDate);
    if (toDate) params.set("toDate", toDate);
    if (fromTime) params.set("fromTime", fromTime);
    if (toTime) params.set("toTime", toTime);
    return params.toString();
  }, [filter, page, search, fromDate, toDate, fromTime, toTime]);

  const { data: summary } = useApi<EmailActivitySummary>("/api/email-activity/summary", refresh);
  const { data: activity, loading: activityLoading } = useApi<EmailActivityList>(`/api/email-activity?${query}`, refresh);
  const { data: authStatus } = useApi<AuthStatus>("/api/auth/status", refresh);
  const gmailReadReady = authStatus?.connected && authStatus.readScopeGranted !== false;
  const totalPages = Math.max(1, Math.ceil((activity?.total ?? 0) / (activity?.pageSize ?? 25)));
  const filterSummary = React.useMemo(() => {
    const selectedFilter = FILTERS.find((item) => item.value === filter)?.label ?? "All";
    const summary = [`Type: ${selectedFilter}`];
    if (search) summary.push(`Search: ${search}`);
    if (fromDate) summary.push(`From: ${fromDate}${fromTime ? ` ${fromTime}` : ""}`);
    if (toDate) summary.push(`To: ${toDate}${toTime ? ` ${toTime}` : ""}`);
    return summary;
  }, [filter, search, fromDate, fromTime, toDate, toTime]);

  React.useEffect(() => {
    setPage(1);
  }, [filter, search, fromDate, toDate, fromTime, toTime]);

  const runAction = async (action: ActivityAction) => {
    setRunningAction(action);
    try {
      if (action === "replies") {
        const response = await api<MonitorSummary>("/api/email-monitor/check-replies", { method: "POST" });
        setResult({ kind: "replies", title: "Reply Check Complete", summary: response });
      }
      if (action === "bounces") {
        const response = await api<MonitorSummary>("/api/email-monitor/check-bounces", { method: "POST" });
        setResult({ kind: "bounces", title: "Bounce Check Complete", summary: response });
      }
      if (action === "import") {
        const response = await api<SentImportSummary>("/api/email-import/sent", {
          method: "POST",
          body: JSON.stringify({ maxMessages: 250 })
        });
        setResult({ kind: "import", title: "Sent Email Import Complete", summary: response });
      }
      setRefresh((value) => value + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Email activity action failed");
    } finally {
      setRunningAction(null);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setFromDate("");
    setToDate("");
    setFromTime("");
    setToTime("");
    setPage(1);
  };

  const buildExportUrl = (mode: ExportMode) => {
    const params = new URLSearchParams();
    params.set("type", filter);
    params.set("exportMode", mode);
    if (search) params.set("search", search);
    if (fromDate) params.set("fromDate", fromDate);
    if (toDate) params.set("toDate", toDate);
    if (fromTime) params.set("fromTime", fromTime);
    if (toTime) params.set("toTime", toTime);
    return `${API_URL}/api/email-activity/export?${params.toString()}`;
  };

  const downloadExcel = async () => {
    setExporting(true);
    try {
      const response = await fetch(buildExportUrl(exportMode));
      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error?.message ?? "Failed to download Excel file");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition");
      const filename = disposition?.match(/filename="([^"]+)"/)?.[1] ?? `email-activity-${exportMode}.xlsx`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Excel download prepared.");
      setExportDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download Excel file");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Page
      title="Email Activity"
      actions={(
        <button type="button" className="secondary" onClick={() => setRefresh((value) => value + 1)}>
          <RefreshCw size={16} />
          Refresh
        </button>
      )}
    >
      {authStatus?.connected && authStatus.readScopeGranted === false && (
        <div className="auth-required-banner">
          <AlertTriangle size={22} />
          <div className="auth-required-content">
            <strong>Gmail read access is required</strong>
            <span>Reconnect Google once to allow reply checks, bounce checks, and sent email imports.</span>
          </div>
          <a className="button" href={`${API_URL}/api/auth/google`}>Reconnect Google</a>
        </div>
      )}

      <div className="stats-grid activity-summary-grid">
        <StatCard label="Replies" value={summary?.replies ?? 0} icon={<Reply size={20} />} />
        <StatCard label="Bounces" value={summary?.bounces ?? 0} icon={<MailCheck size={20} />} />
        <StatCard label="Invalid Addresses" value={summary?.invalidAddresses ?? 0} icon={<AlertTriangle size={20} />} />
        <StatCard label="Imported Emails" value={summary?.importedEmails ?? 0} icon={<Inbox size={20} />} />
      </div>

      <section className="panel activity-action-panel">
        <div className="activity-action-copy">
          <h2>Gmail Monitoring</h2>
          <p>Run manual Gmail checks from one place. Results are saved below so they do not disappear after a toast.</p>
        </div>
        <div className="activity-action-grid">
          <button type="button" disabled={!gmailReadReady || runningAction !== null} onClick={() => runAction("replies")}>
            {runningAction === "replies" ? <Spinner size={14} /> : <Reply size={16} />}
            Check Replies
          </button>
          <button type="button" className="secondary" disabled={!gmailReadReady || runningAction !== null} onClick={() => runAction("bounces")}>
            {runningAction === "bounces" ? <Spinner size={14} /> : <MailCheck size={16} />}
            Check Bounces
          </button>
          <button type="button" className="secondary" disabled={!gmailReadReady || runningAction !== null} onClick={() => runAction("import")}>
            {runningAction === "import" ? <Spinner size={14} /> : <Inbox size={16} />}
            Import Sent Emails
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="activity-table-header">
          <div className="activity-tabs" role="tablist" aria-label="Activity filters">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={filter === item.value ? "button-selected" : "secondary"}
                aria-pressed={filter === item.value}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="activity-search">
            <Search size={14} />
            <input placeholder="Search recruiter or event..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
        </div>

        <div className="activity-filter-bar">
          <label>
            <span>From date</span>
            <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </label>
          <label>
            <span>From time</span>
            <input type="time" value={fromTime} onChange={(event) => setFromTime(event.target.value)} disabled={!fromDate} />
          </label>
          <label>
            <span>To date</span>
            <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </label>
          <label>
            <span>To time</span>
            <input type="time" value={toTime} onChange={(event) => setToTime(event.target.value)} disabled={!toDate} />
          </label>
          <div className="activity-filter-actions">
            <button type="button" className="secondary" onClick={clearFilters}>
              Clear filters
            </button>
            <button type="button" onClick={() => setExportDialogOpen(true)} disabled={exporting}>
              <Download size={16} />
              Download Excel
            </button>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>Recruiter</th>
              <th>Email</th>
              <th>Details</th>
              <th>Thread</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {(activity?.rows ?? []).map((row: EmailActivityItem) => (
              <tr key={row.id}>
                <td><span className={`status-${row.eventType.toLowerCase()}`}>{formatEventType(row.eventType)}</span></td>
                <td>
                  <strong>{row.recruiterName ?? "Unknown"}</strong>
                  {row.recruiterCompany && <div className="activity-subtext">{row.recruiterCompany}</div>}
                </td>
                <td>{row.recruiterEmail ?? "-"}</td>
                <td><span className="activity-metadata" title={metadataPreview(row.metadata)}>{metadataPreview(row.metadata)}</span></td>
                <td>
                  {row.gmailThreadLink ? (
                    <a href={row.gmailThreadLink} target="_blank" rel="noreferrer" className="action-btn" title="Open Gmail thread">
                      <ExternalLink size={14} />
                    </a>
                  ) : "-"}
                </td>
                <td>{formatDateTime(row.createdAt)}</td>
              </tr>
            ))}
            {!activityLoading && (!activity?.rows || activity.rows.length === 0) && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px" }}>
                  No email activity found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="pagination-container">
            <div className="pagination-info">Showing page {page} of {totalPages}</div>
            <div className="pagination-buttons">
              <button type="button" className="pagination-btn inactive" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                Previous
              </button>
              <button type="button" className="pagination-btn inactive" disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {result && <ResultModal result={result} onClose={() => setResult(null)} onFilter={setFilter} />}
      {exportDialogOpen && (
        <ExportDialog
          exportMode={exportMode}
          exporting={exporting}
          filterSummary={filterSummary}
          onClose={() => setExportDialogOpen(false)}
          onDownload={downloadExcel}
          onExportModeChange={setExportMode}
        />
      )}
    </Page>
  );
}
