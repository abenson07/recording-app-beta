import type { ReactNode } from "react";

/**
 * Constrains the app to a mobile-width column on large screens (centered “phone” frame).
 */
export function MobileShell({
  children,
  className = "",
  innerClassName = "bg-white",
}: {
  children: ReactNode;
  className?: string;
  /** Applied to the centered column (e.g. dark theme for record tools). */
  innerClassName?: string;
}) {
  return (
    <div className="min-h-dvh bg-[#d4d0cc]">
      <div
        className={`mx-auto flex min-h-dvh w-full max-w-[430px] flex-col shadow-xl ring-1 ring-black/5 ${innerClassName} ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
