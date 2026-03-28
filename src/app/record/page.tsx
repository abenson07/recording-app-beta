import { MobileShell } from "@/components/mobile-shell";
import { RecordingApp } from "@/components/recording-app";
import { Suspense } from "react";

export default function RecordPage() {
  return (
    <MobileShell innerClassName="bg-zinc-950">
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center px-5 py-24 text-sm text-zinc-400">
            Loading…
          </div>
        }
      >
        <RecordingApp />
      </Suspense>
    </MobileShell>
  );
}
