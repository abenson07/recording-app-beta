import { MobileShell } from "@/components/mobile-shell";
import { ProjectView } from "@/components/project-view";

type Props = { params: Promise<{ id: string }> };

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  return (
    <MobileShell frameClassName="bg-[#141414]" innerClassName="bg-[#1A1A1A]">
      <ProjectView projectId={id} />
    </MobileShell>
  );
}
