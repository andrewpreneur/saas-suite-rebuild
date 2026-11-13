"use client";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import React, {
  type ComponentPropsWithoutRef,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

const SPRING = { stiffness: 500, damping: 30, mass: 0.5 };

type SmoothInputProps = ComponentPropsWithoutRef<"input"> & {
  wrapperClassName?: string;
};

const PASSWORD_CHAR =
  typeof navigator !== "undefined" && navigator.userAgent.match(/firefox|fxios/i)
    ? "\u25CF"
    : "\u2022";

/**
 * Single-line input with a spring-animated caret that glides between characters.
 */
export const SmoothInput = ({
  className,
  wrapperClassName,
  value,
  defaultValue,
  onChange,
  onBlur,
  type = "text",
  ...props
}: SmoothInputProps) => {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const caretX = useMotionValue(0);
  const caretOpacity = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const isControlled = value !== undefined;
  const inputValue = isControlled ? String(value) : String(internalValue);

  const springCaretX = useSpring(
    caretX,
    prefersReducedMotion ? { stiffness: 10000, damping: 100, mass: 0.1 } : SPRING,
  );

  const measurePrefixWidth = (text: string) => {
    const input = inputRef.current;
    const measureSpan = measureRef.current;
    if (!input || !measureSpan) return null;

    const styles = window.getComputedStyle(input);
    measureSpan.style.font = `${styles.fontStyle} ${styles.fontWeight} ${styles.fontSize} ${styles.fontFamily}`;
    measureSpan.style.letterSpacing = styles.letterSpacing;
    measureSpan.textContent = text;

    const paddingLeft = parseFloat(styles.paddingLeft) || 0;
    return text.length > 0 ? measureSpan.offsetWidth + paddingLeft : paddingLeft - 1;
  };

  const [caretHeight, setCaretHeight] = useState(16);
  const caretY = useMotionValue(0);
  const springCaretY = useSpring(
    caretY,
    prefersReducedMotion ? { stiffness: 10000, damping: 100, mass: 0.1 } : SPRING,
  );

  const updateCaret = (target: HTMLInputElement) => {
    const selectionStart = target.selectionStart ?? 0;
    const selectionEnd = target.selectionEnd ?? 0;
    const hasSelection = selectionStart !== selectionEnd;
    const caretIndex =
      selectionStart === selectionEnd
        ? selectionStart
        : target.selectionDirection === "backward"
          ? selectionStart
          : selectionEnd;
    const textBeforeCaret =
      target.type === "password"
        ? PASSWORD_CHAR.repeat(caretIndex)
        : target.value.slice(0, caretIndex);

    const absoluteWidth = measurePrefixWidth(textBeforeCaret);
    if (absoluteWidth === null) return;

    const styles = window.getComputedStyle(target);
    const paddingLeft = parseFloat(styles.paddingLeft) || 0;
    const paddingRight = parseFloat(styles.paddingRight) || 0;
    const maxScroll = Math.max(0, target.scrollWidth - target.clientWidth);
    const visibleRight = target.scrollLeft + target.clientWidth - paddingRight;
    const visibleLeft = target.scrollLeft + paddingLeft;

    if (absoluteWidth > visibleRight) {
      target.scrollLeft = Math.min(
        absoluteWidth - target.clientWidth + paddingRight,
        maxScroll,
      );
    } else if (absoluteWidth < visibleLeft) {
      target.scrollLeft = Math.max(0, absoluteWidth - paddingLeft);
    }

    const caretPosition = absoluteWidth - target.scrollLeft;
    const minX = paddingLeft - 1;
    const maxX = target.clientWidth - paddingRight;

    // Align the caret with the text baseline box instead of the wrapper centre,
    // otherwise it sits low whenever padding is asymmetric.
    const fontSize = parseFloat(styles.fontSize) || 14;
    const paddingTop = parseFloat(styles.paddingTop) || 0;
    const paddingBottom = parseFloat(styles.paddingBottom) || 0;
    const height = Math.round(fontSize * 1.25);
    setCaretHeight(height);
    // Centre the caret inside the input's content box (single-line inputs
    // vertically centre their text), so it never rides high.
    const contentHeight = target.clientHeight - paddingTop - paddingBottom;
    caretY.set(
      target.offsetTop + paddingTop + Math.max(0, (contentHeight - height) / 2),
    );

    caretX.set(Math.min(caretPosition, maxX));
    caretOpacity.set(
      !hasSelection && caretPosition >= minX && caretPosition <= maxX + 1 ? 1 : 0,
    );
  };

  const updateCaretRef = useRef(updateCaret);
  updateCaretRef.current = updateCaret;

  useEffect(() => {
    const input = inputRef.current;
    if (input && document.activeElement === input) updateCaretRef.current(input);
  }, [inputValue]);

  useEffect(() => {
    const input = inputRef.current;
    const container = containerRef.current;
    if (!input || !container) return;

    const sync = () => {
      if (document.activeElement === input) updateCaretRef.current(input);
    };
    const onSelectionChange = () => requestAnimationFrame(sync);

    document.addEventListener("selectionchange", onSelectionChange);
    input.addEventListener("scroll", sync);
    const ro = new ResizeObserver(sync);
    ro.observe(container);
    sync();

    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      input.removeEventListener("scroll", sync);
      ro.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full rounded-md border border-input bg-background transition-colors focus-within:border-primary/60",
        wrapperClassName,
      )}
    >
      <input
        {...props}
        ref={inputRef}
        type={type}
        value={isControlled ? String(value) : internalValue}
        onChange={(e) => {
          if (!isControlled) setInternalValue(e.target.value);
          onChange?.(e);
          requestAnimationFrame(() => updateCaretRef.current(e.target));
        }}
        onFocus={(e) => updateCaretRef.current(e.target)}
        onBlur={(e) => {
          caretOpacity.set(0);
          onBlur?.(e);
        }}
        onKeyUp={(e) => updateCaretRef.current(e.currentTarget)}
        onClick={(e) => updateCaretRef.current(e.currentTarget)}
        className={cn(
          "h-10 w-full bg-transparent px-3 py-2 text-sm caret-transparent outline-none placeholder:text-muted-foreground",
          className,
        )}
      />
      <motion.span
        aria-hidden
        style={{ x: springCaretX, y: springCaretY, height: caretHeight, opacity: caretOpacity }}
        className="pointer-events-none absolute left-0 top-0 w-[2px] rounded-full bg-primary"
      />
      <span
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute left-0 top-0 whitespace-pre"
      />
    </div>
  );
};

