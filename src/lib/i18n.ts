export type Locale = "fr" | "en";

export const LOCALES: Locale[] = ["fr", "en"];
export const DEFAULT_LOCALE: Locale = "fr";

/** localStorage key, also read by the inline script in app/layout.tsx. */
export const LOCALE_KEY = "lang";

/** A user-facing value: the same in every language, or one per language. */
export type Localized = string | Record<Locale, string>;

export function localize(value: Localized, locale: Locale): string {
  return typeof value === "string" ? value : value[locale];
}
