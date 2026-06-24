import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/ops")) {
    return NextResponse.next();
  }

  const secret = process.env.OPS_SECRET_KEY?.trim();
  const key = request.nextUrl.searchParams.get("key")?.trim();

  if (secret && key === secret) {
    return NextResponse.next();
  }

  const user = process.env.OPS_BASIC_USER?.trim();
  const password = process.env.OPS_BASIC_PASSWORD?.trim();

  if (!user || !password) {
    return process.env.NODE_ENV === "production"
      ? basicAuthRequired()
      : NextResponse.next();
  }

  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, encoded] = authorization.split(/\s+/, 2);

  if (scheme?.toLowerCase() === "basic" && encoded) {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    const actualUser = decoded.slice(0, separator);
    const actualPassword = decoded.slice(separator + 1);

    if (actualUser === user && actualPassword === password) {
      return NextResponse.next();
    }
  }

  return basicAuthRequired();
}

function basicAuthRequired() {
  return new NextResponse("Authentication required.", {
    headers: {
      "WWW-Authenticate": 'Basic realm="moong ops"',
    },
    status: 401,
  });
}

export const config = {
  matcher: ["/ops/:path*"],
};
