import React, { FC } from 'react';
import { useTheme } from '../../theme/useTheme';

const SunIcon: FC = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="ui-theme-toggle__icon"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon: FC = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="ui-theme-toggle__icon"
    aria-hidden="true"
  >
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

export interface ThemeToggleProps {
  readonly showLabel?: boolean;
  readonly className?: string;
}

export const ThemeToggle: FC<ThemeToggleProps> = ({
  showLabel = true,
  className = '',
}) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const labelText = isDark ? 'Dark Theme' : 'Light Theme';
  const nextThemeText = isDark ? 'light' : 'dark';

  return (
    <button
      type="button"
      className={`ui-theme-toggle ${className}`.trim()}
      onClick={toggleTheme}
      aria-label={`Current theme is ${theme}. Click to switch to ${nextThemeText} theme.`}
      title={`Switch to ${nextThemeText} theme`}
    >
      <span className="ui-theme-toggle__icon-wrap">
        {isDark ? <MoonIcon /> : <SunIcon />}
      </span>
      {showLabel && <span className="ui-theme-toggle__label">{labelText}</span>}
    </button>
  );
};
