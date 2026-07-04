import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/game")({
  component: GameComponent,
});

type GameError = "startup" | "unsupported";

function GameComponent() {
  return <div>Game Component</div>;
}
