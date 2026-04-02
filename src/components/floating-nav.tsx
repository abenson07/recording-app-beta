"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  UploadGlyph,
  WaveformGlyph,
} from "@/components/list-row-card";

type Props = {
  /** When set, upload slot navigates here instead of opening the file picker. */
  centerHref?: string;
  onUploadClick?: () => void;
};

function navActiveIndex(pathname: string): number {
  if (pathname === "/") return 0;
  if (pathname === "/record") return 1;
  if (pathname === "/projects") return 2;
  return -1;
}

export function FloatingNav({ centerHref, onUploadClick }: Props) {
  const pathname = usePathname();
  const activeIndex = navActiveIndex(pathname);

  return (
    <>
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] h-[90px] bg-gradient-to-b from-transparent to-[#d7d5c8] to-[70%]"
        aria-hidden
      />
      <nav
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[110] flex justify-center px-5 pb-6 pt-4"
        aria-label="Main"
      >
        <div className="pointer-events-auto flex h-[57px] items-center justify-center gap-3 rounded-[64px] bg-black px-2.5 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
          <Link
            href="/"
            className={`flex size-10 items-center justify-center rounded-[48px] transition-colors duration-200 ${
              activeIndex === 0 ? "bg-white/20 text-[#f7f7f7]" : "text-[#f7f7f7] hover:bg-white/10"
            }`}
            aria-current={activeIndex === 0 ? "page" : undefined}
          >
            <AirplayGlyph className="h-4 w-4" />
            <span className="sr-only">Home</span>
          </Link>

          {centerHref ? (
            <Link
              href={centerHref}
              className={`flex size-10 items-center justify-center rounded-[48px] transition-colors duration-200 ${
                activeIndex === 1 ? "bg-white/20 text-[#f7f7f7]" : "text-[#f7f7f7] hover:bg-white/10"
              }`}
              aria-current={activeIndex === 1 ? "page" : undefined}
              aria-label="Add recording"
            >
              <UploadGlyph className="h-4 w-4" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={onUploadClick}
              className={`flex size-10 items-center justify-center rounded-[48px] transition-colors duration-200 ${
                activeIndex === 1 ? "bg-white/20 text-[#f7f7f7]" : "text-[#f7f7f7] hover:bg-white/10"
              }`}
              aria-label="Upload recording"
            >
              <UploadGlyph className="h-4 w-4" />
            </button>
          )}

          <Link
            href="/projects"
            className={`flex size-10 items-center justify-center rounded-[48px] transition-colors duration-200 ${
              activeIndex === 2 ? "bg-white/20 text-[#f7f7f7]" : "text-[#f7f7f7] hover:bg-white/10"
            }`}
            aria-current={activeIndex === 2 ? "page" : undefined}
          >
            <WaveformGlyph className="h-4 w-4" />
            <span className="sr-only">All projects</span>
          </Link>
        </div>
      </nav>
    </>
  );
}

function AirplayGlyph({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6.2 4.5h11.6c1.05 0 1.9.85 1.9 1.9v7.6c0 1.05-.85 1.9-1.9 1.9H14.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 15.9H6.2c-1.05 0-1.9-.85-1.9-1.9V6.4c0-1.05.85-1.9 1.9-1.9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 12.3L8.1 17.6h7.8L12 12.3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
