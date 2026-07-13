import React from "react";
import { ChevronDown, ChevronUp, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { useApi } from "../api/client";
import { Page } from "../components/Page";

export function Logs() {
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
