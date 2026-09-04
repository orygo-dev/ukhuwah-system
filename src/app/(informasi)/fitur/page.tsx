import {
  PublicInformationPage,
  informationMetadata,
} from "@/components/marketing/information-page";
export function generateMetadata() {
  return informationMetadata("fitur");
}
export default function Page() {
  return <PublicInformationPage pageKey="fitur" />;
}
