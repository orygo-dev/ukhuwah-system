import {
  PublicInformationPage,
  informationMetadata,
} from "@/components/marketing/information-page";
export function generateMetadata() {
  return informationMetadata("siswa");
}
export default function Page() {
  return <PublicInformationPage pageKey="siswa" />;
}
