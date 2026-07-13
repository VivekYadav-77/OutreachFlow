import React from "react";
import { NavLink } from "react-router-dom";
import { AlertTriangle, Pencil, RefreshCw, Trash2, X } from "lucide-react";
import { api, useApi, API_URL } from "../api/client";
import { Page } from "../components/Page";
import type { Recruiter, Template, ImportResult } from "../types";

export function Recruiters() {
  const [refresh, setRefresh] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const { data } = useApi<{ rows: Recruiter[]; total: number }>(`/api/recruiters?search=${encodeURIComponent(search)}`, refresh);
  const { data: templates } = useApi<Template[]>("/api/templates", refresh);
  const defaultTemplate = templates?.find((template) => template.isDefault) ?? templates?.[0];
  const [form, setForm] = React.useState({ fullName: "", company: "", email: "", designation: "", notes: "", templateId: "" });

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
      const result = await api<ImportResult>("/api/recruiters/import", { method: "POST", body });
      setImportResult(result);
      setRefresh((value) => value + 1);
    } catch (err) {
      // Server-thrown errors (e.g. wrong column names) surface here as a clear message
      alert(err instanceof Error ? err.message : "Failed to import CSV");
    } finally {
      setIsImporting(false);
      // Reset file input so the same file can be re-selected after fixing it
      if (fileInputRef.current) fileInputRef.current.value = "";
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
            <input ref={fileInputRef} hidden type="file" accept=".csv,text/csv" disabled={isImporting} onChange={(event) => importCsv(event.target.files?.[0])} />
          </label>
        </div>
        <div className="csv-format-hint">
          <span>Required columns:</span>
          <code>fullName</code><code>company</code><code>email</code>
          <span className="csv-hint-sep">·  Optional:</span>
          <code>designation</code><code>linkedin</code><code>notes</code>
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
    </Page>
  );
}
