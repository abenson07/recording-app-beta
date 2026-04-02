import { HomeView } from "@/components/home-view";
import { MobileShell } from "@/components/mobile-shell";

export default function Home() {
  return (
    <main className="min-h-dvh flex-1 font-sans">
      <MobileShell
        frameClassName="bg-[#d7d5c8]"
        innerClassName="bg-[#d7d5c8]"
      >
        <HomeView />
      </MobileShell>
    </main>
  );
}
