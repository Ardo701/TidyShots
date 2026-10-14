import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { LocaleProvider } from "@/components/LocaleProvider";
import { APP_NAME } from "@/lib/brand";
import { DEFAULT_LOCALE, LOCALE_KEY, LOCALES } from "@/lib/i18n";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  axes: ["opsz", "wdth"],
  variable: "--font-bricolage",
  display: "swap",
});

const instrument = Instrument_Sans({
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  variable: "--font-instrument",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
});

// The <title> is rendered by LocaleProvider so it follows the chosen language.
export const metadata: Metadata = {
  description:
    "Triez un dossier de photos au clavier ou d’un geste, directement dans le navigateur. Aucune photo n’est envoyée.",
  // Kept out of search engines. next.config.ts sends the same rule as an
  // X-Robots-Tag header on every response, images and scripts included.
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
  // Name under the icon when the page is added to an iPhone home screen.
  appleWebApp: { title: APP_NAME },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f4f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" },
  ],
};

// Runs before the first paint so a stored theme never flashes the other one.
const APPLY_STORED_THEME = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

// The server always renders French. When another language is stored, the page
// stays hidden (see globals.css) until LocaleProvider has re-rendered it. The
// timeout is a safety net if the scripts fail to load.
const APPLY_STORED_LOCALE = `try{var l=localStorage.getItem(${JSON.stringify(LOCALE_KEY)});if(l!==${JSON.stringify(DEFAULT_LOCALE)}&&${JSON.stringify(LOCALES)}.indexOf(l)>-1){var r=document.documentElement;r.lang=l;r.dataset.langPending="";setTimeout(function(){delete r.dataset.langPending},3000)}}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${bricolage.variable} ${instrument.variable} ${jetbrains.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPLY_STORED_THEME }} />
        <script dangerouslySetInnerHTML={{ __html: APPLY_STORED_LOCALE }} />
      </head>
      <body>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
