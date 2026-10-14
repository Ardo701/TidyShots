"use client";

import { ChevronLeft, ChevronRight, Heart, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import type { Photo } from "@/lib/fs";
import type { Decision } from "@/lib/session";
import { useLocale } from "../LocaleProvider";
import { Button, IconButton, Kbd, spring } from "../ui";

/* A larger look at one tossed photo, with ← → to browse and Space to keep. */
export default function Lightbox({
  photos,
  index,
  decisions,
  onClose,
  onNavigate,
  onToggle,
}: {
  photos: Photo[];
  index: number | null;
  decisions: Record<string, Decision>;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onToggle: (photo: Photo) => void;
}) {
  const { t } = useLocale();
  const photo = index === null ? undefined : photos[index];
  const [image, setImage] = useState<{ id: string; url: string } | null>(null);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    if (!photo) return;
    let url: string | null = null;
    let alive = true;
    void photo.handle.getFile().then((file) => {
      if (!alive) return;
      url = URL.createObjectURL(file);
      setImage({ id: photo.id, url });
    });
    return () => {
      alive = false;
      // Kept a moment so the outgoing image can finish its exit.
      if (url) setTimeout(() => URL.revokeObjectURL(url!), 600);
    };
  }, [photo]);

  useEffect(() => {
    if (index === null || !photo) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight" && index < photos.length - 1) {
        setDirection(1);
        onNavigate(index + 1);
      } else if (event.key === "ArrowLeft" && index > 0) {
        setDirection(-1);
        onNavigate(index - 1);
      } else if (event.key === " ") onToggle(photo);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, photo, photos.length, onClose, onNavigate, onToggle]);

  const kept = photo ? decisions[photo.id] !== "reject" : false;
  const url = image && photo && image.id === photo.id ? image.url : null;

  return (
    <AnimatePresence>
      {photo && index !== null && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col bg-black/88"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div className="flex h-14 shrink-0 items-center justify-between px-4 text-white" onClick={(e) => e.stopPropagation()}>
            <p className="truncate font-mono text-[12.5px] text-white/80">
              {photo.id} · {index + 1} / {photos.length}
            </p>
            <IconButton label={t({ fr: "Fermer", en: "Close" })} onClick={onClose} className="text-white/70 hover:bg-white/10 hover:text-white">
              <X size={20} />
            </IconButton>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-16">
            <AnimatePresence initial={false} custom={direction} mode="popLayout">
              {url && (
                <motion.img
                  key={photo.id}
                  src={url}
                  alt=""
                  custom={direction}
                  variants={{
                    enter: (d: number) => ({ opacity: 0, x: d * 60, scale: 0.96 }),
                    center: { opacity: 1, x: 0, scale: 1 },
                    exit: (d: number) => ({ opacity: 0, x: d * -60, scale: 0.96 }),
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={spring}
                  onClick={(event) => event.stopPropagation()}
                  className="max-h-full max-w-full rounded-[6px] object-contain"
                />
              )}
            </AnimatePresence>
            {index > 0 && (
              <IconButton
                label={t({ fr: "Précédente", en: "Previous" })}
                onClick={(event) => {
                  event.stopPropagation();
                  setDirection(-1);
                  onNavigate(index - 1);
                }}
                className="absolute left-3 size-11 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <ChevronLeft size={26} />
              </IconButton>
            )}
            {index < photos.length - 1 && (
              <IconButton
                label={t({ fr: "Suivante", en: "Next" })}
                onClick={(event) => {
                  event.stopPropagation();
                  setDirection(1);
                  onNavigate(index + 1);
                }}
                className="absolute right-3 size-11 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <ChevronRight size={26} />
              </IconButton>
            )}
          </div>

          <div
            className="flex h-20 shrink-0 items-center justify-center gap-4 text-[13px] text-white/60"
            onClick={(e) => e.stopPropagation()}
          >
            <Button variant={kept ? "keep" : "danger"} onClick={() => onToggle(photo)}>
              {kept ? <Heart size={16} strokeWidth={2.5} /> : <X size={16} strokeWidth={2.8} />}
              {kept ? t({ fr: "Gardée", en: "Kept" }) : t({ fr: "À écarter", en: "To toss" })}
            </Button>
            <span className="flex items-center gap-1.5">
              <Kbd className="!border-white/20 !bg-white/10 !text-white">
                {t({ fr: "Espace", en: "Space" })}
              </Kbd>
              {t({ fr: "pour changer", en: "to switch" })}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
