import React, { createContext, FC, useState, useEffect, useMemo, useCallback } from 'react';
import { Theme, ThemeContextValue, ThemeProviderProps } from './types';

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: FC<ThemeProviderProps> = ({
  defaultTheme = 'dark',
  children,
}) => {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'));
  }, []);

  useEffect(() => {
    // Synchronize data-theme on document element for consistent theme variable cascade
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>
      <div className="theme-root" data-theme={theme}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
};
