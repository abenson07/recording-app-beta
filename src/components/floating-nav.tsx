"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  /** When set, upload slot navigates here instead of opening the file picker. */
  centerHref?: string;
  onUploadClick?: () => void;
};

function navActiveIndex(pathname: string): number {
  if (pathname === "/") return 0;
  if (pathname === "/record") return 1;
  if (pathname === "/projects") return 2;
  if (pathname === "/project/new") return 3;
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
            <NavIcon src="/icons/nav/home.svg" />
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
              <NavIcon src="/icons/nav/upload.svg" />
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
              <NavIcon src="/icons/nav/upload.svg" />
            </button>
          )}

          <Link
            href="/projects"
            className={`flex size-10 items-center justify-center rounded-[48px] transition-colors duration-200 ${
              activeIndex === 2 ? "bg-white/20 text-[#f7f7f7]" : "text-[#f7f7f7] hover:bg-white/10"
            }`}
            aria-current={activeIndex === 2 ? "page" : undefined}
          >
            <NavIcon src="/icons/nav/projects.svg" />
            <span className="sr-only">All projects</span>
          </Link>

          <Link
            href="/project/new"
            className={`flex size-10 items-center justify-center rounded-[48px] transition-colors duration-200 ${
              activeIndex === 3 ? "bg-white/20 text-[#f7f7f7]" : "text-[#f7f7f7] hover:bg-white/10"
            }`}
            aria-current={activeIndex === 3 ? "page" : undefined}
            aria-label="New project"
          >
            <PlusGlyph className="h-4 w-4" />
          </Link>
        </div>
      </nav>
    </>
  );
}

function PlusGlyph({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5.5v13M5.5 12h13"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function NavIcon({ src }: { src: string }) {
  return (
    <Image
      src={src}
      alt=""
      width={18}
      height={18}
      aria-hidden
      className="h-[18px] w-[18px]"
    />
  );
}
