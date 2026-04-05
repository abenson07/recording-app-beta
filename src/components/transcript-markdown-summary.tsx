"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import Markdown, { type Components } from "react-markdown";

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h2 className="mt-3 text-base font-semibold leading-snug text-black/85 first:mt-0">
      {children}
    </h2>
  ),
  h2: ({ children }) => (
    <h2 className="mt-3 text-[15px] font-semibold leading-snug text-black/85 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-2.5 text-sm font-semibold text-black/80 first:mt-0">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="mt-2 first:mt-0 [&:empty]:hidden">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mt-2 list-disc pl-4 first:mt-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-2 list-decimal pl-4 first:mt-0">{children}</ol>
  ),
  li: ({ children }) => <li className="mt-1">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-black/80">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-black/75 underline underline-offset-2"
      target="_blank"
      rel="noreferrer noopener"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-black/[0.06] px-1 py-0.5 font-mono text-[13px]">
      {children}
    </code>
  ),
};

export function TranscriptMarkdownSummary({
  markdown,
  loading,
  emptyMessage,
}: {
  markdown: string;
  loading: boolean;
  emptyMessage: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isClampedOverflow, setIsClampedOverflow] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (loading || !markdown.trim()) {
      setIsClampedOverflow(false);
      return;
    }
    if (expanded) {
      return;
    }

    const el = contentRef.current;
    if (!el) return;

    const measure = () => {
      setIsClampedOverflow(el.scrollHeight > el.clientHeight + 1);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [markdown, expanded, loading]);

  if (loading) {
    return (
      <p className="text-sm leading-relaxed text-black/70">Loading outputs...</p>
    );
  }

  if (!markdown.trim()) {
    return (
      <p className="text-sm leading-relaxed text-black/70">{emptyMessage}</p>
    );
  }

  const showToggle = expanded || isClampedOverflow;

  return (
    <div className="flex flex-col gap-1.5">
      <div
        ref={contentRef}
        className={
          expanded
            ? "text-sm leading-relaxed text-black/70"
            : "line-clamp-4 overflow-hidden text-sm leading-relaxed text-black/70"
        }
      >
        <div className="[&_*:first-child]:mt-0">
          <Markdown components={markdownComponents}>{markdown}</Markdown>
        </div>
      </div>
      {showToggle ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-fit text-sm text-black/75 underline underline-offset-2"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      ) : null}
    </div>
  );
}

function summaryWithLabelMarkdown(label: string, body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";
  const key = label.trim().replace(/:\s*$/, "");
  return `**${key}:**\n\n${trimmed}`;
}

/** Project / folder summary with line-clamp, read more, and Markdown body (e.g. `##` headings). */
export function SummaryMarkdownSection({
  label,
  markdown,
  loading = false,
}: {
  label: string;
  markdown: string;
  loading?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isClampedOverflow, setIsClampedOverflow] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const fullMarkdown = useMemo(
    () => summaryWithLabelMarkdown(label, markdown),
    [label, markdown],
  );

  useLayoutEffect(() => {
    if (loading || !fullMarkdown) {
      setIsClampedOverflow(false);
      return;
    }
    if (expanded) {
      return;
    }

    const el = contentRef.current;
    if (!el) return;

    const measure = () => {
      setIsClampedOverflow(el.scrollHeight > el.clientHeight + 1);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fullMarkdown, expanded, loading]);

  if (loading) {
    return (
      <p className="text-[15px] leading-relaxed text-black/75">Loading…</p>
    );
  }

  if (!fullMarkdown) {
    return null;
  }

  const showToggle = expanded || isClampedOverflow;

  return (
    <>
      <div
        ref={contentRef}
        className={
          expanded
            ? "text-[15px] leading-relaxed text-black/75"
            : "line-clamp-4 overflow-hidden text-[15px] leading-relaxed text-black/75"
        }
      >
        <div className="[&_*:first-child]:mt-0">
          <Markdown components={markdownComponents}>{fullMarkdown}</Markdown>
        </div>
      </div>
      {showToggle ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 inline-block text-left text-[12px] font-medium underline"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      ) : null}
    </>
  );
}
