import { lazy, Suspense, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

// The whole game (matter-js, canvas) is browser-only: lazy-load it after mount
// so SSR/prerender never executes it.
const PinballApp = lazy(() => import("@/components/pinball/PinballApp"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NEONVOLT — Pinball Elétrico" },
      {
        name: "description",
        content:
          "Jogue NEONVOLT: pinball arcade no navegador com física real, 5 mesas neon temáticas, missões, torneio, conquistas e recordes.",
      },
      { property: "og:title", content: "NEONVOLT — Pinball Elétrico" },
      {
        property: "og:description",
        content:
          "Pinball arcade no navegador: física real, 5 mesas neon temáticas, torneio, conquistas e recordes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Boot() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <p className="nv-glow-text font-display animate-pulse text-5xl tracking-widest text-primary">
        NEONVOLT
      </p>
    </div>
  );
}

function Index() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <Boot />;
  return (
    <Suspense fallback={<Boot />}>
      <PinballApp />
    </Suspense>
  );
}
