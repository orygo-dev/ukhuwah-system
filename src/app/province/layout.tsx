import { getCurrentProvinceAdmin } from "@/lib/province-admin";

export const dynamic = "force-dynamic";

export default async function ProvinceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await getCurrentProvinceAdmin("/province");
  return <>{children}</>;
}
