"use client";

import { useEffect, useMemo, useState } from "react";
import type { Assignee } from "@/lib/types";

export function AssigneeCombobox({
  id,
  assignees,
  value,
  onChange,
  placeholder,
  dropUp = false,
  inputClassName = "w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50",
}: {
  id?: string;
  assignees: Assignee[];
  value: string;
  onChange: (uniqueName: string) => void;
  placeholder?: string;
  // Opens the list above the input, for inputs near the bottom of the window.
  dropUp?: boolean;
  inputClassName?: string;
}) {
  const selected = assignees.find((assignee) => assignee.uniqueName === value) ?? null;
  const [query, setQuery] = useState(selected?.displayName ?? "");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setQuery(selected?.displayName ?? "");
  }, [selected?.displayName]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === "" || q === selected?.displayName.toLowerCase()) return assignees;
    return assignees.filter((assignee) => assignee.displayName.toLowerCase().includes(q));
  }, [assignees, query, selected]);

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        value={query}
        onChange={(event) => {
          const next = event.target.value;
          setQuery(next);
          setIsOpen(true);
          if (next === "") onChange("");
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        placeholder={placeholder}
        autoComplete="off"
        className={inputClassName}
      />
      {isOpen && (
        <ul
          className={`absolute z-10 ${dropUp ? "bottom-full mb-1" : "mt-1"} max-h-48 w-full overflow-auto rounded border border-zinc-300 bg-white text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900`}
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-1.5 text-zinc-500 dark:text-zinc-400">No matches</li>
          ) : (
            filtered.map((assignee) => (
              <li key={assignee.uniqueName}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange(assignee.uniqueName);
                    setQuery(assignee.displayName);
                    setIsOpen(false);
                  }}
                  className="block w-full px-3 py-1.5 text-left text-black hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800"
                >
                  {assignee.displayName}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
