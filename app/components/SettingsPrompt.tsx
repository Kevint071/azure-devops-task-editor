import Link from "next/link";
import { primaryButtonClass } from "@/app/components/styles";

export function SettingsPrompt() {
  return (
    <div className="flex w-full animate-fade-up flex-col items-center gap-4 rounded-2xl border border-dashed border-zinc-300 bg-white/70 px-6 py-6 text-center text-sm text-zinc-600 backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-400">
      <p>
        Connect to Azure DevOps first: save your Personal Access Token, Organization and Project in
        Settings.
      </p>
      <Link href="/settings" className={primaryButtonClass}>
        Open Settings
      </Link>
    </div>
  );
}
