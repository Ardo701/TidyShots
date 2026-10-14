"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";

/* The current photo, shrunk to a few dozen pixels and blurred, lights the
   room behind the card. Drawing it that small keeps the blur cheap. */

const W = 36;
const H = 24;

function Layer({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let alive = true;
    const image = new Image();
    image.src = url;
    image
      .decode()
      .then(() => {
        const context = canvasRef.current?.getContext("2d");
        if (!alive || !context) return;
        const scale = Math.max(W / image.naturalWidth, H / image.naturalHeight);
        const w = image.naturalWidth * scale;
        const h = image.naturalHeight * scale;
        context.filter = "blur(1.5px)";
        context.drawImage(image, (W - w) / 2, (H - h) / 2, w, h);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [url]);

  return (
    <motion.canvas
      ref={canvasRef}
      width={W}
      height={H}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className="absolute inset-0 h-full w-full"
      style={{ filter: "blur(28px) saturate(1.35)", transform: "scale(1.2)" }}
    />
  );
}

export default function Ambient({ id, url }: { id: string | null; url: string | null }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <AnimatePresence initial={false}>{id && url && <Layer key={id} url={url} />}</AnimatePresence>
      <div className="absolute inset-0 bg-canvas/75" />
      <div className="grain absolute inset-0" />
    </div>
  );
}
