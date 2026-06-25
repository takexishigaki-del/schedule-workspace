/**
 * Google Calendar API ラッパー。
 * googleapis パッケージなしで fetch API を使って直接呼び出す。
 */
import { db } from "@/lib/db";
import { googleTokens } from "@/db/schema";
import { eq } from "drizzle-orm";

const GCAL_API = "https://www.googleapis.com/calendar/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

// ── トークン管理 ────────────────────────────────────────────

async function refreshAccessToken(
  userId: string,
  refreshToken: string,
): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  const expiresAt = new Date(Date.now() + data.expires_in * 1000);
  await db
    .update(googleTokens)
    .set({ accessToken: data.access_token, expiresAt })
    .where(eq(googleTokens.userId, userId));

  return data.access_token;
}

/** 有効なアクセストークンを取得（期限切れなら自動リフレッシュ） */
export async function getAccessToken(userId: string): Promise<string | null> {
  const [token] = await db
    .select()
    .from(googleTokens)
    .where(eq(googleTokens.userId, userId));

  if (!token) return null;

  // 2分以内に期限切れなら先行リフレッシュ
  if (token.expiresAt < new Date(Date.now() + 2 * 60 * 1000)) {
    return refreshAccessToken(userId, token.refreshToken);
  }

  return token.accessToken;
}

// ── イベント変換 ────────────────────────────────────────────

export type GCalEventInput = {
  summary: string;
  location?: string;
  description?: string;
  /** "YYYY-MM-DD" または "YYYY-MM-DDTHH:MM:SS" */
  start: string;
  end: string;
  allDay?: boolean;
  timeZone?: string;
};

export function buildGCalEvent(input: GCalEventInput) {
  const tz = input.timeZone ?? "Asia/Tokyo";

  const start = input.allDay
    ? { date: input.start }
    : { dateTime: `${input.start}:00`, timeZone: tz };

  const end = input.allDay
    ? { date: input.end }
    : { dateTime: `${input.end}:00`, timeZone: tz };

  return {
    summary: input.summary,
    ...(input.location && { location: input.location }),
    ...(input.description && { description: input.description }),
    start,
    end,
  };
}

// ── CRUD ────────────────────────────────────────────────────

type GCalEventBody = ReturnType<typeof buildGCalEvent>;

/** Google Calendar にイベントを新規作成。成功したらイベント ID を返す */
export async function createCalendarEvent(
  accessToken: string,
  event: GCalEventBody,
): Promise<string | null> {
  const res = await fetch(`${GCAL_API}/calendars/primary/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { id: string };
  return data.id;
}

/** Google Calendar のイベントを更新 */
export async function updateCalendarEvent(
  accessToken: string,
  eventId: string,
  event: GCalEventBody,
): Promise<boolean> {
  const res = await fetch(
    `${GCAL_API}/calendars/primary/events/${eventId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    },
  );
  return res.ok;
}

/** Google Calendar のイベントを削除 */
export async function deleteCalendarEvent(
  accessToken: string,
  eventId: string,
): Promise<boolean> {
  const res = await fetch(
    `${GCAL_API}/calendars/primary/events/${eventId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  // 204 = deleted, 410 = already gone
  return res.ok || res.status === 410;
}
