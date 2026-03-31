"use client";

import { MobileShell } from "@/components/mobile-shell";
import { RecordingDetailView } from "@/components/recording-detail-view";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function RecordingViewGate() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id")?.trim() ?? "";

  if (!id) {
    return (
      <MobileShell frameClassName="bg-[#141414]" innerClassName="bg-[#1A1A1A]">
        <div className="flex flex-1 items-center justify-center px-6 text-sm text-zinc-400">
          Missing recording id. Open a recording from the list.
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell frameClassName="bg-[#141414]" innerClassName="bg-[#1A1A1A]">
      <RecordingDetailView recordingId={id} />
    </MobileShell>
  );
}

export default function RecordingViewPage() {
  return (
    <Suspense
      fallback={
        <MobileShell frameClassName="bg-[#141414]" innerClassName="bg-[#1A1A1A]">
          <div className="flex flex-1 items-center justify-center px-6 text-sm text-zinc-400">
            Loading…
          </div>
        </MobileShell>
      }
    >
      <RecordingViewGate />
    </Suspense>
  );
}
