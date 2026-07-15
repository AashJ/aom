import { useEffect, useState, type CSSProperties } from "react";
import {
  AGE_NAMES,
  FAVOR,
  FOOD,
  getAgeAdvanceAvailability,
  getTypeAvailability,
  GOLD,
  GOD_ATHENA,
  GOD_HERMES,
  NO_AGE,
  TYPE_BARRACKS,
  TYPE_HOUSE,
  TYPE_ICONS,
  TYPE_TEMPLE,
  TYPE_TOWN_CENTER,
  TYPE_VILLAGER,
  UNIT_TYPES,
  WOOD,
  type AgeAdvanceAvailability,
  type GameHandle,
  type IconConfig,
  type PlayerState,
  type SelectionSummary,
  type TypeAvailability,
} from "@aom/engine";
import favorIconUrl from "@/assets/resource-favor.png";
import foodIconUrl from "@/assets/resource-food.png";
import goldIconUrl from "@/assets/resource-gold.png";
import woodIconUrl from "@/assets/resource-wood.png";
import { ClassicHudPanel } from "./classic-hud-panel";

const AGE_SYMBOLS = ["I", "II", "III", "IV"] as const;

export function CommandPanel({ game }: { game: GameHandle | null }) {
  const [selection, setSelection] = useState<SelectionSummary | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [choosingMinorGod, setChoosingMinorGod] = useState(false);

  useEffect(() => {
    if (!game) {
      return;
    }

    const unsubscribeSelection = game.onSelection(setSelection);
    const unsubscribePlayerState = game.onPlayerState(setPlayerState);

    return () => {
      unsubscribeSelection();
      unsubscribePlayerState();
    };
  }, [game]);

  useEffect(() => {
    if (!choosingMinorGod) {
      return;
    }

    const producer = selection?.producer;
    const ageAdvanceAvailability = ageAdvanceAvailabilityFor(playerState);

    if (
      !producer ||
      !producer.complete ||
      ageAdvanceAvailability?.available !== true ||
      producer.type !== ageAdvanceAvailability.rule.producerType
    ) {
      setChoosingMinorGod(false);
    }
  }, [choosingMinorGod, playerState, selection]);

  if (!game) {
    return null;
  }

  const house = UNIT_TYPES[TYPE_HOUSE]!;
  const barracks = UNIT_TYPES[TYPE_BARRACKS]!;
  const temple = UNIT_TYPES[TYPE_TEMPLE]!;
  const producer = selection?.producer ?? null;
  const trained = producer ? UNIT_TYPES[producer.type]!.trains : -1;
  const trainedStats = trained !== -1 ? UNIT_TYPES[trained]! : null;

  const trainedLabel = trained === TYPE_VILLAGER ? "Villager" : "Militia";
  const availability = (unitType: number): TypeAvailability | null =>
    playerState
      ? getTypeAvailability(
          unitType,
          playerState.age,
          (buildingType) => playerState.completedBuildings[buildingType] === 1,
        )
      : null;
  const houseAvailability = availability(TYPE_HOUSE);
  const barracksAvailability = availability(TYPE_BARRACKS);
  const templeAvailability = availability(TYPE_TEMPLE);
  const trainedAvailability = trainedStats ? availability(trained) : null;
  const ageAdvanceAvailability = ageAdvanceAvailabilityFor(playerState);
  const ageAdvanceRule =
    ageAdvanceAvailability && "rule" in ageAdvanceAvailability ? ageAdvanceAvailability.rule : null;
  const ageAdvanceUnavailable = ageAdvanceReason(ageAdvanceAvailability);

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
                unavailableReason={availabilityReason(houseAvailability)}
                disabled={
                  houseAvailability?.available !== true ||
                  (playerState?.food ?? 0) < house.costFood ||
                  (playerState?.wood ?? 0) < house.costWood ||
                  (playerState?.gold ?? 0) < house.costGold ||
                  (playerState?.favor ?? 0) < house.costFavor
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
                unavailableReason={availabilityReason(barracksAvailability)}
                disabled={
                  barracksAvailability?.available !== true ||
                  (playerState?.food ?? 0) < barracks.costFood ||
                  (playerState?.wood ?? 0) < barracks.costWood ||
                  (playerState?.gold ?? 0) < barracks.costGold ||
                  (playerState?.favor ?? 0) < barracks.costFavor
                }
                onClick={() => game.startPlacement(TYPE_BARRACKS)}
              />
              <CommandTile
                icon={TYPE_ICONS.get(TYPE_TEMPLE)}
                label="Temple"
                costFood={temple.costFood}
                costWood={temple.costWood}
                costGold={temple.costGold}
                costFavor={temple.costFavor}
                unavailableReason={availabilityReason(templeAvailability)}
                disabled={
                  templeAvailability?.available !== true ||
                  (playerState?.food ?? 0) < temple.costFood ||
                  (playerState?.wood ?? 0) < temple.costWood ||
                  (playerState?.gold ?? 0) < temple.costGold ||
                  (playerState?.favor ?? 0) < temple.costFavor
                }
                onClick={() => game.startPlacement(TYPE_TEMPLE)}
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
              unavailableReason={availabilityReason(trainedAvailability)}
              disabled={
                trainedAvailability?.available !== true ||
                (playerState?.food ?? 0) < trainedStats.costFood ||
                (playerState?.wood ?? 0) < trainedStats.costWood ||
                (playerState?.gold ?? 0) < trainedStats.costGold ||
                (playerState?.favor ?? 0) < trainedStats.costFavor
              }
              // Population cap is enforced by the sim; impossible orders die silently.
              onClick={() => game.trainSelected(trained)}
            />
          )}

          {producer &&
            producer.complete &&
            ageAdvanceRule &&
            producer.type === ageAdvanceRule.producerType && (
              <CommandTile
                symbol={
                  AGE_SYMBOLS[ageAdvanceRule.targetAge] ?? String(ageAdvanceRule.targetAge + 1)
                }
                label={`Advance to ${AGE_NAMES[ageAdvanceRule.targetAge] ?? "the next age"}`}
                costFood={ageAdvanceRule.cost[FOOD]}
                costWood={ageAdvanceRule.cost[WOOD]}
                costGold={ageAdvanceRule.cost[GOLD]}
                costFavor={ageAdvanceRule.cost[FAVOR]}
                unavailableReason={ageAdvanceUnavailable}
                disabled={ageAdvanceUnavailable !== undefined}
                onClick={() => setChoosingMinorGod(true)}
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

      {choosingMinorGod &&
        producer &&
        ageAdvanceAvailability?.available === true &&
        producer.type === ageAdvanceAvailability.rule.producerType && (
          <MinorGodChoice
            ageName={AGE_NAMES[ageAdvanceAvailability.rule.targetAge] ?? "next age"}
            minorGods={ageAdvanceAvailability.minorGods}
            onChoose={(minorGod) => {
              game.advanceAge(producer.id, minorGod);
              setChoosingMinorGod(false);
            }}
            onCancel={() => setChoosingMinorGod(false)}
          />
        )}
    </>
  );
}

