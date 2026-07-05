// Lobby/room state as plain data plus pure transition functions returning the
// ServerMessages the server should send; the server app stays a thin pipe
// between sockets and these functions.
import { PROTOCOL_VERSION, type PlayerInfo, type ServerMessage } from "./protocol";
import { createHashTracker, type HashTracker } from "./hash-tracker";
import { createSequencer, type Sequencer } from "./sequencer";

export interface Room {
  code: string;
  seed: number;
  players: PlayerInfo[];
  nextPlayerId: number;
  started: boolean;
  sequencer: Sequencer;
  hashTracker: HashTracker;
}

export function createRoom(code: string, seed: number): Room {
  return {
    code,
    seed,
    players: [],
    nextPlayerId: 0,
    started: false,
    sequencer: createSequencer(),
    hashTracker: createHashTracker(),
  };
}

export function addPlayer(
  room: Room,
  name: string,
): { player: PlayerInfo; joined: ServerMessage; playerJoined: ServerMessage } | null {
  // Late join is a parked M4 question.
  if (room.started) {
    return null;
  }

  const player = { id: room.nextPlayerId, name };
  room.nextPlayerId += 1;
  room.players.push(player);

  return {
    player,
    joined: {
      v: PROTOCOL_VERSION,
      kind: "joined",
      playerId: player.id,
      players: [...room.players],
    },
    playerJoined: {
      v: PROTOCOL_VERSION,
      kind: "playerJoined",
      player,
    },
  };
}

export function removePlayer(room: Room, playerId: number): ServerMessage {
  const playerIndex = room.players.findIndex((player) => player.id === playerId);
  if (playerIndex !== -1) {
    room.players.splice(playerIndex, 1);
  }

  return {
    v: PROTOCOL_VERSION,
    kind: "playerLeft",
    playerId,
  };
}

export function startRoom(room: Room, hashIntervalTicks: number): ServerMessage | null {
  if (room.started || room.players.length === 0) {
    return null;
  }

  room.started = true;

  return {
    v: PROTOCOL_VERSION,
    kind: "begin",
    seed: room.seed,
    players: [...room.players],
    hashIntervalTicks,
  };
}

export function isHost(room: Room, playerId: number): boolean {
  let lowestPlayerId = Number.POSITIVE_INFINITY;
  for (const player of room.players) {
    if (player.id < lowestPlayerId) {
      lowestPlayerId = player.id;
    }
  }

  // Host migrates automatically if the original host leaves the lobby.
  return playerId === lowestPlayerId;
}
