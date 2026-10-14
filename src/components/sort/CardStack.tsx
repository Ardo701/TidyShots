"use client";

import { Heart, ImageOff, X } from "lucide-react";
import {
  animate,
  motion,
  useMotionValue,
  useTransform,
  type MotionValue,
  type Transition,
} from "motion/react";
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import type { LoadedPhoto } from "@/lib/loader";
import type { Decision, LastAction } from "@/lib/session";
import { Stamp } from "../home/HeroDeck";
import { useLocale } from "../LocaleProvider";

export type CardInfo = { id: string; loaded: LoadedPhoto | undefined; decision?: Decision };

export type StackHandle = {
  zoomBy: (factor: number) => void;
  fit: () => void;
  actual: () => void;
};

export type ZoomReport = { fit: boolean; percent: number } | null;

type Area = { width: number; height: number };

type View = { id: string | null; zoom: number; x: number; y: number; animate: boolean };

type Exiting = { id: string; info: CardInfo; kind: "fly" | "sink" | "fade"; dir: 1 | -1 };

type Role = "current" | "next" | "exit";

const FIT: View = { id: null, zoom: 1, x: 0, y: 0, animate: false };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/* The card hugs the photo, like a print, and never enlarges it past 100%. */
function cardSize(loaded: LoadedPhoto | undefined, area: Area) {
  const maxW = area.width;
  const maxH = area.height;
  if (!loaded || loaded.status !== "ready") {
    const w = Math.min(maxW, maxH * 1.5) * 0.92;
    return { width: w, height: w / 1.5 };
  }
  const scale = Math.min(maxW / loaded.width, maxH / loaded.height, 1);
  return { width: Math.round(loaded.width * scale), height: Math.round(loaded.height * scale) };
}

/** Zoom level at which one photo pixel is one screen pixel. */
function actualZoom(loaded: LoadedPhoto | undefined, cardWidth: number) {
  if (!loaded || loaded.status !== "ready" || !cardWidth) return 1;
  return loaded.width / window.devicePixelRatio / cardWidth;
}

function clampPan(view: View, width: number, height: number): View {
  const maxX = (width * view.zoom - width) / 2;
  const maxY = (height * view.zoom - height) / 2;
  return { ...view, x: clamp(view.x, -maxX, maxX), y: clamp(view.y, -maxY, maxY) };
}

/** Zooms around a point given relative to the card's centre. */
function zoomAt(
  view: View,
  zoom: number,
  px: number,
  py: number,
  size: { width: number; height: number },
  maxZoom: number,
  animated: boolean,
): View {
  const next = clamp(zoom, 1, maxZoom);
  const k = next / view.zoom;
  return clampPan(
    { ...view, zoom: next, x: px - (px - view.x) * k, y: py - (py - view.y) * k, animate: animated },
    size.width,
    size.height,
  );
}

type Props = {
  current: CardInfo | null;
  next: CardInfo | null;
  last: LastAction;
  dragX: MotionValue<number>;
  onSwipe: (decision: Decision) => void;
  onZoomChange: (report: ZoomReport) => void;
  ref?: Ref<StackHandle>;
};