function CommandTile({
  icon,
  symbol,
  label,
  costFood,
  costWood,
  costGold,
  costFavor,
  unavailableReason,
  disabled,
  onClick,
}: {
  icon?: IconConfig;
  symbol?: string;
  label: string;
  costFood: number;
  costWood: number;
  costGold: number;
  costFavor: number;
  unavailableReason?: string;
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
  const accessibleLabel = [label, unavailableReason, costLabel].filter(Boolean).join(" — ");

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
        {symbol && (
          <span className="absolute inset-1 flex items-center justify-center font-serif text-xl font-bold text-[#f4db78] [text-shadow:-1px_-1px_0_#211a13,1px_-1px_0_#211a13,-1px_1px_0_#211a13,1px_1px_0_#211a13,0_2px_2px_rgb(0_0_0/80%)] sm:text-lg">
            {symbol}
          </span>
        )}
      </button>
      <RolloverHelp label={label} costs={costs} unavailableReason={unavailableReason} />
    </div>
  );
}

function MinorGodChoice({
  ageName,
  minorGods,
  onChoose,
  onCancel,
}: {
  ageName: string;
  minorGods: readonly number[];
  onChoose(minorGod: number): void;
  onCancel(): void;
}) {
  return (
    <ClassicHudPanel
      as="section"
      ariaLabel={`Choose a ${ageName} minor god`}
      className="fixed bottom-[10.5rem] left-1/2 z-30 w-[min(25rem,calc(100vw-2rem))] -translate-x-1/2 select-none px-3 pt-3 pb-2.5 sm:bottom-[9.25rem] sm:px-4"
    >
      <div className="relative">
        <p className="text-center font-serif text-base font-semibold text-[#f4db78] [text-shadow:-1px_-1px_0_#211a13,1px_-1px_0_#211a13,-1px_1px_0_#211a13,1px_1px_0_#211a13,0_2px_2px_rgb(0_0_0/80%)] sm:text-sm">
          Choose a minor god
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {minorGods.map((minorGod) => {
            const presentation = minorGodPresentation(minorGod);

            return (
              <MinorGodButton
                key={minorGod}
                name={presentation.name}
                detail={presentation.detail}
                onClick={() => onChoose(minorGod)}
              />
            );
          })}
        </div>
        <button
          type="button"
          className="mt-2 min-h-12 w-full border border-[#19130d] bg-[#302719] px-3 font-serif text-base text-[#eee9d7] [box-shadow:inset_0_0_0_1px_#8c7742,inset_0_0_5px_rgb(0_0_0/75%)] hover:brightness-115 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4db78] active:translate-y-px sm:min-h-10 sm:text-sm"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </ClassicHudPanel>
  );
}

