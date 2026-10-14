"use client";

import { ArrowLeft, Check, FolderInput, Heart, Maximize2, Trash2, X } from "lucide-react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { useEffect, useRef, useState, type Dispatch } from "react";
import { companionKind } from "@/lib/formats";
import { formatBytes, formatNumber } from "@/lib/format";
import { applyRejections, REJECT_FOLDER, type ApplyMode, type ApplyResult, type Photo } from "@/lib/fs";
import { countDecisions, type SortAction, type SortState } from "@/lib/session";
import { thumbnail } from "@/lib/thumbs";
import { useLocale } from "../LocaleProvider";
import { Button, Kbd, RollingNumber, spring } from "../ui";
import Lightbox from "./Lightbox";

type Props = {
  root: FileSystemDirectoryHandle;
  folderName: string;
  photos: Photo[];
  state: SortState;
  dispatch: Dispatch<SortAction>;
  onBack: () => void;
  onDone: (result: ApplyResult) => void;
  notify: (text: string, tone?: "info" | "error" | "success") => void;
};

type Progress = { done: number; total: number; processed: Record<string, boolean> };

export default function ReviewScreen({ root, folderName, photos, state, dispatch, onBack, onDone, notify }: Props) {
  const { locale, t } = useLocale();
  // The grid keeps the photos it opened with, so one kept by mistake can be
  // tossed again with a second click.
  const [shownIds] = useState(() =>
    photos.filter((photo) => state.decisions[photo.id] === "reject").map((photo) => photo.id),
  );
  const [mode, setMode] = useState<ApplyMode>("move");
  const [withCompanions, setWithCompanions] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);

  const byId = new Map(photos.map((photo) => [photo.id, photo]));
  const shown = shownIds.map((id) => byId.get(id)).filter((photo): photo is Photo => !!photo);
  const toRemove = shown.filter((photo) => state.decisions[photo.id] === "reject");
  const counts = countDecisions(state.decisions);
  const undecided = state.ids.length - counts.decided;

  const companions = toRemove.flatMap((photo) => photo.companions);
  const bytes = toRemove.reduce(
    (sum, photo) =>
      sum + photo.size + (withCompanions ? photo.companions.reduce((n, c) => n + c.size, 0) : 0),
    0,
  );
  const kinds = [...new Set(companions.map((c) => companionKind(c.ext)))];
  const kindLabels = {
    raw: "RAW",
    live: "Live Photos",
    sidecar: "XMP / AAE",
    original: "HEIC",
  };
  const applying = progress !== null;
  const folder = REJECT_FOLDER[locale];

  function toggle(photo: Photo) {
    if (applying) return;
    const next = state.decisions[photo.id] === "reject" ? "keep" : "reject";
    dispatch({ type: "set", id: photo.id, decision: next });
  }

  async function apply() {
    setConfirming(false);
    const total = toRemove.length;
    setProgress({ done: 0, total, processed: {} });
    try {
      const result = await applyRejections(
        root,
        toRemove,
        { mode, withCompanions, folderName: folder },
        (done, photo, ok) =>
          setProgress((current) => ({
            done,
            total,
            processed: { ...(current?.processed ?? {}), [photo.id]: ok },
          })),
      );
      // Let the last tiles settle before leaving.
      await new Promise((resolve) => setTimeout(resolve, 600));
      onDone(result);
    } catch (error) {
      console.error(error);
      setProgress(null);
      notify(
        t({
          fr: "L’opération a été interrompue. Les fichiers déjà traités le restent.",
          en: "The operation stopped. Files already handled stay handled.",
        }),
        "error",
      );
    }
  }

  function start() {
    if (mode === "delete") setConfirming(true);
    else void apply();
  }

  const empty = shown.length === 0;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-6">
        <Button variant="ghost" size="sm" onClick={onBack} disabled={applying} className="-ml-3">
          <ArrowLeft size={16} />
          {t({ fr: "Revenir au tri", en: "Back to sorting" })}
        </Button>
        <span className="ml-auto truncate text-[13.5px] text-faint">{folderName}</span>
      </header>

      {empty ? (
        <EmptyState
          onBack={onBack}
          onFinish={() => onDone({ mode: "move", photos: 0, files: 0, bytes: 0, failures: [] })}
        />
      ) : (
        <>
          <section className="mx-auto w-full max-w-6xl px-6 pt-6 pb-8">
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[14px] text-muted"
            >
              {t({ fr: "Dernier regard avant de ranger", en: "One last look before tidying up" })}
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: 0.05 }}
              className="display mt-2 text-[48px] sm:text-[64px]"
            >
              <RollingNumber value={toRemove.length} locale={locale} />{" "}
              {toRemove.length > 1 || (locale === "en" && toRemove.length !== 1)
                ? t({ fr: "photos à écarter", en: "photos to toss" })
                : t({ fr: "photo à écarter", en: "photo to toss" })}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: 0.1 }}
              className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted"
            >
              {t({
                fr: "Cliquez sur une photo pour la garder finalement, ou agrandissez-la pour mieux la voir.",
                en: "Click a photo to keep it after all, or enlarge it for a better look.",
              })}{" "}
              {undecided > 0 &&
                t({
                  fr: `Les ${formatNumber(undecided, locale)} photos non triées restent où elles sont.`,
                  en: `The ${formatNumber(undecided, locale)} unsorted photos stay where they are.`,
                })}
            </motion.p>
          </section>

          <section className="mx-auto w-full max-w-6xl flex-1 px-6 pb-10">
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-3 gap-y-5">
              {shown.map((photo, index) => (
                <Tile
                  key={photo.id}
                  photo={photo}
                  index={index}
                  rescued={state.decisions[photo.id] !== "reject"}
                  processed={progress?.processed[photo.id]}
                  onToggle={() => toggle(photo)}
                  onOpen={() => setLightbox(index)}
                />
              ))}
            </ul>
          </section>

          <div className="sticky bottom-0 z-20 border-t border-rule bg-canvas">
            {applying && (
              <motion.div
                className="absolute inset-x-0 top-0 h-[3px] origin-left bg-ink"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: progress.total ? progress.done / progress.total : 1 }}
                transition={{ type: "spring", stiffness: 140, damping: 26 }}
              />
            )}
            <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-4">
              <div role="radiogroup" className="flex rounded-[10px] border border-edge bg-surface p-1">
                {(
                  [
                    {
                      id: "move",
                      icon: FolderInput,
                      label: t({ fr: `Déplacer dans « ${folder} »`, en: `Move to “${folder}”` }),
                      hint: t({ fr: "réversible", en: "reversible" }),
                    },
                    {
                      id: "delete",
                      icon: Trash2,
                      label: t({ fr: "Supprimer", en: "Delete" }),
                      hint: t({ fr: "définitif", en: "permanent" }),
                    },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={mode === option.id}
                    disabled={applying}
                    onClick={() => setMode(option.id)}
                    className={`relative flex items-center gap-2 rounded-[7px] px-3 py-2 text-[13.5px] transition-colors ${
                      mode === option.id ? "text-canvas" : "text-muted hover:text-ink"
                    }`}
                  >
                    {mode === option.id && (
                      <motion.span
                        layoutId="mode-highlight"
                        transition={spring}
                        className={`absolute inset-0 rounded-[7px] ${option.id === "delete" ? "bg-reject" : "bg-ink"}`}
                      />
                    )}
                    <option.icon size={15} className="relative" />
                    <span className="relative font-medium">{option.label}</span>
                    <span className={`relative text-[12px] ${mode === option.id ? "opacity-70" : "text-faint"}`}>
                      {option.hint}
                    </span>
                  </button>
                ))}
              </div>

              {companions.length > 0 && (
                <label className="flex cursor-pointer items-center gap-2.5 text-[13.5px] text-muted select-none">
                  <input
                    type="checkbox"
                    className="check"
                    checked={withCompanions}
                    disabled={applying}
                    onChange={(event) => setWithCompanions(event.target.checked)}
                  />
                  {t({ fr: "Avec les fichiers associés", en: "With linked files" })}
                  <span className="text-faint">
                    ({formatNumber(companions.length, locale)} : {kinds.map((kind) => kindLabels[kind]).join(", ")})
                  </span>
                </label>
              )}

              <div className="ml-auto flex items-center gap-4">
                <span className="nums text-[13px] text-muted">
                  {applying
                    ? `${formatNumber(progress.done, locale)} / ${formatNumber(progress.total, locale)}`
                    : formatBytes(bytes, locale)}
                </span>
                <Button
                  variant={mode === "delete" ? "danger" : "primary"}
                  onClick={start}
                  disabled={applying || toRemove.length === 0}
                >
                  {mode === "delete" ? <Trash2 size={16} /> : <FolderInput size={16} />}
                  {mode === "delete"
                    ? t({ fr: `Supprimer ${toRemove.length}`, en: `Delete ${toRemove.length}` })
                    : t({ fr: `Déplacer ${toRemove.length}`, en: `Move ${toRemove.length}` })}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      <Lightbox
        photos={shown}
        index={lightbox}
        decisions={state.decisions}
        onClose={() => setLightbox(null)}
        onNavigate={setLightbox}
        onToggle={toggle}
      />

      <ConfirmDelete
        open={confirming}
        count={toRemove.length}
        files={toRemove.length + (withCompanions ? companions.length : 0)}
        bytes={bytes}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void apply()}
      />
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function Tile({
  photo,
  index,
  rescued,
  processed,
  onToggle,
  onOpen,
}: {
  photo: Photo;
  index: number;
  rescued: boolean;
  processed: boolean | undefined;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const { t } = useLocale();
  const ref = useRef<HTMLLIElement>(null);
  const inView = useInView(ref, { once: true, margin: "300px 0px" });
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!inView) return;
    let alive = true;
    void thumbnail(photo).then((value) => {
      if (alive) setUrl(value);
    });
    return () => {
      alive = false;
    };
  }, [inView, photo]);

  const done = processed === true;

  return (
    <motion.li
      ref={ref}
      initial={{ opacity: 0, y: 24, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...spring, delay: Math.min(index, 24) * 0.025 }}
      className="group"
    >
      <motion.div
        animate={done ? { scale: 0.86, opacity: 0.3 } : { scale: 1, opacity: 1 }}
        transition={spring}
        className="relative aspect-square"
      >
        <motion.button
          type="button"
          onClick={onToggle}
          whileTap={{ scale: 0.95 }}
          transition={spring}
          aria-pressed={rescued}
          aria-label={`${photo.name}: ${rescued ? t({ fr: "gardée", en: "kept" }) : t({ fr: "à écarter", en: "to toss" })}`}
          className={`absolute inset-0 overflow-hidden rounded-[10px] bg-sunk ring-2 transition-[box-shadow] duration-200 ${
            rescued ? "ring-keep" : "ring-transparent hover:ring-edge"
          }`}
        >
          {url && (
            <motion.img
              src={url}
              alt=""
              draggable={false}
              initial={{ opacity: 0, scale: 1.06 }}
              animate={{ opacity: rescued ? 0.55 : 1, scale: 1 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="h-full w-full object-cover"
            />
          )}
          <AnimatePresence>
            {rescued && (
              <motion.span
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[13px] font-semibold text-white"
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-keep">
                  <Heart size={18} strokeWidth={2.6} />
                </span>
                <span className="drop-shadow">{t({ fr: "Gardée", en: "Kept" })}</span>
              </motion.span>
            )}
          </AnimatePresence>
          {!rescued && !done && (
            <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-reject text-white shadow-sm">
              <X size={13} strokeWidth={3} />
            </span>
          )}
          {done && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 600, damping: 20 }}
              className="absolute inset-0 m-auto flex size-10 items-center justify-center rounded-full bg-ink text-canvas"
            >
              <Check size={20} strokeWidth={2.6} />
            </motion.span>
          )}
        </motion.button>
        <button
          type="button"
          onClick={onOpen}
          aria-label={t({ fr: "Agrandir", en: "Enlarge" })}
          title={t({ fr: "Agrandir", en: "Enlarge" })}
          className="absolute top-2 left-2 flex size-7 items-center justify-center rounded-[6px] bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Maximize2 size={14} />
        </button>
      </motion.div>
      <p className="mt-2 truncate font-mono text-[11px] text-muted" title={photo.id}>
        {photo.name}
      </p>
    </motion.li>
  );
}

