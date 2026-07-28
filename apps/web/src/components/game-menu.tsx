import { ScrollText } from "lucide-react";
import { useCallback, useEffect, useState, type RefObject } from "react";
import type { GameHandle } from "@aom/engine";

type MenuView = "closed" | "menu" | "options" | "quit";

export function GameMenu({
  game,
  fullscreenTargetRef,
  pointerLockTargetRef,
  pauseWhenOpen,
  onQuit,
}: {
  game: GameHandle | null;
  fullscreenTargetRef: RefObject<HTMLElement | null>;
  pointerLockTargetRef: RefObject<HTMLCanvasElement | null>;
  pauseWhenOpen: boolean;
  onQuit: () => void;
}) {
  const [view, setView] = useState<MenuView>("closed");
  const {
    isSupported,
    isFullscreen,
    isPointerLockSupported,
    isPointerLocked,
    requestPointerLock,
    toggleFullscreen,
  } = useFullscreenMode(fullscreenTargetRef, pointerLockTargetRef);
  const isOpen = view !== "closed";

  useEffect(() => {
    if (!isOpen || !pauseWhenOpen || !game) {
      return;
    }

    game.stop();
    return () => game.start();
  }, [game, isOpen, pauseWhenOpen]);

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent): void {
      if (isEditableTarget(event.target) || event.repeat) {
        return;
      }

      if (event.key === "F10") {
        event.preventDefault();
        setView((current) => (current === "closed" ? "menu" : "closed"));
        return;
      }

      if (event.altKey && event.key === "Enter") {
        event.preventDefault();
        void toggleFullscreen();
        return;
      }

      if (event.key !== "Escape" || view === "closed") {
        return;
      }

      event.preventDefault();
      setView(view === "options" || view === "quit" ? "menu" : "closed");
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleFullscreen, view]);

  return (
    <>
      <button
        type="button"
        onClick={() => setView((current) => (current === "closed" ? "menu" : "closed"))}
        className="absolute top-3 right-3 z-30 flex size-8 items-center justify-center border border-[#21180e] bg-[linear-gradient(180deg,#b3a77f_0%,#71654b_48%,#453923_100%)] text-[#f4db78] shadow-[inset_0_0_0_1px_#d9cda4,inset_0_0_0_3px_#5b4a2e,0_2px_5px_rgb(0_0_0/65%)] select-none hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4db78]"
        aria-label="In-game menu"
        aria-expanded={isOpen}
        title="In-game menu (F10)"
      >
        <ScrollText
          className="size-4 [filter:drop-shadow(0_1px_1px_rgb(0_0_0/90%))]"
          aria-hidden="true"
        />
      </button>

      {isFullscreen && isPointerLockSupported && !isPointerLocked && (
        <button
          type="button"
          onClick={() => void requestPointerLock()}
          className="fixed top-3 left-1/2 z-40 -translate-x-1/2 border border-[#21180e] bg-[#30271d] px-4 py-2 font-serif text-sm text-[#f4db78] shadow-[inset_0_0_0_1px_#756745,0_2px_8px_rgb(0_0_0/70%)] hover:bg-[#3b3022] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4db78]"
        >
          Click to recapture the game pointer
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
          <section
            role="dialog"
            aria-modal="true"
            aria-label={
              view === "options" ? "Options" : view === "quit" ? "Quit game" : "In-game menu"
            }
            className="relative w-full max-w-sm border border-[#21180e] bg-[#716f69] p-3 font-serif text-[#eee9d7] [background-image:radial-gradient(circle_at_18%_22%,rgb(255_255_255/10%)_0_0.6px,transparent_0.9px),radial-gradient(circle_at_73%_65%,rgb(24_20_15/14%)_0_0.7px,transparent_1px),linear-gradient(180deg,#89867d_0%,#6d6b66_47%,#7c7970_100%)] [background-size:13px_11px,17px_15px,100%_100%] shadow-[inset_0_0_0_2px_#bcb69c,inset_0_0_0_6px_#4e4436,0_8px_28px_rgb(0_0_0/75%)]"
          >
            <div className="border border-[#2a2117] bg-[#17130f]/85 p-5 shadow-[inset_0_0_0_1px_#9b8d68]">
              {view === "menu" && (
                <MenuPanel
                  onResume={() => setView("closed")}
                  onOptions={() => setView("options")}
                  onQuit={() => setView("quit")}
                />
              )}
              {view === "options" && (
                <OptionsPanel
                  isFullscreen={isFullscreen}
                  isSupported={isSupported}
                  onToggleFullscreen={() => void toggleFullscreen()}
                  onBack={() => setView("menu")}
                />
              )}
              {view === "quit" && <QuitPanel onConfirm={onQuit} onCancel={() => setView("menu")} />}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function MenuPanel({
  onResume,
  onOptions,
  onQuit,
}: {
  onResume: () => void;
  onOptions: () => void;
  onQuit: () => void;
}) {
  return (
    <>
      <MenuTitle>Game Menu</MenuTitle>
      <div className="mt-5 grid gap-2">
        <MenuButton onClick={onResume} autoFocus>
          Resume Game
        </MenuButton>
        <MenuButton onClick={onOptions}>Options</MenuButton>
        <MenuButton onClick={onQuit}>Quit Game</MenuButton>
      </div>
      <p className="mt-4 text-center text-xs text-[#c7bea4] [text-shadow:0_1px_1px_#000]">F10</p>
    </>
  );
}

function OptionsPanel({
  isFullscreen,
  isSupported,
  onToggleFullscreen,
  onBack,
}: {
  isFullscreen: boolean;
  isSupported: boolean;
  onToggleFullscreen: () => void;
  onBack: () => void;
}) {
  return (
    <>
      <MenuTitle>Options</MenuTitle>
      <div className="mt-5">
        <button
          type="button"
          onClick={onToggleFullscreen}
          disabled={!isSupported}
          aria-pressed={isFullscreen}
          className="flex w-full items-center justify-between border border-[#24190e] bg-[#30271d] px-3 py-2.5 text-left text-sm text-[#eee9d7] shadow-[inset_0_0_0_1px_#756745] hover:bg-[#3b3022] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4db78] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span>Fullscreen</span>
          <span className="text-[#f4db78]">{isFullscreen ? "On" : "Off"}</span>
        </button>
        <p className="mt-2 text-center text-xs text-[#c7bea4] [text-shadow:0_1px_1px_#000]">
          Toggle anytime with Alt+Enter. Escape releases the game pointer.
        </p>
        {!isSupported && (
          <p className="mt-2 text-center text-xs text-[#d6a18a]">
            Fullscreen is unavailable in this browser.
          </p>
        )}
      </div>
      <div className="mt-5">
        <MenuButton onClick={onBack} autoFocus>
          Back
        </MenuButton>
      </div>
    </>
  );
}

function QuitPanel({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <>
      <MenuTitle>Quit Game?</MenuTitle>
      <p className="mt-4 text-center text-sm text-[#ddd5be]">Any unsaved progress will be lost.</p>
      <div className="mt-5 grid gap-2">
        <MenuButton onClick={onConfirm}>Quit Game</MenuButton>
        <MenuButton onClick={onCancel} autoFocus>
          Cancel
        </MenuButton>
      </div>
    </>
  );
}

function MenuTitle({ children }: { children: string }) {
  return (
    <h2 className="text-center text-2xl font-semibold text-[#f4db78] [text-shadow:-1px_-1px_0_#211a13,1px_-1px_0_#211a13,-1px_1px_0_#211a13,1px_1px_0_#211a13,0_2px_2px_rgb(0_0_0/80%)]">
      {children}
    </h2>
  );
}

function MenuButton({
  children,
  onClick,
  autoFocus,
}: {
  children: string;
  onClick: () => void;
  autoFocus?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      autoFocus={autoFocus}
      className="mythic-menu-button hover:mythic-menu-button-hover min-h-9 w-full px-4 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4db78]"
    >
      {children}
    </button>
  );
}

function useFullscreenMode(
  targetRef: RefObject<HTMLElement | null>,
  pointerLockTargetRef: RefObject<HTMLCanvasElement | null>,
) {
  const [isSupported, setIsSupported] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPointerLockSupported, setIsPointerLockSupported] = useState(false);
  const [isPointerLocked, setIsPointerLocked] = useState(false);

  const requestPointerLock = useCallback(async () => {
    try {
      await pointerLockTargetRef.current?.requestPointerLock();
    } catch (error) {
      console.error("Unable to capture the game pointer", error);
    }
  }, [pointerLockTargetRef]);

  useEffect(() => {
    const target = targetRef.current;
    const pointerLockTarget = pointerLockTargetRef.current;

    setIsSupported(
      document.fullscreenEnabled &&
        typeof target?.requestFullscreen === "function" &&
        typeof document.exitFullscreen === "function",
    );
    setIsPointerLockSupported(
      typeof pointerLockTarget?.requestPointerLock === "function" &&
        typeof document.exitPointerLock === "function",
    );

    const syncState = (): boolean => {
      const fullscreen = document.fullscreenElement === targetRef.current;
      setIsFullscreen(fullscreen);
      setIsPointerLocked(document.pointerLockElement === pointerLockTargetRef.current);

      if (
        !fullscreen &&
        document.pointerLockElement === pointerLockTargetRef.current &&
        typeof document.exitPointerLock === "function"
      ) {
        document.exitPointerLock();
      }

      return fullscreen;
    };

    const handleFullscreenChange = () => {
      // Pointer lock is allowed once fullscreen has been granted. Requesting it from this
      // event avoids racing fullscreen and pointer-lock user-activation rules, and ensures
      // every fullscreen entry captures the game cursor by default.
      if (
        syncState() &&
        document.pointerLockElement !== pointerLockTargetRef.current &&
        typeof pointerLockTargetRef.current?.requestPointerLock === "function"
      ) {
        void requestPointerLock();
      }
    };

    syncState();
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("pointerlockchange", syncState);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("pointerlockchange", syncState);
    };
  }, [pointerLockTargetRef, requestPointerLock, targetRef]);

  const toggleFullscreen = useCallback(async () => {
    const fullscreenTarget = targetRef.current;
    const pointerLockTarget = pointerLockTargetRef.current;

    if (!fullscreenTarget) {
      return;
    }

    try {
      if (document.fullscreenElement === fullscreenTarget) {
        if (document.pointerLockElement === pointerLockTarget) {
          document.exitPointerLock();
        }
        await document.exitFullscreen();
      } else {
        await fullscreenTarget.requestFullscreen({ navigationUI: "hide" });
      }
    } catch (error) {
      console.error("Unable to change fullscreen mode", error);
    }
  }, [pointerLockTargetRef, targetRef]);

  return {
    isSupported,
    isFullscreen,
    isPointerLockSupported,
    isPointerLocked,
    requestPointerLock,
    toggleFullscreen,
  };
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement)
  );
}