export default function CardStack({ current, next, last, dragX, onSwipe, onZoomChange, ref }: Props) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState<Area>({ width: 0, height: 0 });
  const [view, setView] = useState<View>(FIT);

  useEffect(() => {
    const element = areaRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setArea({ width: Math.round(width), height: Math.round(height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  /* Cards leaving the screen stay mounted, under the same key, until their
     animation ends. Keeping the key means a card swiped away and brought
     back by Undo reverses mid-flight instead of popping in. */
  const currentId = current?.id ?? null;
  const nextId = next?.id ?? null;
  const [previous, setPrevious] = useState({ currentId, nextId, current, next });
  const [exiting, setExiting] = useState<Exiting[]>([]);

  const idsChanged = previous.currentId !== currentId || previous.nextId !== nextId;
  if (
    !idsChanged &&
    (previous.current?.loaded !== current?.loaded ||
      previous.next?.loaded !== next?.loaded ||
      previous.current?.decision !== current?.decision)
  ) {
    // Same cards, fresher content: a card that leaves later must carry its
    // photo, not the spinner it had before loading.
    setPrevious({ currentId, nextId, current, next });
  }
  if (idsChanged) {
    const visible = new Set([currentId, nextId]);
    const leaving: Exiting[] = [];
    if (previous.currentId && previous.current && !visible.has(previous.currentId)) {
      const flew = last?.kind === "decide" && last.id === previous.currentId;
      leaving.push({
        id: previous.currentId,
        info: previous.current,
        kind: flew ? "fly" : last?.kind === "jump" ? "fade" : "sink",
        dir: flew && last.decision === "keep" ? 1 : -1,
      });
    }
    if (previous.nextId && previous.next && !visible.has(previous.nextId)) {
      leaving.push({ id: previous.nextId, info: previous.next, kind: "sink", dir: 1 });
    }
    setExiting((list) => [
      ...list.filter((item) => !visible.has(item.id) && !leaving.some((l) => l.id === item.id)),
      ...leaving,
    ]);
    setPrevious({ currentId, nextId, current, next });
  }

  const currentView = view.id === currentId ? view : FIT;
  const currentSize = current ? cardSize(current.loaded, area) : { width: 0, height: 0 };
  const maxZoom = Math.max(4, actualZoom(current?.loaded, currentSize.width) * 4);

  /* Updates read the latest view, so a burst of wheel events between two
     renders never loses a step. */
  function updateView(change: (view: View) => View) {
    if (!currentId) return;
    setView((view) => change(view.id === currentId ? view : { ...FIT, id: currentId }));
  }

  function setZoom(zoom: number, px = 0, py = 0, animated = true) {
    updateView((view) => zoomAt(view, zoom, px, py, currentSize, maxZoom, animated));
  }

  function toggleActual(px = 0, py = 0) {
    if (currentView.zoom > 1.01) setZoom(1, 0, 0);
    else setZoom(Math.max(actualZoom(current?.loaded, currentSize.width), 2), px, py);
  }

  useImperativeHandle(ref, () => ({
    zoomBy: (factor) =>
      updateView((view) => zoomAt(view, view.zoom * factor, 0, 0, currentSize, maxZoom, true)),
    fit: () => setZoom(1),
    actual: () => toggleActual(),
  }));

  // Reports the zoom, in screen pixels per photo pixel, for the status bar.
  const loaded = current?.loaded;
  const fitted = currentView.zoom <= 1.001;
  const percent =
    loaded?.status === "ready" && currentSize.width
      ? Math.round(((currentSize.width * currentView.zoom) / loaded.width) * 100 * (typeof window === "undefined" ? 1 : window.devicePixelRatio))
      : 0;
  useEffect(() => {
    onZoomChange(percent ? { fit: fitted, percent } : null);
  }, [fitted, percent, onZoomChange]);

  const cards: { info: CardInfo; role: Role; exit?: Exiting }[] = [
    ...(next ? [{ info: next, role: "next" as const }] : []),
    ...(current ? [{ info: current, role: "current" as const }] : []),
    ...exiting.map((exit) => ({ info: exit.info, role: "exit" as const, exit })),
  ];

  return (
    <div ref={areaRef} className="relative h-full min-h-0 w-full">
      {area.width > 0 &&
        cards.map(({ info, role, exit }) => (
          <Card
            key={info.id}
            info={info}
            role={role}
            exit={exit}
            area={area}
            last={last}
            view={role === "current" ? currentView : FIT}
            dragX={dragX}
            onSwipe={onSwipe}
            onExited={(id) => setExiting((list) => list.filter((item) => item.id !== id))}
            onWheelZoom={(factor, px, py) =>
              updateView((view) => zoomAt(view, view.zoom * factor, px, py, currentSize, maxZoom, false))
            }
            onToggleZoom={toggleActual}
            onPan={(x, y) =>
              updateView((view) =>
                clampPan({ ...view, x, y, animate: false }, currentSize.width, currentSize.height),
              )
            }
          />
        ))}
    </div>
  );
}

/* ------------------------------------------------------------------------ */

type CardProps = {
  info: CardInfo;
  role: Role;
  exit?: Exiting;
  area: Area;
  last: LastAction;
  view: View;
  dragX: MotionValue<number>;
  onSwipe: (decision: Decision) => void;
  onExited: (id: string) => void;
  onWheelZoom: (factor: number, px: number, py: number) => void;
  onToggleZoom: (px: number, py: number) => void;
  onPan: (x: number, y: number) => void;
};

const settle: Transition = { type: "spring", stiffness: 340, damping: 32, mass: 0.9 };

function Card({
  info,
  role,
  exit,
  area,
  last,
  view,
  dragX,
  onSwipe,
  onExited,
  onWheelZoom,
  onToggleZoom,
  onPan,
}: CardProps) {
  const { t } = useLocale();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-600, 0, 600], [-20, 0, 20], { clamp: false });
  const keepOpacity = useTransform(x, [24, 130], [0, 1]);
  const rejectOpacity = useTransform(x, [-130, -24], [1, 0]);
  const keepWash = useTransform(x, [0, 260], [0, 0.28]);
  const rejectWash = useTransform(x, [-260, 0], [0.28, 0]);

  const size = cardSize(info.loaded, area);
  const cardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    pointer: number;
    startX: number;
    startY: number;
    mode: "swipe" | "pan";
    panX: number;
    panY: number;
    moved: boolean;
  } | null>(null);

  // Where a card appears from: the side it was sent to when Undo brings it
  // back, deeper in the pile when it is the next one.
  const [initial] = useState(() => {
    if (role === "current" && last?.kind === "back" && last.id === info.id) {
      const dir = last.undone === "keep" ? 1 : -1;
      return { x: dir * (area.width / 2 + size.width), y: 30, scale: 1, opacity: 1 };
    }
    if (role === "next") return { x: 0, y: 40, scale: 0.86, opacity: 0 };
    return { x: 0, y: 0, scale: 0.94, opacity: 0 };
  });

  let target: Record<string, number>;
  let transition: Transition = settle;
  if (role === "current") {
    target = { x: 0, y: 0, scale: 1, opacity: 1 };
  } else if (role === "next") {
    target = { x: 0, y: 18, scale: 0.92, opacity: 1 };
  } else if (exit?.kind === "fly") {
    target = { x: exit.dir * (area.width / 2 + size.width * 0.9), y: 50, scale: 1, opacity: 0 };
    transition = {
      x: { type: "spring", stiffness: 170, damping: 24 },
      y: { type: "spring", stiffness: 170, damping: 24 },
      opacity: { duration: 0.22, delay: 0.16 },
    };
  } else if (exit?.kind === "sink") {
    target = { x: 0, y: 40, scale: 0.86, opacity: 0 };
    transition = { duration: 0.25, ease: [0.4, 0, 1, 1] };
  } else {
    target = { x: 0, y: 0, scale: 0.96, opacity: 0 };
    transition = { duration: 0.18 };
  }

  const interactive = role === "current";

  // Wheel zoom needs a non-passive listener to stop the page from scrolling.
  useEffect(() => {
    const element = cardRef.current;
    if (!element || !interactive) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const px = event.clientX - (rect.left + rect.width / 2);
      const py = event.clientY - (rect.top + rect.height / 2);
      // Pinch on a trackpad arrives as ctrl+wheel with small deltas.
      const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.012 : 0.0022));
      onWheelZoom(factor, px, py);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [interactive, onWheelZoom]);

  function pointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!interactive || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointer: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      mode: view.zoom > 1.001 ? "pan" : "swipe",
      panX: view.x,
      panY: view.y,
      moved: false,
    };
  }

  function pointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state || state.pointer !== event.pointerId) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (!state.moved && Math.hypot(dx, dy) < 4) return;
    state.moved = true;
    if (state.mode === "pan") {
      onPan(state.panX + dx, state.panY + dy);
    } else {
      x.set(dx);
      y.set(dy * 0.3);
      dragX.set(dx);
    }
  }

  function pointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state || state.pointer !== event.pointerId) return;
    drag.current = null;
    if (state.mode !== "swipe" || !state.moved) return;
    const dx = x.get();
    const velocity = x.getVelocity();
    const threshold = Math.min(150, area.width * 0.2);
    const flung = Math.abs(velocity) > 700 && Math.abs(dx) > 40 && Math.sign(velocity) === Math.sign(dx);
    animate(dragX, 0, settle);
    if (Math.abs(dx) > threshold || flung) {
      onSwipe(dx > 0 ? "keep" : "reject");
    } else {
      animate(x, 0, { type: "spring", stiffness: 500, damping: 30 });
      animate(y, 0, { type: "spring", stiffness: 500, damping: 30 });
    }
  }

  function doubleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!interactive) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onToggleZoom(event.clientX - (rect.left + rect.width / 2), event.clientY - (rect.top + rect.height / 2));
  }

  const z = role === "exit" ? 30 : role === "current" ? 20 : 10;

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ zIndex: z }}>
      <motion.div
        ref={cardRef}
        initial={initial}
        animate={{ ...target, width: size.width, height: size.height }}
        transition={{ ...transition, width: settle, height: settle }}
        onAnimationComplete={() => {
          if (role === "exit") onExited(info.id);
        }}
        style={{ x, y, rotate, touchAction: "none" }}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
        onDoubleClick={doubleClick}
        className={`relative overflow-hidden rounded-[14px] bg-surface shadow-[var(--shadow-float)] ring-1 ring-ink/8 select-none ${
          interactive
            ? view.zoom > 1.001
              ? "pointer-events-auto cursor-move"
              : "pointer-events-auto cursor-grab active:cursor-grabbing"
            : ""
        }`}
      >
        <PhotoView info={info} size={size} view={view} />

        {/* Washes and stamps follow the drag, and the flight on a keypress. */}
        <motion.div className="pointer-events-none absolute inset-0 bg-keep" style={{ opacity: keepWash }} />
        <motion.div className="pointer-events-none absolute inset-0 bg-reject" style={{ opacity: rejectWash }} />
        <Stamp tone="keep" label={t({ fr: "Garder", en: "Keep" })} style={{ opacity: keepOpacity }} large />
        <Stamp tone="reject" label={t({ fr: "Écarter", en: "Toss" })} style={{ opacity: rejectOpacity }} large />

        {/* The next card waits in the shade. */}
        <motion.div
          className="pointer-events-none absolute inset-0 bg-black"
          initial={false}
          animate={{ opacity: role === "next" ? 0.55 : 0 }}
          transition={{ duration: 0.3 }}
        />

        {role === "current" && info.decision && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`pointer-events-none absolute top-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-[7px] bg-black/60 px-2.5 py-1 text-[12px] font-medium backdrop-blur-sm ${
              info.decision === "keep" ? "text-keep" : "text-reject"
            }`}
          >
            {info.decision === "keep" ? <Heart size={12} strokeWidth={2.6} /> : <X size={12} strokeWidth={2.6} />}
            {info.decision === "keep"
              ? t({ fr: "Déjà gardée", en: "Already kept" })
              : t({ fr: "Déjà écartée", en: "Already tossed" })}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

function PhotoView({
  info,
  size,
  view,
}: {
  info: CardInfo;
  size: { width: number; height: number };
  view: View;
}) {
  const { t } = useLocale();
  const loaded = info.loaded;

  if (!loaded) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-sunk">
        <span className="spinner" />
      </div>
    );
  }

  if (loaded.status === "error") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-sunk p-6 text-center text-[13.5px] text-muted">
        <ImageOff size={30} strokeWidth={1.5} />
        {t({
          fr: "Ce fichier ne peut pas être affiché. Vous pouvez quand même décider.",
          en: "This file cannot be shown. You can still decide.",
        })}
      </div>
    );
  }

  const width = size.width * view.zoom;
  const height = size.height * view.zoom;
  const ease = "280ms cubic-bezier(0.16, 1, 0.3, 1)";

  return (
    <motion.img
      src={loaded.url}
      alt=""
      draggable={false}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      className="absolute max-w-none"
      style={{
        width,
        height,
        left: (size.width - width) / 2 + view.x,
        top: (size.height - height) / 2 + view.y,
        transition: view.animate
          ? `width ${ease}, height ${ease}, left ${ease}, top ${ease}`
          : "none",
      }}
    />
  );
}
