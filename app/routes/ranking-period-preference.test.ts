import {it,expect} from 'vitest';
import {readRankingPeriodPreference,rankingPeriodCookie} from '@server/services/ranking-period-preference.server';
const now=new Date('2026-11-03T00:00:00Z');
it('初回は指定なし。前回の通算・過去シーズンをグループ別に復元する',()=>{
 expect(readRankingPeriodPreference(new Request('https://test/g/a/stats'),'a',now)).toBeNull();
 for(const key of ['all','2026']){
  const request=new Request('https://test/g/a/stats',{headers:{Cookie:`rc_rank_period_a=${key}`}});
  expect(readRankingPeriodPreference(request,'a',now)).toBe(key);
  expect(readRankingPeriodPreference(request,'b',now)).toBeNull();
 }
});
it('未来・不正な保存値は既定シーズンへ戻し、過去の選択は年明けも保持する',()=>{
 expect(readRankingPeriodPreference(new Request('https://test',{headers:{Cookie:'rc_rank_period_a=2027-s1'}}),'a',now)).toBeNull();
 expect(readRankingPeriodPreference(new Request('https://test',{headers:{Cookie:'rc_rank_period_a=2026'}}),'a',new Date('2027-01-01T00:00:00Z'))).toBe('2026');
});
it('保存cookieはグループのランキングに限定し1年保持する',()=>{
 const cookie=rankingPeriodCookie(new Request('https://test/g/a/stats'),'a','all');
 expect(cookie).toContain('rc_rank_period_a=all');expect(cookie).toContain('Path=/g/a/stats');expect(cookie).toContain('Max-Age=31536000');expect(cookie).toContain('HttpOnly');expect(cookie).toContain('SameSite=Lax');expect(cookie).toContain('Secure');
});
