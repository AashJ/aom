import { useEffect, useRef, type RefObject } from "react";
import type { GameHandle } from "@aom/engine";
import favorIconUrl from "@/assets/resource-favor.png";
import foodIconUrl from "@/assets/resource-food.png";
import goldIconUrl from "@/assets/resource-gold.png";
import populationIconUrl from "@/assets/resource-population.png";
import woodIconUrl from "@/assets/resource-wood.png";
import { ClassicHudPanel } from "./classic-hud-panel";

export function ResourceBar({ game }: { game: GameHandle | null }) {
  const foodRef = useRef<HTMLSpanElement>(null);
  const woodRef = useRef<HTMLSpanElement>(null);
  const goldRef = useRef<HTMLSpanElement>(null);
  const populationRef = useRef<HTMLSpanElement>(null);
  const favorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!game) {
      return;
    }

    return game.onStats((stats) => {
      setText(foodRef, stats.food);
      setText(woodRef, stats.wood);
      setText(goldRef, stats.gold);
      setText(populationRef, `${stats.pop}/${stats.popCap}`);
      setText(favorRef, stats.favor);
    });
  }, [game]);

  return (
    <ClassicHudPanel
      as="aside"
      ariaLabel="Resources"
      className="pointer-events-none fixed bottom-0 left-0 z-20 w-32 select-none sm:w-36"
    >
      <ul role="list" className="relative px-2 pt-2 pb-1.5">
        <ResourceRow iconUrl={foodIconUrl} label="Food" valueRef={foodRef} initialValue="100" />
        <ResourceRow iconUrl={woodIconUrl} label="Wood" valueRef={woodRef} initialValue="100" />
        <ResourceRow iconUrl={goldIconUrl} label="Gold" valueRef={goldRef} initialValue="0" />
        <ResourceRow
          iconUrl={populationIconUrl}
          label="Population"
          valueRef={populationRef}
          initialValue="0/0"
        />
        <ResourceRow iconUrl={favorIconUrl} label="Favor" valueRef={favorRef} initialValue="0" />
      </ul>
    </ClassicHudPanel>
  );
}

function ResourceRow({
  iconUrl,
  label,
  valueRef,
  initialValue,
}: {
  iconUrl: string;
  label: string;
  valueRef: RefObject<HTMLSpanElement | null>;
  initialValue: string;
}) {
  return (
    <li className="grid min-h-7 grid-cols-[2rem_minmax(0,1fr)] items-center gap-1 border-b border-black/20 shadow-[0_1px_0_rgb(255_255_255/10%)] last:border-b-0 last:shadow-none sm:min-h-6">
      <div className="flex h-5 w-8 shrink-0 items-center justify-center border border-black/80 bg-[#0c0a08] shadow-[inset_0_0_3px_rgb(0_0_0/90%),0_1px_0_rgb(255_255_255/16%)]">
        <img src={iconUrl} alt="" className="max-h-5 w-full object-contain" />
      </div>
      <div className="min-w-0 font-serif text-base font-medium text-[#eee9d7] [text-shadow:-1px_-1px_0_#211a13,1px_-1px_0_#211a13,-1px_1px_0_#211a13,1px_1px_0_#211a13,0_2px_2px_rgb(0_0_0/80%)] tabular-nums sm:text-sm">
        <span className="sr-only">{label}: </span>
        <span ref={valueRef}>{initialValue}</span>
      </div>
    </li>
  );
}

function setText(ref: RefObject<HTMLSpanElement | null>, value: number | string) {
  if (ref.current) {
    ref.current.textContent = String(value);
  }
}
