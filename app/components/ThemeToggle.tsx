"use client";

import { useLayoutEffect, useSyncExternalStore, type ComponentType } from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "@/app/components/icons";
import { DARK_QUERY, THEME_STORAGE_KEY as STORAGE_KEY } from "@/lib/theme";

type ThemePreference = "light" | "dark" | "system";

const CHANGE_EVENT = "themechange";

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Storage can be blocked (private mode); follow the system theme instead.
  }
  return "system";
}

function applyTheme(preference: ThemePreference) {
  const isDark =
    preference === "dark" || (preference === "system" && window.matchMedia(DARK_QUERY).matches);
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
}

function savePreference(preference: ThemePreference) {
  try {
    if (preference === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Storage blocked: the choice still applies until the page is closed.
  }
  applyTheme(preference);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// Mounted once in the root layout: re-applies the stored theme after React
// resets <html> on a dev remount, and follows OS changes while on "system".
export function ThemeSync() {
  useLayoutEffect(() => {
    applyTheme(readPreference());
    const media = window.matchMedia(DARK_QUERY);
    const handleSystemChange = () => {
      if (readPreference() === "system") applyTheme("system");
    };
    media.addEventListener("change", handleSystemChange);
    return () => media.removeEventListener("change", handleSystemChange);
  }, []);

  return null;
}

const OPTIONS: { value: ThemePreference; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
  { value: "system", label: "System", Icon: MonitorIcon },
];

export function ThemeToggle() {
  const preference = useSyncExternalStore(subscribe, readPreference, () => "system" as const);

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-grid grid-cols-3 gap-1 rounded-xl border border-zinc-200 bg-zinc-100/70 p-1 dark:border-zinc-800 dark:bg-zinc-900"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const isSelected = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => savePreference(value)}
            className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3.5 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none ${
              isSelected
                ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
