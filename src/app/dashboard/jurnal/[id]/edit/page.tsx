import { JournalFormClient } from "@/components/journals/journal-form-client";

type Props = { params: Promise<{ id: string }> };

export default async function JurnalEditPage({ params }: Props) {
  const { id } = await params;
  return <JournalFormClient mode="edit" journalId={id} />;
}
