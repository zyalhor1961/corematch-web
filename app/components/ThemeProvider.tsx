'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const THEME_STORAGE_KEY = 'theme';

const applyThemeMode = (mode: ThemeMode) => {
  const root = document.documentElement;

  root.classList.toggle('dark', mode === 'dark');
  root.style.colorScheme = mode;

  localStorage.setItem(THEME_STORAGE_KEY, mode);
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    const getPreferredTheme = (): ThemeMode => {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    };

    const preferredTheme = getPreferredTheme();
    setIsDarkMode(preferredTheme === 'dark');
    applyThemeMode(preferredTheme);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = (event: MediaQueryListEvent) => {
      if (localStorage.getItem(THEME_STORAGE_KEY)) {
        return;
      }
      const newMode: ThemeMode = event.matches ? 'dark' : 'light';
      setIsDarkMode(newMode === 'dark');
      applyThemeMode(newMode);
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY || !event.newValue) {
        return;
      }
      const newMode: ThemeMode = event.newValue === 'dark' ? 'dark' : 'light';
      setIsDarkMode(newMode === 'dark');
      applyThemeMode(newMode);
    };

    mediaQuery.addEventListener('change', handleMediaChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const newMode: ThemeMode = prev ? 'light' : 'dark';
      applyThemeMode(newMode);
      return !prev;
    });
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
};
