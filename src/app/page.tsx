import { HomeView } from "@/components/home-view";
import { MobileShell } from "@/components/mobile-shell";

export default function Home() {
  return (
    <main className="min-h-dvh flex-1 font-sans">
      <MobileShell>
        <HomeView />
      </MobileShell>
    </main>
  );
}
