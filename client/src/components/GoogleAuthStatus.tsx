import { useApi } from "../api/client";
import { API_URL } from "../api/client";
import type { AuthStatus } from "../types";

export function GoogleAuthStatus() {
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
