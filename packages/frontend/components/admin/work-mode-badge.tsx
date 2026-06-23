import { MapPin, Monitor } from "lucide-react"
import { cn } from "@/lib/utils"

export type WorkMode = "in-person" | "remote"

export function WorkModeBadge({
  mode,
  className,
}: Readonly<{ mode: WorkMode; className?: string }>) {
  const isRemote = mode === "remote"

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium leading-none",
        isRemote
          ? "bg-sky-500/20 text-sky-600 ring-1 ring-inset ring-sky-400/40 dark:bg-sky-400/25 dark:text-sky-200 dark:ring-sky-300/35"
          : "bg-emerald-500/20 text-emerald-600 ring-1 ring-inset ring-emerald-400/40 dark:bg-emerald-400/25 dark:text-emerald-200 dark:ring-emerald-300/35",
        className,
      )}
    >
      {isRemote ? (
        <Monitor className="size-3 shrink-0 text-sky-500 dark:text-sky-300" aria-hidden />
      ) : (
        <MapPin className="size-3 shrink-0 text-emerald-500 dark:text-emerald-300" aria-hidden />
      )}
      {isRemote ? "Remote" : "In person"}
    </span>
  )
}
