/**
 * location 文字列を Google Maps 検索 URL に変換するユーティリティ。
 */
export function mapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}
