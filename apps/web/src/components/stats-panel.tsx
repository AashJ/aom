import { useEffect, useState, type CSSProperties } from "react";
import {
  TYPE_ICONS,
  UNIT_TYPES,
  type GameHandle,
  type IconConfig,
  type SelectionSummary,
} from "@aom/engine";
import { ClassicHudPanel } from "./classic-hud-panel";

const NEUTRAL_OWNER = 255;

export function StatsPanel({ game }: { game: GameHandle | null }) {
  const [selection, setSelection] = useState<SelectionSummary | null>(null);

  useEffect(() => {
    if (!game) {
      return;
    }

    return game.onSelection(setSelection);
  }, [game]);

  if (!game) {
    return null;
  }

  const selected = selection?.primary ?? null;
  const stats = selected ? UNIT_TYPES[selected.type] : undefined;

  return (
    <ClassicHudPanel
      as="section"
      ariaLabel="Selected unit stats"
      className="pointer-events-none fixed top-14 right-2 z-10 h-[8.75rem] w-44 select-none sm:h-[8.375rem] lg:top-auto lg:right-auto lg:bottom-0 lg:left-96"
    >
      <div className="relative h-full px-3 pt-3 pb-2.5 sm:pt-2.5 sm:pb-2">
        {selected && stats ? (
          <SelectedEntityStats
            icon={TYPE_ICONS[selected.type]}
            label={stats.label}
            owner={selected.owner}
            selectedCount={selection?.selectedCount ?? 1}
            hitPoints={selected.hitPoints}
            maxHitPoints={stats.maxHp}
            buildProgress={selected.buildProgress}
            buildTicks={stats.buildTicks}
            isBuilding={stats.footprint > 0}
            damage={stats.attack?.damage ?? null}
            hackArmor={stats.armor[0]}
            pierceArmor={stats.armor[1]}
            lineOfSight={stats.lineOfSight}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-2 text-center font-serif text-base text-[#d5cfbd] italic [text-shadow:0_1px_1px_rgb(0_0_0/85%)] sm:text-sm">
            Select a unit or building
          </div>
        )}
      </div>
    </ClassicHudPanel>
  );
}

function SelectedEntityStats({
  icon,
  label,
  owner,
  selectedCount,
  hitPoints,
  maxHitPoints,
  buildProgress,
  buildTicks,
  isBuilding,
  damage,
  hackArmor,
  pierceArmor,
  lineOfSight,
}: {
  icon?: IconConfig;
  label: string;
  owner: number;
  selectedCount: number;
  hitPoints: number;
  maxHitPoints: number;
  buildProgress: number;
  buildTicks: number;
  isBuilding: boolean;
  damage: readonly [number, number, number] | null;
  hackArmor: number;
  pierceArmor: number;
  lineOfSight: number;
}) {
  const healthRatio = maxHitPoints > 0 ? Math.max(0, Math.min(1, hitPoints / maxHitPoints)) : 0;
  const healthStyle = { "--health": `${healthRatio * 100}%` } as CSSProperties;
  const healthColor =
    healthRatio > 0.5 ? "bg-[#3f9d45]" : healthRatio > 0.25 ? "bg-[#c7a13c]" : "bg-[#a53d32]";
  const isUnderConstruction = isBuilding && buildTicks > 0 && buildProgress < buildTicks;
  const constructionPercent = isUnderConstruction
    ? Math.round(Math.max(0, Math.min(1, buildProgress / buildTicks)) * 100)
    : 100;

  return (
    <div className="flex h-full flex-col gap-1">
      <div className="min-w-0 text-center font-serif text-base font-semibold text-[#f4e7b8] [text-shadow:-1px_-1px_0_#211a13,1px_-1px_0_#211a13,-1px_1px_0_#211a13,1px_1px_0_#211a13,0_2px_2px_rgb(0_0_0/80%)] sm:text-sm">
        <div className="truncate">{label}</div>
        <div className="sr-only">
          {owner === NEUTRAL_OWNER ? "Nature" : `Player ${owner + 1}`}
          {selectedCount > 1 ? `, ${selectedCount} entities selected` : ""}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[4.75rem_minmax(0,1fr)] gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <Portrait icon={icon} label={label} />
          <div
            className="relative h-3 overflow-hidden border border-[#19130d] bg-[#211a12] [box-shadow:inset_0_1px_2px_rgb(0_0_0/90%),0_1px_0_rgb(255_255_255/16%)]"
            role="meter"
            aria-label="Hit points"
            aria-valuemin={0}
            aria-valuemax={maxHitPoints}
            aria-valuenow={Math.max(0, hitPoints)}
          >
            <div
              className={`absolute inset-y-0 left-0 w-(--health) ${healthColor} shadow-[inset_0_1px_0_rgb(255_255_255/28%)]`}
              style={healthStyle}
            />
            <div className="absolute inset-0 flex items-center justify-center font-serif text-[0.625rem] font-medium text-white [text-shadow:-1px_-1px_0_#211a13,1px_-1px_0_#211a13,-1px_1px_0_#211a13,1px_1px_0_#211a13] tabular-nums">
              {Math.ceil(Math.max(0, hitPoints))}/{maxHitPoints}
            </div>
          </div>
        </div>

        <dl className="grid min-w-0 content-start grid-cols-[minmax(0,1fr)_auto] gap-x-1 gap-y-0.5 font-serif text-base text-[#eee9d7] [text-shadow:0_1px_1px_rgb(0_0_0/90%)] tabular-nums sm:text-[0.6875rem]">
          <StatRow label="Attack" value={formatDamage(damage)} />
          <StatRow label="Hack armor" shortLabel="Hack" value={formatArmor(hackArmor)} />
          <StatRow label="Pierce armor" shortLabel="Pierce" value={formatArmor(pierceArmor)} />
          <StatRow label="Line of sight" shortLabel="Sight" value={formatNumber(lineOfSight)} />
        </dl>
      </div>

      {isUnderConstruction && (
        <div className="truncate text-center font-serif text-sm text-[#f4db78] [text-shadow:0_1px_1px_rgb(0_0_0/90%)] tabular-nums sm:text-[0.625rem]">
          Under construction · {constructionPercent}%
        </div>
      )}
    </div>
  );
}

function Portrait({ icon, label }: { icon?: IconConfig; label: string }) {
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden border border-[#19130d] bg-[#17130f] [box-shadow:inset_0_0_0_1px_#c9b86f,inset_0_0_0_3px_#5e4b28,inset_0_0_8px_rgb(0_0_0/90%),0_1px_0_rgb(235_226_183/35%)]">
      {icon ? (
        <div
          aria-hidden="true"
          className="absolute inset-1 bg-left bg-no-repeat"
          style={{
            backgroundImage: `url(${icon.url})`,
            backgroundSize: `${icon.columns * 100}% 100%`,
          }}
        />
      ) : (
        <div className="absolute inset-1 flex items-center justify-center font-serif text-2xl font-semibold text-[#b8ad8e] [text-shadow:0_2px_2px_rgb(0_0_0/90%)]">
          {label.charAt(0)}
        </div>
      )}
    </div>
  );
}

function StatRow({
  label,
  shortLabel = label,
  value,
}: {
  label: string;
  shortLabel?: string;
  value: string;
}) {
  return (
    <>
      <dt className="truncate text-[#d7cfb7]" title={label}>
        {shortLabel}
      </dt>
      <dd className="text-right font-medium text-[#fff6d7]">{value}</dd>
    </>
  );
}

function formatDamage(damage: readonly [number, number, number] | null): string {
  if (!damage) {
    return "—";
  }

  const labels = ["H", "P", "C"] as const;
  const parts = damage.flatMap((value, index) =>
    value > 0 ? [`${formatNumber(value)}${labels[index]}`] : [],
  );

  return parts.length > 0 ? parts.join(" ") : "—";
}

function formatArmor(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}
