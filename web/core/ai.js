/* AI 부르기: 새 메뉴(품의·계획 등)는 이 파일만 씀.
   실제 호출·키·모델은 평가 메뉴(window.SSAM.ai)가 맡음 — Claude·Gemini·GPT·업스테이지 */
import * as wire from './ai-wire.js';
const A = () => (window.SSAM && window.SSAM.ai) || null;
// 평가 메뉴(옛 IIFE)의 AI 부르기가 요청 모양·사용량 읽기에 씀
if (typeof window !== 'undefined') window.SSAM_WIRE = wire;

/* 지금 AI가 쓰는 중인 요청 수 (학년도를 옮기기 전에 봄) */
let inflight = 0;
export const busyCount = () => inflight;

/* images: [{ mime, b64, blob }] → { text, truncated, usage }. 실패하면 { code, message }를 던짐.
   task: 업무(grade·writing·plan·notes)면 그 업무에 정한 AI로, role: 'main'|'review', use: { engine, model } 이 AI로
   shared: { text, images } 학생마다 같은 공통 부분(앞에 두어 캐시), meter: 사용량을 모을 곳(ai-wire newMeter) */
export function generate(prompt, { signal, images, careful, task, role, use, shared, meter } = {}) {
  const a = A();
  if (!a) return Promise.reject({ code: 'no_engine' });
  inflight++;
  return Promise.resolve(a.generate(prompt, { signal, images, careful, fresh: true, task, role, use, shared, meter })).finally(() => { inflight--; });
}

export const ready = () => !!(A() && A().engineReady());
/* Claude 계정(claude.ai 안)으로 쓰는 중인지 — 동시 채점 수를 2로 */
export const isAccount = () => !!(A() && A().current && A().current().engine === 'account');
export const providerName = () => (A() && A().providerName()) || '';
export const errorMessage = (code, e) => (A() ? A().errMsg(code, e) : 'AI를 부르지 못했어요.');

/* AI 답에서 JSON 꺼내기: ```json 울타리를 벗기고, 앞뒤 설명이 있으면 첫 { 또는 [ 부터 짝이 되는 끝까지. 못 읽으면 null */
export function parseJSON(text) {
  const s = String(text == null ? '' : text).trim();
  if (!s) return null;
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(s);
  const body = fence ? fence[1].trim() : s;
  try { return JSON.parse(body); } catch (e) {}
  const i = body.search(/[{[]/);
  if (i < 0) return null;
  const j = body.lastIndexOf(body[i] === '{' ? '}' : ']');
  if (j <= i) return null;
  try { return JSON.parse(body.slice(i, j + 1)); } catch (e) { return null; }
}

const RETRY = '\n\n다른 말 없이 JSON만 답하세요.';
/* JSON으로 답을 받음 (PRD 6.2): 못 읽으면 한 번 더 묻고, 그래도 안 되면 { code: 'bad_json' }.
   valid(v)가 있으면 그 모양까지 맞아야 읽은 것으로 봄 */
export async function generateJSON(prompt, opts = {}) {
  const { valid, ...rest } = opts;
  const ok = v => v != null && (!valid || valid(v));
  let v = parseJSON((await generate(prompt, rest)).text);
  if (!ok(v)) v = parseJSON((await generate(prompt + RETRY, rest)).text);
  if (!ok(v)) throw { code: 'bad_json' };
  return v;
}
