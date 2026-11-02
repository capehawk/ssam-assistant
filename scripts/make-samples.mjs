// 시연용 샘플 만들기 (모두 지어낸 예시): samples/ 폴더에 씀
import { writeFileSync, mkdirSync } from 'node:fs';
import { makeHwpx } from '../web/core/hwpx.js';
import { TYPES, composeReason, purchaseDoc } from '../web/menus/purchase/rules.js';
import { sampleJindoDoc, sampleTimetableDoc } from '../web/menus/class/class-sample.js';

const out = new URL('../samples/', import.meta.url);
mkdirSync(out, { recursive: true });

// 품의 예시 (물품 구입)
const form = { ...TYPES[0].example, type: 'goods', budget: '교육과정 운영 > 교과 운영비', budgetUnknown: false, total: '', memo: '' };
const draft = {
  title: '5학년 과학 실험 재료(용해와 용액) 구입',
  reason: composeReason({ intro: '5학년 과학 「용해와 용액」 단원의 모둠 실험에 쓸 재료를 다음과 같이 구입하고자 합니다.', ...form })
};
writeFileSync(new URL('품의-예시.hwpx', out), makeHwpx(purchaseDoc(form, draft)));
console.log('samples/품의-예시.hwpx');

// 학급 예시: 교과·창체 진도표(연간지도계획 표 모양), 학년별 기초시간표(두 반 나란히)
writeFileSync(new URL('진도표-예시.hwpx', out), makeHwpx(sampleJindoDoc()));
console.log('samples/진도표-예시.hwpx');
writeFileSync(new URL('시간표-예시.hwpx', out), makeHwpx(sampleTimetableDoc()));
console.log('samples/시간표-예시.hwpx');

// 학급운영계획 예시: 작년 계획서(담임 명단·연락 줄 포함, 이름 빼기 시연), 교과 평가계획
const { sampleLastPlanDoc, sampleEvalDoc } = await import('../web/menus/plan/classplan-sample.js');
writeFileSync(new URL('학급운영계획-작년-예시.hwpx', out), makeHwpx(sampleLastPlanDoc()));
console.log('samples/학급운영계획-작년-예시.hwpx');
writeFileSync(new URL('평가계획-예시.hwpx', out), makeHwpx(sampleEvalDoc()));
console.log('samples/평가계획-예시.hwpx');

// 단원평가 예시: 정답지(문항 이원 분류표 모양)와 평가지
const { sampleKeyDoc, samplePaperDoc } = await import('../web/menus/evaluate/unit/unit-sample.js');
writeFileSync(new URL('단원평가-정답지-예시.hwpx', out), makeHwpx(sampleKeyDoc()));
console.log('samples/단원평가-정답지-예시.hwpx');
writeFileSync(new URL('단원평가지-예시.hwpx', out), makeHwpx(samplePaperDoc()));
console.log('samples/단원평가지-예시.hwpx');

// 수업 활동지 예시: 학생용 쪽 + 교사용 쪽(예시 답) 한 파일
const { sampleSheetDoc } = await import('../web/menus/evaluate/activity/activity-sample.js');
writeFileSync(new URL('활동지-예시.hwpx', out), makeHwpx(sampleSheetDoc()));
console.log('samples/활동지-예시.hwpx');

// 단원평가 예시 답안 PDF: 학생 4명 × 1쪽 (지어낸 이름·답, 이름 칸 가리기와 AI 채점 시연용)
const { SAMPLE_QUESTIONS, SAMPLE_PASSAGE, SAMPLE_ANSWERS } = await import('../web/menus/evaluate/unit/unit-sample.js');
const { chromium } = await import('playwright');
const NAMES = ['가람', '나래', '다솜', '라온'];
const h = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(/\n/g, '<br>');
const page1 = (no, ans) => `<section class="pg">
  <table class="hd"><tr><td>국어 3-2</td><td>2. 중요한 내용을 적어요 (1회)</td><td>3학년 2반 ${no}번 이름: <span class="hand">${NAMES[no - 1]}</span></td></tr></table>
  <p class="lead">※ 다음 글을 읽고 물음에 답하시오. (1~10)</p>
  <div class="box">${h(SAMPLE_PASSAGE)}</div>
  <div class="qs">${SAMPLE_QUESTIONS.map(([q, stem, body]) => `<div class="q"><b>${q}</b> ${h(stem)}${body ? `<div class="opt">${h(body)}</div>` : ''}<div class="ans">답: <span class="hand">${h(ans[q] || '')}</span></div></div>`).join('')}</div>
</section>`;
const html = `<!doctype html><meta charset="utf-8"><style>
  @page{size:A4;margin:12mm}
  body{font-family:'WenQuanYi Zen Hei',sans-serif;font-size:10.5pt;color:#111;margin:0}
  .pg{break-after:page}
  .hd{width:100%;border-collapse:collapse;margin-bottom:6px}.hd td{border:1px solid #333;padding:6px 8px}
  .lead{margin:4px 0}.box{border:1px solid #666;padding:8px;margin-bottom:8px;line-height:1.6}
  .qs{columns:2;column-gap:10mm}.q{break-inside:avoid;margin:0 0 9px;line-height:1.5}
  .opt{color:#333;margin:2px 0 2px 12px;font-size:9.5pt}.ans{margin-left:12px}
  .hand{color:#1747a6;font-size:12pt;font-style:italic;letter-spacing:.5px}
</style>${Object.entries(SAMPLE_ANSWERS).map(([no, ans]) => page1(Number(no), ans)).join('')}`;
const browser = await chromium.launch();
const pg = await browser.newPage();
await pg.setContent(html);
writeFileSync(new URL('단원평가-답안-예시.pdf', out), await pg.pdf({ format: 'A4', printBackground: true }));
await browser.close();
console.log('samples/단원평가-답안-예시.pdf');
