import { ParentPortalClient } from "@/components/parent/parent-portal-client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { parentCookieName, verifyParentSessionToken } from "@/lib/parent-access";

export const dynamic = "force-dynamic";

export default async function OrangTuaPortalPage() {
  const cookieStore = await cookies();
  const parentSession = cookieStore.get(parentCookieName())?.value;

  if (!parentSession || !verifyParentSessionToken(parentSession)) {
    redirect("/orangtua");
  }

  return <ParentPortalClient />;
}
