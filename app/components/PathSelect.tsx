"use client";

import type { TeamIteration } from "@/lib/types";

export interface PathOption {
  path: string;
  suffix?: string;
}

// Drops the project root so long Area/Iteration paths fit in a table cell;
// the full path stays as the option value and tooltip.
export function shortPath(path: string) {
  const separator = path.indexOf("\\");
  return separator === -1 ? path : path.slice(separator + 1);
}

export function areaOptions(areas: string[]): PathOption[] {
  return areas.map((path) => ({ path }));
}

export function iterationOptions(iterations: TeamIteration[]): PathOption[] {
  return iterations.map((iteration) => ({
    path: iteration.path,
    suffix: iteration.timeFrame === "current" ? " (current)" : undefined,
  }));
}

interface PathSelectProps {
  id?: string;
  ariaLabel?: string;
  value: string;
  onChange: (path: string) => void;
  options: PathOption[];
  // Label of the "" option; omit to offer no empty choice.
  emptyLabel?: string;
  title?: string;
  className: string;
}

export function PathSelect({
  id,
  ariaLabel,
  value,
  onChange,
  options,
  emptyLabel,
  title,
  className,
}: PathSelectProps) {
  // A value outside the Team's list (e.g. a Task in another team's area) is
  // still shown, so selecting nothing never silently changes it.
  const allOptions =
    value !== "" && !options.some((option) => option.path === value)
      ? [{ path: value }, ...options]
      : options;

  return (
    <select
      id={id}
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      title={title ?? (value || undefined)}
      className={className}
    >
      {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
      {allOptions.map((option) => (
        <option key={option.path} value={option.path} title={option.path}>
          {shortPath(option.path)}
          {option.suffix ?? ""}
        </option>
      ))}
    </select>
  );
}
