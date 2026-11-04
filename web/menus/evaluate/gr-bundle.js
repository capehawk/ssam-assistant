/* 평가지 채점(기존 화면 evaluate.js)의 「한꺼번에 넣기」: 칸 그리기와 나누기·확인 카드를 붙여 줌 (활동지 스펙 3.2) */
import { readBundle, openBundleCard, needsCard, bundleBoxHTML, onBundle, bundleMsg } from '../../core/bundle.js';
import { toast } from '../../core/ui.js';
import '../../core/eval-refs.js';

const SS = () => window.SSAM || {};
SS().bundleBoxHTML = bundleBoxHTML;
onBundle('gr', async files => {
  if (!SS().gr) return;
  bundleMsg('gr', '읽는 중…');
  let b;
  try { b = await readBundle(files, { say: m => bundleMsg('gr', m), mask: SS().gr.mask() }); }
  catch (e) { bundleMsg('gr', ''); toast(e && e.message === 'PDFJS' ? 'PDF를 읽는 도구를 불러오지 못했어요. 인터넷 연결을 확인하거나 사진으로 넣어 주세요.' : '파일을 읽지 못했어요.', 6000); return; }
  bundleMsg('gr', '');
  if (needsCard(b)) { const r = await openBundleCard(b, { what: '평가지 채점' }); if (!r) { SS().files.freePages(b.pages); return; } b = r; }
  SS().gr.putBundle(b);
});
// 이 모듈이 늦게 불러졌으면 칸·참고 목록이 보이게 다시 그림
if (SS().gr) SS().gr.refresh();
