import { notFound } from "next/navigation";
import {
  PublicInformationPage,
  informationMetadata,
} from "@/components/marketing/information-page";

const keys = ["kelas", "ai", "zona-baca", "spotlight"] as const;
function featureKey(slug: string) {
  return keys.find((key) => key === slug) ?? notFound();
}
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  return informationMetadata(featureKey((await params).slug));
}
export default async function FeaturePage({ params }: Props) {
  return <PublicInformationPage pageKey={featureKey((await params).slug)} />;
}
