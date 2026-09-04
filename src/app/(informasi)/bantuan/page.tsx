import {
  PublicInformationPage,
  informationMetadata,
} from "@/components/marketing/information-page";
export function generateMetadata() {
  return informationMetadata("bantuan");
}
export default function Page() {
  return <PublicInformationPage pageKey="bantuan" />;
}
