import React from "react";
import { useLocation } from "react-router-dom";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExtension from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import LinkExtension from "@tiptap/extension-link";
import ImageExtension from "@tiptap/extension-image";
import { TextStyle } from "@tiptap/extension-text-style";
import { Paperclip, RefreshCw, Save, Trash2, X } from "lucide-react";
import { api, useApi } from "../api/client";
import { Page } from "../components/Page";
import { ComposerToolbar } from "../components/ComposerToolbar";
import { GoogleAuthStatus } from "../components/GoogleAuthStatus";
import { useToast } from "../context/ToastContext";
import { ConfirmModal } from "../components/ConfirmModal";
import type { Template } from "../types";

function emailTextFromHtml(html: string) {
  const element = document.createElement("div");
  element.innerHTML = html;
  return element.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

export function Compose() {
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
  const toast = useToast();
  const [templateToDelete, setTemplateToDelete] = React.useState<number | null>(null);

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

  const removeTemplate = () => {
    if (!templateId) return;
    setTemplateToDelete(templateId);
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

  const deleteFromList = (id: number, event: React.MouseEvent) => {
    event.stopPropagation();
    setTemplateToDelete(id);
  };

  const confirmDelete = async () => {
    if (!templateToDelete) return;
    setIsDeleting(true);
    setCardAction({ id: templateToDelete, type: 'delete' });
    try {
      await api(`/api/templates/${templateToDelete}`, { method: "DELETE" });
      if (templateId === templateToDelete) {
        newTemplate();
      }
      setRefresh((value) => value + 1);
      toast.success("Template deleted successfully");
      setError("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete template";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsDeleting(false);
      setCardAction(null);
      setTemplateToDelete(null);
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
      <ConfirmModal
        isOpen={!!templateToDelete}
        title="Delete Template"
        message="Are you sure you want to delete this template? This action cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setTemplateToDelete(null)}
        confirmText="Delete"
        isDestructive={true}
      />
    </Page>
  );
}
