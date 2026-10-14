"use client";

import { Heart, RotateCcw, X } from "lucide-react";
import {
  animate,
  motion,
  useAnimate,
  useMotionValue,
  useTransform,
  type AnimationPlaybackControls,
  type PanInfo,
} from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { Decision } from "@/lib/session";
import { useLocale } from "../LocaleProvider";
import { Button, Kbd, RollingNumber, softSpring } from "../ui";

/* A self-playing demo of the sorting screen: the deck swipes itself, the
   keys light up, and the visitor can grab the top card to try. */

type DemoPhoto = { src: string; name: string; verdict: Decision; tilt: number };

const DEMO: DemoPhoto[] = [
  { src: "/demo/beach.webp", name: "IMG_2041.jpg", verdict: "keep", tilt: -2.5 },
  { src: "/demo/blurry.webp", name: "IMG_2042.jpg", verdict: "reject", tilt: 2 },
  { src: "/demo/dog.webp", name: "IMG_2047.jpg", verdict: "keep", tilt: -1.2 },
  { src: "/demo/concert.webp", name: "IMG_2051.jpg", verdict: "reject", tilt: 2.6 },
  { src: "/demo/lake.webp", name: "IMG_2063.jpg", verdict: "keep", tilt: -1.8 },
];

const STEP_MS = 2300;
/** How long the recap stays up before the deck is dealt again. */
const RECAP_MS = 5200;
const THRESHOLD = 90;

export default function HeroDeck() {
  const { locale, t } = useLocale();
  const [top, setTop] = useState(0);
  const [verdicts, setVerdicts] = useState<(Decision | null)[]>(() => DEMO.map(() => null));
  const [paused, setPaused] = useState(false);
  const [pressed, setPressed] = useState<{ key: Decision; seq: number } | null>(null);

  function decide(index: number, decision: Decision) {
    if (index !== top) return;
    setVerdicts((list) => list.map((value, i) => (i === index ? decision : value)));
    setTop(index + 1);
    setPressed((previous) => ({ key: decision, seq: (previous?.seq ?? 0) + 1 }));
  }

  function redeal() {
    setVerdicts(DEMO.map(() => null));
    setTop(0);
  }

  // Autoplay, paused while the pointer is on the deck. Once the deck is
  // empty the recap card takes over and deals again.
  useEffect(() => {
    if (paused || top >= DEMO.length) return;
    const timer = setTimeout(() => decide(top, DEMO[top].verdict), STEP_MS);
    return () => clearTimeout(timer);
  });

  // Keys light up for a moment.
  useEffect(() => {
    if (!pressed) return;
    const timer = setTimeout(() => setPressed(null), 260);
    return () => clearTimeout(timer);
  }, [pressed]);

  const kept = verdicts.filter((v) => v === "keep").length;
  const rejected = verdicts.filter((v) => v === "reject").length;

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative h-[440px] w-[300px] sm:h-[500px] sm:w-[340px]"
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => setPaused(false)}
      >
        <RecapCard
          visible={top >= DEMO.length}
          paused={paused}
          verdicts={verdicts}
          onReplay={redeal}
        />
        {DEMO.map((photo, index) => (
          <DemoCard
            key={photo.src}
            photo={photo}
            index={index}
            depth={index - top}
            verdict={verdicts[index]}
            onDecide={(decision) => decide(index, decision)}
            labels={{
              keep: t({ fr: "Garder", en: "Keep" }),
              reject: t({ fr: "Écarter", en: "Toss" }),
            }}
          />
        ))}
      </div>

      <div className="mt-8 flex items-center gap-6 text-[13px] text-muted">
        <DemoKey active={pressed?.key === "reject"} tone="reject">
          A
        </DemoKey>
        <div className="flex items-center gap-4 font-mono text-[12px]">
          <span className="inline-flex items-center gap-1.5 text-reject">
            <X size={13} strokeWidth={2.6} />
            <RollingNumber value={rejected} locale={locale} />
          </span>
          <span className="h-3 w-px bg-edge" />
          <span className="inline-flex items-center gap-1.5 text-keep">
            <Heart size={12} strokeWidth={2.6} />
            <RollingNumber value={kept} locale={locale} />
          </span>
        </div>
        <DemoKey active={pressed?.key === "keep"} tone="keep">
          E
        </DemoKey>
      </div>
    </div>
  );
}

/* What the real app shows next: the pile is empty, here is what was kept and
   what was set aside. */
