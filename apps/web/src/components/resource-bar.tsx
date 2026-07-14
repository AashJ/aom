import { useEffect, useRef } from "react";
import type { GameHandle } from "@aom/engine";

export function ResourceBar({ game }: { game: GameHandle | null }) {
  const readoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!game) {
      return;
    }

    const el = readoutRef.current;

    if (!el) {
      return;
    }

    return game.onStats((stats) => {
      el.textContent = `food ${stats.food}  wood ${stats.wood}  gold ${stats.gold}  favor ${stats.favor}  pop ${stats.pop}/${stats.popCap}`;
    });
  }, [game]);

  return (
    <div
      ref={readoutRef}
      className="pointer-events-none absolute top-3 left-3 rounded-full bg-black/50 px-3 py-1 font-mono text-xs text-slate-200 whitespace-pre select-none"
    >
      {"food 100  wood 100  gold 0  favor 0  pop 0/0"}
    </div>
  );
}
