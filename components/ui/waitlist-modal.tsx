"use client";

import {
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AtSignIcon, LoaderCircle } from "lucide-react";
import Link from "next/link";
import * as React from "react";

type WaitlistModalProps = Omit<React.ComponentProps<typeof Modal>, "children">;

export function WaitlistModal(props: WaitlistModalProps) {
  const [email, setEmail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Something went wrong.");
        return;
      }
      props.onOpenChange?.(false);
      setEmail("");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal {...props}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Join the waitlist</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-start text-xs text-muted-foreground">
              Enter your email. We&apos;ll notify you when spots open up.
            </p>
            <div className="relative">
              <Input
                id="waitlist-email"
                name="email"
                placeholder="your.email@example.com"
                className="peer ps-9"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
              />
              <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 text-muted-foreground peer-disabled:opacity-50">
                <AtSignIcon className="size-4" aria-hidden />
              </div>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button
              type="submit"
              variant="default"
              className="relative w-full"
              disabled={submitting}
            >
              <span className={submitting ? "opacity-0" : undefined}>Join waitlist</span>
              {submitting ? (
                <span className="absolute inset-0 flex items-center justify-center" aria-live="polite">
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                  <span className="sr-only">Joining</span>
                </span>
              ) : null}
            </Button>
          </form>
        </ModalBody>
        <div className="p-4">
          <p className="text-center text-xs text-muted-foreground">
            By submitting, you agree to our{" "}
            <Link className="text-foreground hover:underline" href="/policy">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </ModalContent>
    </Modal>
  );
}
