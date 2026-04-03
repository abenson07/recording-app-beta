import { MobileShell } from "@/components/mobile-shell";
import { ProjectFolderView } from "@/components/project-folder-view";

type Props = { params: Promise<{ id: string; folderId: string }> };

export default async function ProjectFolderPage({ params }: Props) {
  const { id, folderId } = await params;
  return (
    <MobileShell frameClassName="bg-[#141414]" innerClassName="bg-[#1A1A1A]">
      <ProjectFolderView projectId={id} folderId={folderId} />
    </MobileShell>
  );
}
