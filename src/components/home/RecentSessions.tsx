"use client";

import { ArrowRight, Folder, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { formatNumber, formatRelative } from "@/lib/format";
import { deleteSession, listSessions, type StoredSession } from "@/lib/persist";
import { useLocale } from "../LocaleProvider";
import { IconButton, spring } from "../ui";

export default function RecentSessions({ onResume }: { onResume: (session: StoredSession) => void }) {
  const { locale, t } = useLocale();
  const [sessions, setSessions] = useState<StoredSession[]>([]);

  useEffect(() => {
    let alive = true;
    void listSessions().then((list) => {
      if (alive) setSessions(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  function forget(key: string) {
    setSessions((list) => list.filter((session) => session.key !== key));
    void deleteSession(key);
  }

  return (
    <AnimatePresence initial={false}>
      {sessions.length > 0 && (
        <motion.section
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto w-full max-w-6xl overflow-hidden px-6"
        >
          <div className="pb-14">
            <div className="flex items-baseline justify-between border-b border-rule pb-3">
              <h2 className="text-[15px] font-semibold">
                {t({ fr: "Reprendre un tri", en: "Pick up a sort" })}
              </h2>
              <p className="text-[12.5px] text-faint">
                {t({
                  fr: "Gardé dans ce navigateur seulement",
                  en: "Kept in this browser only",
                })}
              </p>
            </div>
            <ul>
              <AnimatePresence initial={false}>
                {sessions.map((session, index) => {
                  const progress = session.total ? session.decided / session.total : 0;
                  return (
                    <motion.li
                      key={session.key}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0, transition: { ...spring, delay: index * 0.05 } }}
                      exit={{ opacity: 0, x: -24, transition: { duration: 0.2 } }}
                      className="group flex items-center gap-4 border-b border-rule py-3"
                    >
                      <Folder size={18} strokeWidth={1.8} className="shrink-0 text-faint" />
                      <button
                        type="button"
                        onClick={() => onResume(session)}
                        className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-1.5 text-left sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]"
                      >
                        <span className="truncate text-[15px] font-medium">{session.name}</span>
                        <span className="col-span-2 row-start-2 flex items-center gap-3 sm:col-span-1 sm:row-start-1">
                          <span className="relative h-1 flex-1 overflow-hidden rounded-full bg-sunk">
                            <motion.span
                              className="absolute inset-y-0 left-0 rounded-full bg-ink"
                              initial={{ width: 0 }}
                              animate={{ width: `${progress * 100}%` }}
                              transition={{ ...spring, delay: 0.15 + index * 0.05 }}
                            />
                          </span>
                          <span className="nums shrink-0 font-mono text-[12px] text-muted">
                            {formatNumber(session.decided, locale)} / {formatNumber(session.total, locale)}
                          </span>
                        </span>
                        <span className="shrink-0 text-right text-[12.5px] text-faint">
                          {formatRelative(session.updatedAt, locale)}
                        </span>
                      </button>
                      <span className="hidden items-center gap-1 text-[13px] font-medium text-ink opacity-0 transition-opacity group-hover:opacity-100 md:inline-flex">
                        {t({ fr: "Reprendre", en: "Resume" })}
                        <ArrowRight size={14} />
                      </span>
                      <IconButton
                        label={t({ fr: "Oublier ce tri", en: "Forget this sort" })}
                        onClick={() => forget(session.key)}
                        className="size-8"
                      >
                        <X size={15} />
                      </IconButton>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
