import { NextRequest, NextResponse } from "next/server";

const ISSUER =
  process.env.NEXT_PUBLIC_OTS_OIDC_ISSUER ??
  "http://localhost:8081/realms/ots";

/** Server-side proxy for the OIDC token endpoint — avoids browser CORS to Keycloak. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.text();
  const response = await fetch(`${ISSUER}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json" },
  });
}
