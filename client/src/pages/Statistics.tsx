import { useApi } from "../api/client";
import { Page } from "../components/Page";
import { StatCard } from "../components/StatCard";
import type { Stats } from "../types";

export function Statistics() {
  const { data } = useApi<Stats>("/api/statistics");
  return (
    <Page title="Statistics">
      <div className="stats-grid">
        <StatCard label="Total sent" value={data?.totalSent ?? 0} />
        <StatCard label="Success rate" value={`${data?.successRate ?? 0}%`} />
        <StatCard label="Retries" value={data?.retries ?? 0} />
        <StatCard label="Estimated completion" value={data?.estimatedCompletionDate ?? "Done"} />
      </div>
    </Page>
  );
}
