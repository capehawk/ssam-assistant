import {schoolYearOf} from '../../core/calendar.js';

// 연결 전 미리 보는 시연 목록. 연결 후에는 서버의 제출 기준을 사용합니다.
export const DEMO_REQUIREMENTS = [
  {id:'safety',title:'안전교육 (시연)',kind:'training'},
  {id:'privacy',title:'개인정보보호 (시연)',kind:'training'},
  {id:'child-protection',title:'아동보호 (시연)',kind:'training'},
];
export const itemYear = item => schoolYearOf(item.completedOn);
export function recordsForYear(records, year) {
  return records.map(record=>({...record,items:record.items.filter(item=>year==='all'||itemYear(item)===Number(year))})).filter(record=>record.items.length);
}
export function approvedRequirements(records, year) {
  const ids=new Set();
  for(const record of recordsForYear(records,year)) {
    if(record.status!=='approved') continue;
    for(const item of record.items) {
      ids.add(item.catalogId);
      for(const id of item.itemIds||[]) ids.add(id);
    }
  }
  return ids;
}
