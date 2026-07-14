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
import { ClassicHudPanel } from "./classic-hud-panel";

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

  if (!game) {
    return null;
  }

  const house = UNIT_TYPES[TYPE_HOUSE]!;
  const barracks = UNIT_TYPES[TYPE_BARRACKS]!;
  const trained =
    selection && selection.producerId !== -1 ? UNIT_TYPES[selection.producerType]!.trains : -1;
  const trainedStats = trained !== -1 ? UNIT_TYPES[trained]! : null;

  return (
    <ClassicHudPanel
      as="section"
      ariaLabel="Commands"
      className="fixed bottom-0 left-32 z-10 h-[9.625rem] w-48 select-none sm:left-36 sm:h-[8.375rem] sm:w-60"
    >
      <div className="relative grid grid-cols-3 content-start gap-1 px-3 pt-3 sm:grid-cols-5 sm:pt-2.5">
        {selection && selection.villagers > 0 && (
          <>
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
          </>
        )}

        {selection && selection.producerId !== -1 && selection.producerComplete && trainedStats && (
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
        )}
      </div>

      {selection && selection.producerId !== -1 && !selection.producerComplete && (
        <div className="absolute inset-x-3 bottom-3 font-serif text-base text-[#eee9d7] italic [text-shadow:-1px_-1px_0_#211a13,1px_-1px_0_#211a13,-1px_1px_0_#211a13,1px_1px_0_#211a13,0_2px_2px_rgb(0_0_0/80%)] sm:text-sm">
          Under construction…
        </div>
      )}
    </ClassicHudPanel>
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
  const costLabel = [
    costFood > 0 ? `${costFood} food` : null,
    costWood > 0 ? `${costWood} wood` : null,
    costGold > 0 ? `${costGold} gold` : null,
    costFavor > 0 ? `${costFavor} favor` : null,
  ]
    .filter((cost): cost is string => cost !== null)
    .join(", ");
  const accessibleLabel = costLabel ? `${label} — ${costLabel}` : label;

  return (
    <button
      type="button"
      title={accessibleLabel}
      aria-label={accessibleLabel}
      disabled={disabled}
      className="relative size-12 overflow-hidden border border-[#19130d] bg-[#17130f] [box-shadow:inset_0_0_0_1px_#c9b86f,inset_0_0_0_3px_#5e4b28,inset_0_0_7px_rgb(0_0_0/90%),0_1px_0_rgb(235_226_183/45%)] focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4db78] enabled:hover:brightness-115 enabled:active:translate-y-px disabled:cursor-not-allowed disabled:brightness-50 disabled:grayscale sm:size-10"
      onClick={onClick}
    >
      <span
        aria-hidden="true"
        className="pointer-fine:hidden absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0.5 bg-left bg-no-repeat"
        style={{
          backgroundImage: icon ? `url(${icon.url})` : undefined,
          backgroundSize: icon ? `${icon.columns * 100}% 100%` : undefined,
        }}
      />

      {progress !== undefined && progress >= 0 && (
        <div className="absolute inset-x-1 bottom-1 h-1 border border-black/80 bg-[#211a12]">
          <div
            className="h-full bg-[#d5bb5a] shadow-[inset_0_1px_0_rgb(255_246_171/65%)]"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}
    </button>
  );
}
