import { AllProjectsView } from "@/components/all-projects-view";
import { MobileShell } from "@/components/mobile-shell";

export default function ProjectsPage() {
  return (
    <main className="min-h-dvh flex-1 font-sans">
      <MobileShell
        frameClassName="bg-[#141414]"
        innerClassName="bg-[#1A1A1A]"
      >
        <AllProjectsView />
      </MobileShell>
    </main>
  );
}
