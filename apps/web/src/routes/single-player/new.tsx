import type { GameCulture } from "@aom/engine";
import { buttonVariants } from "@aom/ui/components/button";
import { cn } from "@aom/ui/lib/utils";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/single-player/new")({
  component: NewSinglePlayerComponent,
});

const cultures = [
  {
    id: "greek",
    name: "Greek",
    majorGod: "Zeus",
    description:
      "Lead Greek villagers beneath Zeus with their classic architecture, voices, and culture theme.",
  },
  {
    id: "egyptian",
    name: "Egyptian",
    majorGod: "Ra",
    description:
      "Lead Egyptian laborers beneath Ra with their classic architecture, voices, and culture theme.",
  },
] as const satisfies readonly {
  id: GameCulture;
  name: string;
  majorGod: string;
  description: string;
}[];

const matchDetails = [
  ["Scenario", "Skirmish"],
  ["Map", "Aegean Coast"],
  ["Difficulty", "Standard"],
] as const;

function NewSinglePlayerComponent() {
  const [culture, setCulture] = useState<GameCulture>("greek");

  return (
    <main className="relative isolate min-h-dvh overflow-hidden bg-background text-foreground">
      <img
        src="/images/mythic-island-start.png"
        alt=""
        className="absolute inset-0 size-full object-cover"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(7_10_31_/_0.88),rgb(14_20_63_/_0.72)_48%,rgb(14_20_63_/_0.42)),radial-gradient(circle_at_75%_24%,rgb(255_255_255_/_0.24),transparent_35%)]" />
      <div className="absolute inset-x-0 top-0 h-20 bg-linear-to-b from-white/45 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-black/55 to-transparent" />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <header className="flex items-center justify-between gap-3">
          <Link
            to="/"
            className={cn(
              buttonVariants({ variant: "secondary", size: "default" }),
              "mythic-menu-button rounded-full border-2 border-[#d8bb5a] px-3 font-display text-base font-medium hover:mythic-menu-button-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d46b] sm:text-sm",
            )}
          >
            Back
          </Link>
          <div className="font-display mythic-gold-text text-right text-base font-medium sm:text-sm">
            Single Player
          </div>
        </header>

        <section className="grid flex-1 items-center gap-6 lg:grid-cols-[9fr_11fr]">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <p className="font-display mythic-gold-text text-lg font-medium sm:text-base">
                Match Setup
              </p>
              <h1 className="font-display mythic-title max-w-[11ch] text-5xl font-semibold tracking-tight text-balance sm:text-6xl md:text-7xl">
                Choose Your Culture
              </h1>
              <p className="max-w-[56ch] text-base text-[#f3e6bc] text-pretty [text-shadow:0_1px_2px_rgb(0_0_0_/_0.8)] sm:text-sm">
                Select the people and major god you will lead into the skirmish.
              </p>
            </div>

            <dl className="grid max-w-xl grid-cols-3 divide-x divide-[#d8bb5a]/25 border-y border-[#d8bb5a]/30 bg-[#080d3a]/45 py-3 backdrop-blur-sm">
              {matchDetails.map(([term, detail], index) => (
                <div
                  key={term}
                  className={cn(
                    "grid min-w-0 gap-1 px-3",
                    index === 0 && "pl-0",
                    index === matchDetails.length - 1 && "pr-0",
                  )}
                >
                  <dt className="font-display text-base text-[#d8bb5a] sm:text-sm">{term}</dt>
                  <dd className="truncate text-base font-medium text-[#f3e6bc] sm:text-sm">
                    {detail}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <section
            aria-labelledby="culture-heading"
            className="rounded-sm bg-[#151d63]/95 p-4 shadow-2xl ring-4 ring-[#d8bb5a] sm:p-5"
          >
            <div className="grid gap-4">
              <div className="grid gap-1">
                <h2
                  id="culture-heading"
                  className="font-display text-xl font-medium text-balance text-[#f7d46b] [text-shadow:0_1px_1px_rgb(0_0_0_/_0.75)]"
                >
                  Culture
                </h2>
                <p className="max-w-[56ch] text-base text-[#ddd3b7] text-pretty sm:text-sm">
                  Your choice sets the match&apos;s people, major god, architecture, voices, and
                  opening music.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2" aria-label="Available cultures">
                {cultures.map((option) => {
                  const selected = culture === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setCulture(option.id)}
                      className={cn(
                        "relative grid min-h-44 gap-4 overflow-hidden rounded-sm p-4 text-left ring-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d46b]",
                        option.id === "greek"
                          ? "bg-[radial-gradient(circle_at_82%_12%,rgb(108_152_255_/_0.32),transparent_34%),linear-gradient(145deg,rgb(19_35_119_/_0.98),rgb(8_14_57_/_0.98))]"
                          : "bg-[radial-gradient(circle_at_82%_12%,rgb(255_209_91_/_0.3),transparent_34%),linear-gradient(145deg,rgb(117_65_20_/_0.98),rgb(48_27_19_/_0.98))]",
                        selected
                          ? "ring-2 ring-[#f7d46b] [box-shadow:inset_0_0_0_2px_rgb(255_241_177_/_0.18),0_8px_22px_rgb(0_0_0_/_0.38)]"
                          : "ring-[#d8bb5a]/45 hover:brightness-110",
                      )}
                    >
                      <div className="relative z-10 grid gap-1">
                        <div className="font-display text-3xl font-semibold tracking-tight text-balance text-[#fff1b1]">
                          {option.name}
                        </div>
                        <div className="font-display text-base font-medium text-[#f7d46b] sm:text-sm">
                          Major god: {option.majorGod}
                        </div>
                      </div>
                      <p className="relative z-10 self-end text-base text-[#f3e6bc] text-pretty sm:text-sm">
                        {option.description}
                      </p>
                      <div
                        aria-hidden="true"
                        className="absolute right-3 bottom-0 font-display text-8xl font-semibold text-white/5"
                      >
                        {option.name[0]}
                      </div>
                    </button>
                  );
                })}
              </div>

              <Link
                to="/game"
                search={{ culture }}
                className={cn(
                  buttonVariants({ variant: "default", size: "lg" }),
                  "h-10 rounded-full bg-[#d8bb5a] px-4 font-display text-base font-medium text-[#161230] shadow-lg ring-2 ring-[#d8bb5a] hover:bg-[#f7d46b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d46b] sm:h-9 sm:text-sm",
                )}
              >
                Start as {cultures.find((option) => option.id === culture)?.name}
              </Link>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
