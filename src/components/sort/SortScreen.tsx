"use client";

import {
  ArrowLeft,
  ArrowRight,
  CircleHelp,
  Heart,
  Maximize,
  Minimize,
  Scan,
  Undo2,
  X,
} from "lucide-react";
import {
  AnimatePresence,
  motion,
  useAnimate,
  useMotionValue,
  useTransform,
  type MotionValue,
} from "motion/react";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
} from "react";
import { readMeta, type PhotoMeta } from "@/lib/exif";
import { formatBytes, formatDate, formatExposure, formatNumber } from "@/lib/format";
import type { Photo } from "@/lib/fs";
import { PhotoLoader } from "@/lib/loader";
import { countDecisions, type Decision, type SortAction, type SortState } from "@/lib/session";
import { useLocale } from "../LocaleProvider";
import { Button, IconButton, Kbd, RollingNumber, spring } from "../ui";
import Ambient from "./Ambient";
import CardStack, { type StackHandle, type ZoomReport } from "./CardStack";
import HelpOverlay from "./HelpOverlay";
import ProgressRail from "./ProgressRail";

type Props = {
  folderName: string;
  photoById: Map<string, Photo>;
  state: SortState;
  dispatch: Dispatch<SortAction>;
  onExit: () => void;
  onFinish: () => void;
};

type Pulse = { kind: Decision | "undo"; seq: number } | null;

