import { ArrowRightLeft, CalendarClock, CheckCircle, Mail, RefreshCw } from "lucide-react";
import React, { useState } from "react";
import { useApi } from "../api/client";
import { Page } from "../components/Page";
import { StatCard } from "../components/StatCard";
import { StatisticsChart } from "../components/StatisticsChart";
import type { Stats } from "../types";

export function Statistics() {
  const { data, mutate } = useApi<Stats>("/api/statistics");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await mutate();
    setTimeout(() => setIsRefreshing(false), 600); // Visual delay for feedback
  };

  return (
    <Page
      title="Statistics"
      actions={
        <button className="button secondary" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw size={16} className={isRefreshing ? "spin" : ""} />
          Refresh Data
        </button>
      }
    >
      <div className="stats-grid">
        <StatCard
          label="Total sent"
          value={data?.totalSent ?? 0}
          icon={<Mail size={20} />}
          trend={{ value: "12% from yesterday", isPositive: true }}
        />
        <StatCard
          label="Success rate"
          value={`${data?.successRate ?? 0}%`}
          icon={<CheckCircle size={20} className="success-text" />}
          trend={{ value: "Stable", isPositive: true }}
        />
        <StatCard
          label="Retries"
          value={data?.retries ?? 0}
          icon={<ArrowRightLeft size={20} className="warning-text" />}
          trend={{ value: "2% increase", isPositive: false }}
        />
        <StatCard
          label="Est. completion"
          value={data?.estimatedCompletionDate ?? "Done"}
          icon={<CalendarClock size={20} />}
        />
      </div>
      
      <StatisticsChart />
    </Page>
  );
}
