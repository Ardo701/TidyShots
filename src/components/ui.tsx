"use client";

import { AnimatePresence, motion, type HTMLMotionProps } from "motion/react";
import { useState } from "react";
import { formatNumber } from "@/lib/format";
import type { Locale } from "@/lib/i18n";

export const spring = { type: "spring", stiffness: 420, damping: 34 } as const;
export const softSpring = { type: "spring", stiffness: 220, damping: 28 } as const;

/* ------------------------------------------------------------------------ */

type ButtonProps = HTMLMotionProps<"button"> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "keep";
  size?: "sm" | "md" | "lg";
};

const VARIANTS = {
  primary: "bg-ink text-canvas hover:bg-ink/88",
  secondary: "border border-edge bg-surface text-ink hover:border-muted",
  ghost: "text-muted hover:text-ink hover:bg-ink/6",
  danger: "bg-reject text-white hover:bg-reject/90",
  keep: "bg-keep text-white hover:bg-keep/90",
};

const SIZES = {
  sm: "h-8 gap-1.5 rounded-[7px] px-3 text-[13px]",
  md: "h-10 gap-2 rounded-[8px] px-4 text-[14px]",
  lg: "h-13 gap-2.5 rounded-[10px] px-6 text-[15.5px]",
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      type="button"
      whileTap={props.disabled ? undefined : { scale: 0.96 }}
      transition={spring}
      className={`inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}

export function IconButton({
  label,
  className = "",
  children,
  ...props
}: HTMLMotionProps<"button"> & { label: string }) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      whileTap={{ scale: 0.9 }}
      transition={spring}
      className={`inline-flex size-9 shrink-0 items-center justify-center rounded-[8px] text-muted transition-colors duration-150 hover:bg-ink/6 hover:text-ink disabled:pointer-events-none disabled:opacity-35 ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}

export function Kbd({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <kbd className={`kbd ${className}`}>{children}</kbd>;
}

/* ------------------------------------------------------------------------ */

/**
 * A number whose digits roll like an odometer when it changes: up when it
 * grows, down when it shrinks.
 */
export function RollingNumber({
  value,
  locale,
  className = "",
}: {
  value: number;
  locale: Locale;
  className?: string;
}) {
  const [previous, setPrevious] = useState(value);
  const [direction, setDirection] = useState(1);
  if (value !== previous) {
    setDirection(value > previous ? 1 : -1);
    setPrevious(value);
  }

  const text = formatNumber(value, locale);
  const chars = [...text];

  return (
    <span className={`nums inline-flex items-baseline ${className}`}>
      <span className="sr-only">{text}</span>
      <span aria-hidden className="inline-flex items-baseline">
        {chars.map((char, index) => (
          // Keyed from the right so units stay units when the number grows.
          <Digit key={chars.length - index} char={char} direction={direction} />
        ))}
      </span>
    </span>
  );
}

function Digit({ char, direction }: { char: string; direction: number }) {
  if (!/\d/.test(char)) {
    return (
      <span className="inline-block whitespace-pre">{char}</span>
    );
  }
  return (
    <span className="relative inline-flex h-[1.15em] overflow-hidden leading-[1.15em]">
      {/* Holds the width of one digit. */}
      <span className="invisible">0</span>
      <AnimatePresence initial={false} custom={direction}>
        <motion.span
          key={char}
          custom={direction}
          variants={{
            enter: (d: number) => ({ y: d > 0 ? "100%" : "-100%", opacity: 0 }),
            center: { y: "0%", opacity: 1 },
            exit: (d: number) => ({ y: d > 0 ? "-100%" : "100%", opacity: 0 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: "spring", stiffness: 500, damping: 36 }}
          className="absolute inset-0 text-center"
        >
          {char}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/* ------------------------------------------------------------------------ */

/** Two prints, the front one with a tiny landscape. Mirrors app/icon.svg. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <rect
        x="5.5"
        y="6"
        width="17"
        height="22"
        rx="3"
        transform="rotate(-12 14 17)"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="1.6"
      />
      <rect x="10" y="4" width="17" height="22" rx="3" fill="currentColor" />
      <circle cx="21.5" cy="9.5" r="2" className="fill-canvas" />
      <path d="M12.5 21.5 17 15.5l3 3.6 2-2.2 3.5 4.6z" className="fill-canvas" />
    </svg>
  );
}

/* ------------------------------------------------------------------------ */

export type Toast = { id: number; tone: "info" | "error" | "success"; text: string };

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-5 z-[100] flex flex-col items-center gap-2 px-4"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.button
            layout
            key={toast.id}
            type="button"
            onClick={() => onDismiss(toast.id)}
            initial={{ opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96, transition: { duration: 0.18 } }}
            transition={spring}
            className="pointer-events-auto flex max-w-md items-center gap-2.5 rounded-[10px] border border-edge bg-surface px-4 py-2.5 text-left text-[13.5px] shadow-[var(--shadow-float)]"
          >
            <span
              className={`size-2 shrink-0 rounded-full ${
                toast.tone === "error" ? "bg-reject" : toast.tone === "success" ? "bg-keep" : "bg-muted"
              }`}
            />
            {toast.text}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
