"use client";

import { Moon, Sun, Check } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStyleTheme } from "@/lib/hooks/use-style-theme";
import type { StyleThemeId } from "@/lib/hooks/use-style-theme";

const STYLE_THEMES: { id: StyleThemeId; label: string }[] = [
  { id: "default", label: "Default" },
  { id: "cartoon", label: "Cartoon" },
  { id: "cyberpunk-pixel", label: "Cyberpunk" },
  { id: "retro-handheld", label: "Retro" },
];

export function ThemeToggle() {
  const { setTheme } = useTheme();
  const { styleTheme, setStyleTheme } = useStyleTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9">
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          System
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {STYLE_THEMES.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onClick={() => setStyleTheme(t.id)}
          >
            <Check
              className={`mr-2 h-4 w-4 ${styleTheme === t.id ? "opacity-100" : "opacity-0"}`}
            />
            {t.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
