import { useApi } from "../api/client";
import { API_URL } from "../api/client";
import type { AuthStatus } from "../types";

const STATUS_LABELS: Record<AuthStatus["status"], string> = {
  CONNECTED: "Connected",
  AUTH_REQUIRED: "Authentication Required",
  CONNECTING: "Connecting",
  DISCONNECTED: "Disconnected",
  ERROR: "Error"
};

export function GoogleAuthStatus() {
  const { data, loading } = useApi<AuthStatus>("/api/auth/status");
  if (loading) return null;

  if (data?.status === "CONNECTED" && data.readScopeGranted === false) {
    return (
      <div className="auth-status auth-status-action" title="Reconnect Google to grant Gmail read access">
        <span className="email">{data.emailAddress ?? "Connected"}</span>
        <span className="badge auth-required">Read access needed</span>
        <a className="button secondary" href={`${API_URL}/api/auth/google`}>
          Reconnect Google
        </a>
      </div>
    );
  }

  if (data?.status === "CONNECTED") {
    return (
      <div className="auth-status" title={data.emailAddress || "Connected"}>
        <span className="email">{data.emailAddress ?? "Connected"}</span>
        <span className="badge success">Active</span>
      </div>
    );
  }

  return (
    <div className="auth-status auth-status-action" title={data?.lastAuthFailureReason ?? STATUS_LABELS[data?.status ?? "DISCONNECTED"]}>
      <span className={`badge auth-${(data?.status ?? "DISCONNECTED").toLowerCase()}`}>
        {STATUS_LABELS[data?.status ?? "DISCONNECTED"]}
      </span>
      <a className="button secondary" href={`${API_URL}/api/auth/google`}>
        {data?.status === "AUTH_REQUIRED" ? "Reconnect Google" : "Connect Google"}
      </a>
    </div>
  );
}
