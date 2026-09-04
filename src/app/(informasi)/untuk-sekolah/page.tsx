import {
  PublicInformationPage,
  informationMetadata,
} from "@/components/marketing/information-page";
export function generateMetadata() {
  return informationMetadata("sekolah");
}
export default function Page() {
  return <PublicInformationPage pageKey="sekolah" />;
}
