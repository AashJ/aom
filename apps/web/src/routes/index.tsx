import { buttonVariants } from "@aom/ui/components/button";
import { Input } from "@aom/ui/components/input";
import { cn } from "@aom/ui/lib/utils";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { RefreshCw, Share2, Swords } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState("Aash");
  const [roomCode, setRoomCode] = useState(() => createRoomCode());
  const [shareState, setShareState] = useState<"idle" | "shared" | "copied" | "failed">("idle");
  const inviteUrl = useMemo(() => createInviteUrl(roomCode), [roomCode]);
  const normalizedName = normalizePlayerName(playerName) ?? "Player";

  function handleStartMultiplayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    void navigate({
      to: "/game",
      search: {
        room: roomCode,
        name: normalizedName,
      },
    });
  }

  async function handleShareInvite() {
    const shareData = {
      title: "AoM Online duel",
      text: `Join room ${roomCode}`,
      url: inviteUrl,
    };

    try {
      if (navigator.share !== undefined && navigator.canShare?.(shareData) !== false) {
        await navigator.share(shareData);
        setShareState("shared");
        return;
      }

      await navigator.clipboard.writeText(inviteUrl);
      setShareState("copied");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }

      console.error(err);
      setShareState("failed");
    }
  }

  function handleRefreshRoomCode() {
    setRoomCode(createRoomCode());
    setShareState("idle");
  }

  return (
    <main className="relative flex min-h-dvh overflow-hidden bg-background text-foreground">
      <img
        src="/images/mythic-island-start.png"
        alt=""
        className="absolute inset-0 size-full object-cover"
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_34%,rgb(255_255_255_/_0.38)_84%),linear-gradient(180deg,rgb(0_0_0_/_0.12),rgb(0_0_0_/_0.24))]" />
      <div className="absolute inset-x-0 top-0 h-28 bg-linear-to-b from-white/65 to-transparent sm:h-24" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-white/60 to-transparent sm:h-20" />

      <div className="relative z-10 flex min-h-dvh w-full flex-col items-center justify-start px-4 py-4 sm:py-5">
        <h1 className="sr-only">Age of Mythology Extended Web Edition</h1>

        <div
          aria-hidden="true"
          className="font-display flex w-full max-w-4xl flex-col items-center text-center"
        >
          <div className="mythic-title text-[3.5rem] font-semibold sm:text-[4.75rem] md:text-[5.75rem]">
            AGE
          </div>
          <div className="mythic-gold-text -mt-6 text-[2.5rem] font-semibold italic sm:-mt-8 sm:text-[3.5rem] md:-mt-10 md:text-[4.25rem]">
            of
          </div>
          <div className="mythic-title -mt-5 text-[3rem] font-semibold sm:-mt-8 sm:text-[4.25rem] md:text-[5.25rem]">
            MYTHOLOGY
          </div>
        </div>

        <section className="relative mt-2 w-[min(22rem,calc(100vw-2rem))] sm:mt-3">
          <div className="relative rounded-sm bg-[#191f73]/95 p-3 shadow-2xl ring-4 ring-[#d8bb5a] sm:p-4">
            <div className="absolute inset-1 rounded-sm ring-1 ring-white/20" />
            <div className="relative grid gap-2">
              <Link
                to="/single-player/new"
                className={cn(
                  buttonVariants({ variant: "secondary", size: "lg" }),
                  "mythic-menu-button h-8 rounded-full border-2 border-[#d8bb5a] px-3 font-display text-base font-medium hover:mythic-menu-button-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d46b] sm:h-7 sm:text-sm",
                )}
              >
                Single Player
              </Link>

              <form className="grid gap-2 pt-1" onSubmit={handleStartMultiplayer}>
                <div className="grid gap-1">
                  <label
                    htmlFor="multiplayer-name"
                    className="font-display text-sm font-medium text-[#f7d46b] [text-shadow:0_1px_1px_rgb(0_0_0_/_0.75)]"
                  >
                    Name
                  </label>
                  <Input
                    id="multiplayer-name"
                    value={playerName}
                    onChange={(event) => setPlayerName(event.target.value)}
                    className="h-8 rounded-sm border-[#d8bb5a]/70 bg-[#080d3a]/85 px-3 font-display text-base text-[#f3e6bc] placeholder:text-[#f3e6bc]/50 focus-visible:border-[#f7d46b] focus-visible:ring-[#f7d46b]/50 sm:h-7 sm:text-sm"
                    maxLength={24}
                    autoComplete="nickname"
                  />
                </div>

                <div className="grid gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="multiplayer-room"
                      className="font-display text-sm font-medium text-[#f7d46b] [text-shadow:0_1px_1px_rgb(0_0_0_/_0.75)]"
                    >
                      Room
                    </label>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-display text-xs font-medium text-[#f7d46b] outline-none hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d46b]"
                      onClick={handleRefreshRoomCode}
                    >
                      <RefreshCw className="size-3.5" aria-hidden="true" />
                      New
                    </button>
                  </div>
                  <Input
                    id="multiplayer-room"
                    value={roomCode}
                    readOnly
                    className="h-8 rounded-sm border-[#d8bb5a]/70 bg-[#080d3a]/85 px-3 font-mono text-sm font-semibold tracking-[0.12em] text-[#f3e6bc] focus-visible:border-[#f7d46b] focus-visible:ring-[#f7d46b]/50 sm:h-7 sm:text-xs"
                  />
                </div>

                <div className="grid grid-cols-[1fr_auto] gap-2 pt-1">
                  <button
                    type="submit"
                    className={cn(
                      buttonVariants({ variant: "default", size: "lg" }),
                      "mythic-menu-button h-8 rounded-full border-2 border-[#d8bb5a] px-3 font-display text-base font-medium hover:mythic-menu-button-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d46b] sm:h-7 sm:text-sm",
                    )}
                  >
                    <Swords className="size-4" aria-hidden="true" />
                    Multiplayer
                  </button>
                  <button
                    type="button"
                    className={cn(
                      buttonVariants({ variant: "secondary", size: "lg" }),
                      "h-8 rounded-full border-2 border-[#d8bb5a] bg-[#0b1247]/90 px-3 font-display text-base font-medium text-[#f7d46b] hover:bg-[#18206b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d46b] sm:h-7 sm:text-sm",
                    )}
                    onClick={handleShareInvite}
                  >
                    <Share2 className="size-4" aria-hidden="true" />
                    Share
                  </button>
                </div>

                <div className="min-h-4 truncate text-center font-display text-xs text-[#f3e6bc]/80">
                  {shareState === "copied" && "Invite copied"}
                  {shareState === "shared" && "Invite shared"}
                  {shareState === "failed" && "Share unavailable"}
                </div>
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

const ROOM_CODE_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";
const ROOM_CODE_LENGTH = 6;

function createRoomCode() {
  const values = new Uint32Array(ROOM_CODE_LENGTH);

  if (typeof crypto !== "undefined") {
    crypto.getRandomValues(values);
  } else {
    for (let index = 0; index < values.length; index += 1) {
      values[index] = Math.floor(Math.random() * ROOM_CODE_CHARS.length);
    }
  }

  let code = "duel-";

  for (const value of values) {
    code += ROOM_CODE_CHARS[value % ROOM_CODE_CHARS.length];
  }

  return code;
}

function createInviteUrl(roomCode: string) {
  const path = `/game?room=${encodeURIComponent(roomCode)}`;

  if (typeof window === "undefined") {
    return path;
  }

  return new URL(path, window.location.origin).toString();
}

function normalizePlayerName(name: string) {
  const trimmed = name.trim();
  return trimmed === "" ? null : trimmed;
}
