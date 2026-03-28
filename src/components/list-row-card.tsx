import type { ReactNode } from "react";
import Link from "next/link";

type Base = {
  title: string;
  subtitle: string;
  icon: ReactNode;
  className?: string;
};

export function ListRowCardLink({
  href,
  title,
  subtitle,
  icon,
  className = "",
}: Base & { href: string }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3.5 rounded-2xl bg-white px-4 py-3.5 shadow-sm ring-1 ring-black/[0.04] transition active:scale-[0.99] ${className}`}
    >
      <ListRowCardInner icon={icon} title={title} subtitle={subtitle} />
    </Link>
  );
}

export function ListRowCardStatic({
  title,
  subtitle,
  icon,
  className = "",
}: Base) {
  return (
    <div
      className={`flex items-center gap-3.5 rounded-2xl bg-white px-4 py-3.5 shadow-sm ring-1 ring-black/[0.04] ${className}`}
    >
      <ListRowCardInner icon={icon} title={title} subtitle={subtitle} />
    </div>
  );
}

function ListRowCardInner({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <>
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F5E6D8] text-[#C2410C]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-neutral-800">
          {title}
        </p>
        <p className="mt-0.5 truncate text-[13px] text-neutral-500">
          {subtitle}
        </p>
      </div>
    </>
  );
}

export function HomeGlyph({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9.5Z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}

export function FolderGlyph({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 8V6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" />
    </svg>
  );
}

export function WaveformGlyph({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <rect x="4" y="10" width="3" height="8" rx="1" />
      <rect x="10.5" y="6" width="3" height="12" rx="1" />
      <rect x="17" y="9" width="3" height="9" rx="1" />
    </svg>
  );
}

export function UploadGlyph({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 16V4m0 0 4 4m-4-4L8 8" />
      <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
    </svg>
  );
}
