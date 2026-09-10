import Link from "next/link";

export function SettingsPrompt() {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
      Configure your Personal Access Token, Organization and Project in{" "}
      <Link
        href="/settings"
        className="font-medium text-black underline underline-offset-2 dark:text-zinc-50"
      >
        Settings
      </Link>{" "}
      before looking up a PBI.
    </div>
  );
}
