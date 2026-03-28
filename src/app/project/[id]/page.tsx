import { MobileShell } from "@/components/mobile-shell";
import { ProjectView } from "@/components/project-view";

type Props = { params: Promise<{ id: string }> };

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  return (
    <MobileShell>
      <ProjectView projectId={id} />
    </MobileShell>
  );
}
