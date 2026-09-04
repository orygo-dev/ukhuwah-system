import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

type AppLogoProps = {
  appName?: string;
  logoUrl?: string;
  href?: string;
  showName?: boolean;
  className?: string;
  imageClassName?: string;
  nameClassName?: string;
  fallbackClassName?: string;
};

export function AppLogo({
  appName = APP_NAME,
  logoUrl,
  href,
  showName = true,
  className,
  imageClassName,
  nameClassName,
  fallbackClassName,
}: AppLogoProps) {
  const initials = appName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const content = (
    <>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={appName}
          className={cn(
            showName
              ? "h-8 w-auto max-w-[140px] object-contain"
              : "h-8 w-auto max-w-[140px] object-contain",
            imageClassName
          )}
        />
      ) : (
        <span
          className={cn(
            "text-sm font-bold tracking-tight text-primary",
            fallbackClassName,
            imageClassName
          )}
        >
          {initials}
        </span>
      )}
      {showName && (
        <span className={cn("truncate font-semibold", nameClassName)}>
          {appName}
        </span>
      )}
    </>
  );

  const wrapperClass = cn("flex min-w-0 items-center gap-2", className);

  if (href) {
    return (
      <Link href={href} className={wrapperClass}>
        {content}
      </Link>
    );
  }

  return <div className={wrapperClass}>{content}</div>;
}
