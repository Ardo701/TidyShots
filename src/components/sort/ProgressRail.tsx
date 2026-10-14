"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { formatNumber } from "@/lib/format";
import type { Decision } from "@/lib/session";
import { useLocale } from "../LocaleProvider";

/* Every photo of the folder as a sliver: green kept, red tossed, grey still
   to judge. Clicking a sliver jumps to that photo. */

const HEIGHT = 6;

function useThemeVersion() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", bump);
    const observer = new MutationObserver(bump);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      media.removeEventListener("change", bump);
      observer.disconnect();
    };
  }, []);
  return version;
}

export default function ProgressRail({
  ids,
  decisions,
  index,
  onJump,
}: {
  ids: string[];
  decisions: Record<string, Decision>;
  index: number;
  onJump: (index: number) => void;
}) {
  const { locale } = useLocale();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const theme = useThemeVersion();
  const total = ids.length;

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !width || !total) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = HEIGHT * ratio;
    const context = canvas.getContext("2d");
    if (!context) return;
    const styles = getComputedStyle(document.documentElement);
    const colour = {
      keep: styles.getPropertyValue("--color-keep").trim(),
      reject: styles.getPropertyValue("--color-reject").trim(),
      none: styles.getPropertyValue("--color-edge").trim(),
    };

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, HEIGHT);
    context.save();
    context.beginPath();
    context.roundRect(0, 0, width, HEIGHT, HEIGHT / 2);
    context.clip();
    const step = width / total;
    // Gaps only when each photo gets a few pixels.
    const gap = step >= 5 ? 1.5 : 0;
    for (let i = 0; i < total; i++) {
      const decision = decisions[ids[i]];
      context.fillStyle = decision ? colour[decision] : colour.none;
      const start = i * step;
      context.fillRect(start, 0, Math.max(step - gap, 0.6), HEIGHT);
    }
    context.restore();
  }, [ids, decisions, width, total, theme]);

  function indexAt(clientX: number) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || !total) return null;
    return Math.min(total - 1, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * total)));
  }

  const position = total ? Math.min(index, total - 1) : 0;

  return (
    <div
      ref={wrapRef}
      className="group relative flex h-5 cursor-pointer items-center"
      onPointerMove={(event) => setHover(indexAt(event.clientX))}
      onPointerLeave={() => setHover(null)}
      onClick={(event) => {
        const target = indexAt(event.clientX);
        if (target !== null) onJump(target);
      }}
      role="slider"
      aria-label={locale === "fr" ? "Position dans le dossier" : "Position in the folder"}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={position + 1}
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: HEIGHT }}
        className="transition-transform duration-200 group-hover:scale-y-150"
      />
      <motion.div
        className="pointer-events-none absolute top-1/2 h-4 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink shadow-[0_0_0_2px_var(--color-canvas)]"
        initial={false}
        animate={{ left: `${((position + 0.5) / Math.max(total, 1)) * 100}%` }}
        transition={{ type: "spring", stiffness: 420, damping: 36 }}
      />
      <AnimatePresence>
        {hover !== null && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4, transition: { duration: 0.12 } }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute bottom-6 z-30 -translate-x-1/2 rounded-[6px] bg-ink px-2 py-1 font-mono text-[11px] whitespace-nowrap text-canvas"
            style={{ left: `${((hover + 0.5) / total) * 100}%` }}
          >
            {formatNumber(hover + 1, locale)} · {ids[hover].split("/").pop()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
