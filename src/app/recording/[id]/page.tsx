import { MobileShell } from "@/components/mobile-shell";
import { RecordingDetailView } from "@/components/recording-detail-view";

type Props = { params: Promise<{ id: string }> };

export default async function RecordingPage({ params }: Props) {
  const { id } = await params;
  return (
    <MobileShell frameClassName="bg-[#d7d5c8]" innerClassName="bg-[#d7d5c8]">
      <RecordingDetailView recordingId={id} />
    </MobileShell>
  );
}
