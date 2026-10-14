"use client";

import { motion } from "motion/react";
import type { ScanProgress } from "@/lib/fs";
import { useLocale } from "./LocaleProvider";
import { RollingNumber } from "./ui";

/* Three blank prints shuffling while the folder is read. */
const CARDS = [0, 1, 2];

export default function ScanScreen({ folder, progress }: { folder: string; progress: ScanProgress }) {
  const { locale, t } = useLocale();
  const ratio = progress.phase === "reading" && progress.found ? progress.read / progress.found : 0;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-10 px-6">
      <div className="relative h-40 w-32">
        {CARDS.map((card) => (
          <motion.div
            key={card}
            className="absolute inset-0 rounded-[12px] border border-edge bg-surface shadow-[var(--shadow-card)]"
            animate={{
              x: [0, card === 2 ? 70 : card === 0 ? -70 : 0, 0],
              rotate: [(card - 1) * 6, (card - 1) * 14, (card - 1) * 6],
              y: [card * -4, card * -4 - 10, card * -4],
            }}
            transition={{ duration: 1.6, repeat: Infinity, ease: [0.65, 0, 0.35, 1], delay: card * 0.12 }}
          >
            <div className="absolute inset-2.5 rounded-[7px] bg-sunk" />
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col items-center text-center">
        <p className="text-[14px] text-muted">
          {t({ fr: "Lecture de", en: "Reading" })} <span className="font-medium text-ink">{folder}</span>
        </p>
        <p className="display mt-3 text-[44px]">
          <RollingNumber value={progress.found} locale={locale} />{" "}
          <span className="text-muted">
            {progress.found > 1 || locale === "en"
              ? t({ fr: "photos", en: progress.found === 1 ? "photo" : "photos" })
              : "photo"}
          </span>
        </p>
        <div className="mt-6 h-1 w-56 overflow-hidden rounded-full bg-sunk">
          <motion.div
            className="h-full rounded-full bg-ink"
            animate={{ width: `${Math.max(ratio, 0.04) * 100}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 24 }}
          />
        </div>
        <p className="mt-3 text-[12.5px] text-faint">
          {progress.phase === "listing"
            ? t({ fr: "Inventaire des fichiers…", en: "Listing files…" })
            : t({ fr: "Lecture des dates et des tailles…", en: "Reading dates and sizes…" })}
        </p>
      </div>
    </div>
  );
}
