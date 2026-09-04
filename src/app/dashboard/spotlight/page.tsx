import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SpotlightFeed } from "@/components/spotlight/spotlight-feed";
import { redirect } from "next/navigation";
import { spotlightPath } from "@/lib/spotlight-links";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ post?: string }>;
};

export default async function SpotlightPage({ searchParams }: Props) {
  const { post } = await searchParams;
  // Legacy links must resolve the requested post, even outside the first feed page.
  if (post && /^[a-zA-Z0-9_-]+$/.test(post)) redirect(spotlightPath("teacher", post));
  return (
    <DashboardShell activePath="/dashboard/spotlight">
      <SpotlightFeed initialPostId={post} />
    </DashboardShell>
  );
}
