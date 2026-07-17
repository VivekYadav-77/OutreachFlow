import React from "react";
import {
  AlertTriangle,
  Check,
  Clock,
  Inbox,
  List,
  ListChecks,
  Pause,
  RefreshCw,
  Search,
  Send,
  Trash2,
  XCircle
} from "lucide-react";
import { API_URL, api, useApi } from "../api/client";
import { Page } from "../components/Page";
import { StatCard } from "../components/StatCard";
import { GoogleAuthStatus } from "../components/GoogleAuthStatus";
import { useToast } from "../context/ToastContext";
import { Spinner } from "../components/Spinner";
import { ConfirmModal } from "../components/ConfirmModal";
import type { Stats, QueueItem } from "../types";

type BulkDeleteRecruitersResult = {
  deleted: number;
  skipped: number;
};

const DASHBOARD_AUTO_REFRESH_MS = 5000;

function formatLastUpdated(date: Date | null) {
  if (!date) return "Waiting for update";
  return `Updated ${date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
}

export function Dashboard() {
  const [refresh, setRefresh] = React.useState(0);
  const { data, error, loading } = useApi<Stats>("/api/statistics", refresh);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  const [showDeleteRecruitersConfirm, setShowDeleteRecruitersConfirm] = React.useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = React.useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = React.useState<Date | null>(null);
  const toast = useToast();

  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(10);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, itemsPerPage]);

  React.useEffect(() => {
    if (data) setLastUpdatedAt(new Date());
  }, [data]);

  React.useEffect(() => {
    if (!autoRefreshEnabled) return;

    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") {
        setRefresh((value) => value + 1);
      }
    };

    const intervalId = window.setInterval(refreshIfVisible, DASHBOARD_AUTO_REFRESH_MS);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshIfVisible();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [autoRefreshEnabled]);

  const refreshDashboard = () => {
    setRefresh((value) => value + 1);
  };

  const action = async (path: string) => {
    setActionLoading(path);
    try {
      await api(path, { method: "POST" });
      setRefresh((value) => value + 1);
      toast.success("Action executed successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const deleteDeletableRecruiters = async () => {
    const actionKey = "/api/recruiters/bulk/deletable";
    setActionLoading(actionKey);
    setShowDeleteRecruitersConfirm(false);
    try {
      const result = await api<BulkDeleteRecruitersResult>(actionKey, { method: "DELETE" });
      setRefresh((value) => value + 1);
      if (result.deleted === 0) {
        toast.warning(result.skipped > 0 ? "No recruiters could be deleted while emails are sending." : "No recruiters found to delete.");
      } else {
        toast.success(`Deleted ${result.deleted} recruiter${result.deleted === 1 ? "" : "s"}${result.skipped > 0 ? `, skipped ${result.skipped} currently sending` : ""}.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete recruiters");
    } finally {
      setActionLoading(null);
    }
  };

  const queue = data?.queue ?? {};
  const pendingCount = queue.Pending ?? 0;
  const sendingCount = queue.Sending ?? 0;
  const sentCount = queue.Sent ?? 0;
  const failedCount = queue.Failed ?? 0;
  const retryingCount = queue.Retrying ?? 0;
  const pausedCount = queue.Paused ?? 0;

  const totalQueue = pendingCount + sendingCount + sentCount + failedCount + retryingCount + pausedCount;
  const authStatus = data?.authStatus;

  const filteredQueueItems = React.useMemo(() => {
    const rawItems = data?.queueItems ?? [];
    return rawItems.filter((item: QueueItem) => {
      const matchesSearch =
        searchQuery === "" ||
        (item.recruiterName?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
        (item.recruiterCompany?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
        (item.recruiterEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
        (item.lastError?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

      const matchesStatus =
        statusFilter === "" ||
        item.state.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [data?.queueItems, searchQuery, statusFilter]);

  const paginatedQueueItems = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredQueueItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredQueueItems, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredQueueItems.length / itemsPerPage);

  const getPageNumbers = () => {
    const pages: Array<number | string> = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

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
      title="Dashboard"
      actions={(
        <div className="dashboard-header-actions">
          <div className="dashboard-refresh-control">
            <span className="dashboard-refresh-status">{formatLastUpdated(lastUpdatedAt)}</span>
            <button
              type="button"
              className={`dashboard-auto-toggle ${autoRefreshEnabled ? "active" : ""}`}
              aria-pressed={autoRefreshEnabled}
              onClick={() => setAutoRefreshEnabled((enabled) => !enabled)}
            >
              Auto {autoRefreshEnabled ? "on" : "off"}
            </button>
            <button
              type="button"
              className="secondary dashboard-refresh-button"
              aria-label="Refresh dashboard"
              title="Refresh dashboard"
              disabled={loading}
              onClick={refreshDashboard}
            >
              <RefreshCw size={16} className={loading ? "refresh-spin" : undefined} />
            </button>
          </div>
          <GoogleAuthStatus />
        </div>
      )}
    >
      {error && <p className="error">{error}</p>}
      {authStatus?.status === "AUTH_REQUIRED" && (
        <div className="auth-required-banner">
          <AlertTriangle size={22} />
          <div className="auth-required-content">
            <strong>Google Authorization Required</strong>
            <span>{authStatus.lastAuthFailureReason ?? "Your Google authorization has expired, been revoked, or is no longer valid."}</span>
          </div>
          <a className="button" href={`${API_URL}/api/auth/google`}>Reconnect Google</a>
        </div>
      )}
      <div className="stats-grid">
        <StatCard label="Today's sent" value={data?.todaySent ?? 0} />
        <StatCard label="Pending" value={data?.pending ?? 0} />
        <StatCard label="Failed" value={data?.failed ?? 0} />
        <StatCard label="Worker" value={data?.workerStatus ?? "unknown"} />
      </div>
      <section className="panel">
        <div className="toolbar">
          <button disabled={actionLoading !== null} onClick={() => action("/api/queue/start")}>
            {actionLoading === "/api/queue/start" && <Spinner size={14} />}
            Start
          </button>
          <button disabled={actionLoading !== null} onClick={() => action("/api/queue/pause")}>
            {actionLoading === "/api/queue/pause" && <Spinner size={14} />}
            Pause
          </button>
          <button disabled={actionLoading !== null} onClick={() => action("/api/queue/resume")}>
            {actionLoading === "/api/queue/resume" && <Spinner size={14} />}
            Resume
          </button>
          <button disabled={actionLoading !== null} onClick={() => action("/api/queue/stop")}>
            {actionLoading === "/api/queue/stop" && <Spinner size={14} />}
            Stop
          </button>
          <button disabled={actionLoading !== null} onClick={() => action("/api/queue/retry-failed")}>
            {actionLoading === "/api/queue/retry-failed" && <Spinner size={14} />}
            Retry Failed
          </button>
          <button
            className="danger-button"
            disabled={actionLoading !== null}
            onClick={() => setShowDeleteRecruitersConfirm(true)}
          >
            {actionLoading === "/api/recruiters/bulk/deletable" ? <Spinner size={14} /> : <Trash2 size={14} />}
            Delete all recruiter
          </button>
        </div>
      </section>
      <section className="panel">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ListChecks size={18} />
          Queue Status Overview
        </h2>
        {totalQueue > 0 ? (
          <div className="queue-container">
            <div className="queue-progress-bar-container">
              {sentCount > 0 && (
                <div
                  className="queue-progress-segment sent"
                  style={{ width: `${(sentCount / totalQueue) * 100}%` }}
                  title={`Sent: ${sentCount}`}
                />
              )}
              {sendingCount > 0 && (
                <div
                  className="queue-progress-segment sending"
                  style={{ width: `${(sendingCount / totalQueue) * 100}%` }}
                  title={`Sending: ${sendingCount}`}
                />
              )}
              {retryingCount > 0 && (
                <div
                  className="queue-progress-segment retrying"
                  style={{ width: `${(retryingCount / totalQueue) * 100}%` }}
                  title={`Retrying: ${retryingCount}`}
                />
              )}
              {failedCount > 0 && (
                <div
                  className="queue-progress-segment failed"
                  style={{ width: `${(failedCount / totalQueue) * 100}%` }}
                  title={`Failed: ${failedCount}`}
                />
              )}
              {pausedCount > 0 && (
                <div
                  className="queue-progress-segment paused"
                  style={{ width: `${(pausedCount / totalQueue) * 100}%` }}
                  title={`Paused: ${pausedCount}`}
                />
              )}
              {pendingCount > 0 && (
                <div
                  className="queue-progress-segment pending"
                  style={{ width: `${(pendingCount / totalQueue) * 100}%` }}
                  title={`Pending: ${pendingCount}`}
                />
              )}
            </div>
            <div className="queue-cards-grid">
              <div className="queue-card pending">
                <div className="queue-card-icon"><Clock size={16} /></div>
                <div className="queue-card-info">
                  <span className="queue-card-label">Pending</span>
                  <strong className="queue-card-value">{pendingCount}</strong>
                </div>
              </div>
              <div className="queue-card sending">
                <div className="queue-card-icon"><Send size={16} /></div>
                <div className="queue-card-info">
                  <span className="queue-card-label">Sending</span>
                  <strong className="queue-card-value">{sendingCount}</strong>
                </div>
              </div>
              <div className="queue-card retrying">
                <div className="queue-card-icon"><RefreshCw size={16} /></div>
                <div className="queue-card-info">
                  <span className="queue-card-label">Retrying</span>
                  <strong className="queue-card-value">{retryingCount}</strong>
                </div>
              </div>
              <div className="queue-card sent">
                <div className="queue-card-icon"><Check size={16} /></div>
                <div className="queue-card-info">
                  <span className="queue-card-label">Sent</span>
                  <strong className="queue-card-value">{sentCount}</strong>
                </div>
              </div>
              <div className="queue-card failed">
                <div className="queue-card-icon"><XCircle size={16} /></div>
                <div className="queue-card-info">
                  <span className="queue-card-label">Failed</span>
                  <strong className="queue-card-value">{failedCount}</strong>
                </div>
              </div>
              <div className="queue-card paused">
                <div className="queue-card-icon"><Pause size={16} /></div>
                <div className="queue-card-info">
                  <span className="queue-card-label">Paused</span>
                  <strong className="queue-card-value">{pausedCount}</strong>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="queue-empty-state">
            <Inbox size={40} className="queue-empty-icon" />
            <div className="queue-empty-title">Queue is empty</div>
            <div className="queue-empty-subtitle">
              Configure templates, add recruiters, and start the queue to send out outreach emails.
            </div>
          </div>
        )}
      </section>

      {totalQueue > 0 && data?.queueItems && data.queueItems.length > 0 && (
        <section className="panel" style={{ marginTop: '18px', overflow: 'visible' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <List size={18} />
              Active Queue Jobs
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
              <div style={{ position: 'relative', minWidth: '240px' }}>
                <input
                  placeholder="Search recruiter, company or error..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '32px', minHeight: '36px', height: '36px', padding: '6px 12px 6px 32px' }}
                />
                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                  <Search size={14} />
                </span>
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ width: '130px', minHeight: '36px', height: '36px', padding: '6px 10px' }}
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="sending">Sending</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
                <option value="retrying">Retrying</option>
                <option value="paused">Paused</option>
              </select>
              {(searchQuery !== "" || statusFilter !== "") && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => { setSearchQuery(""); setStatusFilter(""); }}
                  style={{ minHeight: '36px', height: '36px', padding: '0 12px' }}
                >
                  Clear Filters
                </button>
              )}
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                style={{ width: '120px', minHeight: '36px', height: '36px', padding: '6px 10px' }}
              >
                <option value="10">10 / page</option>
                <option value="25">25 / page</option>
                <option value="50">50 / page</option>
                <option value="100">100 / page</option>
              </select>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Recruiter</th>
                <th>Company</th>
                <th>Email</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Last Update</th>
              </tr>
            </thead>
            <tbody>
              {paginatedQueueItems.map((item: QueueItem) => (
                <tr key={item.id}>
                  <td><strong>{item.recruiterName ?? "Unknown"}</strong></td>
                  <td>{item.recruiterCompany ?? "—"}</td>
                  <td>{item.recruiterEmail ?? "—"}</td>
                  <td>
                    <span className={`status-${item.state.toLowerCase()}`}>
                      {item.state === "Sending" && <RefreshCw size={12} className="refresh-spin" style={{ marginRight: '4px' }} />}
                      {item.state}
                    </span>
                    {item.lastError && (
                      <div
                        style={{
                          fontSize: '11px',
                          color: 'var(--error-text)',
                          marginTop: '4px',
                          maxWidth: '220px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                        title={item.lastError}
                      >
                        {item.lastError}
                      </div>
                    )}
                  </td>
                  <td>{item.attempts} / 4</td>
                  <td>
                    {new Date(item.updatedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                </tr>
              ))}
              {paginatedQueueItems.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                    No matching queue jobs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="pagination-container" style={{ marginTop: '16px' }}>
              <div className="pagination-info">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredQueueItems.length)} of {filteredQueueItems.length} entries
              </div>
              <div className="pagination-buttons">
                <button
                  className="pagination-btn inactive"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  style={{ minHeight: '32px', height: '32px', padding: '0 10px', fontSize: '12px' }}
                >
                  Previous
                </button>
                {getPageNumbers().map((p, idx) => {
                  if (p === "...") {
                    return (
                      <span key={`ellipsis-${idx}`} style={{ padding: '0 6px', color: 'var(--text-muted)' }}>
                        ...
                      </span>
                    );
                  }
                  const pageNum = p as number;
                  return (
                    <button
                      key={`page-${pageNum}`}
                      className={`pagination-btn ${currentPage === pageNum ? 'active' : 'inactive'}`}
                      onClick={() => setCurrentPage(pageNum)}
                      style={{ minHeight: '32px', height: '32px', padding: '0 10px', fontSize: '12px' }}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  className="pagination-btn inactive"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  style={{ minHeight: '32px', height: '32px', padding: '0 10px', fontSize: '12px' }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      )}
      <ConfirmModal
        isOpen={showDeleteRecruitersConfirm}
        title="Delete all recruiter"
        message="Delete every recruiter that is currently allowed to be deleted? Recruiters with actively sending emails will be skipped. This action cannot be undone."
        onConfirm={deleteDeletableRecruiters}
        onCancel={() => setShowDeleteRecruitersConfirm(false)}
        confirmText="Delete all recruiter"
        isDestructive={true}
      />
    </Page>
  );
}