/* ------------------------------------------------------------------------ */

function EmptyState({ onBack, onFinish }: { onBack: () => void; onFinish: () => void }) {
  const { t } = useLocale();
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 14 }}
        className="flex size-20 items-center justify-center rounded-full bg-keep-soft text-keep"
      >
        <Heart size={34} strokeWidth={2.2} />
      </motion.div>
      <h1 className="display mt-8 text-[44px]">{t({ fr: "Rien à écarter", en: "Nothing to toss" })}</h1>
      <p className="mt-3 max-w-md text-[15px] text-muted">
        {t({
          fr: "Toutes les photos triées sont gardées. Le dossier reste tel quel.",
          en: "Every sorted photo is kept. The folder stays as it is.",
        })}
      </p>
      <div className="mt-8 flex gap-3">
        <Button onClick={onBack}>{t({ fr: "Revenir au tri", en: "Back to sorting" })}</Button>
        <Button variant="primary" onClick={onFinish}>
          {t({ fr: "Terminer", en: "Finish" })}
        </Button>
      </div>
    </div>
  );
}

function ConfirmDelete({
  open,
  count,
  files,
  bytes,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  count: number;
  files: number;
  bytes: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { locale, t } = useLocale();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={spring}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md rounded-[14px] border border-edge bg-surface p-6 shadow-[var(--shadow-float)]"
          >
            <motion.div
              initial={{ rotate: 0 }}
              animate={{ rotate: [0, -12, 10, -6, 0] }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="flex size-11 items-center justify-center rounded-full bg-reject-soft text-reject"
            >
              <Trash2 size={20} />
            </motion.div>
            <h2 className="mt-5 text-[19px] font-semibold">
              {t({
                fr: `Supprimer définitivement ${formatNumber(count, locale)} photo${count > 1 ? "s" : ""} ?`,
                en: `Delete ${formatNumber(count, locale)} photo${count === 1 ? "" : "s"} for good?`,
              })}
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">
              {t({
                fr: `${formatNumber(files, locale)} fichier${files > 1 ? "s" : ""}, ${formatBytes(bytes, locale)}. Le navigateur les efface directement : ils ne passent pas par la corbeille et ne pourront pas être récupérés.`,
                en: `${formatNumber(files, locale)} file${files === 1 ? "" : "s"}, ${formatBytes(bytes, locale)}. The browser erases them directly: they skip the Trash and cannot be recovered.`,
              })}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button onClick={onCancel} autoFocus>
                {t({ fr: "Annuler", en: "Cancel" })}
              </Button>
              <Button variant="danger" onClick={onConfirm}>
                {t({ fr: "Supprimer", en: "Delete" })}
              </Button>
            </div>
            <p className="mt-4 flex items-center gap-1.5 text-[12px] text-faint">
              <Kbd>{t({ fr: "Échap", en: "Esc" })}</Kbd> {t({ fr: "pour annuler", en: "to cancel" })}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
