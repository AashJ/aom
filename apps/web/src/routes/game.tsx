import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/game")({
  component: GameComponent,
});

function GameComponent() {
  return <div>Game Component</div>;
}
