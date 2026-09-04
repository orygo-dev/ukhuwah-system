import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import type { Tool } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ToolCardProps = {
  tool: Tool;
};

export function ToolCard({ tool }: ToolCardProps) {
  const Icon = tool.icon;

  return (
    <Link href={`/dashboard/tools/${tool.slug}`}>
      <Card className="group h-full overflow-hidden rounded-2xl border-emerald-100 bg-white transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_16px_40px_rgba(15,76,129,0.12)]">
        <CardContent className="p-4 sm:p-5">
          <div className="mb-4 flex items-start justify-between">
            <div
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white"
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex flex-col items-end gap-1">
              {tool.popular && (
                <Badge variant="warning" className="text-[10px]">
                  Populer
                </Badge>
              )}
              <Badge variant="secondary" className="text-[10px]">
                {tool.creditCost} kredit
              </Badge>
            </div>
          </div>

          <h3 className="mb-1 font-extrabold leading-snug text-slate-950 group-hover:text-primary">
            {tool.name}
          </h3>
          <p className="mb-4 line-clamp-2 text-sm leading-6 text-muted-foreground">
            {tool.description}
          </p>

          <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-sm font-extrabold text-primary transition-colors group-hover:bg-primary group-hover:text-white">
            <span className="inline-flex items-center">
            <Sparkles className="mr-1 h-3.5 w-3.5" />
            Buat sekarang
            </span>
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
