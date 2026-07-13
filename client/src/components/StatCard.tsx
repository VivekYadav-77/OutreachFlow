import React from "react";

export function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <section className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </section>
  );
}
