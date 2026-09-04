import {
  PublicPackagePage,
  packageMetadata,
} from "@/components/marketing/package-page";
export function generateMetadata() {
  return packageMetadata();
}
export default function PackagesPage() {
  return <PublicPackagePage />;
}
