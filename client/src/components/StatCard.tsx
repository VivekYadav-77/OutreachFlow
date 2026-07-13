import React from "react";

export function StatCard({
  label,
  value,
  icon,
  trend,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  trend?: { value: string; isPositive: boolean };
}) {
  return (
    <section className="stat">
      <div className="stat-header">
        <div className="stat-label-container">
          {icon && <div className="stat-icon">{icon}</div>}
          <span>{label}</span>
        </div>
        {trend && (
          <div className={`stat-trend ${trend.isPositive ? "positive" : "negative"}`}>
            {trend.isPositive ? "↑" : "↓"} {trend.value}
          </div>
        )}
      </div>
      <strong>{value}</strong>
    </section>
  );
}
