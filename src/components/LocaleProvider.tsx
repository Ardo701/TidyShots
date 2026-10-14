"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { APP_NAME } from "@/lib/brand";
import {
  DEFAULT_LOCALE,
  LOCALE_KEY,
  LOCALES,
  localize,
  type Locale,
  type Localized,
} from "@/lib/i18n";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (value: Localized) => string;
};

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (value) => localize(value, DEFAULT_LOCALE),
});

function readStored(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_KEY);
    if (LOCALES.includes(stored as Locale)) return stored as Locale;
  } catch {
    // Storage disabled: the toggle still works for this visit.
  }
  return DEFAULT_LOCALE;
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  // The server renders French; the stored choice is only readable here.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading localStorage after hydration
    setLocaleState(readStored());
    setReady(true);
  }, []);

  useEffect(() => {
    // Before the stored choice is known, the inline script in the layout owns
    // these attributes: lifting the veil now would flash the French page.
    if (!ready) return;
    const root = document.documentElement;
    root.lang = locale;
    delete root.dataset.langPending;
  }, [locale, ready]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(LOCALE_KEY, next);
    } catch {
      // Nothing to persist to; the choice lasts until reload.
    }
  }, []);

  const value = useMemo(
    () => ({ locale, setLocale, t: (text: Localized) => localize(text, locale) }),
    [locale, setLocale],
  );

  return (
    <LocaleContext.Provider value={value}>
      <title>{APP_NAME}</title>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
