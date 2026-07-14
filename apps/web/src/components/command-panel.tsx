import { useEffect, useState } from "react";
import {
  TYPE_BARRACKS,
  TYPE_HOUSE,
  TYPE_ICONS,
  TYPE_VILLAGER,
  UNIT_TYPES,
  type GameHandle,
  type IconConfig,
  type SelectionSummary,
} from "@aom/engine";

export function CommandPanel({ game }: { game: GameHandle | null }) {
  const [selection, setSelection] = useState<SelectionSummary | null>(null);
  const [resources, setResources] = useState({ food: 0, wood: 0, gold: 0, favor: 0 });
  const [progress, setProgress] = useState(-1);
  const producerId = selection?.producerId ?? -1;

  useEffect(() => {
    if (!game) {
      return;
    }

    const unsubscribeSelection = game.onSelection(setSelection);
    const unsubscribeStats = game.onStats((stats) => {
      setResources({ food: stats.food, wood: stats.wood, gold: stats.gold, favor: stats.favor });
    });

    return () => {
      unsubscribeSelection();
      unsubscribeStats();
    };
  }, [game]);

  useEffect(() => {
    setProgress(-1);

    if (!game || producerId === -1) {
      return;
    }

    setProgress(game.producerProgress());

    const interval = window.setInterval(() => {
      setProgress(game.producerProgress());
    }, 100);

    return () => window.clearInterval(interval);
  }, [game, producerId]);

  if (!game || !selection || (selection.villagers === 0 && selection.producerId === -1)) {
    return null;
  }

  const house = UNIT_TYPES[TYPE_HOUSE]!;
  const barracks = UNIT_TYPES[TYPE_BARRACKS]!;
  const trained = selection.producerId !== -1 ? UNIT_TYPES[selection.producerType]!.trains : -1;
  const trainedStats = trained !== -1 ? UNIT_TYPES[trained]! : null;

  return (
    <div className="fixed bottom-4 left-4 rounded-lg border-2 border-amber-900/70 bg-gradient-to-b from-stone-900/95 to-stone-950/95 p-2 shadow-xl shadow-black/50 ring-1 ring-amber-500/20 ring-inset backdrop-blur">
      <div className="flex flex-col gap-2">
        {selection.villagers > 0 && (
          <div>
            <div className="mb-1 font-serif text-[10px] tracking-[0.2em] text-amber-200/60 uppercase">
              Build
            </div>
            <div className="flex gap-2">
              <CommandTile
                icon={TYPE_ICONS.get(TYPE_HOUSE)}
                label="House"
                costFood={house.costFood}
                costWood={house.costWood}
                costGold={house.costGold}
                costFavor={house.costFavor}
                disabled={
                  resources.food < house.costFood ||
                  resources.wood < house.costWood ||
                  resources.gold < house.costGold ||
                  resources.favor < house.costFavor
                }
                onClick={() => game.startPlacement(TYPE_HOUSE)}
              />
              <CommandTile
                icon={TYPE_ICONS.get(TYPE_BARRACKS)}
                label="Barracks"
                costFood={barracks.costFood}
                costWood={barracks.costWood}
                costGold={barracks.costGold}
                costFavor={barracks.costFavor}
                disabled={
                  resources.food < barracks.costFood ||
                  resources.wood < barracks.costWood ||
                  resources.gold < barracks.costGold ||
                  resources.favor < barracks.costFavor
                }
                onClick={() => game.startPlacement(TYPE_BARRACKS)}
              />
            </div>
          </div>
        )}

        {selection.producerId !== -1 && (
          <div>
            <div className="mb-1 font-serif text-[10px] tracking-[0.2em] text-amber-200/60 uppercase">
              Train
            </div>
            {selection.producerComplete && trainedStats ? (
              <div className="flex gap-2">
                <CommandTile
                  icon={TYPE_ICONS.get(trained)}
                  label={trained === TYPE_VILLAGER ? "Villager" : "Militia"}
                  costFood={trainedStats.costFood}
                  costWood={trainedStats.costWood}
                  costGold={trainedStats.costGold}
                  costFavor={trainedStats.costFavor}
                  disabled={
                    resources.food < trainedStats.costFood ||
                    resources.wood < trainedStats.costWood ||
                    resources.gold < trainedStats.costGold ||
                    resources.favor < trainedStats.costFavor
                  }
                  progress={progress}
                  // Population cap is enforced by the sim; impossible orders die silently.
                  onClick={() => game.trainSelected(trained)}
                />
              </div>
            ) : (
              <div className="text-xs text-stone-500 italic">Under construction…</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CommandTile({
  icon,
  label,
  costFood,
  costWood,
  costGold,
  costFavor,
  disabled,
  progress,
  onClick,
}: {
  icon: IconConfig | undefined;
  label: string;
  costFood: number;
  costWood: number;
  costGold: number;
  costFavor: number;
  disabled: boolean;
  progress?: number;
  onClick(): void;
}) {
  return (
    <button
      type="button"
      title={label}
      disabled={disabled}
      className="relative h-16 w-16 overflow-hidden rounded-md border border-amber-700/50 bg-stone-800/80 shadow-inner hover:border-amber-400/80 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:grayscale disabled:hover:border-amber-700/50 disabled:hover:brightness-100"
      onClick={onClick}
    >
      <div
        className="absolute top-1 left-0 h-10 w-full"
        style={{
          backgroundImage: icon ? `url(${icon.url})` : undefined,
          backgroundSize: icon ? `${icon.columns * 100}% 100%` : undefined,
          backgroundPosition: "left center",
          backgroundRepeat: "no-repeat",
        }}
      />

      <div className="absolute top-1 right-1 flex flex-col items-end gap-0.5">
        {costFood > 0 && (
          <span className="rounded bg-amber-500/90 px-1 text-[9px] leading-3 font-bold text-stone-950">
            {costFood}
          </span>
        )}
        {costWood > 0 && (
          <span className="rounded bg-orange-900/90 px-1 text-[9px] leading-3 font-bold text-orange-100">
            {costWood}
          </span>
        )}
        {costGold > 0 && (
          <span className="rounded bg-yellow-500/90 px-1 text-[9px] leading-3 font-bold text-yellow-950">
            {costGold}
          </span>
        )}
        {costFavor > 0 && (
          <span className="rounded bg-violet-700/90 px-1 text-[9px] leading-3 font-bold text-violet-100">
            {costFavor}
          </span>
        )}
      </div>

      <div className="absolute right-0 bottom-1 left-0 bg-stone-950/75 px-0.5 text-center text-[9px] leading-3 text-amber-100">
        {label}
      </div>

      {progress !== undefined && progress >= 0 && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-stone-950/80">
          <div className="h-full bg-amber-400" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
    </button>
  );
}
