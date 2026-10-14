"use client";

import { FolderOpen, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { APP_NAME, REPO_URL } from "@/lib/brand";
import { isFileSystemAccessSupported } from "@/lib/fs";
import type { Localized } from "@/lib/i18n";
import type { StoredSession } from "@/lib/persist";
import { useLocale } from "../LocaleProvider";
import { LanguageToggle, ThemeToggle } from "../Switches";
import { Button, GitHubMark, Kbd, Logo, spring } from "../ui";
import HeroDeck from "./HeroDeck";
import RecentSessions from "./RecentSessions";

const noop = () => () => {};

const STEPS: { title: Localized; body: Localized }[] = [
  {
    title: { fr: "Ouvrez un dossier", en: "Open a folder" },
    body: {
      fr: "Le navigateur vous demande l’accès au dossier. Les photos sont lues sur place : rien n’est téléversé, il n’y a pas de serveur.",
      en: "The browser asks for access to the folder. Photos are read in place: nothing is uploaded, there is no server.",
    },
  },
  {
    title: { fr: "Triez d’un geste", en: "Sort with a flick" },
    body: {
      fr: "E ou → pour garder, A ou ← pour écarter, ⌫ pour revenir. Faites glisser la photo, zoomez à la molette, double-cliquez pour la voir à 100 %.",
      en: "E or → to keep, A or ← to toss, ⌫ to go back. Drag the photo, zoom with the wheel, double-click to see it at 100%.",
    },
  },
  {
    title: { fr: "Relisez, puis appliquez", en: "Review, then apply" },
    body: {
      fr: "Rien ne bouge pendant le tri. À la fin, les photos écartées sont rangées dans « _Rejetées » ou supprimées, après votre confirmation.",
      en: "Nothing moves while you sort. At the end, tossed photos go to “_Rejected” or are deleted, once you confirm.",
    },
  },
  {
    title: { fr: "Reprenez plus tard", en: "Come back later" },
    body: {
      fr: "La progression reste dans ce navigateur. Rouvrez le même dossier et le tri reprend à la photo où vous l’aviez laissé.",
      en: "Progress stays in this browser. Open the same folder again and sorting resumes at the photo you stopped on.",
    },
  },
];

type Props = {
  onOpen: (handle: FileSystemDirectoryHandle) => void;
  onResume: (session: StoredSession) => void;
  notify: (text: string, tone?: "info" | "error" | "success") => void;
};

export default function HomeScreen({ onOpen, onResume, notify }: Props) {
  const { t } = useLocale();
  const supported = useSyncExternalStore(noop, isFileSystemAccessSupported, () => true);
  const [dragging, setDragging] = useState(false);
  // A dropped folder arrives read-only; write access must be asked for from
  // a click, which this confirmation provides.
  const [dropped, setDropped] = useState<FileSystemDirectoryHandle | null>(null);

  async function pick() {
    try {
      const handle = await window.showDirectoryPicker!({
        id: "tidyshots",
        mode: "readwrite",
        startIn: "pictures",
      });
      onOpen(handle);
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        notify(t({ fr: "Ce dossier ne peut pas être ouvert.", en: "This folder cannot be opened." }), "error");
      }
    }
  }

  // A folder dropped anywhere on the page opens it.
  useEffect(() => {
    if (!supported) return;
    let depth = 0;
    const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes("Files") ?? false;
    const enter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth++;
      setDragging(true);
    };
    const leave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const over = (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault();
    };
    const drop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);
      const item = [...(event.dataTransfer?.items ?? [])].find((entry) => entry.kind === "file");
      // Must be called during the event, before any await.
      const pending = item?.getAsFileSystemHandle?.();
      void pending?.then(async (handle) => {
        if (handle?.kind !== "directory") {
          notify(
            t({
              fr: "Déposez un dossier, pas un fichier.",
              en: "Drop a folder, not a file.",
            }),
            "error",
          );
          return;
        }
        const folder = handle as FileSystemDirectoryHandle;
        const permission = await folder
          .queryPermission({ mode: "readwrite" })
          .catch(() => "prompt" as const);
        if (permission === "granted") onOpen(folder);
        else setDropped(folder);
      });
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, [supported, onOpen, notify, t]);

  const reveal = (index: number) => ({
    initial: { y: "110%" },
    animate: { y: "0%" },
    transition: { type: "spring" as const, stiffness: 140, damping: 22, delay: 0.08 + index * 0.09 },
  });
  const fadeUp = (index: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { ...spring, delay: 0.3 + index * 0.07 },
  });

  return (
    // The demo cards fly well past the edge of the page: clip them rather
    // than let the page scroll sideways.
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <motion.div
          className="flex items-center gap-2.5"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={spring}
        >
          <Logo className="size-7 text-ink" />
          <span className="font-display text-[19px] font-bold tracking-[-0.02em]">{APP_NAME}</span>
        </motion.div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t({ fr: "Code source sur GitHub", en: "Source code on GitHub" })}
            title={t({ fr: "Code source sur GitHub", en: "Source code on GitHub" })}
            className="flex size-[30px] items-center justify-center rounded-[7px] border border-edge bg-surface text-muted transition-colors duration-200 hover:text-ink"
          >
            <GitHubMark className="size-[15px]" />
          </a>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-x-12 gap-y-16 px-6 pt-10 pb-20 lg:grid-cols-[1.15fr_1fr] lg:pt-6">
        <section>
          <h1 className="display text-[52px] sm:text-[72px] lg:text-[84px]">
            <span className="block overflow-hidden pb-[0.06em]">
              <motion.span className="block" {...reveal(0)}>
                <span className="text-keep">{t({ fr: "Gardez", en: "Keep" })}</span>{" "}
                {t({ fr: "les belles.", en: "the keepers." })}
              </motion.span>
            </span>
            <span className="block overflow-hidden pb-[0.06em]">
              <motion.span className="block" {...reveal(1)}>
                <span className="text-reject">{t({ fr: "Écartez", en: "Toss" })}</span>{" "}
                {t({ fr: "les ratées.", en: "the misses." })}
              </motion.span>
            </span>
          </h1>

          <motion.p {...fadeUp(0)} className="mt-7 max-w-[30rem] text-[17px] leading-relaxed text-muted">
            {t({
              fr: "Ouvrez un dossier de photos et décidez, une par une, au clavier ou d’un glissé. Tout se passe dans votre navigateur, et rien n’est supprimé avant que vous ayez tout relu.",
              en: "Open a folder of photos and decide, one at a time, with the keyboard or a swipe. Everything happens in your browser, and nothing is deleted until you have reviewed it all.",
            })}
          </motion.p>

          {supported ? (
            <motion.div {...fadeUp(1)} className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Button variant="primary" size="lg" onClick={() => void pick()}>
                <FolderOpen size={18} strokeWidth={2} />
                {t({ fr: "Choisir un dossier", en: "Choose a folder" })}
              </Button>
              <span className="text-[14px] text-faint">
                {t({ fr: "ou glissez-le sur la page", en: "or drop it on the page" })}
              </span>
            </motion.div>
          ) : (
            <motion.div
              {...fadeUp(1)}
              className="mt-9 flex max-w-[30rem] gap-3 rounded-[10px] border border-edge bg-surface p-4 text-[14px] leading-relaxed"
            >
              <MonitorSmartphone size={20} className="mt-0.5 shrink-0 text-reject" />
              <p>
                <strong className="font-semibold">
                  {t({ fr: "Ce navigateur ne peut pas ouvrir de dossier.", en: "This browser cannot open folders." })}
                </strong>{" "}
                <span className="text-muted">
                  {t({
                    fr: "Le tri a besoin de lire et de ranger vos fichiers. Ouvrez cette page dans Chrome, Edge, Brave ou Opera, sur ordinateur.",
                    en: "Sorting needs to read and move your files. Open this page in Chrome, Edge, Brave or Opera, on a computer.",
                  })}
                </span>
              </p>
            </motion.div>
          )}

          <motion.p {...fadeUp(2)} className="mt-10 flex items-center gap-2 text-[13px] text-faint">
            <ShieldCheck size={15} strokeWidth={1.8} />
            {t({
              fr: "Aucune photo n’est envoyée. Aucun compte. Code source ouvert.",
              en: "No photo is uploaded. No account. Open source.",
            })}
          </motion.p>
        </section>

        <motion.section
          initial={{ opacity: 0, scale: 0.94, rotate: 2 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 18, delay: 0.2 }}
          className="flex justify-center"
        >
          <HeroDeck />
        </motion.section>
      </main>

      <RecentSessions onResume={onResume} />

      <section className="mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="grid gap-x-10 gap-y-10 border-t border-rule pt-10 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ ...spring, delay: index * 0.08 }}
            >
              <p className="font-mono text-[12px] text-faint">0{index + 1}</p>
              <h2 className="mt-3 text-[16px] font-semibold">{t(step.title)}</h2>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{t(step.body)}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="border-t border-rule">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-6 text-[12.5px] text-faint">
          <p>
            {APP_NAME} · {t({ fr: "logiciel libre, licence MIT", en: "free software, MIT license" })}
          </p>
          <p className="flex items-center gap-1.5">
            <Kbd>?</Kbd>
            {t({
              fr: "pendant le tri affiche tous les raccourcis",
              en: "while sorting shows every shortcut",
            })}
          </p>
        </div>
      </footer>

      <AnimatePresence>
        {dropped && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDropped(null)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={spring}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-md rounded-[14px] border border-edge bg-surface p-6 shadow-[var(--shadow-float)]"
            >
              <FolderOpen size={26} strokeWidth={1.6} />
              <h2 className="mt-4 text-[19px] font-semibold">
                {t({ fr: `Ouvrir « ${dropped.name} » ?`, en: `Open “${dropped.name}”?` })}
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">
                {t({
                  fr: "Le navigateur va vous demander l’autorisation de modifier ce dossier. Rien n’y bouge avant votre relecture finale.",
                  en: "The browser will ask for permission to change this folder. Nothing moves in it before your final review.",
                })}
              </p>
              <div className="mt-6 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setDropped(null)}>
                  {t({ fr: "Annuler", en: "Cancel" })}
                </Button>
                <Button
                  variant="primary"
                  autoFocus
                  onClick={() => {
                    setDropped(null);
                    onOpen(dropped);
                  }}
                >
                  {t({ fr: "Continuer", en: "Continue" })}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {dragging && (
          <motion.div
            className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={spring}
              className="flex h-full max-h-[520px] w-full max-w-3xl flex-col items-center justify-center gap-4 rounded-[18px] border-2 border-dashed border-ink/40"
            >
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              >
                <FolderOpen size={44} strokeWidth={1.5} />
              </motion.div>
              <p className="display text-[34px]">
                {t({ fr: "Lâchez le dossier ici", en: "Drop the folder here" })}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
