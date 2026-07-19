import React from "react";
import { NavLink } from "react-router-dom";
import { AlertTriangle, Pencil, Trash2, X } from "lucide-react";
import { api, useApi, API_URL } from "../api/client";
import { Page } from "../components/Page";
import { useToast } from "../context/ToastContext";
import { ConfirmModal } from "../components/ConfirmModal";
import { Spinner } from "../components/Spinner";
import type { Recruiter, Template, ImportResult } from "../types";

type BulkDeleteRecruitersResult = {
  deleted: number;
  skipped: number;
  notFound: number;
};

type BulkAssignTemplateResult = {
  updated: number;
  skipped: number;
  notFound: number;
};

export function Recruiters() {
  const [refresh, setRefresh] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const recruiterQuery = React.useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    return params.toString();
  }, [page, pageSize, search, statusFilter]);
  const { data } = useApi<{ rows: Recruiter[]; total: number; page: number; pageSize: number }>(`/api/recruiters?${recruiterQuery}`, refresh);
  const { data: templates } = useApi<Template[]>("/api/templates", refresh);
  const defaultTemplate = templates?.find((template) => template.isDefault) ?? templates?.[0];
  const [form, setForm] = React.useState({ fullName: "", company: "", email: "", designation: "", notes: "", templateId: "" });
  const toast = useToast();
  const [recruiterToDelete, setRecruiterToDelete] = React.useState<Recruiter | null>(null);

  // State for Loading and Editing
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [importResult, setImportResult] = React.useState<ImportResult | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [deletingId, setDeletingId] = React.useState<number | null>(null);
  const [editingRecruiter, setEditingRecruiter] = React.useState<Recruiter | null>(null);
  const [editForm, setEditForm] = React.useState({ fullName: "", company: "", email: "", designation: "", templateId: "" });
  const [editError, setEditError] = React.useState("");
  const [editSubmitting, setEditSubmitting] = React.useState(false);
  const [selectedRecruiterIds, setSelectedRecruiterIds] = React.useState<Set<number>>(new Set());
  const [bulkTemplateId, setBulkTemplateId] = React.useState("");
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = React.useState(false);
  const [bulkDeleting, setBulkDeleting] = React.useState(false);
  const [bulkAssigning, setBulkAssigning] = React.useState(false);
  const selectAllRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (form.templateId && templates && !templates.some((t) => String(t.id) === form.templateId)) {
      setForm((current) => ({ ...current, templateId: "" }));
    }
  }, [templates, form.templateId]);

  React.useEffect(() => {
    if (!form.templateId && defaultTemplate) setForm((current) => ({ ...current, templateId: String(defaultTemplate.id) }));
  }, [defaultTemplate, form.templateId]);

  React.useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  React.useEffect(() => {
    setSelectedRecruiterIds(new Set());
  }, [search, page, pageSize, data?.rows]);

  React.useEffect(() => {
    if (bulkTemplateId && templates && !templates.some((template) => String(template.id) === bulkTemplateId)) {
      setBulkTemplateId("");
    }
  }, [templates, bulkTemplateId]);

  React.useEffect(() => {
    const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));
    if (page > totalPages) setPage(totalPages);
  }, [data?.total, page, pageSize]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.templateId) {
      toast.warning("Please select a template first.");
      return;
    }
    setIsSubmitting(true);
    try {
      await api("/api/recruiters", { method: "POST", body: JSON.stringify({ ...form, templateId: Number(form.templateId) }) });
      setForm({ fullName: "", company: "", email: "", designation: "", notes: "", templateId: defaultTemplate ? String(defaultTemplate.id) : "" });
      setPage(1);
      setRefresh((value) => value + 1);
      toast.success("Recruiter added successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add recruiter");
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
      toast.success("Recruiter updated successfully");
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update recruiter");
    } finally {
      setEditSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!recruiterToDelete) return;
    const id = recruiterToDelete.id;
    setDeletingId(id);
    setRecruiterToDelete(null);
    try {
      await api(`/api/recruiters/${id}`, { method: "DELETE" });
      setRefresh((value) => value + 1);
      toast.success("Recruiter deleted successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete recruiter");
    } finally {
      setDeletingId(null);
    }
  };

  const selectedCount = selectedRecruiterIds.size;
  const visibleRecruiterIds = React.useMemo(() => (data?.rows ?? []).map((row) => row.id), [data?.rows]);
  const selectedVisibleCount = visibleRecruiterIds.filter((id) => selectedRecruiterIds.has(id)).length;
  const allVisibleSelected = visibleRecruiterIds.length > 0 && selectedVisibleCount === visibleRecruiterIds.length;
  const hasPartialVisibleSelection = selectedVisibleCount > 0 && selectedVisibleCount < visibleRecruiterIds.length;
  const bulkActionDisabled = isImporting || bulkDeleting || bulkAssigning || deletingId !== null || editSubmitting;

  React.useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = hasPartialVisibleSelection;
    }
  }, [hasPartialVisibleSelection]);

  const toggleRecruiterSelection = (id: number) => {
    setSelectedRecruiterIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleVisibleSelection = () => {
    setSelectedRecruiterIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        visibleRecruiterIds.forEach((id) => next.delete(id));
      } else {
        visibleRecruiterIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedRecruiterIds(new Set());

  const bulkDeleteSelectedRecruiters = async () => {
    const ids = Array.from(selectedRecruiterIds);
    if (ids.length === 0) return;
    setBulkDeleting(true);
    setShowBulkDeleteConfirm(false);
    try {
      const result = await api<BulkDeleteRecruitersResult>("/api/recruiters/bulk/selected", {
        method: "DELETE",
        body: JSON.stringify({ ids })
      });
      clearSelection();
      setRefresh((value) => value + 1);
      if (result.deleted === 0) {
        toast.warning(`No selected recruiters were deleted${result.skipped > 0 ? `; ${result.skipped} currently sending` : ""}${result.notFound > 0 ? `; ${result.notFound} not found` : ""}.`);
      } else {
        toast.success(`Deleted ${result.deleted} recruiter${result.deleted === 1 ? "" : "s"}${result.skipped > 0 ? `, skipped ${result.skipped} currently sending` : ""}${result.notFound > 0 ? `, ${result.notFound} not found` : ""}.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete selected recruiters");
    } finally {
      setBulkDeleting(false);
    }
  };

  const bulkAssignTemplate = async () => {
    const ids = Array.from(selectedRecruiterIds);
    if (ids.length === 0) return;
    if (!bulkTemplateId) {
      toast.warning("Please select a template to assign.");
      return;
    }
    setBulkAssigning(true);
    try {
      const result = await api<BulkAssignTemplateResult>("/api/recruiters/bulk/template", {
        method: "PUT",
        body: JSON.stringify({ ids, templateId: Number(bulkTemplateId) })
      });
      clearSelection();
      setRefresh((value) => value + 1);
      if (result.updated === 0) {
        toast.warning(`No selected recruiters were updated${result.skipped > 0 ? `; ${result.skipped} currently sending` : ""}${result.notFound > 0 ? `; ${result.notFound} not found` : ""}.`);
      } else {
        toast.success(`Assigned template to ${result.updated} recruiter${result.updated === 1 ? "" : "s"}${result.skipped > 0 ? `, skipped ${result.skipped} currently sending` : ""}${result.notFound > 0 ? `, ${result.notFound} not found` : ""}.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign template");
    } finally {
      setBulkAssigning(false);
    }
  };

  const importRecruiterFile = async (file?: File) => {
    if (!file) return;
    setIsImporting(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const result = await api<ImportResult>("/api/recruiters/import", { method: "POST", body });
      setImportResult(result);
      setPage(1);
      setRefresh((value) => value + 1);
    } catch (err) {
      // Server-thrown errors (e.g. wrong column names) surface here as a clear message
      toast.error(err instanceof Error ? err.message : "Failed to import file");
    } finally {
      setIsImporting(false);
      // Reset file input so the same file can be re-selected after fixing it
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const hasTemplates = templates && templates.length > 0;
  const totalRecruiters = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRecruiters / pageSize));
  const firstVisible = totalRecruiters === 0 ? 0 : ((page - 1) * pageSize) + 1;
  const lastVisible = Math.min(page * pageSize, totalRecruiters);
  const getPageNumbers = () => {
    const pages: Array<number | string> = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }
    pages.push(1);
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    if (start > 2) pages.push("...");
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  return (
    <Page title="Recruiters" actions={<a className={`button secondary ${isImporting ? "disabled" : ""}`} href={`${API_URL}/api/recruiters/export`}>Export CSV</a>}>
      <section className="panel">
        <div className="toolbar">
          <input placeholder="Search" value={search} onChange={(event) => setSearch(event.target.value)} disabled={isImporting} />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            disabled={isImporting}
            style={{ maxWidth: "190px" }}
          >
            <option value="">All statuses</option>
            <option value="Pending">Pending</option>
            <option value="NEW">New</option>
            <option value="QUEUED">Queued</option>
            <option value="SENDING">Sending</option>
            <option value="Sent">Sent</option>
            <option value="ACCEPTED_BY_GMAIL">Accepted by Gmail</option>
            <option value="Replied">Replied</option>
            <option value="REPLIED">Reply received</option>
            <option value="TEMPORARY_FAILURE">Temporary failure</option>
            <option value="Failed">Failed</option>
            <option value="INVALID_ADDRESS">Invalid address</option>
            <option value="Skipped">Skipped</option>
            <option value="SKIPPED">Skipped lifecycle</option>
            <option value="COMPLETED">Completed</option>
          </select>
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
            disabled={isImporting}
            style={{ maxWidth: "140px" }}
          >
            <option value="25">25 per page</option>
            <option value="50">50 per page</option>
            <option value="100">100 per page</option>
            <option value="200">200 per page</option>
          </select>
          <label className={`button secondary ${isImporting ? "disabled" : ""}`}>
            {isImporting ? (
              <>
                <Spinner size={14} />
                Importing file...
              </>
            ) : (
              "Import CSV / Excel"
            )}
            <input ref={fileInputRef} hidden type="file" accept=".csv,text/csv,.xlsx,.xls" disabled={isImporting} onChange={(event) => importRecruiterFile(event.target.files?.[0])} />
          </label>
        </div>
        <div className="csv-format-hint">
          <span>CSV or Excel headers:</span>
          <code>Name</code><code>Title</code><code>Company</code><code>Email</code>
          <span className="csv-hint-sep">·  Also accepts:</span>
          <code>fullName</code><code>designation</code><code>linkedin</code><code>notes</code>
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
              {isSubmitting && <Spinner size={14} />}
              Add Recruiter
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        {selectedCount > 0 && (
          <div className="bulk-actions-bar">
            <div className="bulk-selection-summary">
              <strong>{selectedCount}</strong> selected
            </div>
            <select
              value={bulkTemplateId}
              onChange={(event) => setBulkTemplateId(event.target.value)}
              disabled={!hasTemplates || bulkActionDisabled}
              aria-label="Template for selected recruiters"
            >
              <option value="">Assign template...</option>
              {(templates ?? []).map((template) => (
                <option key={template.id} value={template.id}>{template.name}{template.isDefault ? " (Default)" : ""}</option>
              ))}
            </select>
            <button type="button" className="secondary" disabled={!hasTemplates || !bulkTemplateId || bulkActionDisabled} onClick={bulkAssignTemplate}>
              {bulkAssigning && <Spinner size={14} />}
              Apply Template
            </button>
            <button type="button" className="danger-button" disabled={bulkActionDisabled} onClick={() => setShowBulkDeleteConfirm(true)}>
              {bulkDeleting ? <Spinner size={14} /> : <Trash2 size={14} />}
              Delete selected
            </button>
            <button type="button" className="secondary" disabled={bulkActionDisabled} onClick={clearSelection}>
              Clear
            </button>
          </div>
        )}
        <table>
          <thead>
            <tr>
              <th className="selection-cell">
                <input
                  ref={selectAllRef}
                  className="selection-checkbox"
                  type="checkbox"
                  aria-label="Select all visible recruiters"
                  checked={allVisibleSelected}
                  disabled={visibleRecruiterIds.length === 0 || bulkActionDisabled}
                  onChange={toggleVisibleSelection}
                />
              </th>
              <th style={{ width: "72px" }}>S.No</th>
              <th>Name</th>
              <th>Company</th>
              <th>Email</th>
              <th>Template</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data?.rows ?? []).map((row, index) => (
              <tr key={row.id}>
                <td className="selection-cell">
                  <input
                    className="selection-checkbox"
                    type="checkbox"
                    aria-label={`Select ${row.fullName}`}
                    checked={selectedRecruiterIds.has(row.id)}
                    disabled={bulkActionDisabled}
                    onChange={() => toggleRecruiterSelection(row.id)}
                  />
                </td>
                <td>{firstVisible + index}</td>
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
                      disabled={deletingId !== null || bulkDeleting || bulkAssigning}
                      onClick={() => startEdit(row)}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      className="action-btn danger"
                      title="Delete Recruiter"
                      disabled={deletingId !== null || bulkDeleting || bulkAssigning}
                      onClick={() => setRecruiterToDelete(row)}
                    >
                      {deletingId === row.id ? <Spinner size={14} /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {(!data?.rows || data.rows.length === 0) && (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px" }}>
                  No recruiters found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {totalRecruiters > 0 && (
        <div className="pagination-container">
          <div className="pagination-info">
            Showing {firstVisible} to {lastVisible} of {totalRecruiters} recruiters
          </div>
          <div className="pagination-buttons">
            <button
              type="button"
              className="pagination-btn inactive"
              disabled={page === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>
            {getPageNumbers().map((value, index) => {
              if (value === "...") {
                return <span key={`page-gap-${index}`} style={{ padding: "0 8px", color: "var(--text-muted)" }}>...</span>;
              }
              const pageNumber = value as number;
              return (
                <button
                  key={`page-${pageNumber}`}
                  type="button"
                  className={`pagination-btn ${page === pageNumber ? "active" : "inactive"}`}
                  onClick={() => setPage(pageNumber)}
                >
                  {pageNumber}
                </button>
              );
            })}
            <button
              type="button"
              className="pagination-btn inactive"
              disabled={page === totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}

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
                    {editSubmitting && <Spinner size={14} />}
                    Save Changes
                  </button>
                  <button type="button" className="secondary" disabled={editSubmitting} onClick={() => setEditingRecruiter(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Import Result Modal */}
      {importResult && (
        <div className="modal-overlay" onClick={() => setImportResult(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h2>Import Complete</h2>
              <button className="modal-close" onClick={() => setImportResult(null)}><X size={24} /></button>
            </div>
            <div className="modal-body">
              <div className="import-result-grid">
                <div className="import-result-stat success">
                  <span className="import-stat-value">{importResult.imported}</span>
                  <span className="import-stat-label">Imported</span>
                </div>
                <div className="import-result-stat duplicate">
                  <span className="import-stat-value">{importResult.duplicates}</span>
                  <span className="import-stat-label">Duplicates</span>
                </div>
                <div className="import-result-stat skipped">
                  <span className="import-stat-value">{importResult.skipped}</span>
                  <span className="import-stat-label">Skipped</span>
                </div>
                <div className="import-result-stat invalid">
                  <span className="import-stat-value">{importResult.invalid}</span>
                  <span className="import-stat-label">Invalid</span>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-muted)' }}>
                    Row-level issues (first {importResult.errors.length} shown):
                  </p>
                  <div className="import-errors-table-wrap">
                    <table className="import-errors-table">
                      <thead>
                        <tr>
                          <th>Row</th>
                          <th>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResult.errors.map((err, idx) => (
                          <tr key={idx}>
                            <td>#{err.row}</td>
                            <td>{err.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {importResult.imported === 0 && importResult.errors.length === 0 && (
                <p style={{ marginTop: '16px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No recruiters were imported. The file may have been empty or all rows were duplicates.
                </p>
              )}
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setImportResult(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!recruiterToDelete}
        title="Delete Recruiter"
        message={`Are you sure you want to delete ${recruiterToDelete?.fullName}? This action cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setRecruiterToDelete(null)}
        confirmText="Delete"
        isDestructive={true}
      />
      <ConfirmModal
        isOpen={showBulkDeleteConfirm}
        title="Delete selected recruiters"
        message={`Are you sure you want to delete ${selectedCount} selected recruiter${selectedCount === 1 ? "" : "s"}? Recruiters with actively sending emails will be skipped. This action cannot be undone.`}
        onConfirm={bulkDeleteSelectedRecruiters}
        onCancel={() => setShowBulkDeleteConfirm(false)}
        confirmText="Delete selected"
        isDestructive={true}
      />
    </Page>
  );
}
