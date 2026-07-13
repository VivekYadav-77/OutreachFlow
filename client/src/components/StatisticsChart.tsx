import React from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Dummy data for the past 7 days to showcase the chart
// In a real scenario, this would be fetched from the backend.
const generateDummyData = () => {
  const data = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    data.push({
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      sent: Math.floor(Math.random() * (1000 - 400 + 1)) + 400,
      failed: Math.floor(Math.random() * (100 - 10 + 1)) + 10,
    });
  }
  return data;
};

const data = generateDummyData();

export function StatisticsChart() {
  return (
    <div className="panel chart-panel">
      <h2>Activity (Last 7 Days)</h2>
      <div className="chart-container" style={{ width: "100%", height: 350 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--error-text)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--error-text)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" stroke="var(--text-muted)" tick={{ fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
            <YAxis stroke="var(--text-muted)" tick={{ fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-lighter)" />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--bg-panel)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                color: "var(--text-main)",
                boxShadow: "0 4px 6px var(--shadow-color)",
              }}
              itemStyle={{ fontWeight: "bold" }}
            />
            <Area type="monotone" dataKey="sent" name="Emails Sent" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorSent)" />
            <Area type="monotone" dataKey="failed" name="Failed" stroke="var(--error-text)" strokeWidth={3} fillOpacity={1} fill="url(#colorFailed)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
