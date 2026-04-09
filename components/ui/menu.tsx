"use client";

/**
 * Styled wrappers for Base UI Menu (@base-ui/react/menu).
 * The installed Base UI API uses Menu.Root, Menu.Portal, Menu.Positioner, Menu.Popup, etc.
 */
import { Menu } from "@base-ui/react/menu";
import { cn } from "@/lib/utils";
import type * as React from "react";

export { Menu };

const itemClass =
  "flex min-h-8 w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground outline-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-muted data-highlighted:text-foreground [&>svg]:size-4 [&>svg]:shrink-0";

export function MenuDropdownContent({
  children,
  className,
  align = "end",
  side = "bottom",
  sideOffset = 4,
}: React.PropsWithChildren<{
  className?: string;
  align?: "start" | "center" | "end";
  side?: React.ComponentProps<typeof Menu.Positioner>["side"];
  sideOffset?: number;
}>) {
  return (
    <Menu.Portal>
      <Menu.Positioner
        align={align}
        className="z-[100] outline-none"
        side={side}
        sideOffset={sideOffset}
      >
        <Menu.Popup
          className={cn(
            "relative min-w-[12rem] origin-[var(--transform-origin)] rounded-lg border border-border bg-card p-1 text-foreground shadow-xl outline-none",
            className,
          )}
        >
          {children}
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  );
}

export function MenuDropdownItem({
  className,
  ...props
}: React.ComponentProps<typeof Menu.Item>) {
  return <Menu.Item className={cn(itemClass, className)} {...props} />;
}

export function MenuDropdownLinkItem({
  className,
  ...props
}: React.ComponentProps<typeof Menu.LinkItem>) {
  return <Menu.LinkItem className={cn(itemClass, className)} closeOnClick {...props} />;
}

export function MenuDropdownSeparator({ className, ...props }: React.ComponentProps<typeof Menu.Separator>) {
  return <Menu.Separator className={cn("mx-1 my-1 h-px bg-border", className)} {...props} />;
}
