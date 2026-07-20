const ROOM_CODE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

export function roomCodeFromRequest(request: Request): string | null {
  const roomCode = new URL(request.url).searchParams.get("room");
  return roomCode !== null && ROOM_CODE_PATTERN.test(roomCode) ? roomCode : null;
}
