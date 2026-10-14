"use client";

import { FolderOpen } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { formatBytes } from "@/lib/format";
import { REJECT_FOLDER, type ApplyResult, type FailureReason } from "@/lib/fs";
import type { Locale, Localized } from "@/lib/i18n";
import { useLocale } from "./LocaleProvider";
import { Button, RollingNumber, spring } from "./ui";

const REASONS: Record<FailureReason, Localized> = {
  changed: { fr: "modifiée depuis l’ouverture du dossier", en: "changed since the folder was opened" },
  missing: { fr: "introuvable", en: "not found" },
  locked: { fr: "verrouillée ou ouverte ailleurs", en: "locked or open elsewhere" },
  other: { fr: "erreur inattendue", en: "unexpected error" },
};

export default function DoneScreen({
  folderName,
  result,
  total,
  kept,
  undecided,
  onHome,
}: {
  folderName: string;
  result: ApplyResult;
  total: number;
  kept: number;
  undecided: number;
  onHome: () => void;
}) {
  const { locale, t } = useLocale();
  const moved = result.mode === "move";

  const stats: { label: Localized; value: number; tone?: string; bytes?: boolean }[] = [
    { label: { fr: "photos dans le dossier", en: "photos in the folder" }, value: total },
    { label: { fr: "gardées", en: "kept" }, value: kept, tone: "text-keep" },
    {
      label: moved
        ? { fr: `déplacées dans « ${REJECT_FOLDER.fr} »`, en: `moved to “${REJECT_FOLDER.en}”` }
        : { fr: "supprimées", en: "deleted" },
      value: result.photos,
      tone: "text-reject",
    },
    ...(undecided > 0
      ? [{ label: { fr: "laissées sans décision", en: "left undecided" }, value: undecided }]
      : []),
  ];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-6 py-16">
      <svg viewBox="0 0 64 64" className="size-16 text-keep" aria-hidden>
        <motion.circle
          cx="32"
          cy="32"
          r="29"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          initial={{ pathLength: 0, rotate: -90 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.7, ease: [0.65, 0, 0.35, 1] }}
          style={{ originX: "50%", originY: "50%" }}
        />
        <motion.path
          d="M19 33l9 9 17-19"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.45, delay: 0.55, ease: "easeOut" }}
        />
      </svg>

      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.3 }}
        className="display mt-8 text-[56px] sm:text-[72px]"
      >
        {t({ fr: "C’est rangé.", en: "All tidy." })}
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.38 }}
        className="mt-3 text-[16px] text-muted"
      >
        {folderName}
        {result.bytes > 0 &&
          ` · ${formatBytes(result.bytes, locale)} ${moved ? t({ fr: "mis de côté", en: "set aside" }) : t({ fr: "libérés", en: "freed" })}`}
      </motion.p>

      <dl className="mt-10 border-t border-rule">
        {stats.map((stat, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...spring, delay: 0.45 + index * 0.08 }}
            className="flex items-baseline justify-between gap-6 border-b border-rule py-4"
          >
            <dt className="text-[15px] text-muted">{t(stat.label)}</dt>
            <dd className={`display text-[34px] ${stat.tone ?? ""}`}>
              <CountUp value={stat.value} delay={0.5 + index * 0.08} locale={locale} />
            </dd>
          </motion.div>
        ))}
      </dl>

      {moved && result.photos > 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="mt-6 flex gap-2.5 text-[14px] leading-relaxed text-muted"
        >
          <FolderOpen size={17} className="mt-0.5 shrink-0" />
          {t({
            fr: `Les photos écartées sont dans le sous-dossier « ${REJECT_FOLDER.fr} ». Jetez-y un œil, puis mettez-le à la corbeille quand vous êtes sûr.`,
            en: `Tossed photos are in the “${REJECT_FOLDER.en}” subfolder. Have a look, then move it to the Trash when you are sure.`,
          })}
        </motion.p>
      )}

      {result.failures.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="mt-8 rounded-[10px] border border-reject/40 bg-reject-soft/50 p-4"
        >
          <p className="text-[14px] font-medium">
            {t({
              fr: `${result.failures.length} photo${result.failures.length > 1 ? "s n’ont" : " n’a"} pas pu être traitée${result.failures.length > 1 ? "s" : ""} et ${result.failures.length > 1 ? "sont restées" : "est restée"} en place :`,
              en: `${result.failures.length} photo${result.failures.length === 1 ? "" : "s"} could not be handled and stayed in place:`,
            })}
          </p>
          <ul className="mt-2 max-h-48 space-y-1 overflow-auto font-mono text-[12px] text-muted">
            {result.failures.map((failure) => (
              <li key={failure.id}>
                {failure.name} <span className="text-faint">· {t(REASONS[failure.reason])}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.8 }}
        className="mt-10"
      >
        <Button variant="primary" size="lg" onClick={onHome}>
          <FolderOpen size={18} />
          {t({ fr: "Trier un autre dossier", en: "Sort another folder" })}
        </Button>
      </motion.div>
    </div>
  );
}

/** Rolls up from zero once its row has appeared. */
function CountUp({ value, delay, locale }: { value: number; delay: number; locale: Locale }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setShown(value), delay * 1000);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return <RollingNumber value={shown} locale={locale} />;
}
