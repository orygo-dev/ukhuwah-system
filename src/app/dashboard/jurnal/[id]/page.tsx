import { JournalDetailClient } from "@/components/journals/journal-detail-client";

type Props = { params: Promise<{ id: string }> };

export default async function JurnalDetailPage({ params }: Props) {
  const { id } = await params;
  return <JournalDetailClient journalId={id} />;
}
