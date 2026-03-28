import type { ReactNode } from "react";

/**
 * Constrains the app to a mobile-width column on large screens (centered “phone” frame).
 */
export function MobileShell({
  children,
  className = "",
  innerClassName = "bg-white",
  frameClassName = "bg-[#d4d0cc]",
}: {
  children: ReactNode;
  className?: string;
  /** Applied to the centered column (e.g. dark theme for record tools). */
  innerClassName?: string;
  /** Outer “phone frame” behind the column. */
  frameClassName?: string;
}) {
  return (
    <div className={`min-h-dvh ${frameClassName}`}>
      <div
        className={`mx-auto flex min-h-dvh w-full max-w-[430px] flex-col shadow-xl ring-1 ring-black/5 ${innerClassName} ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
