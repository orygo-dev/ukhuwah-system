import { notFound } from "next/navigation";
import {
  PublicPackagePage,
  packageMetadata,
} from "@/components/marketing/package-page";

function catalogAudience(value: string) {
  if (value === "guru" || value === "sekolah") return value;
  return notFound();
}
type Props = { params: Promise<{ audience: string }> };
export async function generateMetadata({ params }: Props) {
  return packageMetadata(catalogAudience((await params).audience));
}
export default async function PackagePage({ params }: Props) {
  return (
    <PublicPackagePage audience={catalogAudience((await params).audience)} />
  );
}
