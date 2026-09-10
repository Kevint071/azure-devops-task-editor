"use client";

import { useEffect, useState } from "react";
import { clearSession, fetchSessionInfo, saveSession } from "@/lib/api-client";

export default function SettingsPage() {
  const [pat, setPat] = useState("");
  const [org, setOrg] = useState("");
  const [project, setProject] = useState("");
  const [team, setTeam] = useState("");
  const [hasStoredPat, setHasStoredPat] = useState(false);

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
    <div className="flex flex-1 justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
        <header>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Settings</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Save your Azure DevOps credentials once - Create Tasks, Edit Tasks and Move Tasks all
            use this connection, you&apos;ll only need to enter a PBI id on those pages.
          </p>
        </header>

        <section className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-1">
            <label htmlFor="pat" className="text-sm font-medium text-black dark:text-zinc-50">
              Personal Access Token
            </label>
            <input
              id="pat"
              type="password"
              autoComplete="off"
              value={pat}
              onChange={(event) => setPat(event.target.value)}
              placeholder={hasStoredPat ? "PAT saved - leave blank to keep using it" : "Paste your Azure DevOps PAT"}
              className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {hasStoredPat
                ? "Saved in an httpOnly cookie for up to 8h (not readable by page scripts). Type a new one to replace it."
                : "Saved in an httpOnly cookie for up to 8h once you save - never exposed to page scripts."}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="org" className="text-sm font-medium text-black dark:text-zinc-50">
                Organization
              </label>
              <input
                id="org"
                type="text"
                value={org}
                onChange={(event) => setOrg(event.target.value)}
                placeholder="e.g. my-org"
                className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="project" className="text-sm font-medium text-black dark:text-zinc-50">
                Project
              </label>
              <input
                id="project"
                type="text"
                value={project}
                onChange={(event) => setProject(event.target.value)}
                placeholder="e.g. my-project"
                className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label htmlFor="team" className="text-sm font-medium text-black dark:text-zinc-50">
                Team <span className="font-normal text-zinc-500 dark:text-zinc-400">(optional)</span>
              </label>
              <input
                id="team"
                type="text"
                value={team}
                onChange={(event) => setTeam(event.target.value)}
                placeholder={`Defaults to "${project || "<project>"} Team"`}
                className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="h-10 rounded bg-black px-4 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
            {savedAt && <p className="text-sm text-green-700 dark:text-green-400">Saved.</p>}
          </div>

          {hasStoredPat && (
            <button
              type="button"
              onClick={handleForgetSession}
              className="self-start text-xs font-medium text-zinc-600 underline underline-offset-2 hover:text-black dark:text-zinc-300 dark:hover:text-zinc-50"
            >
              Forget saved PAT / Organization / Project / Team
            </button>
          )}

          {saveError && <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>}
        </section>
      </main>
    </div>
  );
}
