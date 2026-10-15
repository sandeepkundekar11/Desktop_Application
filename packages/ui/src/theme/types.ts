export type Theme = 'light' | 'dark';

export interface ThemeContextValue {
  readonly theme: Theme;
  readonly setTheme: (theme: Theme) => void;
  readonly toggleTheme: () => void;
}

export interface ThemeProviderProps {
  readonly defaultTheme?: Theme;
  readonly children: React.ReactNode;
}
