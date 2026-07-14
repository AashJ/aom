import { useEffect, useState, type CSSProperties } from "react";
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
import favorIconUrl from "@/assets/resource-favor.png";
import foodIconUrl from "@/assets/resource-food.png";
import goldIconUrl from "@/assets/resource-gold.png";
import woodIconUrl from "@/assets/resource-wood.png";
import { ClassicHudPanel } from "./classic-hud-panel";

export function CommandPanel({ game }: { game: GameHandle | null }) {
  const [selection, setSelection] = useState<SelectionSummary | null>(null);
  const [resources, setResources] = useState({ food: 0, wood: 0, gold: 0, favor: 0 });

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

  if (!game) {
    return null;
  }

  const house = UNIT_TYPES[TYPE_HOUSE]!;
  const barracks = UNIT_TYPES[TYPE_BARRACKS]!;
  const producer = selection?.producer ?? null;
  const trained = producer ? UNIT_TYPES[producer.type]!.trains : -1;
  const trainedStats = trained !== -1 ? UNIT_TYPES[trained]! : null;

  const trainedLabel = trained === TYPE_VILLAGER ? "Villager" : "Militia";

  return (
    <>
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

          {selection && producer && producer.complete && trainedStats && (
            <CommandTile
              icon={TYPE_ICONS.get(trained)}
              label={trainedLabel}
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
              // Population cap is enforced by the sim; impossible orders die silently.
              onClick={() => game.trainSelected(trained)}
            />
          )}
        </div>

        {producer && !producer.complete && (
          <div className="absolute inset-x-3 bottom-3 font-serif text-base text-[#eee9d7] italic [text-shadow:-1px_-1px_0_#211a13,1px_-1px_0_#211a13,-1px_1px_0_#211a13,1px_1px_0_#211a13,0_2px_2px_rgb(0_0_0/80%)] sm:text-sm">
            Under construction…
          </div>
        )}
      </ClassicHudPanel>

      {trainedStats && (
        <ProductionQueue
          icon={TYPE_ICONS.get(trained)}
          label={trainedLabel}
          length={producer?.queueLength ?? 0}
          progress={producer?.progress ?? 0}
        />
      )}
    </>
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
  onClick,
}: {
  icon: IconConfig | undefined;
  label: string;
  costFood: number;
  costWood: number;
  costGold: number;
  costFavor: number;
  disabled: boolean;
  onClick(): void;
}) {
  const costs = [
    { label: "Food", value: costFood, iconUrl: foodIconUrl },
    { label: "Wood", value: costWood, iconUrl: woodIconUrl },
    { label: "Gold", value: costGold, iconUrl: goldIconUrl },
    { label: "Favor", value: costFavor, iconUrl: favorIconUrl },
  ].filter((cost) => cost.value > 0);
  const costLabel = costs.map((cost) => `${cost.value} ${cost.label.toLowerCase()}`).join(", ");
  const accessibleLabel = costLabel ? `${label} — ${costLabel}` : label;

  return (
    <div className="group relative size-12 sm:size-10">
      <button
        type="button"
        aria-label={accessibleLabel}
        aria-disabled={disabled}
        className="relative size-full overflow-hidden border border-[#19130d] bg-[#17130f] [box-shadow:inset_0_0_0_1px_#c9b86f,inset_0_0_0_3px_#5e4b28,inset_0_0_7px_rgb(0_0_0/90%),0_1px_0_rgb(235_226_183/45%)] focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4db78] hover:brightness-115 active:translate-y-px aria-disabled:cursor-not-allowed aria-disabled:brightness-50 aria-disabled:grayscale aria-disabled:hover:brightness-50 aria-disabled:active:translate-y-0"
        onClick={() => {
          if (!disabled) {
            onClick();
          }
        }}
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
      </button>
      <RolloverHelp label={label} costs={costs} />
    </div>
  );
}

