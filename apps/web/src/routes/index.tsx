import { buttonVariants } from "@aom/ui/components/button";
import { cn } from "@aom/ui/lib/utils";
import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
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
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
