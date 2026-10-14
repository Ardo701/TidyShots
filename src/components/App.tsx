"use client";

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  ensureWritable,
  scanFolder,
  type ApplyResult,
  type Photo,
  type ScanOptions,
  type ScanProgress,
} from "@/lib/fs";
import { findSession, newSessionKey, saveSession, deleteSession, type StoredSession } from "@/lib/persist";
import { clearThumbnails } from "@/lib/thumbs";
import {
  countDecisions,
  createSortState,
  sortReducer,
  type SortAction,
  type SortState,
} from "@/lib/session";
import DoneScreen from "./DoneScreen";
import HomeScreen from "./home/HomeScreen";
import { useLocale } from "./LocaleProvider";
import ReviewScreen from "./review/ReviewScreen";
import ScanScreen from "./ScanScreen";
import SortScreen from "./sort/SortScreen";
import { Toasts, type Toast } from "./ui";

type Screen =
  | { name: "home" }
  | { name: "scanning"; folder: string; progress: ScanProgress }
  | { name: "sorting" }
  | { name: "review" }
  | { name: "done"; result: ApplyResult; total: number; kept: number; undecided: number };

type Folder = {
  handle: FileSystemDirectoryHandle;
  name: string;
  options: ScanOptions;
  key: string;
};

type AppAction = SortAction | { type: "reset"; state: SortState };

const EMPTY: SortState = { ids: [], decisions: {}, index: 0, last: null };

function appReducer(state: SortState, action: AppAction): SortState {
  return action.type === "reset" ? action.state : sortReducer(state, action);
}

/** Keeps the scanning screen up long enough for its animation to read. */
const MIN_SCAN_MS = 900;

/* Like the original tool: the chosen folder only, in file name order. */
const SCAN_OPTIONS: ScanOptions = { recursive: false, order: "name" };

