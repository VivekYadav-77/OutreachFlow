import React from "react";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: options?.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...options
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.ok === false) throw new Error(json.error?.message ?? "Request failed");
  return json.data as T;
}

export function useApi<T>(path: string, refresh = 0) {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const mutate = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const value = await api<T>(path);
      setData(value);
      return value;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [path]);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api<T>(path)
      .then((value) => active && setData(value))
      .catch((err: Error) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [path, refresh]);
  return { data, error, loading, mutate };
}
