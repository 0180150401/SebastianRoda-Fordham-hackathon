import { BrainCircuit, Mail, MapPinned, Radar, Sparkles } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { GlobeWeather } from "@/components/ui/cobe-globe-weather"
import { Logos3 } from "@/components/ui/logos3"
import { TextScramble } from "@/components/ui/text-scramble"

const capabilityCards = [
  {
    title: "Visibility Intelligence",
    description:
      "See where your brand appears across AI answers, search overlays, and competitor recommendation clusters.",
    icon: Radar,
  },
  {
    title: "Semantic Mapping",
    description:
      "Map themes, entities, and intent signals so teams know exactly what language drives demand.",
    icon: BrainCircuit,
  },
  {
    title: "Geo-Aware Strategy",
    description:
      "Turn location and market nuance into campaigns that convert by region, audience, and model behavior.",
    icon: MapPinned,
  },
]

const socialProof = [
  "Built for AI-native growth teams",
  "Strategy grounded in evidence, not guesswork",
  "Fast setup with human-readable outputs",
]

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(255,174,77,0.18),_transparent_55%)]" />
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div className="space-y-8">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-muted-foreground">
                6 degree&apos;s
              </p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] uppercase tracking-[0.35em] text-muted-foreground">
                <span>by</span>
                <span className="inline-flex items-center gap-0">
                  <Image
                    src="/noem-logo.png"
                    alt=""
                    width={30}
                    height={30}
                    className="h-[30px] w-[30px] shrink-0 object-contain opacity-90 dark:invert"
                    aria-hidden
                  />
                  <span>NOEM</span>
                </span>
              </p>
            </div>
            <h1 className="max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
              Make your brand discoverable in AI and search conversations.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
              6 degree&apos;s helps teams understand where they show up, where competitors win,
              and what to do next with confidence.
            </p>
            <div className="flex flex-wrap items-center gap-6">
              <Link
                href="/sign-in?redirect=/tool"
                className="inline-flex rounded-xl px-2 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label="Try the 6 degree's analysis tool"
              >
                <TextScramble
                  text="Try 6°"
                  gapAfter={{ at: 3, skip: 1, widthClass: "w-16 sm:w-20" }}
                  textClassName="normal-case text-3xl sm:text-4xl md:text-5xl"
                />
              </Link>
            </div>
            <div className="flex flex-wrap gap-3 pt-1">
              {socialProof.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-border bg-card/50 px-3 py-1 text-xs text-muted-foreground"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="mx-auto w-full max-w-md">
            <GlobeWeather />
          </div>
        </div>
      </section>


      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="mb-8 flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-semibold tracking-tight">What 6 degree&apos;s delivers</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {capabilityCards.map((item) => {
            const Icon = item.icon
            return (
              <article
                key={item.title}
                className="cursor-pointer rounded-xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/60"
              >
                <Icon className="h-5 w-5 text-primary" />
                <h3 className="mt-4 text-lg font-medium">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </article>
            )
          })}
        </div>
      </section>

      <section
        id="trusted-by"
        className="border-y border-border/60 bg-muted/30"
        aria-labelledby="trusted-heading"
      >
        <Logos3 heading="Trusted by teams building AI-native brands" />
      </section>

      <section
        id="contact"
        className="border-t border-border/60 bg-muted/25"
        aria-labelledby="contact-heading"
      >
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-16 md:grid-cols-[1fr_1.1fr] md:items-start">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-muted-foreground">
              Contact
            </p>
            <h2
              id="contact-heading"
              className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              Contact us
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
              Reach out for demos, partnerships, or questions about how 6 degree&apos;s maps your
              brand across AI and search. We&apos;ll get back to you as soon as we can.
            </p>
          </div>
          <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <a
              href="mailto:hello@noemtech.com"
              className="group flex gap-4 rounded-xl border border-transparent p-2 transition hover:border-border hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Mail className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">Email</span>
                <span className="mt-0.5 block text-sm text-muted-foreground transition group-hover:text-foreground">
                  hello@noemtech.com
                </span>
              </span>
            </a>
            <p className="border-t border-border pt-6 text-sm text-muted-foreground">
              Typical response time: <span className="text-foreground">1–2 business days</span>.
              For product support, include your workspace name and a short description of the issue.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
