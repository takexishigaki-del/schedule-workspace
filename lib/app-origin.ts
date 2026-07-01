/**
 * OAuth リダイレクト等で使うアプリの公開 origin。
 * Vercel 本番では APP_URL（カスタムドメイン）を優先する。
 */
export function getAppOrigin(request: Request): string {
  const fromEnv = process.env.APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;

  return new URL(request.url).origin;
}

export function getGoogleRedirectUri(request: Request): string {
  return `${getAppOrigin(request)}/api/auth/google/callback`;
}
