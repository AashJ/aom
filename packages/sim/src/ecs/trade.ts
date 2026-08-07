import { COMMAND_TRADE, type Command, type TradeCommand } from "../commands";
import { MAP_TILES } from "../terrain";
import { assignFieldGoal, setFacingToward } from "./navigation";
import { GOLD, RESOURCE_COUNT, UNIT_TYPES } from "./types";
import {
  clearUnitTask,
  MODE_TRADING_TO_MARKET,
  MODE_TRADING_TO_TOWN_CENTER,
  NO_TARGET,
} from "./unit-tasks";
import { resolveId, unitIdAt, type World } from "./world";

function isCompletedTradeSite(
  world: World,
  index: number,
  role: "market" | "town-center",
): boolean {
  if (index < 0 || index >= world.count || world.dying[index] === 1 || world.hp[index]! <= 0) {
    return false;
  }
  const stats = UNIT_TYPES[world.unitType[index]!]!;
  return stats.tradeSite === role && world.buildProgress[index]! >= stats.buildTicks;
}

function farthestOwnedMarket(world: World, townCenter: number, owner: number): number {
  let best = -1;
  let bestDistanceSquared = -1;
  for (let index = 0; index < world.count; index += 1) {
    if (world.owner[index] !== owner || !isCompletedTradeSite(world, index, "market")) continue;
    const dx = world.posX[index]! - world.posX[townCenter]!;
    const dz = world.posZ[index]! - world.posZ[townCenter]!;
    const distanceSquared = dx * dx + dz * dz;
    if (
      distanceSquared > bestDistanceSquared ||
      (distanceSquared === bestDistanceSquared &&
        (best < 0 || unitIdAt(world, index) < unitIdAt(world, best)))
    ) {
      best = index;
      bestDistanceSquared = distanceSquared;
    }
  }
  return best;
}

export function assignTradeRoute(
  world: World,
  unitIndex: number,
  townCenterIndex: number,
  playerId: number,
): boolean {
  const unitStats = UNIT_TYPES[world.unitType[unitIndex]!]!;
  if (
    unitStats.trade === undefined ||
    world.owner[unitIndex] !== playerId ||
    world.containedBy[unitIndex] !== NO_TARGET ||
    world.dying[unitIndex] === 1 ||
    world.hp[unitIndex]! <= 0 ||
    !isCompletedTradeSite(world, townCenterIndex, "town-center") ||
    world.owner[townCenterIndex] !== playerId
  ) {
    return false;
  }
  const market = farthestOwnedMarket(world, townCenterIndex, playerId);
  if (market < 0) return false;

  clearUnitTask(world, unitIndex);
  world.tradeTownCenter[unitIndex] = unitIdAt(world, townCenterIndex);
  world.tradeMarket[unitIndex] = unitIdAt(world, market);
  world.mode[unitIndex] = MODE_TRADING_TO_TOWN_CENTER;
  world.taskTarget[unitIndex] = unitIdAt(world, townCenterIndex);
  world.carriedResource[unitIndex] = GOLD;
  assignFieldGoal(
    world,
    unitIndex,
    world.posX[townCenterIndex]!,
    world.posZ[townCenterIndex]!,
    UNIT_TYPES[world.unitType[townCenterIndex]!]!.footprint,
  );
  return true;
}

function clearInvalidRoute(world: World, index: number): true {
  clearUnitTask(world, index);
  world.moving[index] = 0;
  world.unitField[index] = null;
  return true;
}

export function tickTradeTask(world: World, index: number): boolean {
  const mode = world.mode[index]!;
  if (mode !== MODE_TRADING_TO_TOWN_CENTER && mode !== MODE_TRADING_TO_MARKET) return false;

  const traits = UNIT_TYPES[world.unitType[index]!]!.trade;
  const townCenter = resolveId(world, world.tradeTownCenter[index]!);
  const market = resolveId(world, world.tradeMarket[index]!);
  if (
    traits === undefined ||
    !isCompletedTradeSite(world, townCenter, "town-center") ||
    !isCompletedTradeSite(world, market, "market") ||
    world.owner[index] !== world.owner[market] ||
    world.owner[index] !== world.owner[townCenter]
  ) {
    return clearInvalidRoute(world, index);
  }

  const target = mode === MODE_TRADING_TO_TOWN_CENTER ? townCenter : market;
  const targetStats = UNIT_TYPES[world.unitType[target]!]!;
  const targetX = world.posX[target]!;
  const targetZ = world.posZ[target]!;
  const dx = targetX - world.posX[index]!;
  const dz = targetZ - world.posZ[index]!;
  const reach = traits.interactionRange + targetStats.bodyRadius;

  if (dx * dx + dz * dz > reach * reach) {
    assignFieldGoal(world, index, targetX, targetZ, targetStats.footprint);
    return true;
  }

  world.moving[index] = 0;
  world.unitField[index] = null;
  setFacingToward(world, index, targetX, targetZ);

  if (mode === MODE_TRADING_TO_TOWN_CENTER) {
    const routeX = world.posX[market]! - world.posX[index]!;
    const routeZ = world.posZ[market]! - world.posZ[index]!;
    const distanceSquared = routeX * routeX + routeZ * routeZ;
    const distance = Math.sqrt(distanceSquared);
    const earned =
      Math.max(
        (distanceSquared * traits.townCenterWorkRate) / MAP_TILES,
        distance * traits.townCenterMinimumRate,
      ) * traits.incomeMultiplier;
    world.tradeCargo[index] = Math.min(traits.capacity, world.tradeCargo[index]! + earned);
    world.carried[index] = Math.floor(world.tradeCargo[index]!);
    world.mode[index] = MODE_TRADING_TO_MARKET;
    world.taskTarget[index] = world.tradeMarket[index]!;
    assignFieldGoal(
      world,
      index,
      world.posX[market]!,
      world.posZ[market]!,
      UNIT_TYPES[world.unitType[market]!]!.footprint,
    );
    return true;
  }

  const wholeGold = Math.floor(world.tradeCargo[index]!);
  if (wholeGold > 0) {
    const stockpile = world.owner[index]! * RESOURCE_COUNT + GOLD;
    world.stockpiles[stockpile] = Math.min(0xffffffff, world.stockpiles[stockpile]! + wholeGold);
    world.tradeCargo[index] = world.tradeCargo[index]! - wholeGold;
  }
  world.carried[index] = 0;
  world.mode[index] = MODE_TRADING_TO_TOWN_CENTER;
  world.taskTarget[index] = world.tradeTownCenter[index]!;
  assignFieldGoal(
    world,
    index,
    world.posX[townCenter]!,
    world.posZ[townCenter]!,
    UNIT_TYPES[world.unitType[townCenter]!]!.footprint,
  );
  return true;
}

export function isTradeCommand(command: Command): command is TradeCommand {
  return command.type === COMMAND_TRADE;
}

export function applyTradeCommand(world: World, command: TradeCommand): void {
  const townCenter = resolveId(world, command.targetId);
  if (townCenter < 0) return;
  for (const unitId of command.unitIds) {
    const unit = resolveId(world, unitId);
    if (unit < 0) continue;
    assignTradeRoute(world, unit, townCenter, command.issuer);
  }
}