type SmoothTextareaProps = ComponentPropsWithoutRef<"textarea"> & {
  wrapperClassName?: string;
};

/**
 * Multi-line composer that grows smoothly as you type, with a springy focus ring.
 */
export const SmoothTextarea = ({
  className,
  wrapperClassName,
  onChange,
  value,
  ...props
}: SmoothTextareaProps) => {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const mirrorRef = useRef<HTMLDivElement | null>(null);
  const [focused, setFocused] = useState(false);
  const [caretHeight, setCaretHeight] = useState(16);
  const prefersReducedMotion = useReducedMotion();
  const caretX = useMotionValue(0);
  const caretY = useMotionValue(0);
  const caretOpacity = useMotionValue(0);
  const spring = prefersReducedMotion
    ? { stiffness: 10000, damping: 100, mass: 0.1 }
    : SPRING;
  const springX = useSpring(caretX, spring);
  const springY = useSpring(caretY, spring);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  };

  const updateCaret = () => {
    const el = ref.current;
    const mirror = mirrorRef.current;
    if (!el || !mirror) return;

    const s = window.getComputedStyle(el);
    mirror.style.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} / ${s.lineHeight} ${s.fontFamily}`;
    mirror.style.letterSpacing = s.letterSpacing;
    mirror.style.padding = s.padding;
    mirror.style.width = `${el.clientWidth}px`;
    mirror.style.boxSizing = "border-box";
    mirror.style.whiteSpace = "pre-wrap";
    mirror.style.wordWrap = "break-word";

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    mirror.textContent = el.value.slice(0, end);
    const marker = document.createElement("span");
    marker.textContent = "\u200b";
    mirror.appendChild(marker);

    const fontSize = parseFloat(s.fontSize) || 14;
    const lineHeight = parseFloat(s.lineHeight) || fontSize * 1.4;
    const height = Math.round(fontSize * 1.25);
    setCaretHeight(height);
    caretX.set(marker.offsetLeft);
    caretY.set(marker.offsetTop + (lineHeight - height) / 2 - el.scrollTop);
    caretOpacity.set(start === end && document.activeElement === el ? 1 : 0);
  };

  const updateCaretRef = useRef(updateCaret);
  updateCaretRef.current = updateCaret;

  useEffect(() => {
    resize();
    if (ref.current && document.activeElement === ref.current) {
      updateCaretRef.current();
    }
  }, [value]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => {
      if (document.activeElement === el) requestAnimationFrame(() => updateCaretRef.current());
    };
    document.addEventListener("selectionchange", sync);
    el.addEventListener("scroll", sync);
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      document.removeEventListener("selectionchange", sync);
      el.removeEventListener("scroll", sync);
      ro.disconnect();
    };
  }, []);

  return (
    <motion.div
      layout
      transition={{ type: "spring", stiffness: 400, damping: 32, mass: 0.6 }}
      animate={{
        boxShadow: focused
          ? "0 0 0 2px hsl(var(--primary) / 0.35)"
          : "0 0 0 0px hsl(var(--primary) / 0)",
      }}
      className={cn(
        "relative rounded-md border border-input bg-background",
        wrapperClassName,
      )}
    >
      <textarea
        {...props}
        value={value}
        ref={ref}
        onFocus={(e) => {
          setFocused(true);
          requestAnimationFrame(() => updateCaretRef.current());
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          caretOpacity.set(0);
          props.onBlur?.(e);
        }}
        onChange={(e) => {
          onChange?.(e);
          requestAnimationFrame(() => {
            resize();
            updateCaretRef.current();
          });
        }}
        onKeyUp={() => updateCaretRef.current()}
        onClick={() => updateCaretRef.current()}
        className={cn(
          "w-full resize-none bg-transparent px-3 py-2 text-sm caret-transparent outline-none placeholder:text-muted-foreground",
          className,
        )}
      />
      <motion.span
        aria-hidden
        style={{ x: springX, y: springY, height: caretHeight, opacity: caretOpacity }}
        className="pointer-events-none absolute left-0 top-0 w-[2px] rounded-full bg-primary"
      />
      <div
        ref={mirrorRef}
        aria-hidden
        className="pointer-events-none invisible absolute left-0 top-0"
      />
    </motion.div>
  );
};

export default SmoothInput;