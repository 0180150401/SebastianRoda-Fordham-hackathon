"use client";

import { Info } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export function InfoHint({
  text,
  className,
  iconClassName,
}: {
  text: string;
  className?: string;
  iconClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const updatePosition = useCallback(() => {
    const btn = buttonRef.current;
    const panel = panelRef.current;
    if (!btn || !panel) return;
    const r = btn.getBoundingClientRect();
    const maxW = 320;
    const pad = 8;
    const width = Math.min(maxW, window.innerWidth - pad * 2);
    let left = r.left + r.width / 2 - width / 2;
    left = Math.max(pad, Math.min(left, window.innerWidth - width - pad));
    const top = r.bottom + 8;
    const maxH = Math.min(window.innerHeight * 0.5, 280);
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.width = `${width}px`;
    panel.style.maxHeight = `${maxH}px`;
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onResize = () => updatePosition();
    const onScroll = () => updatePosition();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const popover =
    open && mounted ? (
      <>
        <div
          className="fixed inset-0 z-[9998] cursor-default bg-transparent"
          aria-hidden
          onClick={() => setOpen(false)}
        />
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="Details"
          className="fixed z-[9999] overflow-y-auto rounded-lg border border-border bg-card p-3 text-left text-xs leading-relaxed text-foreground shadow-xl"
        >
          {text}
        </div>
      </>
    ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={cn(
          "inline-flex shrink-0 rounded p-0.5 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          className,
        )}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <Info className={cn("h-3.5 w-3.5", iconClassName)} strokeWidth={2} aria-hidden />
      </button>
      {mounted && typeof document !== "undefined" && popover
        ? createPortal(popover, document.body)
        : null}
    </>
  );
}
