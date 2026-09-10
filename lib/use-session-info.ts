// Shared client-side hook that loads the saved PAT/org/project/team status
// from the httpOnly session cookie set on the Settings page.
import { useEffect, useState } from "react";
import { fetchSessionInfo, type SessionInfo } from "./api-client";

export function useSessionInfo() {
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);

  useEffect(() => {
    fetchSessionInfo()
      .then(setSessionInfo)
      .catch(() => {});
  }, []);

  const isConfigured = Boolean(sessionInfo?.hasPat && sessionInfo.org && sessionInfo.project);

  return { sessionInfo, isConfigured };
}
