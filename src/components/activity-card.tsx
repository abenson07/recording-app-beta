"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useLongPress } from "@/hooks/use-long-press";
import { FolderGlyph, WaveformGlyph } from "@/components/list-row-card";

type CardBaseProps = {
  title: string;
  subtitle: string;
  href?: string;
  className?: string;
  onClick?: () => void;
  /** When set with `href`, long-press opens actions; tap still navigates. */
  onLongPress?: () => void;
};

type RecordingCardProps = CardBaseProps & {
  variant: "recording";
  state?: "default" | "open";
  summary?: string;
  addToRecordingHref?: string;
  seeOutputHref?: string;
  addToRecordingLabel?: string;
  seeOutputLabel?: string;
};

type ProjectCardProps = CardBaseProps & {
  variant: "project";
  state?: "default";
};

export type ActivityCardProps = RecordingCardProps | ProjectCardProps;

export function ActivityCard(props: ActivityCardProps) {
  const state = props.state ?? "default";
  const isOpenRecording = props.variant === "recording" && state === "open";
  const wholeCardNav = Boolean(props.href) && !isOpenRecording;
  const useLink = wholeCardNav && !props.onLongPress;
  const useLongPressNav = wholeCardNav && Boolean(props.onLongPress);
  /** Long-press only (e.g. recording file rows with no navigation). */
  const useLongPressOnly =
    Boolean(props.onLongPress) && !props.href && !isOpenRecording;

  const className = `rounded-[10px] bg-[#EAE9E5] px-3 py-4 ${isOpenRecording ? "space-y-3.5" : ""} ${props.className ?? ""}`;

  const inner = (
    <>
      <CardHeader
        title={props.title}
        subtitle={props.subtitle}
        href={wholeCardNav ? undefined : props.href}
        variant={props.variant}
      />

      {isOpenRecording ? (
        <>
          <p
            className="rounded-[10px] border border-[#D9D7CA] bg-[#FBFBF9] px-3 py-2 text-[14px] leading-[1.25] text-black/65"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {props.summary ??
              "Something short and sweet goes here. Nothing too long. Just enough to jog the memory a bit."}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <ActionPill
              href={props.addToRecordingHref}
              icon={<WaveformGlyph className="h-[20px] w-[20px]" />}
              label={props.addToRecordingLabel ?? "Add to recording"}
            />
            <ActionPill
              href={props.seeOutputHref}
              icon={<FolderGlyph className="h-[20px] w-[20px]" />}
              label={props.seeOutputLabel ?? "See output"}
            />
          </div>
        </>
      ) : null}
    </>
  );

  if (useLink) {
    return (
      <Link href={props.href!} className={`block ${className}`}>
        {inner}
      </Link>
    );
  }

  if (useLongPressNav) {
    return (
      <LongPressCardShell
        className={className}
        href={props.href!}
        onLongPress={props.onLongPress!}
      >
        {inner}
      </LongPressCardShell>
    );
  }

  if (useLongPressOnly) {
    return (
      <LongPressOnlyShell className={className} onLongPress={props.onLongPress!}>
        {inner}
      </LongPressOnlyShell>
    );
  }

  return (
    <article className={className} onClick={props.onClick}>
      {inner}
    </article>
  );
}

function LongPressOnlyShell({
  className,
  onLongPress,
  children,
}: {
  className: string;
  onLongPress: () => void;
  children: ReactNode;
}) {
  const lp = useLongPress({ onLongPress });

  return (
    <div
      className={`block select-none ${className}`}
      onPointerDown={lp.onPointerDown}
      onPointerUp={lp.onPointerUp}
      onPointerCancel={lp.onPointerCancel}
      onPointerLeave={lp.onPointerLeave}
      onClick={() => {
        lp.consumeClick();
      }}
    >
      {children}
    </div>
  );
}

function LongPressCardShell({
  className,
  href,
  onLongPress,
  children,
}: {
  className: string;
  href: string;
  onLongPress: () => void;
  children: ReactNode;
}) {
  const router = useRouter();
  const lp = useLongPress({ onLongPress });

  return (
    <div
      role="link"
      tabIndex={0}
      className={`block cursor-pointer select-none ${className}`}
      onPointerDown={lp.onPointerDown}
      onPointerUp={lp.onPointerUp}
      onPointerCancel={lp.onPointerCancel}
      onPointerLeave={lp.onPointerLeave}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(href);
        }
      }}
      onClick={() => {
        if (lp.consumeClick()) return;
        router.push(href);
      }}
    >
      {children}
    </div>
  );
}

function CardHeader({
  title,
  subtitle,
  href,
  variant,
}: {
  title: string;
  subtitle: string;
  href?: string;
  variant: "recording" | "project";
}) {
  const content = (
    <div className="flex items-center gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-[#ff4e1a]">
        {variant === "recording" ? (
          <WaveformGlyph className="h-[20px] w-[20px]" />
        ) : (
          <FolderGlyph className="h-[20px] w-[20px]" />
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate font-serif text-[14px] leading-[1.05]">{title}</p>
        <p className="truncate text-[14px] text-black/65">{subtitle}</p>
      </div>
    </div>
  );

  if (!href) return content;
  return <Link href={href}>{content}</Link>;
}

function ActionPill({
  href,
  icon,
  label,
}: {
  href?: string;
  icon: ReactNode;
  label: string;
}) {
  const content = (
    <div className="flex items-center gap-2 rounded-[10px] bg-white px-3 py-2.5 text-[14px] text-black/80">
      <span className="shrink-0 text-[#ff4e1a]">{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  );

  if (!href) return content;
  return (
    <Link href={href} onClick={(e) => e.stopPropagation()}>
      {content}
    </Link>
  );
}
