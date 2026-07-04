import { buttonVariants } from "@aom/ui/components/button";
import { cn } from "@aom/ui/lib/utils";
import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/single-player/new")({
  component: NewSinglePlayerComponent,
});

const setupGroups = [
  {
    title: "Scenario",
    options: ["Skirmish", "Campaign", "Custom"],
    selected: "Skirmish",
  },
  {
    title: "Map",
    options: ["Aegean Coast", "Highland Pass", "Nile Delta"],
    selected: "Aegean Coast",
  },
  {
    title: "Difficulty",
    options: ["Easy", "Standard", "Titan"],
    selected: "Standard",
  },
] as const;

function NewSinglePlayerComponent() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-background text-foreground">
      <img
        src="/images/mythic-island-start.png"
        alt=""
        className="absolute inset-0 size-full object-cover"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(7_10_31_/_0.82),rgb(14_20_63_/_0.66)_42%,rgb(14_20_63_/_0.36)),radial-gradient(circle_at_75%_24%,rgb(255_255_255_/_0.28),transparent_35%)]" />
      <div className="absolute inset-x-0 top-0 h-20 bg-linear-to-b from-white/45 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-black/55 to-transparent" />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-5 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
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

        <section className="grid flex-1 items-center gap-5 lg:grid-cols-[11fr_9fr]">
          <div className="max-w-2xl">
            <p className="font-display mythic-gold-text text-lg font-medium sm:text-base">
              Match Setup
            </p>
            <h1 className="font-display mythic-title mt-1 max-w-[11ch] text-5xl font-semibold tracking-tight text-balance sm:text-6xl md:text-7xl">
              Single Player
            </h1>
            <p className="mt-4 max-w-[56ch] text-base text-[#f3e6bc] text-pretty [text-shadow:0_1px_2px_rgb(0_0_0_/_0.8)] sm:text-sm">
              Choose your battleground, set the challenge, and begin a mythic match.
            </p>
          </div>

          <div className="rounded-sm bg-[#151d63]/95 p-4 shadow-2xl ring-4 ring-[#d8bb5a] sm:p-5">
            <div className="grid gap-4">
              {setupGroups.map((group) => (
                <section key={group.title} className="grid gap-2">
                  <h2 className="font-display text-lg font-medium text-[#f7d46b] [text-shadow:0_1px_1px_rgb(0_0_0_/_0.75)] sm:text-base">
                    {group.title}
                  </h2>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {group.options.map((option) => {
                      const selected = option === group.selected;

                      return (
                        <button
                          key={option}
                          type="button"
                          aria-pressed={selected}
                          className={cn(
                            "rounded-sm px-3 py-2 text-left font-display text-base font-medium ring-1 ring-[#d8bb5a]/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d46b] sm:text-sm",
                            selected
                              ? "mythic-menu-button"
                              : "bg-[#0b1247]/75 text-[#f3e6bc] hover:bg-[#18206b]",
                          )}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}

              <Link
                to="/game"
                className={cn(
                  buttonVariants({ variant: "default", size: "lg" }),
                  "h-10 rounded-full bg-[#d8bb5a] px-4 font-display text-base font-medium text-[#161230] shadow-lg ring-2 ring-[#d8bb5a] hover:bg-[#f7d46b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d46b] sm:h-9 sm:text-sm",
                )}
              >
                Start Skirmish
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
