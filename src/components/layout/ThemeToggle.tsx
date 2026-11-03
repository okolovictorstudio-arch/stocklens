"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="size-9 rounded-md text-muted-foreground"
        aria-label="Toggle theme"
      >
        <span className="size-4" />
      </Button>
    );
  }

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const getIcon = () => {
    if (theme === "dark") return <Moon className="size-4 text-sky-400" />;
    if (theme === "light") return <Sun className="size-4 text-amber-500" />;
    return <Monitor className="size-4 text-muted-foreground" />;
  };

  const getLabel = () => {
    if (theme === "dark") return "Dark theme active (click for system)";
    if (theme === "light") return "Light theme active (click for dark)";
    return "System theme active (click for light)";
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      className="size-9 rounded-md transition-colors hover:bg-muted"
      title={getLabel()}
      aria-label={getLabel()}
    >
      {getIcon()}
    </Button>
  );
}
