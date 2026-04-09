"use client";

import { Home, LogOut, Settings2, UserCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Menu,
  MenuDropdownContent,
  MenuDropdownItem,
  MenuDropdownLinkItem,
  MenuDropdownSeparator,
} from "@/components/ui/menu";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function AccountMenu() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data: { user } }) => setEmail(user?.email ?? null));
  }, [supabase]);

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  async function handleManagePlan() {
    if (openingPortal) return;
    setOpeningPortal(true);
    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        credentials: "include",
      });
      const data = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      if (data?.error) {
        window.alert(data.error);
        return;
      }
      window.alert("Unable to open plan management right now.");
    } finally {
      setOpeningPortal(false);
    }
  }

  if (!supabase) {
    return null;
  }

  return (
    <Menu.Root>
      <Menu.Trigger
        className={cn(
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm outline-none transition",
          "hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
        aria-label="Account menu"
      >
        <UserCircle className="h-5 w-5" aria-hidden />
      </Menu.Trigger>

      <MenuDropdownContent align="end" side="bottom" sideOffset={6}>
        {email ? (
          <div className="max-w-[220px] truncate px-2 py-1.5 text-xs text-muted-foreground">{email}</div>
        ) : null}

        <MenuDropdownLinkItem href="/">
          <Home className="text-muted-foreground" />
          Home
        </MenuDropdownLinkItem>

        <MenuDropdownItem
          disabled={openingPortal}
          onClick={() => {
            void handleManagePlan();
          }}
        >
          <Settings2 className="text-muted-foreground" />
          {openingPortal ? "Opening plan management…" : "Plan management"}
        </MenuDropdownItem>

        <MenuDropdownSeparator />

        <MenuDropdownItem
          onClick={() => {
            void handleSignOut();
          }}
        >
          <LogOut className="text-muted-foreground" />
          Log out
        </MenuDropdownItem>

        <div className="border-t border-border px-2 py-1.5">
          <Link
            href="/policy"
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Privacy
          </Link>
        </div>
      </MenuDropdownContent>
    </Menu.Root>
  );
}
