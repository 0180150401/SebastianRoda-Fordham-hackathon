"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*"

interface TextScrambleProps {
  text: string
  className?: string
  /** Typography for the scrambled line (default `text-lg`). */
  textClassName?: string
  /** Skip `skip` characters starting at `at` (usually spaces) and render a fixed-width gap instead. */
  gapAfter?: { at: number; skip: number; widthClass?: string }
}

export function TextScramble({ text, className = "", textClassName, gapAfter }: TextScrambleProps) {
  const [displayText, setDisplayText] = useState(text)
  const [isHovering, setIsHovering] = useState(false)
  const [isScrambling, setIsScrambling] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const frameRef = useRef(0)

  const scramble = useCallback(() => {
    setIsScrambling(true)
    frameRef.current = 0
    const duration = text.length * 3

    if (intervalRef.current) clearInterval(intervalRef.current)

    intervalRef.current = setInterval(() => {
      frameRef.current++

      const progress = frameRef.current / duration
      const revealedLength = Math.floor(progress * text.length)

      const newText = text
        .split("")
        .map((char, i) => {
          if (char === " ") return " "
          if (i < revealedLength) return text[i]
          return CHARS[Math.floor(Math.random() * CHARS.length)]
        })
        .join("")

      setDisplayText(newText)

      if (frameRef.current >= duration) {
        if (intervalRef.current) clearInterval(intervalRef.current)
        setDisplayText(text)
        setIsScrambling(false)
      }
    }, 30)
  }, [text])

  const handleMouseEnter = () => {
    setIsHovering(true)
    scramble()
  }

  const handleMouseLeave = () => {
    setIsHovering(false)
  }

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return (
    <div
      className={`group relative inline-flex cursor-pointer select-none flex-col ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span
        className={cn(
          "relative font-mono text-lg tracking-widest uppercase",
          textClassName,
        )}
      >
        {gapAfter ? (
          <>
            {displayText.slice(0, gapAfter.at).split("").map((char, i) => (
              <span
                key={i}
                className={`inline-block transition-all duration-150 ${
                  isScrambling && char !== text[i] ? "scale-110 text-primary" : "text-foreground"
                }`}
                style={{ transitionDelay: `${i * 10}ms` }}
              >
                {char}
              </span>
            ))}
            <span
              aria-hidden
              className={`inline-block shrink-0 ${gapAfter.widthClass ?? "w-10"}`}
            />
            {displayText.slice(gapAfter.at + gapAfter.skip).split("").map((char, i) => {
              const gi = gapAfter.at + gapAfter.skip + i
              return (
                <span
                  key={gi}
                  className={`inline-block transition-all duration-150 ${
                    isScrambling && char !== text[gi] ? "scale-110 text-primary" : "text-foreground"
                  }`}
                  style={{ transitionDelay: `${gi * 10}ms` }}
                >
                  {char}
                </span>
              )
            })}
          </>
        ) : (
          displayText.split("").map((char, i) => (
            <span
              key={i}
              className={`inline-block transition-all duration-150 ${
                isScrambling && char !== text[i] ? "scale-110 text-primary" : "text-foreground"
              }`}
              style={{
                transitionDelay: `${i * 10}ms`,
              }}
            >
              {char}
            </span>
          ))
        )}
      </span>

      <span className="relative mt-2 h-px w-full overflow-hidden">
        <span
          className={`absolute inset-0 origin-left bg-foreground transition-transform duration-500 ease-out ${
            isHovering ? "scale-x-100" : "scale-x-0"
          }`}
        />
        <span className="absolute inset-0 bg-border" />
      </span>

      <span
        className={`absolute -inset-4 -z-10 rounded-lg bg-primary/5 transition-opacity duration-300 ${
          isHovering ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  )
}
