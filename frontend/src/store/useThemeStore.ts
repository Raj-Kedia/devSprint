import { create } from 'zustand';

type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const initialTheme: Theme =
    (localStorage.getItem('devsprint_theme') as Theme) || 'dark';

  // Apply to document on load
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    if (initialTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }

  return {
    theme: initialTheme,
    toggleTheme: () => {
      const nextTheme = get().theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('devsprint_theme', nextTheme);
      const root = document.documentElement;
      if (nextTheme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
      set({ theme: nextTheme });
    },
    setTheme: (theme: Theme) => {
      localStorage.setItem('devsprint_theme', theme);
      const root = document.documentElement;
      if (theme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
      set({ theme });
    },
  };
});
