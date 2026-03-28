"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderGlyph,
  HomeGlyph,
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
  if (pathname === "/projects") return 1;
  if (pathname === "/recordings") return 2;
  if (pathname === "/record") return 3;
  return -1;
}

export function FloatingNav({ centerHref, onUploadClick }: Props) {
  const pathname = usePathname();
  const activeIndex = navActiveIndex(pathname);
  const showPill = activeIndex >= 0;

  return (
    <nav
      className="pointer-events-none fixed bottom-0 left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 px-5 pb-6 pt-4"
      aria-label="Main"
    >
      <div className="pointer-events-auto mx-auto w-full max-w-[320px] rounded-full border border-white/20 bg-black/95 px-1.5 py-1.5 shadow-lg shadow-black/30 backdrop-blur-md">
        <div className="relative h-11 w-full">
          {/* Sliding active indicator (1/4 width for 4 tabs) */}
          <div
            className="absolute bottom-0 left-0 h-[2px] w-1/4 rounded-full bg-[#D35400] transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
            style={{
              transform: showPill
                ? `translateX(calc(${activeIndex} * 100%))`
                : "translateX(0)",
              opacity: showPill ? 1 : 0,
            }}
            aria-hidden
          />

          <div className="relative z-10 grid h-11 w-full grid-cols-4">
            <Link
              href="/"
              className={`flex items-center justify-center rounded-xl transition-colors duration-200 ${
                activeIndex === 0
                  ? "text-[#D35400]"
                  : "text-white hover:text-white/80"
              }`}
              aria-current={activeIndex === 0 ? "page" : undefined}
            >
              <HomeGlyph className="h-[22px] w-[22px]" />
              <span className="sr-only">Home</span>
            </Link>

            <Link
              href="/projects"
              className={`flex items-center justify-center rounded-xl transition-colors duration-200 ${
                activeIndex === 1
                  ? "text-[#D35400]"
                  : "text-white hover:text-white/80"
              }`}
              aria-current={activeIndex === 1 ? "page" : undefined}
            >
              <FolderGlyph className="h-[22px] w-[22px]" />
              <span className="sr-only">All projects</span>
            </Link>

            <Link
              href="/recordings"
              className={`flex items-center justify-center rounded-xl transition-colors duration-200 ${
                activeIndex === 2
                  ? "text-[#D35400]"
                  : "text-white hover:text-white/80"
              }`}
              aria-current={activeIndex === 2 ? "page" : undefined}
            >
              <WaveformGlyph className="h-[22px] w-[22px]" />
              <span className="sr-only">All recordings</span>
            </Link>

            {centerHref ? (
              <Link
                href={centerHref}
                className={`flex items-center justify-center rounded-xl transition-colors duration-200 ${
                  activeIndex === 3
                    ? "text-[#D35400]"
                    : "text-white hover:text-white/80"
                }`}
                aria-label="Add recording"
              >
                <UploadGlyph className="h-[22px] w-[22px]" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={onUploadClick}
                className={`flex items-center justify-center rounded-xl transition-colors duration-200 ${
                  activeIndex === 3
                    ? "text-[#D35400]"
                    : "text-white hover:text-white/80"
                }`}
                aria-label="Upload recording"
              >
                <UploadGlyph className="h-[22px] w-[22px]" />
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
