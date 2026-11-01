// Run locally yourself. Output contains temporary secrets: do not share or commit it.
import { randomBytes, createHash } from 'node:crypto';
const expiresAt=new Date(Date.now()+24*60*60*1000).toISOString();
const privateTokens={};
const records=['teacher-a','teacher-b','reviewer-a'].map(actorId=>{
  const token=randomBytes(32).toString('base64url');privateTokens[actorId]=token;
  return {actorId,tokenHash:createHash('sha256').update(token).digest('hex'),expiresAt,revoked:false};
});
console.log('개인별 임시 인증값 — 각 사용자에게 따로 전달하고 소스나 채팅에 붙이지 마세요');
console.log(JSON.stringify(privateTokens,null,2));
console.log('\nTRAINING_AUTH_JSON — 다음 줄 전체를 [와 ]까지 포함해 복사하세요');
console.log(JSON.stringify(records));
