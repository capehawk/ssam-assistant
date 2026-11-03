import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recordsForYear,approvedRequirements} from '../../web/menus/training/results.js';
const item=(catalogId,completedOn,extra={})=>({catalogId,completedOn,...extra});
test('학년도는 3월 경계로 나누고 전체 조회는 과거 이력을 유지한다',()=>{
  const records=[{status:'approved',items:[item('safety','2027-02-28'),item('privacy','2027-03-01')]}];
  assert.deepEqual(recordsForYear(records,'2026')[0].items,[records[0].items[0]]);
  assert.deepEqual(recordsForYear(records,'2027')[0].items,[records[0].items[1]]);
  assert.equal(recordsForYear(records,'all')[0].items.length,2);
  assert.equal(records[0].items.length,2,'원본 보완 제출 항목을 잘라내지 않는다');
});
test('확인완료 항목과 승인된 묶음만 선택 학년도 체크리스트에 반영한다',()=>{
  const records=[
    {status:'submitted',items:[item('safety','2026-05-01')]},
    {status:'needs_changes',items:[item('privacy','2026-05-01')]},
    {status:'approved',items:[item('child-protection','2025-05-01')]},
    {status:'approved',items:[item('mandatory-bundle','2027-02-01',{itemIds:['safety','privacy']})]},
  ];
  assert.deepEqual([...approvedRequirements(records,'2026')].sort(),['mandatory-bundle','privacy','safety']);
  assert.deepEqual([...approvedRequirements(records,'2027')],[]);
  assert.ok(approvedRequirements(records,'all').has('child-protection'));
});