function ProductionQueue({
  icon,
  label,
  length,
  progress,
}: {
  icon: IconConfig | undefined;
  label: string;
  length: number;
  progress: number;
}) {
  if (length === 0) {
    return null;
  }

  const activeProgress = Math.max(0, Math.min(1, progress));
  const progressStyle = {
    "--queue-progress": `${activeProgress * 100}%`,
  } as CSSProperties;

  return (
    <ClassicHudPanel
      as="section"
      ariaLabel={`Production queue: ${length} ${label.toLowerCase()}${length === 1 ? "" : "s"}`}
      className="fixed bottom-[9.625rem] left-0 z-10 h-16 w-full select-none sm:bottom-[8.375rem] lg:bottom-0 lg:left-96 lg:w-[min(42rem,calc(100vw-40rem))]"
    >
      <ol className="relative flex h-full list-none items-center gap-1 overflow-x-auto px-3 pt-2 pb-1.5">
        {Array.from({ length }, (_, index) => (
          <li
            key={index}
            className="relative size-12 shrink-0 overflow-hidden border border-[#19130d] bg-[#17130f] [box-shadow:inset_0_0_0_1px_#c9b86f,inset_0_0_0_3px_#5e4b28,inset_0_0_7px_rgb(0_0_0/90%),0_1px_0_rgb(235_226_183/45%)] sm:size-10"
          >
            <div
              aria-hidden="true"
              className="absolute inset-0.5 bg-left bg-no-repeat"
              style={{
                backgroundImage: icon ? `url(${icon.url})` : undefined,
                backgroundSize: icon ? `${icon.columns * 100}% 100%` : undefined,
              }}
            />

            {index === 0 && (
              <>
                <div className="absolute top-0.5 right-1 font-serif text-base font-medium text-[#fff7cf] [text-shadow:-1px_-1px_0_#211a13,1px_-1px_0_#211a13,-1px_1px_0_#211a13,1px_1px_0_#211a13] tabular-nums sm:text-sm">
                  {Math.round(activeProgress * 100)}%
                </div>
                <div className="absolute inset-x-1 bottom-1 h-1 border border-black/80 bg-[#211a12]">
                  <div
                    className="h-full w-(--queue-progress) bg-[#d5bb5a] shadow-[inset_0_1px_0_rgb(255_246_171/65%)]"
                    style={progressStyle}
                  />
                </div>
              </>
            )}

            <span className="sr-only">
              {label} {index + 1} of {length}
              {index === 0 ? `, ${Math.round(activeProgress * 100)}% complete` : ""}
            </span>
          </li>
        ))}
      </ol>
    </ClassicHudPanel>
  );
}

function RolloverHelp({
  label,
  costs,
}: {
  label: string;
  costs: { label: string; value: number; iconUrl: string }[];
}) {
  return (
    <div
      role="tooltip"
      aria-label="Rollover help"
      className="pointer-events-none invisible fixed bottom-[9.625rem] left-0 z-40 min-h-20 w-80 bg-[#1d1a14]/75 p-3 font-serif text-[#f4eed8] opacity-0 [box-shadow:inset_0_1px_0_rgb(231_220_177/45%),inset_-1px_0_0_rgb(67_55_38/80%),0_-2px_8px_rgb(0_0_0/30%)] group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 sm:bottom-[8.375rem] sm:w-96"
    >
      <div className="text-base font-semibold [text-shadow:0_1px_1px_rgb(0_0_0/85%)] sm:text-sm">
        {label}
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-2 text-base tabular-nums sm:text-sm">
        {costs.map((cost) => (
          <div key={cost.label} className="flex items-center gap-1">
            <img
              src={cost.iconUrl}
              alt=""
              className="h-5 w-8 shrink-0 bg-[#0c0a08] object-contain sm:h-4 sm:w-6"
            />
            <span className="sr-only">{cost.label}: </span>
            <span>{cost.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
