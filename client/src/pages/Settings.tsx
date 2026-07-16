import React from "react";
import { AlertTriangle, SlidersHorizontal, X, XCircle } from "lucide-react";
import { API_URL, api, useApi } from "../api/client";
import { Page } from "../components/Page";
import { GoogleAuthStatus } from "../components/GoogleAuthStatus";
import { useToast } from "../context/ToastContext";
import { Spinner } from "../components/Spinner";
import type { AuthStatus } from "../types";

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

const AUTH_STATUS_LABELS: Record<AuthStatus["status"], string> = {
  CONNECTED: "Connected",
  AUTH_REQUIRED: "Authentication Required",
  CONNECTING: "Connecting",
  DISCONNECTED: "Disconnected",
  ERROR: "Error"
};

function formatDateTime(value?: string | null) {
  if (!value) return "Not available";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

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
                <li>prevent spam</li>
                <li>protect accounts</li>
                <li>stop compromised accounts</li>
                <li>maintain Gmail reputation</li>
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
                  Recommendations: Keep Daily Limit &le;100 and Delay &ge;45 seconds.
                </p>
              )}
            </div>
          </section>

          <div className="modal-footer-note">
            <p>Information summarized from Google's official documentation (Reference: July 2026). Google may update limits or policies at any time.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const [refresh, setRefresh] = React.useState(0);
  const { data } = useApi<Record<string, unknown>>("/api/settings", refresh);
  const { data: authStatus } = useApi<AuthStatus>("/api/auth/status", refresh);
  const [form, setForm] = React.useState<Record<string, unknown>>({});
  const [isGuidelinesOpen, setIsGuidelinesOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const toast = useToast();
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
      toast.error("Validation Error: Minimum delay cannot exceed maximum delay.");
      return;
    }

    setIsSaving(true);
    try {
      await api("/api/settings", { method: "PUT", body: JSON.stringify(form) });
      setRefresh((value) => value + 1);
      toast.success("Settings saved successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
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

      <section className={`panel google-connection-card auth-${(authStatus?.status ?? "DISCONNECTED").toLowerCase()}`}>
        <div className="google-connection-main">
          <div>
            <h2>Google Account</h2>
            <div className="google-connection-email">{authStatus?.emailAddress ?? "Gmail sending account"}</div>
          </div>
          <span className={`badge auth-${(authStatus?.status ?? "DISCONNECTED").toLowerCase()}`}>
            {AUTH_STATUS_LABELS[authStatus?.status ?? "DISCONNECTED"]}
          </span>
        </div>
        <div className="google-connection-grid">
          <div>
            <span>Last Connected</span>
            <strong>{formatDateTime(authStatus?.lastConnectedAt ?? authStatus?.updatedAt)}</strong>
          </div>
          <div>
            <span>Last Refresh</span>
            <strong>{formatDateTime(authStatus?.lastRefreshAt)}</strong>
          </div>
          <div>
            <span>Failure Reason</span>
            <strong>{authStatus?.lastAuthFailureReason ?? "None"}</strong>
          </div>
        </div>
        {authStatus?.status !== "CONNECTED" && (
          <a className="button" href={`${API_URL}/api/auth/google`}>
            {authStatus?.status === "AUTH_REQUIRED" ? "Reconnect Google" : "Connect Google"}
          </a>
        )}
      </section>

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
            {isSaving && <Spinner size={14} />}
            Save Settings
          </button>
        </form>
      </section>
    </Page>
  );
}
