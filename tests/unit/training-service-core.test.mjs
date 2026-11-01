import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createTrainingService } from '../../services/training-submission/core.js';
import { createMemoryRepository, createMemoryEvidenceStore } from '../../services/training-submission/memory.js';
import { DEMO_CATALOG } from '../../services/training-submission/fixtures.js';

const teacher = { actorId: 'teacher-a', role: 'teacher' };
const other = { actorId: 'teacher-b', role: 'teacher' };
const reviewer = { actorId: 'reviewer', role: 'reviewer' };
const pdf = Buffer.from('%PDF-1.4\nSynthetic certificate\n%%EOF').toString('base64');
const payload = () => ({ items: [{ catalogId: 'safety', title: 'Synthetic training', provider: 'Demo school', completedOn: '2026-11-01', hours: 2 }], evidence: { name: 'demo.pdf', mimeType: 'application/pdf', base64: pdf } });
const fail = (fn, code) => assert.throws(fn, e => e.code === code);
function setup() {
  const repository = createMemoryRepository(), evidenceStore = createMemoryEvidenceStore();
  let n = 0;
  const service = createTrainingService({ repository, evidenceStore, catalog: DEMO_CATALOG,
    clock: () => '2026-11-02T00:00:00.000Z', idGenerator: () => `submission-${++n}`,
    hash: s => createHash('sha256').update(s).digest('hex'), decodeBase64: s => [...Buffer.from(s, 'base64')] });
  return { service, repository, evidenceStore, call: (a,p={},who=teacher,id='request-0001') => service.execute(a,p,who,id) };
}
test('submit, isolated all-year list, private evidence and safe public record', () => {
  const { call } = setup(), record = call('submit', payload());
  assert.equal(record.status, 'submitted'); assert.equal(record.revision, 1);
  assert.equal(record.evidence.id, undefined); assert.equal(record.requests, undefined);
  assert.deepEqual(call('mySubmissions'), [record]); assert.deepEqual(call('mySubmissions',{},other), []);
  fail(() => call('evidence',{submissionId:record.submissionId},other), 'FORBIDDEN');
  assert.equal(call('evidence',{submissionId:record.submissionId},reviewer).base64,pdf);
});
test('review, needs_changes revision and approval retain history and reject stale version/state', () => {
  const { call } = setup(), record = call('submit', payload());
  const review = {submissionId:record.submissionId,expectedRevision:1,decision:'needs_changes',comment:'Correct hours'};
  fail(() => call('review',review,teacher,'review-0001'),'FORBIDDEN');
  const returned=call('review',review,reviewer,'review-0001'); assert.equal(returned.revision,2);
  fail(() => call('revise',{...payload(),submissionId:record.submissionId,expectedRevision:1},teacher,'revise-0001'),'REVISION_CONFLICT');
  const revised=call('revise',{...payload(),submissionId:record.submissionId,expectedRevision:2},teacher,'revise-0002');
  assert.equal(revised.status,'submitted'); assert.equal(revised.history.length,3);
  const approved=call('review',{...review,expectedRevision:3,decision:'approved',comment:''},reviewer,'review-0002');
  assert.equal(approved.status,'approved'); assert.equal(approved.revision,4);
  fail(() => call('revise',{...payload(),submissionId:record.submissionId,expectedRevision:4},teacher,'revise-0003'),'INVALID_STATE');
});
test('idempotency returns original result after later review; content/action changes conflict', () => {
  const { call,evidenceStore }=setup(), p=payload(), original=call('submit',p);
  call('review',{submissionId:original.submissionId,expectedRevision:1,decision:'approved',comment:''},reviewer,'review-0001');
  assert.deepEqual(call('submit',p),original); assert.equal(evidenceStore.size,1);
  fail(()=>call('submit',{...p,items:[{...p.items[0],hours:3}]}),'REQUEST_CONFLICT');
  fail(()=>call('revise',{...p,submissionId:original.submissionId,expectedRevision:2},teacher),'REQUEST_CONFLICT');
});
test('authorization is checked before duplicate receipts; reviewer cannot approve own submission', () => {
  const {call,repository}=setup(), record=call('submit',payload());
  call('review',{submissionId:record.submissionId,expectedRevision:1,decision:'needs_changes',comment:'Fix'},reviewer,'review-0001');
  fail(()=>call('review',{submissionId:record.submissionId,expectedRevision:1,decision:'needs_changes',comment:'Fix'},{...reviewer,role:'teacher'},'review-0001'),'FORBIDDEN');
  const own=repository.get(record.submissionId); own.actorId=reviewer.actorId; own.status='submitted'; repository.save(own);
  fail(()=>call('review',{submissionId:own.submissionId,expectedRevision:2,decision:'approved',comment:''},reviewer,'review-0002'),'FORBIDDEN');
  fail(()=>call('mySubmissions',{},null),'UNAUTHENTICATED');
  fail(()=>call('mySubmissions',{}, {actorId:'x',role:'admin'}),'FORBIDDEN');
});
test('save failure and ambiguous committed write reuse evidence with same request', () => {
  const {call,repository,evidenceStore}=setup(), save=repository.save;
  repository.save=()=>{throw new Error('sensitive infrastructure detail');};
  fail(()=>call('submit',payload()),'STORAGE_ERROR'); assert.equal(evidenceStore.size,1);
  repository.save=save; const record=call('submit',payload()); assert.equal(evidenceStore.size,1);
  assert.equal(call('mySubmissions').length,1);
  repository.save=r=>{save(r);throw new Error('response lost');};
  fail(()=>call('review',{submissionId:record.submissionId,expectedRevision:1,decision:'approved',comment:''},reviewer,'review-0001'),'STORAGE_ERROR');
  assert.equal(call('review',{submissionId:record.submissionId,expectedRevision:1,decision:'approved',comment:''},reviewer,'review-0001').status,'approved');
});
test('evidence failures produce no record and retry recovers', () => {
  const {call,evidenceStore}=setup(), put=evidenceStore.put;
  evidenceStore.put=()=>{throw new Error('drive failure');};
  fail(()=>call('submit',payload()),'STORAGE_ERROR'); assert.deepEqual(call('mySubmissions'),[]);
  evidenceStore.put=put; assert.equal(call('submit',payload()).status,'submitted');
});
test('strict PDF, base64, item/date/catalog validation and exact size limit', () => {
  const {call}=setup();
  for(const base64 of ['','not base64',Buffer.from('not PDF').toString('base64'),pdf+'\n']) fail(()=>call('submit',{...payload(),evidence:{...payload().evidence,base64}}),'VALIDATION');
  for(const patch of [{catalogId:'unknown'},{completedOn:'2026-02-30'},{hours:0},{title:'x'.repeat(301)}]) fail(()=>call('submit',{...payload(),items:[{...payload().items[0],...patch}]}),'VALIDATION');
  const boundary=Buffer.alloc(5*1024*1024,32); boundary.write('%PDF-1.4');
  assert.equal(call('submit',{...payload(),evidence:{...payload().evidence,base64:boundary.toString('base64')}}).evidence.size,boundary.length);
  fail(()=>call('submit',{...payload(),evidence:{...payload().evidence,base64:Buffer.concat([boundary,Buffer.from('x')]).toString('base64')}},teacher,'request-0002'),'VALIDATION');
});
test('bundles remain a single record and retain catalog member IDs',()=>{
  const {call}=setup(), p=payload(); p.items[0].catalogId='mandatory-bundle';
  const r=call('submit',p); assert.equal(r.items.length,1); assert.deepEqual(r.items[0].itemIds,['safety','privacy','child-protection']);
});
test('a duplicate submit cannot bypass changed ownership, even with its original request ID',()=>{
  const {call,repository}=setup(), r=call('submit',payload());
  const stored=repository.get(r.submissionId); stored.actorId=other.actorId; repository.save(stored);
  fail(()=>call('submit',payload()),'FORBIDDEN');
});
test('invalid review and access requests cannot mutate stored records',()=>{
  const {call}=setup(), r=call('submit',payload());
  fail(()=>call('reviewQueue',{},teacher),'FORBIDDEN');
  fail(()=>call('review',{submissionId:r.submissionId,expectedRevision:1,decision:'needs_changes',comment:'  '},reviewer,'review-0001'),'VALIDATION');
  fail(()=>call('review',{submissionId:r.submissionId,expectedRevision:1,decision:'deleted',comment:''},reviewer,'review-0002'),'VALIDATION');
  fail(()=>call('revise',{...payload(),submissionId:r.submissionId,expectedRevision:1},other,'revise-0001'),'FORBIDDEN');
  assert.deepEqual(call('mySubmissions'),[r]);
});
test('receipt history is bounded before creating more evidence',()=>{
  const {call,repository,evidenceStore}=setup(), r=call('submit',payload()), stored=repository.get(r.submissionId);
  stored.status='needs_changes'; stored.history=Array.from({length:50},()=>stored.history[0]); repository.save(stored);
  fail(()=>call('revise',{...payload(),submissionId:r.submissionId,expectedRevision:1},teacher,'revise-0001'),'VALIDATION');
  assert.equal(evidenceStore.size,1);
});
test('replaced evidence IDs remain private and retained for reference-aware cleanup',()=>{
  const {call,repository}=setup(), r=call('submit',payload()), originalId=repository.get(r.submissionId).evidence.id;
  call('review',{submissionId:r.submissionId,expectedRevision:1,decision:'needs_changes',comment:'Replace PDF'},reviewer,'review-0001');
  const p=payload(); p.evidence.name='corrected.pdf';
  const revised=call('revise',{...p,submissionId:r.submissionId,expectedRevision:2},teacher,'revise-0001');
  assert.deepEqual(repository.get(r.submissionId).evidenceHistory,[originalId]);
  assert.equal(revised.evidenceHistory,undefined); assert.equal(revised.evidence.name,'corrected.pdf');
});
test('oversized stored receipt aggregate returns validation before repository save',()=>{
  const {call,repository}=setup(), r=call('submit',payload()), stored=repository.get(r.submissionId);
  stored.requests[0].result.comment='x'.repeat(1_000_000); repository.save(stored);
  fail(()=>call('review',{submissionId:r.submissionId,expectedRevision:1,decision:'approved',comment:''},reviewer,'review-0001'),'VALIDATION');
  assert.equal(repository.get(r.submissionId).revision,1);
});
