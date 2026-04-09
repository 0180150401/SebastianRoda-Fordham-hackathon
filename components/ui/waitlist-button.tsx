"use client";

import { WaitlistModal } from "@/components/ui/waitlist-modal";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useState } from "react";

export function WaitlistButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="h-11 rounded-full px-5"
      >
        <span className="inline-flex items-center gap-2">
          Join waitlist
          <ArrowRight className="h-4 w-4" aria-hidden />
        </span>
      </Button>
      <WaitlistModal open={open} onOpenChange={setOpen} />
    </>
  );
}
