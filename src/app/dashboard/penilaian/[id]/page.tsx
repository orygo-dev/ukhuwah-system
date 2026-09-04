import { GradingEntryClient } from "@/components/grading/grading-entry-client";

type Props = { params: Promise<{ id: string }> };

export default async function PenilaianDetailPage({ params }: Props) {
  const { id } = await params;
  return <GradingEntryClient assessmentId={id} />;
}
