import { availableSeasons } from '@domain/season/season';
function cookieName(code: string) { return `rc_rank_period_${encodeURIComponent(code)}`; }
export function readRankingPeriodPreference(request: Request, code: string, now = new Date()): string | null {
  const name = cookieName(code);
  const raw = request.headers.get('Cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(`${name}=`))?.slice(name.length+1);
  if (raw === 'all' || availableSeasons(now).some(s=>s.key===raw)) return raw!;
  return null;
}
export function rankingPeriodCookie(request: Request, code: string, key: string) {
  return `${cookieName(code)}=${key}; Path=/g/${encodeURIComponent(code)}/stats; Max-Age=31536000; HttpOnly; SameSite=Lax${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}
