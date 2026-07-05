// Commands are the ONLY way gameplay state changes from outside the tick
// (ARCHITECTURE.md M3: the lockstep seam). Flat numeric data by construction:
// this shape IS the future wire format.
import type { World } from "./ecs/world";

export const COMMAND_MOVE = 0;
export const COMMAND_STOP = 1;
export const COMMAND_ATTACK = 2;
export const COMMAND_GATHER = 3;
export const COMMAND_PLACE = 4;

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

export interface PlaceCommand {
  tick: number;
  issuer: number;
  type: typeof COMMAND_PLACE;
  // No unitIds — placement is a player act, not a unit order; the villagers come in M6-5's Build command.
  buildingType: number;
  tileX: number;
  tileZ: number;
}

export type Command = MoveCommand | StopCommand | AttackCommand | GatherCommand | PlaceCommand;

export function enqueueCommand(world: World, command: Command): void {
  // Command handling is deliberately NOT zero-allocation: it runs at human click rate, not
  // per-tick-per-unit rate. The zero-alloc discipline applies to the movement loop.
  world.commands.push(command);
}
