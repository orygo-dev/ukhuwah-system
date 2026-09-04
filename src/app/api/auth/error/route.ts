import { NextResponse } from "next/server";

export function GET(req: Request) {
  const requestUrl = new URL(req.url);
  const loginUrl = new URL("/login", requestUrl.origin);
  const error = requestUrl.searchParams.get("error") || "Authentication";
  loginUrl.searchParams.set("error", error);
  const response = NextResponse.redirect(loginUrl);

  if (error === "SessionExpired") {
    for (const name of [
      "__Secure-authjs.session-token",
      "authjs.session-token",
      "__Secure-next-auth.session-token",
      "next-auth.session-token",
    ]) {
      response.cookies.set(name, "", { expires: new Date(0), path: "/" });
    }
  }

  return response;
}
