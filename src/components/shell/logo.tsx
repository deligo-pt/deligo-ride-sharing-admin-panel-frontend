import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * DeliGo mark + wordmark. `compact` shows the mark only (collapsed sidebar).
 * The mark is the same file as the favicon (`app/icon.png`) and the other
 * DeliGo panels' `deligoLogo.png`. `markClassName` lets the sidebar spin it.
 */
export function Logo({
  compact = false,
  className,
  markClassName,
}: {
  compact?: boolean;
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <Image
        src="/deligo-logo.png"
        alt=""
        width={36}
        height={36}
        className={cn("size-9 shrink-0 rounded-lg shadow-sm", markClassName)}
      />
      {!compact && (
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-base font-bold tracking-tight">DeliGo</span>
          <span className="text-micro truncate text-muted-foreground">Ride Admin</span>
        </span>
      )}
    </span>
  );
}
