import React from "react";
import { useNavigate } from "react-router-dom";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExtension from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import LinkExtension from "@tiptap/extension-link";
import ImageExtension from "@tiptap/extension-image";
import { TextStyle } from "@tiptap/extension-text-style";
import { RefreshCw, Upload } from "lucide-react";
import { api } from "../api/client";
import { Page } from "../components/Page";
import { ComposerToolbar } from "../components/ComposerToolbar";

function emailTextFromHtml(html: string) {
  const element = document.createElement("div");
  element.innerHTML = html;
  return element.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

export function CoverLetterGenerator() {
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
                  <option value="Professional & Formal">Professional &amp; Formal (Structured, polite, standard layout)</option>
                  <option value="Short & Crisp">Short &amp; Crisp (Concise email focus, quick reading)</option>
                  <option value="Story-Driven">Story-Driven (Highlights personal story, connection to mission)</option>
                  <option value="Technical & Skills Focus">Technical &amp; Skills Focus (Dives deep into scale, frameworks, and architecture)</option>
                  <option value="Bold & Persuasive">Bold &amp; Persuasive (Confident, clear value-proposition)</option>
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