export default function App() {
  const { t } = useLocale();
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [folder, setFolder] = useState<Folder | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [sort, dispatch] = useReducer(appReducer, EMPTY);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const notify = useCallback((text: string, tone: Toast["tone"] = "info") => {
    const id = ++toastId.current;
    setToasts((list) => [...list.slice(-2), { id, tone, text }]);
    setTimeout(() => setToasts((list) => list.filter((toast) => toast.id !== id)), 5200);
  }, []);

  const photoById = useMemo(() => new Map(photos.map((photo) => [photo.id, photo])), [photos]);

  /* ---------------------------------------------------------------------- */
  /* Opening a folder                                                        */
  /* ---------------------------------------------------------------------- */

  async function openFolder(handle: FileSystemDirectoryHandle, stored?: StoredSession) {
    const scanOptions = stored?.options ?? SCAN_OPTIONS;
    const started = performance.now();
    setScreen({ name: "scanning", folder: handle.name, progress: { phase: "listing", found: 0, read: 0 } });

    try {
      if (!(await ensureWritable(handle))) {
        notify(
          t({
            fr: "Sans l’accès en écriture, impossible de ranger ce dossier.",
            en: "Without write access this folder cannot be sorted.",
          }),
          "error",
        );
        setScreen({ name: "home" });
        return;
      }

      const result = await scanFolder(handle, scanOptions, (progress) =>
        setScreen((current) => (current.name === "scanning" ? { ...current, progress } : current)),
      );

      if (result.photos.length === 0) {
        notify(
          result.skipped > 0
            ? t({
                fr: `Aucune photo lisible ici : ${result.skipped} fichiers HEIC, RAW ou TIFF ne peuvent pas être affichés par le navigateur.`,
                en: `No readable photo here: ${result.skipped} HEIC, RAW or TIFF files cannot be shown by the browser.`,
              })
            : t({
                fr: "Aucune photo (JPEG, PNG, WebP, AVIF, GIF) dans ce dossier.",
                en: "No photo (JPEG, PNG, WebP, AVIF, GIF) in this folder.",
              }),
          "error",
        );
        setScreen({ name: "home" });
        return;
      }

      const session = stored ?? (await findSession(handle));
      const ids = result.photos.map((photo) => photo.id);
      const state = createSortState(ids, session?.decisions, session?.currentId);
      const restored = countDecisions(state.decisions).decided;

      const wait = MIN_SCAN_MS - (performance.now() - started);
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));

      clearThumbnails();
      dispatch({ type: "reset", state });
      setPhotos(result.photos);
      setFolder({
        handle,
        name: handle.name,
        options: scanOptions,
        key: session?.key ?? newSessionKey(),
      });
      setScreen(state.index >= ids.length ? { name: "review" } : { name: "sorting" });

      if (restored > 0) {
        notify(
          t({
            fr: `Reprise là où vous en étiez : ${restored} ${restored > 1 ? "décisions retrouvées" : "décision retrouvée"}.`,
            en: `Picking up where you left off: ${restored} ${restored === 1 ? "decision" : "decisions"} restored.`,
          }),
          "success",
        );
      }
      if (result.skipped > 0) {
        notify(
          t({
            fr: `${result.skipped} ${result.skipped > 1 ? "fichiers HEIC, RAW ou TIFF ignorés" : "fichier HEIC, RAW ou TIFF ignoré"} : le navigateur ne sait pas les afficher.`,
            en: `${result.skipped} HEIC, RAW or TIFF ${result.skipped === 1 ? "file" : "files"} skipped: the browser cannot show them.`,
          }),
        );
      }
    } catch (error) {
      console.error(error);
      notify(
        t({ fr: "Lecture du dossier impossible.", en: "The folder could not be read." }),
        "error",
      );
      setScreen({ name: "home" });
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Remembering the session                                                 */
  /* ---------------------------------------------------------------------- */

  const snapshot = useCallback((): StoredSession | null => {
    if (!folder || sort.ids.length === 0) return null;
    const counts = countDecisions(sort.decisions);
    return {
      key: folder.key,
      name: folder.name,
      handle: folder.handle,
      options: folder.options,
      decisions: sort.decisions,
      currentId: sort.ids[sort.index] ?? null,
      total: sort.ids.length,
      decided: counts.decided,
      rejected: counts.rejected,
      updatedAt: Date.now(),
    };
  }, [folder, sort]);

  const active = screen.name === "sorting" || screen.name === "review";

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => {
      const session = snapshot();
      if (session) void saveSession(session);
    }, 350);
    return () => clearTimeout(timer);
  }, [active, snapshot]);

  // Closing the tab mid-debounce must not lose the last decisions.
  const latest = useRef(snapshot);
  useEffect(() => {
    latest.current = active ? snapshot : () => null;
  }, [active, snapshot]);
  useEffect(() => {
    const flush = () => {
      const session = latest.current();
      if (session) void saveSession(session);
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);

  // Development only: lets browser automation open a folder (for instance
  // one built in the origin private file system) without the native picker.
  // The whole block is dropped from production builds.
  const openRef = useRef(openFolder);
  useEffect(() => {
    openRef.current = openFolder;
  });
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const testWindow = window as unknown as { __tidyshots?: unknown };
    testWindow.__tidyshots = {
      open: (handle: FileSystemDirectoryHandle) => openRef.current(handle),
    };
    return () => {
      delete testWindow.__tidyshots;
    };
  }, []);

  /* ---------------------------------------------------------------------- */

  function goHome() {
    const session = snapshot();
    if (session) void saveSession(session);
    setScreen({ name: "home" });
  }

  function finishApply(result: ApplyResult) {
    const counts = countDecisions(sort.decisions);
    if (folder) void deleteSession(folder.key);
    setScreen({
      name: "done",
      result,
      total: sort.ids.length,
      kept: counts.kept,
      undecided: sort.ids.length - counts.decided,
    });
  }

  function backToSorting() {
    if (sort.index >= sort.ids.length) dispatch({ type: "jump", index: sort.ids.length - 1 });
    setScreen({ name: "sorting" });
  }

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={screen.name}
          initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
          // A leftover filter would trap position: fixed children.
          animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
          exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        >
          {screen.name === "home" && (
            <HomeScreen
              onOpen={(handle) => void openFolder(handle)}
              onResume={(session) => void openFolder(session.handle, session)}
              notify={notify}
            />
          )}
          {screen.name === "scanning" && (
            <ScanScreen folder={screen.folder} progress={screen.progress} />
          )}
          {screen.name === "sorting" && folder && (
            <SortScreen
              folderName={folder.name}
              photoById={photoById}
              state={sort}
              dispatch={dispatch}
              onExit={goHome}
              onFinish={() => setScreen({ name: "review" })}
            />
          )}
          {screen.name === "review" && folder && (
            <ReviewScreen
              root={folder.handle}
              folderName={folder.name}
              photos={photos}
              state={sort}
              dispatch={dispatch}
              onBack={backToSorting}
              onDone={finishApply}
              notify={notify}
            />
          )}
          {screen.name === "done" && (
            <DoneScreen
              folderName={folder?.name ?? ""}
              result={screen.result}
              total={screen.total}
              kept={screen.kept}
              undecided={screen.undecided}
              onHome={() => setScreen({ name: "home" })}
            />
          )}
        </motion.div>
      </AnimatePresence>
      <Toasts toasts={toasts} onDismiss={(id) => setToasts((list) => list.filter((x) => x.id !== id))} />
      {/* Screen readers hear where they are after each transition. */}
      <p className="sr-only" aria-live="polite">
        {screen.name === "sorting" && t({ fr: "Tri en cours", en: "Sorting" })}
        {screen.name === "review" && t({ fr: "Relecture", en: "Review" })}
        {screen.name === "done" && t({ fr: "Terminé", en: "Done" })}
      </p>
    </MotionConfig>
  );
}
