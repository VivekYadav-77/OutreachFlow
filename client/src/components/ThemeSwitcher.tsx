import { useTheme } from "../context/ThemeContext";
import { Sun, Monitor, Moon } from "lucide-react";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="theme-switcher">
      <button
        className={theme === 'light' ? 'active' : ''}
        onClick={() => setTheme('light')}
        title="Light Theme"
      >
        <Sun size={16} />
      </button>
      <button
        className={theme === 'system' ? 'active' : ''}
        onClick={() => setTheme('system')}
        title="System Theme"
      >
        <Monitor size={16} />
      </button>
      <button
        className={theme === 'dark' ? 'active' : ''}
        onClick={() => setTheme('dark')}
        title="Dark Theme"
      >
        <Moon size={16} />
      </button>
    </div>
  );
}
