import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === "production";

  response.cookies.set("sb-access-token", "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set("sb-refresh-token", "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
