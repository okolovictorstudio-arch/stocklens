import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <div className="size-14 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground mb-4">
        <Search className="size-7" />
      </div>
      <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        404 — Page Not Found
      </span>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        Asset or Page Not Found
      </h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        The ticker symbol or URL you are looking for doesn&apos;t exist or has been delisted.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Link
          href="/"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <ArrowLeft className="size-3.5" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    </div>
  );
}