export default function SortScreen({ folderName, photoById, state, dispatch, onExit, onFinish }: Props) {
  const { locale, t } = useLocale();
  const [loader] = useState(() => new PhotoLoader());
  const stack = useRef<StackHandle>(null);
  const dragX = useMotionValue(0);
  const [help, setHelp] = useState(false);
  const [pulse, setPulse] = useState<Pulse>(null);
  const [zoom, setZoom] = useState<ZoomReport>(null);
  const [meta, setMeta] = useState<{ id: string; meta: PhotoMeta | null } | null>(null);
  const fullscreen = useSyncExternalStore(
    (notify) => {
      document.addEventListener("fullscreenchange", notify);
      return () => document.removeEventListener("fullscreenchange", notify);
    },
    () => document.fullscreenElement !== null,
    () => false,
  );

  const { ids, index, decisions, last } = state;
  const total = ids.length;
  const currentId = ids[index];
  const nextId = ids[index + 1];
  const photo = currentId ? photoById.get(currentId) : undefined;
  const counts = countDecisions(decisions);

  useEffect(() => () => loader.dispose(), [loader]);

  // Reads the photos around the current one, the current one first.
  useEffect(() => {
    let cancelled = false;
    const order = [0, 1, 2, -1, 3, 4]
      .map((offset) => ids[index + offset])
      .filter((id): id is string => id !== undefined);
    loader.retain(new Set([...order, ids[index - 2]].filter(Boolean)));
    void (async () => {
      for (const id of order) {
        if (cancelled) return;
        const item = photoById.get(id);
        if (item) await loader.load(item);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ids, index, loader, photoById]);

  const currentLoaded = useSyncExternalStore(
    loader.subscribe,
    () => loader.peek(currentId),
    () => undefined,
  );
  const nextLoaded = useSyncExternalStore(
    loader.subscribe,
    () => loader.peek(nextId),
    () => undefined,
  );

  // EXIF of the photo on screen.
  useEffect(() => {
    if (!currentId || currentLoaded?.status !== "ready") return;
    let alive = true;
    void readMeta(currentId, currentLoaded.file).then((value) => {
      if (alive) setMeta({ id: currentId, meta: value });
    });
    return () => {
      alive = false;
    };
  }, [currentId, currentLoaded]);
  const currentMeta = meta?.id === currentId ? meta.meta : null;

  // The last card has flown: on to the review.
  const finished = index >= total;
  useEffect(() => {
    if (!finished) return;
    const timer = setTimeout(onFinish, 550);
    return () => clearTimeout(timer);
  }, [finished, onFinish]);

  function decide(decision: Decision) {
    if (finished) return;
    dispatch({ type: "decide", decision });
    setPulse((previous) => ({ kind: decision, seq: (previous?.seq ?? 0) + 1 }));
  }

  function undo() {
    if (index === 0) return;
    dispatch({ type: "back" });
    setPulse((previous) => ({ kind: "undo", seq: (previous?.seq ?? 0) + 1 }));
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => {});
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (help) return;
      const target = event.target;
      if (target instanceof Element && target.closest("input, select, textarea, [contenteditable]")) return;
      const key = event.key.toLowerCase();
      if (event.metaKey || event.ctrlKey) {
        if (key === "z") {
          event.preventDefault();
          undo();
        }
        return;
      }
      if (event.altKey) return;
      switch (key) {
        case "e":
        case "arrowright":
          // A held key would sweep through the folder.
          if (!event.repeat) decide("keep");
          break;
        case "a":
        case "arrowleft":
          if (!event.repeat) decide("reject");
          break;
        case "backspace":
          undo();
          break;
        case "+":
        case "=":
          stack.current?.zoomBy(1.5);
          break;
        case "-":
        case "_":
          stack.current?.zoomBy(1 / 1.5);
          break;
        case "0":
        case "escape":
          stack.current?.fit();
          break;
        case "1":
          stack.current?.actual();
          break;
        case "f":
          toggleFullscreen();
          break;
        case "?":
        case "h":
          setHelp(true);
          break;
        default:
          return;
      }
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const current = currentId
    ? { id: currentId, loaded: currentLoaded, decision: decisions[currentId] }
    : null;
  const next = nextId ? { id: nextId, loaded: nextLoaded } : null;
  const ambientUrl = currentLoaded?.status === "ready" ? currentLoaded.url : null;

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <Ambient id={currentId ?? null} url={ambientUrl} />

      <header className="relative z-20 flex h-14 shrink-0 items-center gap-2 px-3 sm:px-4">
        <IconButton label={t({ fr: "Retour à l’accueil", en: "Back to home" })} onClick={onExit}>
          <ArrowLeft size={18} />
        </IconButton>
        <div className="flex min-w-0 items-baseline gap-2.5">
          <span className="truncate font-medium">{folderName}</span>
          <span className="shrink-0 font-mono text-[12.5px] text-muted">
            <RollingNumber value={Math.min(index + 1, total)} locale={locale} /> / {formatNumber(total, locale)}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <div className="mr-2 hidden items-center gap-4 font-mono text-[13px] sm:flex">
            <span className="inline-flex items-center gap-1.5 text-keep" title={t({ fr: "Gardées", en: "Kept" })}>
              <Heart size={13} strokeWidth={2.6} />
              <RollingNumber value={counts.kept} locale={locale} />
            </span>
            <span className="inline-flex items-center gap-1.5 text-reject" title={t({ fr: "Écartées", en: "Tossed" })}>
              <X size={14} strokeWidth={2.6} />
              <RollingNumber value={counts.rejected} locale={locale} />
            </span>
          </div>
          <IconButton label={t({ fr: "Raccourcis (?)", en: "Shortcuts (?)" })} onClick={() => setHelp(true)}>
            <CircleHelp size={18} />
          </IconButton>
          <IconButton
            label={fullscreen ? t({ fr: "Quitter le plein écran (F)", en: "Exit full screen (F)" }) : t({ fr: "Plein écran (F)", en: "Full screen (F)" })}
            onClick={toggleFullscreen}
          >
            {fullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
          </IconButton>
          <Button variant="primary" size="sm" className="ml-1" onClick={onFinish}>
            {t({ fr: "Terminer", en: "Finish" })}
            <ArrowRight size={15} />
          </Button>
        </div>
      </header>

      <div className="relative z-20 shrink-0 px-4 sm:px-6">
        <ProgressRail
          ids={ids}
          decisions={decisions}
          index={index}
          onJump={(target) => dispatch({ type: "jump", index: target })}
        />
      </div>

      <main className="relative z-10 grid min-h-0 flex-1 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-5 sm:gap-8 sm:px-8">
        <DecisionButton
          kind="reject"
          label={t({ fr: "Écarter", en: "Toss" })}
          keys={["A", "←"]}
          dragX={dragX}
          pulse={pulse?.kind === "reject" ? pulse.seq : 0}
          onClick={() => decide("reject")}
          disabled={finished}
        />
        <div className="relative h-full min-h-0">
          <CardStack
            ref={stack}
            current={current}
            next={next}
            last={last}
            dragX={dragX}
            onSwipe={decide}
            onZoomChange={setZoom}
          />
          <AnimatePresence>
            {finished && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ ...spring, delay: 0.15 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <p className="display text-[40px] text-muted">
                  {t({ fr: "Dossier terminé", en: "Folder done" })}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <DecisionButton
          kind="keep"
          label={t({ fr: "Garder", en: "Keep" })}
          keys={["E", "→"]}
          dragX={dragX}
          pulse={pulse?.kind === "keep" ? pulse.seq : 0}
          onClick={() => decide("keep")}
          disabled={finished}
        />
      </main>

      <footer className="relative z-20 grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-4 sm:px-6">
        <InfoLine photo={photo} loaded={currentLoaded} meta={currentMeta} />

        <motion.div
          key={pulse?.kind === "undo" ? pulse.seq : "undo"}
          animate={pulse?.kind === "undo" ? { rotate: [0, -24, 0] } : undefined}
          transition={{ duration: 0.35 }}
        >
          <Button variant="ghost" size="sm" onClick={undo} disabled={index === 0}>
            <Undo2 size={15} />
            {t({ fr: "Annuler", en: "Undo" })}
            <Kbd className="ml-1">⌫</Kbd>
          </Button>
        </motion.div>

        <div className="flex items-center justify-end gap-3 text-[12.5px] text-muted">
          <AnimatePresence initial={false}>
            {zoom && (
              <motion.button
                key="zoom"
                type="button"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                onClick={() => (zoom.fit ? stack.current?.actual() : stack.current?.fit())}
                className="nums inline-flex items-center gap-1.5 rounded-[6px] px-2 py-1 font-mono transition-colors hover:bg-ink/6 hover:text-ink"
                title={zoom.fit ? t({ fr: "Voir à 100 % (1)", en: "View at 100% (1)" }) : t({ fr: "Ajuster (0)", en: "Fit (0)" })}
              >
                <Scan size={13} />
                {zoom.fit ? t({ fr: "Ajustée", en: "Fit" }) + " · " : ""}
                {zoom.percent} %
              </motion.button>
            )}
          </AnimatePresence>
          <span className="hidden items-center gap-1.5 lg:flex">
            <Kbd>?</Kbd> {t({ fr: "aide", en: "help" })}
          </span>
        </div>
      </footer>

      <HelpOverlay open={help} onClose={() => setHelp(false)} />
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function DecisionButton({
  kind,
  label,
  keys,
  dragX,
  pulse,
  onClick,
  disabled,
}: {
  kind: Decision;
  label: string;
  keys: string[];
  dragX: MotionValue<number>;
  pulse: number;
  onClick: () => void;
  disabled: boolean;
}) {
  const keep = kind === "keep";
  const [scope, animateScope] = useAnimate<HTMLButtonElement>();
  // The button leans in as the card is dragged towards it.
  const scale = useTransform(dragX, keep ? [0, 170] : [-170, 0], keep ? [1, 1.22] : [1.22, 1]);
  const tint = useTransform(dragX, keep ? [0, 170] : [-170, 0], keep ? [0, 1] : [1, 0]);

  useEffect(() => {
    if (!pulse || !scope.current) return;
    void animateScope(scope.current, { scale: [1, 0.84, 1.08, 1] }, { duration: 0.38, ease: "easeOut" });
  }, [pulse, scope, animateScope]);

  const Icon = keep ? Heart : X;

  return (
    <div className="flex flex-col items-center gap-3">
      <motion.div style={{ scale }} className="relative">
        {/* A ripple for each decision taken from the keyboard. */}
        <AnimatePresence>
          {pulse > 0 && (
            <motion.span
              key={pulse}
              initial={{ scale: 1, opacity: 0.55 }}
              animate={{ scale: 1.9, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              className={`pointer-events-none absolute inset-0 rounded-full border-2 ${keep ? "border-keep" : "border-reject"}`}
            />
          )}
        </AnimatePresence>
        <motion.button
          ref={scope}
          type="button"
          aria-label={label}
          title={`${label} (${keys.join(", ")})`}
          onClick={onClick}
          disabled={disabled}
          whileHover={{ scale: 1.07 }}
          whileTap={{ scale: 0.9 }}
          transition={spring}
          className={`relative flex size-14 items-center justify-center overflow-hidden rounded-full border-2 bg-surface shadow-[var(--shadow-card)] transition-colors disabled:opacity-40 sm:size-[72px] ${
            keep ? "border-keep/45 text-keep hover:border-keep" : "border-reject/45 text-reject hover:border-reject"
          }`}
        >
          <motion.span
            className={`absolute inset-0 ${keep ? "bg-keep-soft" : "bg-reject-soft"}`}
            style={{ opacity: tint }}
          />
          <Icon className="relative size-6 sm:size-8" strokeWidth={keep ? 2.4 : 2.8} />
        </motion.button>
      </motion.div>
      <span className="hidden text-[12.5px] font-medium text-muted sm:block">{label}</span>
      <span className="hidden gap-1 sm:flex">
        {keys.map((key) => (
          <Kbd key={key}>{key}</Kbd>
        ))}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function InfoLine({
  photo,
  loaded,
  meta,
}: {
  photo: Photo | undefined;
  loaded: ReturnType<PhotoLoader["peek"]>;
  meta: PhotoMeta | null;
}) {
  const { locale } = useLocale();
  if (!photo) return <div />;

  const parts: string[] = [];
  if (loaded?.status === "ready") parts.push(`${loaded.width} × ${loaded.height}`);
  parts.push(formatBytes(photo.size, locale));
  parts.push(formatDate(meta?.taken ?? photo.lastModified, locale));
  const exposure = [
    meta?.camera,
    meta?.aperture ? `ƒ/${Number(meta.aperture.toFixed(1))}` : null,
    meta?.exposure ? formatExposure(meta.exposure) : null,
    meta?.iso ? `ISO ${meta.iso}` : null,
  ].filter(Boolean);

  return (
    <div className="relative min-w-0">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={photo.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="min-w-0"
        >
          <p className="truncate font-mono text-[12.5px] font-medium">
            {photo.dir && <span className="text-faint">{photo.dir}/</span>}
            {photo.name}
            {photo.companions.length > 0 && (
              <span className="ml-2 text-faint">
                + {photo.companions.map((c) => c.ext.toUpperCase()).join(", ")}
              </span>
            )}
          </p>
          <p className="truncate text-[12px] text-muted">
            {parts.join(" · ")}
            {exposure.length > 0 && <span className="text-faint"> · {exposure.join(" · ")}</span>}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
