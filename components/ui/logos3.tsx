"use client";

import AutoScroll from "embla-carousel-auto-scroll";
import { useMemo } from "react";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

export interface Logo {
  id: string;
  description: string;
  image: string;
  className?: string;
}

export interface Logos3Props {
  heading?: string;
  headingId?: string;
  logos?: Logo[];
  className?: string;
}

const defaultLogos: Logo[] = [
  {
    id: "logo-chanel",
    description: "Chanel",
    image: "/logos/chanel.svg",
    className: "h-16 w-auto",
  },
  {
    id: "logo-google",
    description: "Google",
    image: "/logos/google-color.svg",
    className: "h-16 w-auto",
  },
  {
    id: "logo-hermes",
    description: "Hermes",
    image: "/logos/hermes.svg",
    className: "h-16 w-auto",
  },
  {
    id: "logo-pinterest",
    description: "Pinterest",
    image: "/logos/pinterest-color.svg",
    className: "h-16 w-auto",
  },
];

export function Logos3({
  heading = "Trusted by these companies",
  headingId = "trusted-heading",
  logos = defaultLogos,
  className,
}: Logos3Props) {
  const repeatedLogos = useMemo(() => [...logos, ...logos, ...logos], [logos]);
  const autoScroll = useMemo(
    () =>
      AutoScroll({
        playOnInit: true,
        speed: 2,
        stopOnInteraction: false,
        stopOnMouseEnter: false,
        stopOnFocusIn: false,
      }),
    [],
  );

  return (
    <section className={cn("py-16 md:py-20", className)}>
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-6 text-center">
        <h2
          id={headingId}
          className="my-6 text-2xl font-bold text-pretty text-foreground lg:text-4xl"
        >
          {heading}
        </h2>
      </div>
      <div className="pt-6 md:pt-10 lg:pt-12">
        <div className="relative mx-auto flex items-center justify-center lg:max-w-5xl">
          <Carousel
            opts={{ loop: true, align: "start", dragFree: true }}
            plugins={[autoScroll]}
          >
            <CarouselContent className="ml-0">
              {repeatedLogos.map((logo, index) => (
                <CarouselItem
                  key={`${logo.id}-${index}`}
                  className="flex basis-1/2 justify-center pl-0 sm:basis-1/3 md:basis-1/4 lg:basis-1/5"
                >
                  <div className="mx-12 flex shrink-0 items-center justify-center">
                    <div>
                      <img
                        src={logo.image}
                        alt={logo.description}
                        className={cn("opacity-80 dark:opacity-70", logo.className)}
                      />
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-background to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent" />
        </div>
      </div>
    </section>
  );
}
