import {
  PublicInformationPage,
  informationMetadata,
} from "@/components/marketing/information-page";
export function generateMetadata() {
  return informationMetadata("aplikasi");
}
export default function Page() {
  return <PublicInformationPage pageKey="aplikasi" />;
}
