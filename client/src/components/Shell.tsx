import { NavLink, Route, Routes } from "react-router-dom";
import {
  BarChart3,
  FileText,
  History,
  LayoutDashboard,
  ListChecks,
  Mail,
  Settings
} from "lucide-react";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { GoogleAuthStatus } from "./GoogleAuthStatus";
import { Dashboard } from "../pages/Dashboard";
import { Recruiters } from "../pages/Recruiters";
import { Compose } from "../pages/Compose";
import { CoverLetterGenerator } from "../pages/CoverLetterGenerator";
import { SettingsPage } from "../pages/Settings";
import { Logs } from "../pages/Logs";
import { Statistics } from "../pages/Statistics";
import { EmailActivity } from "../pages/EmailActivity";

export function Shell() {
  const nav = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/email-activity", label: "Email Activity", icon: History },
    { to: "/recruiters", label: "Recruiters", icon: Mail },
    { to: "/compose", label: "Templates", icon: Mail },
    { to: "/cover-letter", label: "Cover Letters", icon: FileText },
    { to: "/settings", label: "Settings", icon: Settings },
    { to: "/logs", label: "Logs", icon: ListChecks },
    { to: "/statistics", label: "Statistics", icon: BarChart3 }
  ];
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">Outreach Flow</div>
        <ThemeSwitcher />
        <nav>
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "active" : "")}>
                <Icon size={18} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="sidebar-auth">
          <GoogleAuthStatus />
        </div>
      </aside>
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/email-activity" element={<EmailActivity />} />
          <Route path="/recruiters" element={<Recruiters />} />
          <Route path="/compose" element={<Compose />} />
          <Route path="/cover-letter" element={<CoverLetterGenerator />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/statistics" element={<Statistics />} />
        </Routes>
      </main>
    </div>
  );
}
