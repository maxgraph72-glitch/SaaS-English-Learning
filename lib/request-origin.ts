import { headers } from "next/headers";

function firstHeaderValue(value: string | null): string | null {
  return value?.split(",")[0]?.trim() || null;
}

export function safeOrigin(
  host: string | null,
  protocol: string | null,
): string {
  const normalizedHost = firstHeaderValue(host);
  const normalizedProtocol = firstHeaderValue(protocol) === "http" ? "http" : "https";

  if (!normalizedHost || !/^[a-z0-9.-]+(?::\d{1,5})?$/iu.test(normalizedHost)) {
    return "http://localhost:3000";
  }

  try {
    return new URL(`${normalizedProtocol}://${normalizedHost}`).origin;
  } catch {
    return "http://localhost:3000";
  }
}

export async function getRequestOrigin(): Promise<string> {
  const requestHeaders = await headers();
  return safeOrigin(
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
    requestHeaders.get("x-forwarded-proto"),
  );
}
