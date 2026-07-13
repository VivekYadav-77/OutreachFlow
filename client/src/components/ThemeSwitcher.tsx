import React from "react";
import { useTheme } from "../context/ThemeContext";
import { Sun, Monitor, Moon } from "lucide-react";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  const btnStyle = (isActive: boolean): React.CSSProperties => ({
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '8px',
    border: 'none',
    borderRadius: '4px',
    background: isActive ? 'var(--primary)' : 'transparent',
    color: isActive ? 'white' : 'var(--sidebar-text-muted)',
    cursor: 'pointer',
    transition: 'all 0.2s'
  });

  return (
    <div style={{ display: 'flex', gap: '4px', background: 'var(--sidebar-hover)', padding: '4px', borderRadius: '6px', marginBottom: '28px' }}>
      <button style={btnStyle(theme === 'light')} onClick={() => setTheme('light')} title="Light Theme">
        <Sun size={16} />
      </button>
      <button style={btnStyle(theme === 'system')} onClick={() => setTheme('system')} title="System Theme">
        <Monitor size={16} />
      </button>
      <button style={btnStyle(theme === 'dark')} onClick={() => setTheme('dark')} title="Dark Theme">
        <Moon size={16} />
      </button>
    </div>
  );
}
