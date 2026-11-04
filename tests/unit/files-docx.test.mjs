// 워드(.docx) 글 읽기: 문단마다 한 줄, 표 칸은 탭, XML 글자 풀기 (결과 보고에 작년 보고서·계획서를 워드로 넣을 때)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../../web/core/store.js';
import { makeDocx } from '../../web/core/doc-export.js';
import { readText } from '../../web/core/files.js';

function mem() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }
store.useStorage(mem());

test('docx → 제목·문단·표(칸은 탭) 글', async () => {
  const u8 = makeDocx({ title: '2025 과학의 날 결과 보고서', blocks: [{ type: 'h', text: '1. 개요' }, { type: 'p', text: 'A & B\n둘째 줄' }, { type: 'table', rows: [['구분', '내용'], ['장소', '강당']] }] });
  const t = await readText(new File([u8], '작년 보고.docx'));
  assert.ok(t.startsWith('2025 과학의 날 결과 보고서\n1. 개요\nA & B\n둘째 줄'), t);
  assert.ok(t.includes('구분\t내용\n장소\t강당'), t);
});