function minorGodPresentation(minorGod: number): { name: string; detail: string } {
  switch (minorGod) {
    case GOD_ATHENA:
      return { name: "Athena", detail: "Restoration · Minotaur" };
    case GOD_HERMES:
      return { name: "Hermes", detail: "Ceasefire · Centaur" };
    default:
      return { name: `God ${minorGod}`, detail: "Minor god" };
  }
}

function MinorGodButton({
  name,
  detail,
  onClick,
}: {
  name: string;
  detail: string;
  onClick(): void;
}) {
  return (
    <button
      type="button"
      className="min-h-16 border border-[#19130d] bg-[#17130f] px-2 py-2 font-serif [box-shadow:inset_0_0_0_1px_#c9b86f,inset_0_0_0_3px_#5e4b28,inset_0_0_7px_rgb(0_0_0/90%),0_1px_0_rgb(235_226_183/45%)] hover:brightness-115 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4db78] active:translate-y-px"
      onClick={onClick}
    >
      <span className="block text-base font-semibold text-[#f4db78] [text-shadow:0_1px_1px_rgb(0_0_0/85%)] sm:text-sm">
        {name}
      </span>
      <span className="mt-0.5 block text-sm text-[#d8cfb7] [text-shadow:0_1px_1px_rgb(0_0_0/85%)] sm:text-xs">
        {detail}
      </span>
    </button>
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
  unavailableReason,
}: {
  label: string;
  costs: { label: string; value: number; iconUrl: string }[];
  unavailableReason?: string;
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
      {unavailableReason && (
        <div className="pt-1 text-base font-semibold text-[#f4db78] [text-shadow:0_1px_1px_rgb(0_0_0/85%)] sm:text-sm">
          {unavailableReason}
        </div>
      )}
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

function availabilityReason(availability: TypeAvailability | null): string | undefined {
  if (availability === null || availability.available) {
    return undefined;
  }

  switch (availability.reason) {
    case "age":
      return `Requires ${AGE_NAMES[availability.requiredAge] ?? "a later age"}`;
    case "building":
      return `Requires a completed ${buildingLabel(availability.buildingType)}`;
    case "invalid-type":
      return "Unavailable";
  }
}

function ageAdvanceAvailabilityFor(playerState: PlayerState | null): AgeAdvanceAvailability | null {
  if (!playerState) {
    return null;
  }

  return getAgeAdvanceAvailability({
    age: playerState.age,
    majorGod: playerState.majorGod,
    activeTargetAge: playerState.ageAdvancement?.targetAge ?? NO_AGE,
    resources: [playerState.food, playerState.wood, playerState.gold, playerState.favor],
    hasCompletedBuilding: (buildingType) => playerState.completedBuildings[buildingType] === 1,
  });
}

function ageAdvanceReason(availability: AgeAdvanceAvailability | null): string | undefined {
  if (!availability) {
    return "Checking availability";
  }

  if (availability.available) {
    return undefined;
  }

  switch (availability.reason) {
    case "max-age":
      return "No further age available";
    case "in-progress":
      return "Advance already in progress";
    case "minor-god":
      return "No minor gods available for this advance";
    case "building":
      return `Requires a completed ${buildingLabel(availability.buildingType)}`;
    case "resource":
      return `Requires ${availability.required} ${resourceLabel(availability.resource).toLowerCase()}`;
  }
}

function resourceLabel(resource: number): string {
  switch (resource) {
    case FOOD:
      return "Food";
    case WOOD:
      return "Wood";
    case GOLD:
      return "Gold";
    case FAVOR:
      return "Favor";
    default:
      return "Resource";
  }
}

function buildingLabel(buildingType: number): string {
  switch (buildingType) {
    case TYPE_TOWN_CENTER:
      return "Town Center";
    case TYPE_BARRACKS:
      return "Barracks";
    case TYPE_HOUSE:
      return "House";
    case TYPE_TEMPLE:
      return "Temple";
    default:
      return "prerequisite building";
  }
}
