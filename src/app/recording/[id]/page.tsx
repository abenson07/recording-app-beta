import { MobileShell } from "@/components/mobile-shell";
import { RecordingDetailView } from "@/components/recording-detail-view";

type Props = { params: Promise<{ id: string }> };

export default async function RecordingPage({ params }: Props) {
  const { id } = await params;
  return (
    <MobileShell>
      <RecordingDetailView recordingId={id} />
    </MobileShell>
  );
}
