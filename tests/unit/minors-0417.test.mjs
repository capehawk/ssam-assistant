// 0.17 미뤄 둔 것(단위): M2 회신서 번호는 「번」 앞 숫자, M3 긴 칸 이름도 저장, M5 테두리 없는 양식의 사진은 문단으로,
// M10 D-day → 「오늘」·종류 이름, M12 행사 가정통신문 글의 제목·날짜·학교장 줄 빼기, M14 다 한 공문은 글을 줄임
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../../web/core/store.js';
import { unzip, zipStore } from '../../web/core/zip.js';
import { replyOptions, normReply } from '../../web/menus/etc/reply-collect.js';
import { ddayText } from '../../web/menus/etc/gongmun-ai.js';
import { KINDS } from '../../web/core/inbox-classify.js';
import { readForm, findRoles, fillForm, checkXml } from '../../web/core/hwpx-form.js';
import { letterBodyFromEvent } from '../../web/menus/etc/letter-ai.js';
import { letterFormHwpx } from '../../scripts/sample-letter-form.mjs';

function mem() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }
store.useStorage(mem());
const dec = u8 => new TextDecoder().decode(u8);

test('M2 회신서 번호: 「3학년 2반 15번」 → 15, 숫자 하나면 그것', () => {
  const o = replyOptions(['참가: □ 예 □ 아니오']);
  assert.equal(normReply({ no: '3학년 2반 15번' }, o).no, 15);
  assert.equal(normReply({ no: '3-2-7' }, o).no, 7);
  assert.equal(normReply({ no: 12 }, o).no, 12);
});

test('M3 회신서 칸 이름이 길어도(120자까지) 새로 고침 뒤 답이 남음', async () => {
  const { saveCurrent, getCurrent } = await import('../../web/menus/etc/letter-model.js');
  const name = '가'.repeat(100);
  saveCurrent({ id: 'lt1', out: { title: 'T', body: ['b'] }, collect: { mask: [], rows: [{ no: 1, answers: { [name]: '예' }, unsure: [name] }] } });
  const r = getCurrent().collect.rows[0];
  assert.equal(r.answers[name], '예'); assert.deepEqual(r.unsure, [name]);
});

test('M5 테두리를 더할 수 없는 양식: 사진은 문단마다 그림+설명으로(빠지지 않음), XML이 잘 짜임', async () => {
  const src = await unzip(await letterFormHwpx());
  const files = [...src.entries()].map(([name, data]) => ({ name, data: name === 'Contents/header.xml' ? dec(data).replace(/<hh:borderFills[\s\S]*?<\/hh:borderFills>/, '') : data }));
  const f = await readForm(zipStore(files));
  const JPG = new Uint8Array(readFileSync(new URL('../fixtures/photo-1.jpg', import.meta.url)));
  const { bytes, warn } = await fillForm(f, findRoles(f.lines), { title: 'T', date: '2026-11-04', body: ['본문'], photos: [{ bytes: JPG, w: 4, h: 3, caption: '실험 장면' }], reply: null });
  const sec = dec((await unzip(bytes)).get('Contents/section0.xml'));
  checkXml(sec);
  assert.ok(warn.includes('no-border'));
  assert.ok(sec.includes('binaryItemIDRef="ssamimg1"') && sec.includes('실험 장면'), '사진이 빠짐');
});

test('M10 오늘 기한은 「오늘」, 「쌤」 버튼 종류는 「안내·제출 공문」', () => {
  assert.equal(ddayText(0), '오늘');
  assert.deepEqual(KINDS.find(k => k[0] === 'notice'), ['notice', '안내·제출 공문', '공문 처리로']);
});

test('M12 행사 가정통신문 글 → 양식 본문: 맨 위 제목·「가정통신문」 줄과 맨 아래 날짜·학교장 줄은 뺌', () => {
  const body = letterBodyFromEvent('가을 운동회', '가정통신문\n가을 운동회 안내\n\n안녕하십니까?\n1. 일시: 10. 10.\n\n2026. 10. 1.\n새싹초등학교장');
  assert.deepEqual(body, ['안녕하십니까?', '1. 일시: 10. 10.']);
  assert.deepEqual(letterBodyFromEvent('x', '안녕하십니까?\n본문'), ['안녕하십니까?', '본문']);
});

test('M14 다 한 공문은 글을 2천 자로 줄여 저장', async () => {
  const { putDoc, getDoc } = await import('../../web/menus/etc/gongmun-model.js');
  putDoc({ id: 'gx', title: 't', text: 'x'.repeat(7000), done: true, tasks: [], kinds: [], at: 1 });
  assert.equal(getDoc('gx').text.length, 2000);
});
