import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getSharedSpotlight } from "@/lib/spotlight-shared-content";
import { spotlightPath } from "@/lib/spotlight-links";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Zona Kreasi",
  description: "Buka konten Zona Kreasi menggunakan akun yang memiliki akses.",
  robots: { index: false, follow: false },
};

export default async function SharedSpotlightPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if ((kind !== "teacher" && kind !== "student") || !/^[a-zA-Z0-9_-]+$/.test(id)) notFound();
  const session = await auth();
  const result = await getSharedSpotlight(kind, id, session?.user);
  const destination = spotlightPath(kind, id);
  if (result.status !== "ready") {
    const message = result.status === "signin"
      ? "Masuk untuk melihat Zona Kreasi ini. Setelah masuk, Anda akan kembali ke konten yang dibagikan."
      : result.status === "forbidden"
        ? `Konten ini hanya dapat dilihat oleh akun ${kind === "student" ? "siswa yang memiliki akses" : "guru atau super admin"}.`
        : "Konten sudah dihapus, belum diterbitkan, atau tidak tersedia untuk kelas/sekolah Anda.";
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-950 px-5 text-white">
        <section className="max-w-md space-y-5 rounded-3xl border border-white/15 bg-white/5 p-7">
          <h1 className="text-2xl font-bold">Zona Kreasi</h1>
          <p className="leading-7 text-slate-300">{message}</p>
          {result.status === "signin" ? (
            <Link className="inline-flex rounded-xl bg-emerald-600 px-5 py-3 font-semibold" href={`/login?callbackUrl=${encodeURIComponent(destination)}`}>Masuk untuk melihat</Link>
          ) : <Link className="inline-flex underline" href="/login">Kembali ke akun</Link>}
          <p className="text-sm text-slate-400">Tautan berbagi tidak mengubah izin akses konten.</p>
        </section>
      </main>
    );
  }
  const { post } = result;
  const isImage = /\.(jpe?g|png|webp)(?:[?#]|$)/i.test(post.videoUrl);
  return (
    <main className="min-h-dvh bg-black text-white">
      <article className="relative mx-auto flex min-h-dvh max-w-xl flex-col justify-center">
        <Link aria-label="Kembali ke Zona Kreasi" className="absolute left-4 top-4 z-10 rounded-full bg-black/70 px-4 py-2 text-sm" href={kind === "student" ? "/student/spotlight" : session?.user.role === "SUPER_ADMIN" ? "/admin" : "/dashboard/spotlight"}>← Kembali</Link>
        {isImage ? (
          // Uploaded media is served directly, matching the existing Spotlight player.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.videoUrl} alt={post.caption} className="max-h-[78dvh] w-full object-contain" />
        ) : <video src={post.videoUrl} poster={post.thumbnailUrl || undefined} controls playsInline preload="metadata" className="max-h-[78dvh] w-full" />}
        <div className="space-y-2 p-5"><p className="font-semibold">{post.author}</p><p className="whitespace-pre-wrap text-sm leading-6 text-slate-200">{post.caption}</p></div>
      </article>
    </main>
  );
}
