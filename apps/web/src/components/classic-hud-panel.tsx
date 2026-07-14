import type { ReactNode } from "react";
import { cn } from "@aom/ui/lib/utils";

export function ClassicHudPanel({
  as: Component,
  ariaLabel,
  className,
  children,
}: {
  as: "aside" | "section";
  ariaLabel: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Component
      aria-label={ariaLabel}
      className={cn(
        "border-t border-r border-t-[#282017] border-r-[#221a12] bg-[#716f69] [background-image:radial-gradient(circle_at_18%_22%,rgb(255_255_255/10%)_0_0.6px,transparent_0.9px),radial-gradient(circle_at_73%_65%,rgb(24_20_15/14%)_0_0.7px,transparent_1px),linear-gradient(90deg,rgb(33_27_20/58%)_0,transparent_9%,rgb(255_251_226/7%)_43%,transparent_82%,rgb(31_25_18/48%)_100%),linear-gradient(180deg,#89867d_0%,#6d6b66_47%,#7c7970_100%)] [background-size:13px_11px,17px_15px,100%_100%,100%_100%] [box-shadow:inset_2px_0_0_#aca78f,inset_5px_0_0_#4b4030,inset_-4px_0_0_#3b3124,inset_0_5px_0_#bcb69c,inset_0_8px_0_#4e4436,1px_-1px_0_#17120d,3px_-3px_8px_rgb(0_0_0/45%)] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:z-0 before:h-1 before:bg-linear-to-b before:from-[#e4dcb2] before:via-[#8f8671] before:to-[#342a1e] before:content-[''] after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:z-0 after:w-1 after:bg-linear-to-l after:from-[#2a2117] after:via-[#746b57] after:to-[#c6bea0] after:content-['']",
        className,
      )}
    >
      {children}
    </Component>
  );
}
