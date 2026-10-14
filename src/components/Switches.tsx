"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import type { Locale, Localized } from "@/lib/i18n";
import { useLocale } from "./LocaleProvider";

type Mode = "system" | "light" | "dark";

const MODES: { id: Mode; icon: typeof Sun; title: Localized }[] = [
  { id: "system", icon: Monitor, title: { fr: "Suivre le système", en: "Follow the system" } },
  { id: "light", icon: Sun, title: { fr: "Mode clair", en: "Light mode" } },
  { id: "dark", icon: Moon, title: { fr: "Mode sombre", en: "Dark mode" } },
];

/* Kept in sync with --color-canvas in globals.css: the colour the browser
   paints its own chrome with. */
const BAR: Record<"light" | "dark", string> = { light: "#f4f4f2", dark: "#0b0b0c" };

const OVERRIDE_ID = "theme-color-override";

function readStoredTheme(): Mode {
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Storage disabled: the toggle still works for this visit.
  }
  return "system";
}

/* In Auto the two media-scoped tags from the layout already follow the
   system. A forced theme adds one unscoped tag ahead of them. */
function writeBarColour(mode: Mode) {
  let tag = document.getElementById(OVERRIDE_ID) as HTMLMetaElement | null;
  if (mode === "system") {
    tag?.remove();
    return;
  }
  if (!tag) {
    tag = document.createElement("meta");
    tag.id = OVERRIDE_ID;
    tag.name = "theme-color";
  }
  tag.content = BAR[mode];
  document.head.prepend(tag);
}

const segment =
  "flex h-7 items-center justify-center px-2 text-muted transition-colors duration-200 hover:text-ink";

export function ThemeToggle() {
  const { t } = useLocale();
  const [mode, setMode] = useState<Mode>("system");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading localStorage after hydration
    setMode(readStoredTheme());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    if (mode === "system") delete root.dataset.theme;
    else root.dataset.theme = mode;
    writeBarColour(mode);
  }, [mode, ready]);

  function choose(next: Mode) {
    setMode(next);
    try {
      if (next === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", next);
    } catch {
      // Nothing to persist to; the choice lasts until reload.
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={t({ fr: "Thème", en: "Theme" })}
      className="theme-switch flex overflow-hidden rounded-[7px] border border-edge bg-surface"
    >
      {MODES.map(({ id, icon: Icon, title }, index) => (
        <button
          key={id}
          type="button"
          role="radio"
          data-mode={id}
          aria-checked={mode === id}
          aria-label={t(title)}
          title={t(title)}
          onClick={() => choose(id)}
          className={`${segment} ${index > 0 ? "border-l border-edge" : ""}`}
        >
          <Icon size={14} strokeWidth={2} />
        </button>
      ))}
    </div>
  );
}

/* Each language is named in itself, so a reader who cannot read the current
   one still finds theirs. */
const LANGUAGES: { id: Locale; label: string; title: string }[] = [
  { id: "fr", label: "FR", title: "Français" },
  { id: "en", label: "EN", title: "English" },
];

export function LanguageToggle() {
  const { locale, setLocale, t } = useLocale();

  return (
    <div
      role="radiogroup"
      aria-label={t({ fr: "Langue", en: "Language" })}
      className="lang-switch flex overflow-hidden rounded-[7px] border border-edge bg-surface"
    >
      {LANGUAGES.map((option, index) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          lang={option.id}
          data-locale={option.id}
          aria-checked={locale === option.id}
          title={option.title}
          onClick={() => setLocale(option.id)}
          className={`${segment} font-mono text-[11px] font-medium ${
            index > 0 ? "border-l border-edge" : ""
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