function RecapCard({
  visible,
  paused,
  verdicts,
  onReplay,
}: {
  visible: boolean;
  paused: boolean;
  verdicts: (Decision | null)[];
  onReplay: () => void;
}) {
  const { t } = useLocale();
  const [bar, animateBar] = useAnimate<HTMLDivElement>();
  const countdown = useRef<AnimationPlaybackControls | null>(null);
  const replay = useRef(onReplay);
  useEffect(() => {
    replay.current = onReplay;
  });

  // A thin bar fills up, then the deck is dealt again. Hovering the deck
  // holds it, so the recap can be read at leisure.
  useEffect(() => {
    if (!visible) return;
    let live = true;
    const controls = animateBar(
      bar.current,
      { scaleX: [0, 1] },
      { duration: RECAP_MS / 1000, ease: "linear", delay: 0.6 },
    );
    countdown.current = controls;
    void controls.then(() => {
      if (live) replay.current();
    });
    return () => {
      live = false;
      controls.stop();
      countdown.current = null;
    };
  }, [visible, animateBar, bar]);

  useEffect(() => {
    if (paused) countdown.current?.pause();
    else countdown.current?.play();
  }, [paused, visible]);

  const groups = [
    {
      tone: "keep" as const,
      label: t({ fr: "Gardées", en: "Kept" }),
      photos: DEMO.filter((_, index) => verdicts[index] === "keep"),
    },
    {
      tone: "reject" as const,
      label: t({ fr: "Écartées", en: "Tossed" }),
      photos: DEMO.filter((_, index) => verdicts[index] === "reject"),
    },
  ];

  const item = {
    hidden: { opacity: 0, y: 12 },
    shown: { opacity: 1, y: 0, transition: softSpring },
  };

  return (
    <motion.div
      aria-hidden={!visible}
      inert={!visible}
      className="absolute inset-0 flex flex-col overflow-hidden rounded-[16px] border border-edge bg-surface p-6 shadow-[var(--shadow-float)] select-none"
      initial={false}
      animate={visible ? "shown" : "hidden"}
      variants={{
        hidden: { opacity: 0, scale: 0.9, y: 28, transition: { duration: 0.25 } },
        shown: {
          opacity: 1,
          scale: 1,
          y: 0,
          transition: {
            type: "spring",
            stiffness: 200,
            damping: 22,
            delay: 0.25,
            delayChildren: 0.4,
            staggerChildren: 0.07,
          },
        },
      }}
    >
      <motion.svg variants={item} viewBox="0 0 40 40" className="size-10 text-keep" aria-hidden>
        <motion.circle
          cx="20"
          cy="20"
          r="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          variants={{ hidden: { pathLength: 0 }, shown: { pathLength: 1 } }}
          transition={{ duration: 0.6, ease: [0.65, 0, 0.35, 1], delay: 0.45 }}
          style={{ rotate: -90, originX: "50%", originY: "50%" }}
        />
        <motion.path
          d="M12.5 20.5l5 5 10-11"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          variants={{ hidden: { pathLength: 0 }, shown: { pathLength: 1 } }}
          transition={{ duration: 0.35, ease: "easeOut", delay: 0.9 }}
        />
      </motion.svg>

      <motion.p variants={item} className="display mt-4 text-[30px]">
        {t({ fr: "Plus de photos.", en: "No more photos." })}
      </motion.p>
      <motion.p variants={item} className="mt-1 text-[14px] text-muted">
        {t({
          fr: `Les ${DEMO.length} photos sont triées.`,
          en: `All ${DEMO.length} photos are sorted.`,
        })}
      </motion.p>

      <div className="mt-6 space-y-4">
        {groups.map((group) => (
          <motion.div
            key={group.tone}
            variants={{
              hidden: item.hidden,
              shown: {
                ...item.shown,
                transition: { ...softSpring, delayChildren: 0.12, staggerChildren: 0.05 },
              },
            }}
          >
            <div className="flex items-center justify-between text-[13px]">
              <span
                className={`inline-flex items-center gap-1.5 font-medium ${
                  group.tone === "keep" ? "text-keep" : "text-reject"
                }`}
              >
                {group.tone === "keep" ? (
                  <Heart size={12} strokeWidth={2.6} />
                ) : (
                  <X size={13} strokeWidth={2.6} />
                )}
                {group.label}
              </span>
              <span className="font-mono text-[12px] text-muted">{group.photos.length}</span>
            </div>
            <div className="mt-2 grid grid-cols-5 gap-1.5">
              {group.photos.length === 0 && (
                <span className="col-span-5 flex aspect-[5/1] items-center justify-center rounded-[6px] border border-dashed border-edge text-[12px] text-faint">
                  {t({ fr: "Aucune", en: "None" })}
                </span>
              )}
              {group.photos.map((photo) => (
                <motion.span
                  key={photo.src}
                  className="aspect-[4/5] overflow-hidden rounded-[6px] bg-sunk"
                  variants={{
                    hidden: { opacity: 0, scale: 0.6 },
                    shown: { opacity: 1, scale: 1, transition: softSpring },
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- static demo assets */}
                  <img
                    src={photo.src}
                    alt=""
                    draggable={false}
                    className={`h-full w-full object-cover ${
                      group.tone === "reject" ? "opacity-70 grayscale" : ""
                    }`}
                  />
                </motion.span>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div variants={item} className="mt-auto flex flex-col items-start gap-4 pt-5">
        <p className="hidden text-[12.5px] leading-relaxed text-faint sm:block">
          {t({
            fr: "Ensuite, dans l’app : vous relisez les écartées, puis elles sont rangées à part.",
            en: "Next, in the app: you review the tossed photos, then they are set aside.",
          })}
        </p>
        <Button variant="secondary" size="sm" onClick={onReplay}>
          <RotateCcw size={14} strokeWidth={2} />
          {t({ fr: "Recommencer", en: "Start over" })}
        </Button>
      </motion.div>

      <div
        ref={bar}
        className="absolute inset-x-0 bottom-0 h-[3px] origin-left bg-ink/20"
        style={{ transform: "scaleX(0)" }}
      />
    </motion.div>
  );
}

function DemoKey({
  active,
  tone,
  children,
}: {
  active: boolean;
  tone: Decision;
  children: React.ReactNode;
}) {
  return (
    <motion.span
      animate={active ? { y: 2, scale: 0.94 } : { y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 700, damping: 26 }}
      className="inline-flex"
    >
      <Kbd
        className={`!h-9 !min-w-9 !text-[13px] transition-colors duration-150 ${
          active
            ? tone === "keep"
              ? "!border-keep !bg-keep !text-white"
              : "!border-reject !bg-reject !text-white"
            : ""
        }`}
      >
        {children}
      </Kbd>
    </motion.span>
  );
}

function DemoCard({
  photo,
  index,
  depth,
  verdict,
  onDecide,
  labels,
}: {
  photo: DemoPhoto;
  index: number;
  depth: number;
  verdict: Decision | null;
  onDecide: (decision: Decision) => void;
  labels: { keep: string; reject: string };
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-16, 0, 16], { clamp: false });
  const keepOpacity = useTransform(x, [20, 110], [0, 1]);
  const rejectOpacity = useTransform(x, [-110, -20], [1, 0]);
  const isTop = depth === 0 && !verdict;

  // Flying out, or settling into the pile at its depth.
  const target = verdict
    ? { x: verdict === "keep" ? 560 : -560, y: 60, opacity: 0, scale: 1 }
    : {
        x: 0,
        y: Math.max(0, depth) * 14,
        scale: 1 - Math.max(0, depth) * 0.05,
        opacity: depth > 2 ? 0 : 1,
      };

  // When the deck is dealt again, cards come back one after the other.
  useEffect(() => {
    if (!verdict) animate(x, 0, softSpring);
  }, [verdict, x]);

  function onDragEnd(_: unknown, info: PanInfo) {
    const travel = info.offset.x;
    if (Math.abs(travel) > THRESHOLD || Math.abs(info.velocity.x) > 650) {
      onDecide(travel > 0 ? "keep" : "reject");
    }
  }

  return (
    <motion.div
      className="absolute inset-0 select-none"
      style={{ x, rotate, zIndex: 100 - index, touchAction: "none" }}
      initial={{ y: 120, opacity: 0, scale: 0.9 }}
      animate={target}
      transition={
        verdict
          ? { type: "spring", stiffness: 180, damping: 24, opacity: { duration: 0.45, delay: 0.1 } }
          : { type: "spring", stiffness: 260, damping: 26, delay: verdict === null && depth >= 0 ? depth * 0.06 : 0 }
      }
      drag={isTop ? "x" : false}
      dragSnapToOrigin
      dragElastic={0.9}
      onDragEnd={onDragEnd}
      whileDrag={{ cursor: "grabbing" }}
    >
      <div
        className="relative h-full w-full overflow-hidden rounded-[16px] border border-white/10 bg-sunk shadow-[var(--shadow-float)]"
        style={{ rotate: `${photo.tilt}deg`, cursor: isTop ? "grab" : "default" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static demo assets */}
        <img
          src={photo.src}
          alt=""
          draggable={false}
          className="h-full w-full object-cover"
          loading={index < 2 ? "eager" : "lazy"}
        />
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/45 px-3.5 py-2.5 font-mono text-[11px] text-white/85 backdrop-blur-[2px]">
          <span>{photo.name}</span>
          <span>
            {index + 1} / {DEMO.length}
          </span>
        </div>
        <Stamp tone="keep" style={{ opacity: keepOpacity }} label={labels.keep} />
        <Stamp tone="reject" style={{ opacity: rejectOpacity }} label={labels.reject} />
      </div>
    </motion.div>
  );
}

export function Stamp({
  tone,
  label,
  style,
  large = false,
}: {
  tone: Decision;
  label: string;
  style: React.ComponentProps<typeof motion.div>["style"];
  large?: boolean;
}) {
  const keep = tone === "keep";
  return (
    <motion.div
      aria-hidden
      style={style}
      className={`pointer-events-none absolute top-6 ${keep ? "left-5 -rotate-[14deg]" : "right-5 rotate-[14deg]"} rounded-[8px] border-[3px] px-3 py-1 font-display font-bold tracking-[-0.01em] uppercase ${
        keep ? "border-keep text-keep" : "border-reject text-reject"
      } ${large ? "text-[34px]" : "text-[24px]"} bg-black/25 backdrop-blur-[1px]`}
    >
      {label}
    </motion.div>
  );
}
