import { MobileShell } from "@/components/mobile-shell";
import { RecordingDetailView } from "@/components/recording-detail-view";

type Props = { params: Promise<{ id: string }> };

export default async function RecordingPage({ params }: Props) {
  const { id } = await params;
  return (
    <MobileShell frameClassName="bg-[#141414]" innerClassName="bg-[#1A1A1A]">
      <RecordingDetailView recordingId={id} />
    </MobileShell>
  );
}
