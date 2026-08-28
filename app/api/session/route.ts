import { NextRequest, NextResponse } from "next/server";
import {
  ORG_COOKIE,
  PAT_COOKIE,
  PROJECT_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  TEAM_COOKIE,
} from "@/lib/azure-devops/session";

interface SessionRequestBody {
  pat?: unknown;
  org?: unknown;
  project?: unknown;
  team?: unknown;
}

// Only settable via this route handler - the PAT cookie is httpOnly so
// client-side JS (and therefore any XSS payload) can never read it back.
const isProduction = process.env.NODE_ENV === "production";

function cookieOptions(httpOnly: boolean) {
  return {
    httpOnly,
    secure: isProduction,
    sameSite: "strict" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    org: request.cookies.get(ORG_COOKIE)?.value ?? "",
    project: request.cookies.get(PROJECT_COOKIE)?.value ?? "",
    team: request.cookies.get(TEAM_COOKIE)?.value ?? "",
    hasPat: Boolean(request.cookies.get(PAT_COOKIE)?.value),
  });
}

export async function POST(request: NextRequest) {
  let body: SessionRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });

  if (typeof body.pat === "string" && body.pat.trim()) {
    response.cookies.set(PAT_COOKIE, body.pat.trim(), cookieOptions(true));
  }
  if (typeof body.org === "string" && body.org.trim()) {
    response.cookies.set(ORG_COOKIE, body.org.trim(), cookieOptions(false));
  }
  if (typeof body.project === "string" && body.project.trim()) {
    response.cookies.set(PROJECT_COOKIE, body.project.trim(), cookieOptions(false));
  }
  if (typeof body.team === "string" && body.team.trim()) {
    response.cookies.set(TEAM_COOKIE, body.team.trim(), cookieOptions(false));
  }

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(PAT_COOKIE);
  response.cookies.delete(ORG_COOKIE);
  response.cookies.delete(PROJECT_COOKIE);
  response.cookies.delete(TEAM_COOKIE);
  return response;
}
