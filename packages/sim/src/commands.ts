// Commands are the ONLY way gameplay state changes from outside the tick
// (ARCHITECTURE.md M3: the lockstep seam). Flat numeric data by construction:
// this shape IS the future wire format.
import type { World } from "./ecs/world";

export const COMMAND_MOVE = 0;
export const COMMAND_STOP = 1;
export const COMMAND_ATTACK = 2;
export const COMMAND_GATHER = 3;
export const COMMAND_PLACE = 4;
export const COMMAND_BUILD = 5;
export const COMMAND_TRAIN = 6;
export const COMMAND_ADVANCE_AGE = 7;
export const COMMAND_CHEAT = 8;
export const COMMAND_PRAY = 9;

export const CHEAT_ADD_FOOD = 0;
export const CHEAT_ADD_WOOD = 1;
export const CHEAT_ADD_GOLD = 2;
export const CHEAT_FULL_FAVOR = 3;
export const CHEAT_REVEAL_MAP = 4;

export type CheatId =
  | typeof CHEAT_ADD_FOOD
  | typeof CHEAT_ADD_WOOD
  | typeof CHEAT_ADD_GOLD
  | typeof CHEAT_FULL_FAVOR
  | typeof CHEAT_REVEAL_MAP;

export interface MoveCommand {
  tick: number;
  // The playerId whose authority the command carries. Stamped by the loopback sink (0)
  // or by the turn buffer from the server-assigned PlayerCommand.playerId - never by
  // the wire. Validation happens at application: units not owned by the issuer are
  // silently skipped.
  issuer: number;
  type: typeof COMMAND_MOVE;
  unitIds: number[];
  targetX: number;
  targetZ: number;
}

export interface StopCommand {
  tick: number;
  // The playerId whose authority the command carries. Stamped by the loopback sink (0)
  // or by the turn buffer from the server-assigned PlayerCommand.playerId - never by
  // the wire. Validation happens at application: units not owned by the issuer are
  // silently skipped.
  issuer: number;
  type: typeof COMMAND_STOP;
  unitIds: number[];
}

export interface AttackCommand {
  tick: number;
  // The playerId whose authority the command carries. Stamped by the loopback sink (0)
  // or by the turn buffer from the server-assigned PlayerCommand.playerId - never by
  // the wire. Validation happens at application: units not owned by the issuer are
  // silently skipped.
  issuer: number;
  type: typeof COMMAND_ATTACK;
  unitIds: number[];
  targetId: number;
}

export interface GatherCommand {
  tick: number;
  // The playerId whose authority the command carries. Stamped by the loopback sink (0)
  // or by the turn buffer from the server-assigned PlayerCommand.playerId - never by
  // the wire. Validation happens at application: units not owned by the issuer are
  // silently skipped.
  issuer: number;
  type: typeof COMMAND_GATHER;
  unitIds: number[];
  targetId: number;
}

export interface PrayCommand {
  tick: number;
  issuer: number;
  type: typeof COMMAND_PRAY;
  unitIds: number[];
  targetId: number;
}

export interface PlaceCommand {
  tick: number;
  issuer: number;
  type: typeof COMMAND_PLACE;
  // No unitIds — placement is a player act, not a unit order; the villagers come in M6-5's Build command.
  buildingType: number;
  tileX: number;
  tileZ: number;
}

export interface BuildCommand {
  tick: number;
  issuer: number;
  type: typeof COMMAND_BUILD;
  unitIds: number[];
  targetId: number;
}

export interface TrainCommand {
  tick: number;
  issuer: number;
  type: typeof COMMAND_TRAIN;
  // No unitIds - production is a building act; the building is the addressee.
  buildingId: number;
  unitType: number;
}

export interface AdvanceAgeCommand {
  tick: number;
  issuer: number;
  type: typeof COMMAND_ADVANCE_AGE;
  // Age research occupies one completed Town Center. The target age is derived
  // from authoritative player state; the command only carries the god choice.
  buildingId: number;
  minorGod: number;
}

export interface CheatCommand {
  tick: number;
  issuer: number;
  type: typeof COMMAND_CHEAT;
  cheat: CheatId;
}

export type Command =
  | MoveCommand
  | StopCommand
  | AttackCommand
  | GatherCommand
  | PrayCommand
  | PlaceCommand
  | BuildCommand
  | TrainCommand
  | AdvanceAgeCommand
  | CheatCommand;

export function enqueueCommand(world: World, command: Command): void {
  // Command handling is deliberately NOT zero-allocation: it runs at human click rate, not
  // per-tick-per-unit rate. The zero-alloc discipline applies to the movement loop.
  world.commands.push(command);
}
