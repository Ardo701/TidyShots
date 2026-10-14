"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import type { Localized } from "@/lib/i18n";
import { useLocale } from "../LocaleProvider";
import { IconButton, Kbd, spring } from "../ui";

type Row = { keys: string[]; label: Localized };

const GROUPS: { title: Localized; rows: Row[] }[] = [
  {
    title: { fr: "Décider", en: "Decide" },
    rows: [
      { keys: ["E", "→"], label: { fr: "Garder", en: "Keep" } },
      { keys: ["A", "←"], label: { fr: "Écarter", en: "Toss" } },
      { keys: ["⌫", "⌘Z"], label: { fr: "Annuler la dernière décision", en: "Undo the last decision" } },
    ],
  },
  {
    title: { fr: "Regarder", en: "Look" },
    rows: [
      { keys: ["Molette"], label: { fr: "Zoomer sous le pointeur", en: "Zoom under the pointer" } },
      { keys: ["Double-clic", "1"], label: { fr: "Voir à 100 %, ou revenir", en: "See at 100%, or back" } },
      { keys: ["+", "−"], label: { fr: "Zoomer, dézoomer", en: "Zoom in, zoom out" } },
      { keys: ["0"], label: { fr: "Ajuster à l’écran", en: "Fit to screen" } },
      { keys: ["F"], label: { fr: "Plein écran", en: "Full screen" } },
    ],
  },
  {
    title: { fr: "Souris et trackpad", en: "Mouse and trackpad" },
    rows: [
      { keys: ["Glisser"], label: { fr: "À droite pour garder, à gauche pour écarter", en: "Right to keep, left to toss" } },
      { keys: ["Glisser"], label: { fr: "Déplacer la photo quand elle est zoomée", en: "Move the photo while zoomed" } },
    ],
  },
];

/* Position of each group's first row, for the staggered entrance. */
const OFFSETS = GROUPS.map((_, index) =>
  GROUPS.slice(0, index).reduce((sum, group) => sum + group.rows.length, 0),
);

const KEY_LABELS: Record<string, Localized> = {
  Molette: { fr: "Molette", en: "Wheel" },
  "Double-clic": { fr: "Double-clic", en: "Double-click" },
  Glisser: { fr: "Glisser", en: "Drag" },
};

export default function HelpOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLocale();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "?") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t({ fr: "Raccourcis", en: "Shortcuts" })}
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={spring}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-[560px] rounded-[14px] border border-edge bg-surface p-6 shadow-[var(--shadow-float)]"
          >
            <div className="flex items-center justify-between">
              <h2 className="display text-[28px]">{t({ fr: "Raccourcis", en: "Shortcuts" })}</h2>
              <IconButton label={t({ fr: "Fermer", en: "Close" })} onClick={onClose}>
                <X size={18} />
              </IconButton>
            </div>
            <div className="mt-4 space-y-5">
              {GROUPS.map((group, groupIndex) => (
                <section key={t(group.title)}>
                  <h3 className="mb-1.5 text-[12.5px] font-medium text-faint">{t(group.title)}</h3>
                  <ul>
                    {group.rows.map((item, rowIndex) => {
                      const delay = 0.04 + (OFFSETS[groupIndex] + rowIndex) * 0.025;
                      return (
                        <motion.li
                          key={t(item.label)}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ ...spring, delay }}
                          className="flex items-center justify-between gap-4 border-b border-rule py-2 text-[14px] last:border-0"
                        >
                          <span>{t(item.label)}</span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            {item.keys.map((key) => (
                              <Kbd key={key}>{KEY_LABELS[key] ? t(KEY_LABELS[key]) : key}</Kbd>
                            ))}
                          </span>
                        </motion.li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
