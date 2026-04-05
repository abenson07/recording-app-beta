"use client";

import type { ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** z above FloatingNav (110) */
  className?: string;
};

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  className = "",
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title ?? "Actions"}
        className={`max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-black/[0.08] bg-[#f2f1ed] p-5 shadow-xl ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title ? (
          <h2
            className="text-lg font-medium text-[#1e1e1e]"
            style={{ fontFamily: "var(--font-instrument-serif), serif" }}
          >
            {title}
          </h2>
        ) : null}
        {children}
      </div>
    </div>
  );
}
