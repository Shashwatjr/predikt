import React, { createContext, useContext, useEffect, useState } from 'react';
import { dark, light, ColorTokens } from '../theme/tokens';
import { keyValueStore } from '../services/keyValueStore';

const THEME_PREFERENCE_KEY = 'predikt.theme.isDark.v1';

interface ThemeContextType {
  colors: ColorTokens;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    let active = true;

    void keyValueStore.getItem(THEME_PREFERENCE_KEY).then((stored) => {
      if (active && stored !== null) {
        setIsDark(stored === 'true');
      }
    });

    return () => {
      active = false;
    };
  }, []);

  function toggleTheme() {
    setIsDark((prev) => {
      const next = !prev;
      void keyValueStore.setItem(THEME_PREFERENCE_KEY, next ? 'true' : 'false');
      return next;
    });
  }

  return (
    <ThemeContext.Provider value={{ colors: isDark ? dark : light, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
