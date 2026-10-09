"use client";

import type { ReactNode } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "@/app/components/icons";

const STEP = 0.5;

function stepValue(value: string, delta: number) {
  const current = Number.parseFloat(value);
  const base = Number.isFinite(current) ? current : 0;
  return String(Math.max(0, Math.round((base + delta) * 100) / 100));
}

interface HoursInputProps {
  id?: string;
  ariaLabel?: string;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  title?: string;
  className: string;
}

// Number input with our own stepper instead of the browser's spin buttons
// (hidden globally in globals.css). Arrow keys still work natively.
export function HoursInput({
  id,
  ariaLabel,
  value,
  onValueChange,
  disabled,
  placeholder,
  title,
  className,
}: HoursInputProps) {
  return (
    <div className="group/hours relative">
      <input
        id={id}
        type="number"
        min={0}
        step={STEP}
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        title={title}
        className={`${className} pr-2.5! transition-[padding] group-focus-within/hours:pr-7! group-hover/hours:pr-7!`}
      />
      {!disabled && (
        <div className="pointer-events-none absolute inset-y-1 right-1 flex w-5 flex-col gap-px opacity-0 transition-opacity duration-150 group-focus-within/hours:pointer-events-auto group-focus-within/hours:opacity-100 group-hover/hours:pointer-events-auto group-hover/hours:opacity-100">
          <StepButton label="Increase" onClick={() => onValueChange(stepValue(value, STEP))}>
            <ChevronUpIcon className="size-3" />
          </StepButton>
          <StepButton label="Decrease" onClick={() => onValueChange(stepValue(value, -STEP))}>
            <ChevronDownIcon className="size-3" />
          </StepButton>
        </div>
      )}
    </div>
  );
}

function StepButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      // Keeps focus in the input so the field does not blur when stepping.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="flex flex-1 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-200/80 hover:text-zinc-800 active:scale-90 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
    >
      {children}
    </button>
  );
}
