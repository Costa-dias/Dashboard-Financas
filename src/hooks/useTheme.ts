import { useEffect } from 'react';

/** Applies `dark` class to <html> whenever `theme` is 'dark'. */
export function useTheme(theme: 'light' | 'dark'): void {
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);
}
