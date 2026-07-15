import { AGE_ARCHAIC, AGE_COUNT, GOD_ZEUS, NO_GOD } from "./progression";
import type { World } from "./world";

const MAX_PLAYER_ID = 254;

export function registerPlayer(world: World, playerId: number, majorGod = GOD_ZEUS): void {
  if (!Number.isInteger(playerId) || playerId < 0 || playerId > MAX_PLAYER_ID) {
    throw new RangeError(`Player id must be an integer from 0 through ${MAX_PLAYER_ID}.`);
  }

  if (world.playerSlotById[playerId] !== -1) {
    return;
  }

  if (world.playerCount >= world.playerIds.length) {
    throw new RangeError("World player capacity exceeded.");
  }

  const playerSlot = world.playerCount;
  const minorGodStart = playerId * AGE_COUNT;

  world.playerIds[playerSlot] = playerId;
  world.playerSlotById[playerId] = playerSlot;
  world.playerAge[playerId] = AGE_ARCHAIC;
  world.playerMajorGod[playerId] = majorGod;
  world.playerMinorGods.fill(NO_GOD, minorGodStart, minorGodStart + AGE_COUNT);
  world.playerCount += 1;
}
