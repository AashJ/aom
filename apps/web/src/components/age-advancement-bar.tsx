import { useEffect, useState, type CSSProperties } from "react";
import { AGE_NAMES, type AgeAdvancementState, type GameHandle } from "@aom/engine";
import { ClassicHudPanel } from "./classic-hud-panel";

export function AgeAdvancementBar({ game }: { game: GameHandle | null }) {
  const [advancement, setAdvancement] = useState<AgeAdvancementState | null>(null);

  useEffect(() => {
    if (!game) {
      setAdvancement(null);
      return;
    }

    return game.onPlayerState((state) => setAdvancement(state.ageAdvancement));
  }, [game]);

  if (advancement === null) {
    return null;
  }

  const progress = Math.max(0, Math.min(1, advancement.progress));
  const percentage = Math.round(progress * 100);
  const targetAgeName = AGE_NAMES[advancement.targetAge] ?? "Next Age";
  const progressStyle = {
    "--age-advance-progress": `${percentage}%`,
  } as CSSProperties;

  return (
    <ClassicHudPanel
      as="section"
      ariaLabel={`Advancing to ${targetAgeName}`}
      className="pointer-events-none fixed top-3 left-1/2 z-30 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 select-none px-3 pt-3 pb-2 sm:w-96 sm:px-4 sm:pt-2.5"
    >
      <div className="relative grid gap-1">
        <p className="truncate text-center font-serif text-base font-semibold text-[#f4db78] [text-shadow:-1px_-1px_0_#211a13,1px_-1px_0_#211a13,-1px_1px_0_#211a13,1px_1px_0_#211a13,0_2px_2px_rgb(0_0_0/80%)] sm:text-sm">
          Advancing to {targetAgeName}
        </p>
        <div
          role="progressbar"
          aria-label={`Age advancement: ${targetAgeName}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentage}
          className="h-3 overflow-hidden border border-[#19130d] bg-[#17130f] p-px [box-shadow:inset_0_0_5px_rgb(0_0_0/95%),0_1px_0_rgb(235_226_183/45%)] sm:h-2"
          style={progressStyle}
        >
          <div className="h-full w-(--age-advance-progress) bg-linear-to-r from-[#806a24] via-[#d5bb5a] to-[#f4db78] [box-shadow:inset_0_1px_0_rgb(255_246_171/70%),0_0_4px_rgb(244_219_120/55%)]" />
        </div>
      </div>
    </ClassicHudPanel>
  );
}
