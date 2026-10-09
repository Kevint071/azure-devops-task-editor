"use client";

import { useEffect, useState } from "react";
import { clearSession, fetchSessionInfo, saveSession } from "@/lib/api-client";
import { PageHero, PageShell } from "@/app/components/PageShell";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { AlertIcon, CheckIcon, EyeIcon, EyeOffIcon, SpinnerIcon } from "@/app/components/icons";
import {
  boxedFieldClass,
  cardClass,
  fieldLabelClass,
  primaryButtonClass,
} from "@/app/components/styles";

const inputClass = `${boxedFieldClass} py-2`;

export default function SettingsPage() {
  const [pat, setPat] = useState("");
  const [org, setOrg] = useState("");
  const [project, setProject] = useState("");
  const [team, setTeam] = useState("");
  const [hasStoredPat, setHasStoredPat] = useState(false);
  const [showPat, setShowPat] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    fetchSessionInfo()
      .then((info) => {
        setOrg(info.org);
        setProject(info.project);
        setTeam(info.team);
        setHasStoredPat(info.hasPat);
      })
      .catch(() => {});
  }, []);

  const canSave = (pat.trim() !== "" || hasStoredPat) && org.trim() !== "" && project.trim() !== "" && !isSaving;

  async function handleSave() {
    if (!canSave) return;

    setIsSaving(true);
    setSaveError(null);
    setSavedAt(null);

    try {
      await saveSession({
        pat: pat.trim() || undefined,
        org: org.trim() || undefined,
        project: project.trim() || undefined,
        team: team.trim() || undefined,
      });
      setHasStoredPat(true);
      setPat("");
      setSavedAt(Date.now());
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unexpected error.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleForgetSession() {
    await clearSession();
    setPat("");
    setOrg("");
    setProject("");
    setTeam("");
    setHasStoredPat(false);
    setSavedAt(null);
  }

  return (
    <PageShell isLanding width="narrow">
      <PageHero
        title="Connect to Azure DevOps"
        description="Save your connection once. Create, Edit and Move Tasks all use it, so on those pages you only type a PBI id."
      />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleSave();
        }}
        className={`mx-auto mt-2 flex w-full max-w-xl animate-fade-up flex-col gap-5 p-6 ${cardClass}`}
        style={{ animationDelay: "120ms" }}
      >
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`size-2 rounded-full ${hasStoredPat ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600"}`}
          />
          <span className="text-zinc-600 dark:text-zinc-400">
            {hasStoredPat ? "A Personal Access Token is saved" : "No Personal Access Token saved yet"}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="pat" className={fieldLabelClass}>
            Personal Access Token
          </label>
          <div className="relative">
            <input
              id="pat"
              type={showPat ? "text" : "password"}
              autoComplete="off"
              value={pat}
              onChange={(event) => setPat(event.target.value)}
              placeholder={hasStoredPat ? "Saved - leave blank to keep using it" : "Paste your Azure DevOps PAT"}
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPat((visible) => !visible)}
              aria-label={showPat ? "Hide token" : "Show token"}
              className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              {showPat ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
            </button>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {hasStoredPat
              ? "Kept in an httpOnly cookie for up to 8 h, never readable by page scripts. Type a new one to replace it."
              : "Kept in an httpOnly cookie for up to 8 h once you save, never readable by page scripts."}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="org" className={fieldLabelClass}>
              Organization
            </label>
            <input
              id="org"
              type="text"
              value={org}
              onChange={(event) => setOrg(event.target.value)}
              placeholder="e.g. my-org"
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="project" className={fieldLabelClass}>
              Project
            </label>
            <input
              id="project"
              type="text"
              value={project}
              onChange={(event) => setProject(event.target.value)}
              placeholder="e.g. my-project"
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="team" className={fieldLabelClass}>
              Team <span className="font-normal text-zinc-400">(optional)</span>
            </label>
            <input
              id="team"
              type="text"
              value={team}
              onChange={(event) => setTeam(event.target.value)}
              placeholder={`Defaults to "${project || "<project>"} Team"`}
              className={inputClass}
            />
          </div>
        </div>

        {saveError && (
          <p role="alert" className="flex animate-fade-up items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
            <AlertIcon className="size-4 shrink-0" />
            {saveError}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-5 dark:border-zinc-800">
          <button type="submit" disabled={!canSave} className={`${primaryButtonClass} h-10 px-5`}>
            {isSaving && <SpinnerIcon className="size-4 animate-spin" />}
            {isSaving ? "Saving" : "Save connection"}
          </button>
          {savedAt && (
            <span
              key={savedAt}
              className="inline-flex animate-pop items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400"
            >
              <CheckIcon className="size-4" />
              Saved
            </span>
          )}
          {hasStoredPat && (
            <button
              type="button"
              onClick={handleForgetSession}
              className="ml-auto inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-red-600 transition hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
            >
              Forget connection
            </button>
          )}
        </div>
      </form>

      <section
        className={`mx-auto mt-4 flex w-full max-w-xl animate-fade-up flex-wrap items-center justify-between gap-4 p-6 ${cardClass}`}
        style={{ animationDelay: "200ms" }}
      >
        <div>
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Appearance</h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            System follows your device setting.
          </p>
        </div>
        <ThemeToggle />
      </section>
    </PageShell>
  );
}
