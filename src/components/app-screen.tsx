import type { ReactNode } from "react";

/** Dark hero strip + optional metadata under the orange title */
export function AppScreenHeader({
  greeting,
  title,
  meta,
}: {
  greeting: string;
  title: string;
  meta?: string;
}) {
  return (
    <header className="shrink-0 px-5 pt-8 pb-5">
      <p className="text-[15px] font-medium text-white/95">{greeting}</p>
      <h1 className="mt-1.5 text-[26px] font-bold leading-[1.15] tracking-tight text-[#D35400]">
        {title}
      </h1>
      {meta ? (
        <p className="mt-2 text-[13px] text-white/55">{meta}</p>
      ) : null}
    </header>
  );
}

/** Rounded beige sheet over the dark background */
export function AppContentSheet({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-[32px] bg-[#F2EFE9] shadow-[0_-8px_40px_rgba(0,0,0,0.12)]">
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 pb-32 pt-6">
        {children}
      </div>
    </div>
  );
}

export function AppSectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[13px] font-semibold tracking-wide text-neutral-600">
      {children}
    </h2>
  );
}
