// Run locally yourself. Output contains temporary secrets: do not share or commit it.
import { randomBytes, createHash } from 'node:crypto';
const expiresAt=new Date(Date.now()+24*60*60*1000).toISOString();
const privateTokens={};
const records=['teacher-a','teacher-b','reviewer-a'].map(actorId=>{
  const token=randomBytes(32).toString('base64url');privateTokens[actorId]=token;
  return {actorId,tokenHash:createHash('sha256').update(token).digest('hex'),expiresAt,revoked:false};
});
console.log('PRIVATE TOKENS — distribute individually; never paste into source or chat');
console.log(JSON.stringify(privateTokens,null,2));
console.log('\nTRAINING_AUTH_JSON — copy the entire following line, including [ and ]');
console.log(JSON.stringify(records));
