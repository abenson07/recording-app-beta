import { MobileShell } from "@/components/mobile-shell";
import { NewProjectView } from "@/components/new-project-view";

export default function NewProjectPage() {
  return (
    <MobileShell frameClassName="bg-[#141414]" innerClassName="bg-[#1A1A1A]">
      <NewProjectView />
    </MobileShell>
  );
}
