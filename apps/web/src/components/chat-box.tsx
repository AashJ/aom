import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { GameHandle } from "@aom/engine";

export function ChatBox({ game }: { game: GameHandle | null }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function openChat(event: globalThis.KeyboardEvent): void {
      if (event.key !== "Enter" || event.repeat || game === null) {
        return;
      }

      if (
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable ||
          event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement ||
          event.target instanceof HTMLSelectElement)
      ) {
        return;
      }

      event.preventDefault();
      setOpen(true);
    }

    window.addEventListener("keydown", openChat);
    return () => window.removeEventListener("keydown", openChat);
  }, [game]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  function close(): void {
    setMessage("");
    setOpen(false);
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    game?.submitCheat(message);
    close();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    event.stopPropagation();

    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  if (!open) {
    return null;
  }

  return (
    <form
      aria-label="Chat"
      onSubmit={submit}
      className="fixed top-4 left-4 z-40 flex w-[min(30rem,calc(100vw-2rem))] items-center gap-2 border border-[#9c8a63] bg-[#17130f]/90 px-2 py-1.5 font-serif shadow-[inset_0_0_0_1px_rgb(20_15_10/85%),0_2px_8px_rgb(0_0_0/55%)]"
    >
      <label htmlFor="game-chat-input" className="shrink-0 text-sm text-[#f4db78]">
        Chat:
      </label>
      <input
        ref={inputRef}
        id="game-chat-input"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        spellCheck={false}
        className="min-w-0 flex-1 border-0 bg-transparent text-sm text-[#f4eed8] outline-none"
      />
    </form>
  );
}
