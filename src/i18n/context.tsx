import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { translations, type Lang, type Translations } from './translations';

interface I18nContextValue {
  lang: Lang;
  t: Translations;
  toggleLang: () => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = 'travel-replay-lang';

function getInitialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'ko') return stored;
  } catch { /* noop */ }
  return 'ko';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(getInitialLang);

  const toggleLang = useCallback(() => {
    setLang((prev) => {
      const next = prev === 'ko' ? 'en' : 'ko';
      try { localStorage.setItem(STORAGE_KEY, next); } catch { /* noop */ }
      return next;
    });
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({ lang, t: translations[lang], toggleLang }),
    [lang, toggleLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
