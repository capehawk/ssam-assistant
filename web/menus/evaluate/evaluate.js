(()=>{
'use strict';
/* ===== 문서 읽기: HWP(5.0) · HWPX · 붙여넣기 텍스트 → 블록 목록 =====
   블록: {type:'p', text} | {type:'table', rows, cols, cells:[{r,c,rs,cs,text}]}
   브라우저와 Node(테스트) 양쪽에서 돈다. */

/* 압축 해제: fflate 0.8.2의 inflateSync (MIT, © 2023 Arjun Barrett, github.com/101arrowz/fflate)
   브라우저의 DecompressionStream은 압축 데이터 뒤에 남는 바이트가 있으면 오류를 내는데,
   한글(.hwp) 파일의 본문 스트림은 대부분 뒤에 바이트가 남아 있어서 직접 푼다. */
var FFLATE=(()=>{var k=Object.defineProperty;var yr=Object.getOwnPropertyDescriptor;var wr=Object.getOwnPropertyNames;var mr=Object.prototype.hasOwnProperty;var xr=(r,n)=>{for(var t in n)k(r,t,{get:n[t],enumerable:!0})},zr=(r,n,t,a)=>{if(n&&typeof n=="object"||typeof n=="function")for(let e of wr(n))!mr.call(r,e)&&e!==t&&k(r,e,{get:()=>n[e],enumerable:!(a=yr(n,e))||a.enumerable});return r};var Ar=r=>zr(k({},"__esModule",{value:!0}),r);var qr={};xr(qr,{inflateSync:()=>ur});var h=Uint8Array,S=Uint16Array,Mr=Int32Array,er=new h([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),ir=new h([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),Sr=new h([16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15]),ar=function(r,n){for(var t=new S(31),a=0;a<31;++a)t[a]=n+=1<<r[a-1];for(var e=new Mr(t[30]),a=1;a<30;++a)for(var v=t[a];v<t[a+1];++v)e[v]=v-t[a]<<5|a;return{b:t,r:e}},or=ar(er,2),sr=or.b,Ur=or.r;sr[28]=258,Ur[258]=28;var fr=ar(ir,0),Fr=fr.b,Pr=fr.r,j=new S(32768);for(o=0;o<32768;++o)p=(o&43690)>>1|(o&21845)<<1,p=(p&52428)>>2|(p&13107)<<2,p=(p&61680)>>4|(p&3855)<<4,j[o]=((p&65280)>>8|(p&255)<<8)>>1;var p,o,I=(function(r,n,t){for(var a=r.length,e=0,v=new S(n);e<a;++e)r[e]&&++v[r[e]-1];var y=new S(n);for(e=1;e<n;++e)y[e]=y[e-1]+v[e-1]<<1;var c;if(t){c=new S(1<<n);var z=15-n;for(e=0;e<a;++e)if(r[e])for(var U=e<<4|r[e],w=n-r[e],i=y[r[e]-1]++<<w,s=i|(1<<w)-1;i<=s;++i)c[j[i]>>z]=U}else for(c=new S(a),e=0;e<a;++e)r[e]&&(c[e]=j[y[r[e]-1]++]>>15-r[e]);return c}),Z=new h(288);for(o=0;o<144;++o)Z[o]=8;var o;for(o=144;o<256;++o)Z[o]=9;var o;for(o=256;o<280;++o)Z[o]=7;var o;for(o=280;o<288;++o)Z[o]=8;var o,hr=new h(32);for(o=0;o<32;++o)hr[o]=5;var o;var Dr=I(Z,9,1);var Tr=I(hr,5,1),W=function(r){for(var n=r[0],t=1;t<r.length;++t)r[t]>n&&(n=r[t]);return n},u=function(r,n,t){var a=n/8|0;return(r[a]|r[a+1]<<8)>>(n&7)&t},Y=function(r,n){var t=n/8|0;return(r[t]|r[t+1]<<8|r[t+2]<<16)>>(n&7)},Cr=function(r){return(r+7)/8|0},Ir=function(r,n,t){return(n==null||n<0)&&(n=0),(t==null||t>r.length)&&(t=r.length),new h(r.subarray(n,t))};var Zr=["unexpected EOF","invalid block type","invalid length/literal","invalid distance","stream finished","no stream handler",,"no callback","invalid UTF-8 data","extra field too long","date not in range 1980-2099","filename too long","stream finishing","invalid zip data"],g=function(r,n,t){var a=new Error(n||Zr[r]);if(a.code=r,Error.captureStackTrace&&Error.captureStackTrace(a,g),!t)throw a;return a},Br=function(r,n,t,a){var e=r.length,v=a?a.length:0;if(!e||n.f&&!n.l)return t||new h(0);var y=!t,c=y||n.i!=2,z=n.i;y&&(t=new h(e*3));var U=function(rr){var nr=t.length;if(rr>nr){var tr=new h(Math.max(nr*2,rr));tr.set(t),t=tr}},w=n.f||0,i=n.p||0,s=n.b||0,x=n.l,B=n.d,F=n.m,D=n.n,G=e*8;do{if(!x){w=u(r,i,1);var O=u(r,i+1,3);if(i+=3,O)if(O==1)x=Dr,B=Tr,F=9,D=5;else if(O==2){var P=u(r,i,31)+257,J=u(r,i+10,15)+4,K=P+u(r,i+5,31)+1;i+=14;for(var T=new h(K),$=new h(19),f=0;f<J;++f)$[Sr[f]]=u(r,i+f*3,7);i+=J*3;for(var Q=W($),lr=(1<<Q)-1,vr=I($,Q,1),f=0;f<K;){var V=vr[u(r,i,lr)];i+=V&15;var l=V>>4;if(l<16)T[f++]=l;else{var A=0,E=0;for(l==16?(E=3+u(r,i,3),i+=2,A=T[f-1]):l==17?(E=3+u(r,i,7),i+=3):l==18&&(E=11+u(r,i,127),i+=7);E--;)T[f++]=A}}var X=T.subarray(0,P),m=T.subarray(P);F=W(X),D=W(m),x=I(X,F,1),B=I(m,D,1)}else g(1);else{var l=Cr(i)+4,q=r[l-4]|r[l-3]<<8,L=l+q;if(L>e){z&&g(0);break}c&&U(s+q),t.set(r.subarray(l,L),s),n.b=s+=q,n.p=i=L*8,n.f=w;continue}if(i>G){z&&g(0);break}}c&&U(s+131072);for(var cr=(1<<F)-1,pr=(1<<D)-1,H=i;;H=i){var A=x[Y(r,i)&cr],M=A>>4;if(i+=A&15,i>G){z&&g(0);break}if(A||g(2),M<256)t[s++]=M;else if(M==256){H=i,x=null;break}else{var d=M-254;if(M>264){var f=M-257,C=er[f];d=u(r,i,(1<<C)-1)+sr[f],i+=C}var N=B[Y(r,i)&pr],R=N>>4;N||g(3),i+=N&15;var m=Fr[R];if(R>3){var C=ir[R];m+=Y(r,i)&(1<<C)-1,i+=C}if(i>G){z&&g(0);break}c&&U(s+131072);var b=s+d;if(s<m){var _=v-m,gr=Math.min(m,b);for(_+s<0&&g(3);s<gr;++s)t[s]=a[_+s]}for(;s<b;++s)t[s]=t[s-m]}}n.l=x,n.p=H,n.b=s,n.f=w,x&&(w=1,n.m=F,n.d=B,n.n=D)}while(!w);return s!=t.length&&y?Ir(t,0,s):t.subarray(0,s)};var Er=new h(0);function ur(r,n){return Br(r,{i:2},n&&n.out,n&&n.dictionary)}var Gr=typeof TextDecoder<"u"&&new TextDecoder,Or=0;try{Gr.decode(Er,{stream:!0}),Or=1}catch{}return Ar(qr);})();
async function inflateRaw(u8) {
  try { return FFLATE.inflateSync(u8); }
  catch (e) { throw new Error('INFLATE'); }
}

/* ---------- OLE(Compound File) ---------- */
function readCFB(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const sig = [0xD0,0xCF,0x11,0xE0,0xA1,0xB1,0x1A,0xE1];
  for (let i = 0; i < 8; i++) if (u8[i] !== sig[i]) throw new Error('NOT_CFB');
  const secSize = 1 << dv.getUint16(0x1E, true);
  const miniSize = 1 << dv.getUint16(0x20, true);
  const nFat = dv.getUint32(0x2C, true);
  const dirStart = dv.getUint32(0x30, true);
  const miniCutoff = dv.getUint32(0x38, true);
  const miniFatStart = dv.getUint32(0x3C, true);
  let difatNext = dv.getUint32(0x44, true);
  const off = s => (s + 1) * secSize;
  const u32 = o => dv.getUint32(o, true);

  // FAT 섹터 목록(DIFAT)
  const fatSecs = [];
  for (let i = 0; i < 109 && fatSecs.length < nFat; i++) {
    const s = u32(0x4C + i * 4);
    if (s < 0xFFFFFFFA) fatSecs.push(s);
  }
  let guard = 0;
  while (difatNext < 0xFFFFFFFA && fatSecs.length < nFat && guard++ < 10000) {
    const base = off(difatNext);
    const per = secSize / 4 - 1;
    for (let i = 0; i < per && fatSecs.length < nFat; i++) {
      const s = u32(base + i * 4);
      if (s < 0xFFFFFFFA) fatSecs.push(s);
    }
    difatNext = u32(base + per * 4);
  }
  const fat = new Uint32Array(fatSecs.length * secSize / 4);
  fatSecs.forEach((s, k) => {
    const base = off(s);
    for (let i = 0; i < secSize / 4; i++) {
      const o = base + i * 4;
      fat[k * secSize / 4 + i] = o + 4 <= u8.length ? u32(o) : 0xFFFFFFFE;
    }
  });
  const chain = start => {
    const out = []; let s = start; const seen = new Set();
    while (s < 0xFFFFFFFA && !seen.has(s) && s < fat.length) { seen.add(s); out.push(s); s = fat[s]; }
    return out;
  };
  const readChain = (start, size) => {
    const secs = chain(start);
    const out = new Uint8Array(secs.length * secSize);
    secs.forEach((s, i) => out.set(u8.subarray(off(s), Math.min(off(s) + secSize, u8.length)), i * secSize));
    return size == null ? out : out.subarray(0, size);
  };

  // 디렉터리
  const dirBytes = readChain(dirStart);
  const ents = [];
  for (let i = 0; i + 128 <= dirBytes.length; i += 128) {
    const e = new DataView(dirBytes.buffer, dirBytes.byteOffset + i, 128);
    const nlen = e.getUint16(64, true);
    let name = '';
    for (let j = 0; j + 2 < nlen; j += 2) name += String.fromCharCode(e.getUint16(j, true));
    ents.push({
      name, type: e.getUint8(66),
      left: e.getUint32(68, true), right: e.getUint32(72, true), child: e.getUint32(76, true),
      start: e.getUint32(116, true), size: e.getUint32(120, true)
    });
  }
  const root = ents[0];
  const miniStream = root ? readChain(root.start, root.size) : new Uint8Array(0);
  const miniFat = miniFatStart < 0xFFFFFFFA ? (() => {
    const b = readChain(miniFatStart);
    return new Uint32Array(b.buffer, b.byteOffset, Math.floor(b.length / 4));
  })() : new Uint32Array(0);
  const readMini = (start, size) => {
    const out = new Uint8Array(Math.ceil(size / miniSize) * miniSize);
    let s = start, i = 0; const seen = new Set();
    while (s < 0xFFFFFFFA && !seen.has(s) && i * miniSize < out.length) {
      seen.add(s);
      out.set(miniStream.subarray(s * miniSize, s * miniSize + miniSize), i * miniSize);
      i++; s = miniFat[s];
    }
    return out.subarray(0, size);
  };

  // 경로 만들기
  const files = new Map();
  const walk = (idx, prefix, depth) => {
    if (idx >= ents.length || idx === 0xFFFFFFFF || depth > 64) return;
    const e = ents[idx];
    walk(e.left, prefix, depth + 1);
    const path = prefix ? prefix + '/' + e.name : e.name;
    if (e.type === 2) files.set(path, e);
    if (e.type === 1) walk(e.child, path, depth + 1);
    walk(e.right, prefix, depth + 1);
  };
  if (root) walk(root.child, '', 0);

  return {
    paths: [...files.keys()],
    read(path) {
      const e = files.get(path);
      if (!e) return null;
      return e.size < miniCutoff ? readMini(e.start, e.size) : readChain(e.start, e.size);
    }
  };
}

/* ---------- HWP 레코드 ---------- */
const TAG = { PARA_HEADER: 66, PARA_TEXT: 67, CTRL_HEADER: 71, LIST_HEADER: 72, TABLE: 77, EQEDIT: 88 };

/* 한글 수식 스크립트 → 읽기 쉬운 글 (예: {3} over {4} → 3/4, 2 TIMES 3 → 2×3) */
function eqText(s) {
  return String(s || '')
    .replace(/\b(?:LEFT|RIGHT|left|right|rm|it|bold)\b/g, ' ')
    .replace(/\s*\bover\b\s*/gi, '/')
    .replace(/\btimes\b/gi, '×').replace(/\bdiv\b/gi, '÷').replace(/\bcdot\b/gi, '·')
    .replace(/\bsqrt\b/gi, '√').replace(/\bleq\b/gi, '≤').replace(/\bgeq\b/gi, '≥')
    .replace(/[{}]/g, '').replace(/[~`]/g, ' ').replace(/#/g, ' / ')
    .replace(/\s+/g, ' ').trim();
}
/* 수식 레코드: 속성(4) + 글자 수(2) + 스크립트(WCHAR) */
function eqScript(data) {
  if (data.length < 6) return '';
  const dv = new DataView(data.buffer, data.byteOffset, data.length);
  const n = dv.getUint16(4, true);
  let s = '';
  for (let i = 0; i < n && 6 + i * 2 + 1 < data.length; i++) s += String.fromCharCode(dv.getUint16(6 + i * 2, true));
  return s;
}

/* 블록 → 글 (표는 행마다 「칸 | 칸」) — 정답표처럼 내용을 AI에게 글로 줄 때 */
function blocksToText(blocks) {
  const out = [];
  for (const b of blocks) {
    if (b.type === 'p') { const t = b.text.replace(/[ \t]+\n/g, '\n').trim(); if (t) out.push(t); continue; }
    const rows = new Map();
    for (const c of b.cells) { if (!rows.has(c.r)) rows.set(c.r, []); rows.get(c.r).push(c); }
    const lines = [...rows.keys()].sort((x, y) => x - y)
      .map(r => rows.get(r).sort((x, y) => x.c - y.c).map(c => c.text.replace(/\s*\n\s*/g, ' ').trim()).join(' | '))
      .filter(l => l.replace(/[|\s]/g, ''));
    if (lines.length) out.push(lines.join('\n'));
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* 블록 → 글, 합친 칸을 풀어 같은 글을 되풀이 (칸 자리를 지킴) — 단원평가 정답지(이원 분류표)처럼 열 자리로 읽는 표 */
function blocksToGridText(blocks) {
  const out = [];
  for (const b of blocks) {
    if (b.type === 'p') { const t = b.text.replace(/[ \t]+\n/g, '\n').trim(); if (t) out.push(t); continue; }
    const g = [];
    for (const c of b.cells) {
      const t = c.text.replace(/\s*\n\s*/g, ' ').trim();
      for (let r = c.r; r < c.r + (c.rs || 1); r++) for (let k = c.c; k < c.c + (c.cs || 1); k++) (g[r] = g[r] || [])[k] = t;
    }
    const rows = g.filter(Boolean), w = Math.max(0, ...rows.map(r => r.length));
    const lines = rows.map(r => Array.from({ length: w }, (_, k) => r[k] || '').join(' | ')).filter(l => l.replace(/[|\s]/g, ''));
    if (lines.length) out.push(lines.join('\n'));
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function readRecords(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const recs = []; let p = 0;
  while (p + 4 <= u8.length) {
    const h = dv.getUint32(p, true); p += 4;
    const tag = h & 0x3FF, level = (h >>> 10) & 0x3FF;
    let size = (h >>> 20) & 0xFFF;
    if (size === 0xFFF) { if (p + 4 > u8.length) break; size = dv.getUint32(p, true); p += 4; }
    if (p + size > u8.length) break;
    recs.push({ tag, level, data: u8.subarray(p, p + size) });
    p += size;
  }
  return recs;
}

function paraText(data) {
  let s = '';
  const n = data.length >> 1;
  for (let i = 0; i < n; i++) {
    const c = data[i * 2] | (data[i * 2 + 1] << 8);
    if (c >= 32) { s += String.fromCharCode(c); continue; }
    if (c === 9) { s += '\t'; i += 7; continue; }
    if (c === 10) { s += '\n'; continue; }
    if (c === 13) continue;
    if (c === 24) { s += '-'; continue; }
    if (c === 30 || c === 31) { s += ' '; continue; }
    if ([1,2,3,4,5,6,7,8,11,12,14,15,16,17,18,19,20,21,22,23].includes(c)) { i += 7; continue; }
  }
  return s;
}

/* 레코드 → 블록 (표는 셀 단위로) */
function recordsToBlocks(recs) {
  // 부모 연결
  const nodes = recs.map(r => ({ ...r, kids: [] }));
  const stack = [];
  const top = [];
  for (const n of nodes) {
    while (stack.length && stack[stack.length - 1].level >= n.level) stack.pop();
    if (stack.length) stack[stack.length - 1].kids.push(n); else top.push(n);
    stack.push(n);
  }
  const blocks = [];
  const paraOf = (ph) => {
    const t = ph.kids.find(k => k.tag === TAG.PARA_TEXT);
    return t ? paraText(t.data) : '';
  };
  // 한 문단(PARA_HEADER 노드)을 처리: 글자는 out(text)로, 표는 blocks에
  const doPara = (ph, out) => {
    const txt = paraOf(ph);
    if (txt.trim()) out(txt);
    for (const k of ph.kids) if (k.tag === TAG.CTRL_HEADER) doCtrl(k, out);
  };
  const ctrlId = (k) => {
    if (k.data.length < 4) return '';
    const v = new DataView(k.data.buffer, k.data.byteOffset, 4).getUint32(0, true);
    return String.fromCharCode((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
  };
  const doCtrl = (k, out) => {
    const id = ctrlId(k);
    if (id === 'tbl ') {
      const tb = k.kids.find(x => x.tag === TAG.TABLE);
      let rows = 0, cols = 0;
      if (tb && tb.data.length >= 8) {
        const dv = new DataView(tb.data.buffer, tb.data.byteOffset, tb.data.length);
        rows = dv.getUint16(4, true); cols = dv.getUint16(6, true);
      }
      const table = { type: 'table', rows, cols, cells: [] };
      let cell = null, seenTable = false;
      const parts = [];
      const caption = [];
      const cellOut = t => parts.push(t);
      for (const x of k.kids) {
        if (x.tag === TAG.TABLE) { seenTable = true; continue; }
        if (!seenTable) {
          // 표 앞의 목록은 캡션
          if (x.tag === TAG.PARA_HEADER) doParaNested(x, t => caption.push(t));
          continue;
        }
        if (x.tag === TAG.LIST_HEADER) {
          if (cell) { cell.text = parts.splice(0).join('\n').trim(); table.cells.push(cell); }
          const dv = new DataView(x.data.buffer, x.data.byteOffset, x.data.length);
          // 문단수(2) + 미상(2) + 속성(4) 다음에 열·행·열합침·행합침
          const g = o => (o + 2 <= x.data.length ? dv.getUint16(o, true) : 0);
          cell = { c: g(8), r: g(10), cs: g(12) || 1, rs: g(14) || 1, text: '' };
        } else if (x.tag === TAG.PARA_HEADER) {
          doParaNested(x, cellOut);
        }
      }
      if (cell) { cell.text = parts.splice(0).join('\n').trim(); table.cells.push(cell); }
      if (caption.length) caption.forEach(t => out(t));
      blocks.push(table);
    } else if (id === 'eqed') {
      const r = k.kids.find(x => x.tag === TAG.EQEDIT);
      const t = r ? eqText(eqScript(r.data)) : '';
      if (t) out(t);
    } else {
      // 글상자·각주 등 안의 문단은 글자만
      const walk = (n) => {
        for (const x of n.kids) {
          if (x.tag === TAG.PARA_HEADER) doParaNested(x, out);
          else walk(x);
        }
      };
      walk(k);
    }
  };
  // 셀 안 문단: 셀 안의 표는 셀 글자로 평탄화
  const doParaNested = (ph, out) => {
    const txt = paraOf(ph);
    if (txt.trim()) out(txt);
    for (const k of ph.kids) if (k.tag === TAG.CTRL_HEADER) {
      if (ctrlId(k) === 'tbl ') {
        // 안쪽 표: 행 순서대로 글자만
        const save = blocks.length;
        doCtrl(k, () => {});
        const tb = blocks.splice(save)[0];
        if (tb) tb.cells.forEach(c => c.text && out(c.text));
      } else doCtrl(k, out);
    }
  };

  for (const n of top) {
    if (n.tag === TAG.PARA_HEADER) {
      doPara(n, t => blocks.push({ type: 'p', text: t }));
    }
  }
  return blocks;
}

async function parseHWP(u8) {
  const cfb = readCFB(u8);
  const head = cfb.read('FileHeader');
  if (!head) throw new Error('NOT_HWP');
  const props = new DataView(head.buffer, head.byteOffset, head.length).getUint32(36, true);
  const compressed = !!(props & 1);
  if (props & 2) throw new Error('HWP_PASSWORD');
  const sections = cfb.paths
    .filter(p => /^BodyText\/Section\d+$/.test(p))
    .sort((a, b) => +a.match(/\d+$/)[0] - +b.match(/\d+$/)[0]);
  if (!sections.length) {
    if (cfb.paths.some(p => p.startsWith('ViewText/'))) throw new Error('HWP_DISTRIBUTION');
    throw new Error('HWP_EMPTY');
  }
  const blocks = [];
  for (const s of sections) {
    let data = cfb.read(s);
    if (compressed) data = await inflateRaw(data);
    blocks.push(...recordsToBlocks(readRecords(data)));
  }
  return blocks;
}

/* ---------- HWPX (zip + xml) ---------- */
async function unzip(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('NOT_ZIP');
  const n = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const files = new Map();
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
    const loc = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
    files.set(name, { method, csize, loc });
    p += 46 + nlen + xlen + clen;
  }
  return {
    names: [...files.keys()],
    async read(name) {
      const f = files.get(name); if (!f) return null;
      const lnl = dv.getUint16(f.loc + 26, true), lxl = dv.getUint16(f.loc + 28, true);
      const start = f.loc + 30 + lnl + lxl;
      const raw = u8.subarray(start, start + f.csize);
      return f.method === 0 ? raw : await inflateRaw(raw);
    }
  };
}

function hwpxXmlToBlocks(xml, DOMParserImpl) {
  const doc = new DOMParserImpl().parseFromString(xml, 'application/xml');
  const blocks = [];
  const local = el => (el.localName || el.nodeName.split(':').pop());
  const kids = el => Array.from(el.childNodes || []).filter(n => n.nodeType === 1);
  const textOf = (p) => {
    // 문단 안의 글자 (표는 제외)
    let s = '';
    const walk = (n) => {
      for (const c of kids(n)) {
        const ln = local(c);
        if (ln === 'tbl') continue;
        if (ln === 't') s += c.textContent;
        else if (ln === 'tab') s += '\t';
        else if (ln === 'lineBreak') s += '\n';
        else if (ln === 'script') s += ' ' + eqText(c.textContent) + ' ';
        else walk(c);
      }
    };
    walk(p);
    return s;
  };
  const findTables = (p) => {
    const out = [];
    const walk = (n) => { for (const c of kids(n)) { if (local(c) === 'tbl') out.push(c); else if (local(c) !== 'subList') walk(c); } };
    walk(p);
    return out;
  };
  const cellText = (tc) => {
    const parts = [];
    const sub = kids(tc).find(c => local(c) === 'subList') || tc;
    for (const p of kids(sub).filter(c => local(c) === 'p')) {
      const t = textOf(p); if (t.trim()) parts.push(t);
      for (const inner of findTables(p)) {
        for (const tr of kids(inner).filter(c => local(c) === 'tr'))
          for (const itc of kids(tr).filter(c => local(c) === 'tc')) { const x = cellText(itc); if (x) parts.push(x); }
      }
    }
    return parts.join('\n').trim();
  };
  const doTable = (tbl) => {
    const table = { type: 'table', rows: +tbl.getAttribute('rowCnt') || 0, cols: +tbl.getAttribute('colCnt') || 0, cells: [] };
    for (const tr of kids(tbl).filter(c => local(c) === 'tr')) {
      for (const tc of kids(tr).filter(c => local(c) === 'tc')) {
        const addr = kids(tc).find(c => local(c) === 'cellAddr');
        const span = kids(tc).find(c => local(c) === 'cellSpan');
        table.cells.push({
          c: +(addr && addr.getAttribute('colAddr')) || 0,
          r: +(addr && addr.getAttribute('rowAddr')) || 0,
          cs: +(span && span.getAttribute('colSpan')) || 1,
          rs: +(span && span.getAttribute('rowSpan')) || 1,
          text: cellText(tc)
        });
      }
    }
    blocks.push(table);
  };
  const root = doc.documentElement;
  for (const p of kids(root).filter(c => local(c) === 'p')) {
    const t = textOf(p);
    if (t.trim()) blocks.push({ type: 'p', text: t });
    for (const tbl of findTables(p)) doTable(tbl);
  }
  return blocks;
}

async function parseHWPX(u8, DOMParserImpl) {
  const z = await unzip(u8);
  const secs = z.names.filter(n => /^Contents\/section\d+\.xml$/i.test(n))
    .sort((a, b) => +a.match(/(\d+)\.xml$/i)[1] - +b.match(/(\d+)\.xml$/i)[1]);
  if (!secs.length) throw new Error('HWPX_EMPTY');
  const blocks = [];
  const dec = new TextDecoder();
  for (const s of secs) blocks.push(...hwpxXmlToBlocks(dec.decode(await z.read(s)), DOMParserImpl));
  return blocks;
}


/* ===== 블록 → 평가계획(과목 > 평가요소) ===== */
const SUBJ_BY_CODE = { 국: '국어', 수: '수학', 사: '사회', 과: '과학', 도: '도덕', 체: '체육', 음: '음악', 미: '미술', 영: '영어', 실: '실과', 바: '바른 생활', 슬: '슬기로운 생활', 즐: '즐거운 생활', 정: '정보' };
const SUBJ_ORDER = ['국어', '도덕', '사회', '수학', '과학', '실과', '체육', '음악', '미술', '영어', '바른 생활', '슬기로운 생활', '즐거운 생활', '정보', '기타'];
const SUBJ_NAMES = Object.values(SUBJ_BY_CODE);
const CODE_RE = /\[\s*\d\s*([가-힣])\s*\d{1,2}\s*-\s*\d{1,2}\s*\]/g;
const LEVEL_WORDS = [
  [/^(매우\s*잘\s*함|매우\s*우수|최상)$/, 'top'],
  [/^(상|잘\s*함|우수)$/, 'high'],
  [/^(중|보통)$/, 'mid'],
  [/^(하|노력\s*요\s*함|미흡|노력\s*필요)$/, 'low']
];
const levelOf = t => {
  const s = String(t || '').replace(/[\s:：()]/g, '').trim();
  for (const [re, k] of LEVEL_WORDS) if (re.test(s)) return k;
  return null;
};
const nz = s => String(s || '').replace(/\s+/g, '');
const clean = s => String(s || '').replace(/[ \t ]+/g, ' ').replace(/\n{2,}/g, '\n').trim();

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

function subjectFromCodes(text) {
  const counts = {};
  for (const m of String(text || '').matchAll(CODE_RE)) {
    const s = SUBJ_BY_CODE[m[1]]; if (s) counts[s] = (counts[s] || 0) + 1;
  }
  let best = null, n = 0;
  for (const k in counts) if (counts[k] > n) { best = k; n = counts[k]; }
  return best;
}
function subjectFromTitle(text) {
  const t = nz(text);
  for (const s of SUBJ_NAMES) {
    const k = nz(s);
    if (t.startsWith(k + '과') || t.startsWith('<' + k) || t === k || t.startsWith(k + '교수') || t.startsWith(k + '평가')) return s;
  }
  return null;
}
function gradeFrom(text) {
  const m = String(text || '').match(/(?:^|[^\d])([1-6])\s*학년(?!도)/);
  return m ? +m[1] : null;
}

/* ---------- 표 → 평가요소 ---------- */
function headerField(text) {
  const t = nz(text);
  if (!t) return null;
  if (/성취기준/.test(t)) return 'std';
  if (/평가기준|채점기준|수준/.test(t)) return 'crit';
  if (/요소/.test(t)) return 'elem';
  if (/영역/.test(t)) return 'area';
  if (/단원/.test(t)) return 'unit';
  if (/주안점|평가방법|수업.*방법|방법/.test(t)) return 'focus';
  if (/^시기|^월$|^시기\(월\)|^평가시기|^시기/.test(t)) return 'period';
  if (/^(과목|교과)$/.test(t)) return 'subj';
  return null;
}

function tableToUnits(t) {
  const rows = Math.max(t.rows || 0, ...t.cells.map(c => c.r + c.rs));
  const cols = Math.max(t.cols || 0, ...t.cells.map(c => c.c + c.cs));
  if (!rows || !cols || rows > 400 || cols > 40) return null;
  const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
  for (const c of t.cells)
    for (let r = c.r; r < Math.min(rows, c.r + c.rs); r++)
      for (let k = c.c; k < Math.min(cols, c.c + c.cs); k++) grid[r][k] = c;

  // 머리행 찾기
  let hr = -1;
  for (let r = 0; r < Math.min(rows, 6); r++) {
    const txt = grid[r].map(c => nz(c && c.text)).join('|');
    if (/성취기준/.test(txt) && /(평가기준|기준|요소)/.test(txt)) { hr = r; break; }
  }
  if (hr < 0) return null;

  const colField = Array(cols).fill(null);
  for (let k = 0; k < cols; k++) {
    const c = grid[hr][k];
    colField[k] = c ? headerField(c.text) : null;
  }
  // 둘째 머리행: 평가기준 아래 상/중/하가 칸으로 나뉜 경우
  let dataStart = hr + 1;
  const critCols = [];
  for (let k = 0; k < cols; k++) if (colField[k] === 'crit') critCols.push(k);
  const colLevel = {};
  if (hr + 1 < rows && critCols.length > 1) {
    let hits = 0;
    for (const k of critCols) {
      const c = grid[hr + 1][k];
      if (c && c.r === hr + 1) { const lv = levelOf(c.text); if (lv) { colLevel[k] = lv; hits++; } }
    }
    if (hits >= 2) dataStart = hr + 2; else for (const k in colLevel) delete colLevel[k];
  }
  // 머리행이 두 줄로 합쳐진 칸(rs=2)이면 다음 줄도 머리
  const allHeadSpan = grid[hr].filter(Boolean).every(c => c.r + c.rs > hr + 1);
  if (allHeadSpan && dataStart === hr + 1) dataStart = hr + 2;

  const firstCol = f => colField.indexOf(f);
  const keyCol = [firstCol('elem'), firstCol('std'), firstCol('unit')].find(k => k >= 0);
  if (keyCol == null) return null;
  const textAt = (r, f) => {
    const k = firstCol(f); if (k < 0) return '';
    const c = grid[r][k]; return c ? clean(c.text) : '';
  };

  const fieldCols = colField.map((f, k) => f ? k : -1).filter(k => k >= 0);
  const units = [];
  for (let r = dataStart; r < rows; r++) {
    const key = grid[r][keyCol];
    if (!key || key.r !== r) continue;
    // 칸을 모두 하나로 합친 줄(예: 「▶ 2학기 국어 총 횟수: 3회」, 학기 구분)은 건너뜀
    if (fieldCols.length > 1 && fieldCols.every(k => grid[r][k] === key)) continue;
    // 머리 글자가 반복되는 행은 건너뜀
    if (headerField(key.text) && nz(key.text).length < 8) continue;
    const end = Math.min(rows, r + key.rs);
    const u = {
      period: textAt(r, 'period'), std: textAt(r, 'std'), unit: textAt(r, 'unit'),
      area: textAt(r, 'area'), elem: textAt(r, 'elem'), focus: textAt(r, 'focus'),
      subjCell: textAt(r, 'subj'), crit: {}
    };
    if (Object.keys(colLevel).length) {
      for (const k in colLevel) { const c = grid[r][+k]; if (c) u.crit[colLevel[k]] = clean(c.text); }
    } else if (critCols.length) {
      const order = [];
      for (let rr = r; rr < end; rr++) {
        const seen = [];
        for (const k of critCols) { const c = grid[rr][k]; if (c && !seen.includes(c)) seen.push(c); }
        if (!seen.length) continue;
        const lab = levelOf(seen[0].text);
        if (lab && seen.length > 1) { u.crit[lab] = clean(seen.slice(1).map(c => c.text).join(' ')); continue; }
        // 한 칸에 "상: …" 또는 여러 수준이 함께 있는 경우
        const txt = seen.map(c => c.text).join('\n');
        const parts = splitInlineLevels(txt);
        if (parts) Object.assign(u.crit, parts); else if (clean(txt)) order.push(clean(txt));
      }
      if (!Object.keys(u.crit).length && order.length) {
        const keys = order.length >= 4 ? ['top', 'high', 'mid', 'low'] : ['high', 'mid', 'low'];
        order.forEach((x, i) => { if (keys[i]) u.crit[keys[i]] = x; });
      }
    }
    if (!u.std && !u.elem) continue;
    units.push(u);
  }
  return units;
}

function splitInlineLevels(txt) {
  const re = /(^|\n|\s)(매우\s*잘함|잘함|보통|노력\s*요함|상|중|하)\s*[:：)]\s*/g;
  const marks = [];
  let m;
  while ((m = re.exec(txt))) marks.push({ i: m.index + m[1].length, end: re.lastIndex, lv: levelOf(m[2]) });
  if (marks.length < 2) return null;
  const out = {};
  marks.forEach((mk, j) => {
    const stop = j + 1 < marks.length ? marks[j + 1].i : txt.length;
    out[mk.lv] = clean(txt.slice(mk.end, stop));
  });
  return out;
}

/* ---------- 줄 단위(붙여넣기·머리행 없는 표) ---------- */
const HEAD_TOKENS = /^(시기|성취\s*기준|단원\s*명?|평가\s*영역|평가\s*요소|수업\s*[·․ㆍ.]?\s*평가\s*방법.*|평가\s*기준|교과|과목|평가\s*방법)$/;
const CODE_START = /^\[\s*\d\s*[가-힣]\s*\d{1,2}\s*-\s*\d{1,2}\s*\]/;
const PERIOD_TOK = /^\d{1,2}\s*월(\s*[~∼\-]\s*\d{1,2}\s*월)?$|^\d{1,2}\s*[~∼\-]\s*\d{1,2}\s*월$/;
// 평가 횟수·합계 줄 (예: 「▶ 2학기 국어 총 횟수: 3회」, 「평가 횟수 4회」, 「합계」)
const COUNT_LINE = /^[▶▷►•\s]*(.{0,24}?횟수\s*[:：]?\s*\d+\s*회|(합\s*계|소\s*계|총\s*계|계)\s*[:：]?\s*(\d+\s*회?)?)\s*$/;

function linesToUnits(text, requireCrit) {
  const toks = String(text || '').split(/\n|\t/).map(s => s.trim()).filter(Boolean);
  const units = [];
  let cur = null, lv = null, pendingPeriod = '', subjHint = null;
  const fresh = () => ({ period: pendingPeriod, std: '', unit: '', area: '', elem: '', focus: '', crit: {}, subjHint });
  const done = () => {
    if (cur && (cur.std || cur.elem) && Object.keys(cur.crit).length) units.push(cur);
    else if (!requireCrit && cur && cur.std && (cur.elem || cur.unit)) units.push(cur);
    cur = null; lv = null;
  };
  for (const tok of toks) {
    const st = subjectFromTitle(tok);
    if (st && /교수|평가|운영|계획/.test(tok)) { done(); subjHint = st; continue; }
    if (HEAD_TOKENS.test(tok)) continue;
    if (!CODE_START.test(tok) && COUNT_LINE.test(tok)) { done(); continue; }
    if (PERIOD_TOK.test(tok)) {
      if (cur && (Object.keys(cur.crit).length || cur.elem)) done();
      pendingPeriod = tok; if (cur && !cur.period) cur.period = tok;
      continue;
    }
    if (CODE_START.test(tok)) {
      if (cur && (Object.keys(cur.crit).length || cur.unit || cur.elem)) done();
      if (!cur) cur = fresh();
      cur.std = cur.std ? cur.std + '\n' + tok : tok;
      lv = null; pendingPeriod = '';
      continue;
    }
    const L = levelOf(tok);
    if (L) { if (!cur) cur = fresh(); lv = L; continue; }
    if (!cur) continue;
    const inline = splitInlineLevels(tok);
    if (inline) { Object.assign(cur.crit, inline); lv = null; continue; }
    if (lv) { cur.crit[lv] = cur.crit[lv] ? cur.crit[lv] + ' ' + tok : tok; continue; }
    if (/^[▪•○◦※⇒◎■□\-·]/.test(tok) || /⇒|평가함|평가한다|하게\s*함\.?$|하도록\s*함/.test(tok)) {
      cur.focus = cur.focus ? cur.focus + '\n' + tok : tok; continue;
    }
    if (!Object.keys(cur.crit).length) {
      if (!cur.unit && (/^\d+\s*[.)]/.test(tok) || /단원/.test(tok))) { cur.unit = tok; continue; }
      if (!cur.area && tok.length <= 16 && !/[.。]$/.test(tok)) { cur.area = tok; continue; }
      if (!cur.unit) { cur.unit = tok; continue; }
      if (!cur.elem) { cur.elem = tok; continue; }
      cur.focus = cur.focus ? cur.focus + '\n' + tok : tok;
    }
  }
  done();
  return units;
}

/* ---------- 묶기 ---------- */
function buildPlan(blocks, meta = {}) {
  let subjHint = null, grade = null;
  const raw = [];
  const textOfTable = t => t.cells.slice().sort((a, b) => a.r - b.r || a.c - b.c).map(c => c.text).join('\n');
  for (const b of blocks) {
    if (b.type === 'p') {
      const s = subjectFromTitle(b.text);
      if (s && /교수|평가|운영|계획|과/.test(b.text) && b.text.length < 60) subjHint = s;
      if (!grade) grade = gradeFrom(b.text);
      continue;
    }
    // 표 위 첫 칸이 제목인 경우(예: "국어과 교수학습 및 평가 운영계획")
    const head = b.cells.filter(c => c.r === 0).map(c => c.text).join(' ');
    const sh = subjectFromTitle(head);
    if (sh && head.length < 80) subjHint = sh;
    if (!grade) grade = gradeFrom(head);
    let us = tableToUnits(b);
    if (!us) {
      const txt = textOfTable(b);
      if (!CODE_RE.test(txt)) { CODE_RE.lastIndex = 0; continue; }
      CODE_RE.lastIndex = 0;
      us = linesToUnits(txt, true);
    }
    us.forEach(u => { u.subjHint = u.subjHint || subjHint; raw.push(u); });
  }
  return assemble(raw, { ...meta, grade: meta.grade || grade });
}

function planFromText(text, meta = {}) {
  const raw = linesToUnits(text);
  return assemble(raw, { ...meta, grade: meta.grade || gradeFrom(text) });
}

/* 평가 횟수·합계 줄(예: 「4회」, 「평가 횟수」, 「계」)처럼 평어를 쓸 평가요소가 아닌 줄 */
function isCountRow(u) {
  const crit = u.crit || {};
  const hasCrit = ['top', 'high', 'mid', 'low'].some(k => nz(crit[k]));
  const hasCode = /\[\s*\d\s*[가-힣]\s*\d{1,2}\s*-\s*\d{1,2}\s*\]/.test(u.std || '');
  if (hasCode) return false;
  // 합친 칸 하나가 모든 칸에 똑같이 들어간 줄
  const vals = [u.std, u.elem, u.unit, u.area, u.focus, crit.top, crit.high, crit.mid, crit.low].map(nz).filter(Boolean);
  if (vals.length >= 3 && vals.every(v => v === vals[0])) return true;
  const label = [u.elem, u.unit, u.area, u.period, u.std].map(x => clean(x)).join(' ');
  if (hasCrit) return /횟수\s*[:：]?\s*\d+\s*회/.test(label);
  if (/\d\s*회|횟수|합\s*계|소\s*계|총\s*계|^\s*계\s*$/.test(label)) return true;
  // 평가기준도 성취기준 코드도 없고 이름만 아주 짧은 줄
  return nz(u.std).length < 10 && nz(u.elem || u.unit).length < 8;
}

function assemble(raw, meta) {
  const bySubj = new Map();
  const seen = new Set();
  for (const u of raw) {
    if (isCountRow(u)) continue;
    const subject = subjectFromCodes(u.std) || (u.subjCell && subjectFromTitle(u.subjCell)) || u.subjHint || '기타';
    const key = hashStr(subject + '|' + nz(u.std).slice(0, 80) + '|' + nz(u.elem) + '|' + nz(u.unit));
    if (seen.has(key)) continue;
    seen.add(key);
    const unit = {
      id: key, subject,
      period: clean(u.period), std: clean(u.std), unit: clean(u.unit), area: clean(u.area),
      elem: clean(u.elem), focus: clean(u.focus),
      crit: { top: clean(u.crit.top), high: clean(u.crit.high), mid: clean(u.crit.mid), low: clean(u.crit.low) }
    };
    if (!bySubj.has(subject)) bySubj.set(subject, []);
    bySubj.get(subject).push(unit);
  }
  const subjects = [...bySubj.entries()]
    .sort((a, b) => (SUBJ_ORDER.indexOf(a[0]) + 99) % 99 - (SUBJ_ORDER.indexOf(b[0]) + 99) % 99)
    .map(([name, units]) => ({ name, units }));
  return { title: meta.title || '평가계획', grade: meta.grade || null, source: meta.source || '', subjects };
}


/* ===== 평어 만들기 앱 ===== */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LV = [
  { k: 'top', name: '최상', cls: 'lv-top' },
  { k: 'high', name: '상', cls: 'lv-high' },
  { k: 'mid', name: '중', cls: 'lv-mid' },
  { k: 'low', name: '하', cls: 'lv-low' }
];
const LVNAME = { top: '최상', high: '상', mid: '중', low: '하' };
const N = 50;
/* 동시에 보내는 요청 수: Claude 계정은 2개, API 키는 6개.
   API 한도에 걸리면 반으로 줄였다가, 잘 되면 하나씩 다시 늘림 */
const CONC_ACCOUNT = 2, CONC_API = 6;
const CC = { api: CONC_API, ok: 0, at: 0 };
function conc() { return E.engine === 'account' ? CONC_ACCOUNT : CC.api; }
function concBackoff() {
  if (E.engine === 'account') return;
  const now = Date.now();
  if (now - CC.at < 5000) return; // 한꺼번에 여러 요청이 막혀도 한 번만 줄임
  CC.at = now; CC.ok = 0; CC.api = Math.max(1, Math.ceil(CC.api / 2));
}
function concOk() {
  if (E.engine === 'account' || CC.api >= CONC_API) return;
  if (++CC.ok >= 3) { CC.api++; CC.ok = 0; }
}

const S = {
  mode: 'pyeongeo', plan: null, planId: null, subject: null, unitId: null, lv: 'top', showPane: false,
  sets: new Map(), settings: { len: 'auto', tier: 'quick', ending: 'eum' }, remainOnly: false,
  queue: [], running: new Map(), paused: null, consecutiveErr: 0
};
const cap = { db: null, uid: null, sample: undefined, mcp: undefined, perms: null };
const useCap = name => {
  try { return (window.claude && typeof window.claude.use === 'function') ? window.claude.use(name).catch(() => null) : Promise.resolve(null); }
  catch (e) { return Promise.resolve(null); }
};
const capP = { sample: useCap('sample'), mcp: useCap('mcp'), perms: useCap('permissions') };
capP.mcp.then(m => { cap.mcp = m; if (!m) $('#srcDrive').hidden = true; });
capP.perms.then(p => { cap.perms = p; });
/* ===== 평어를 만드는 AI: Claude 계정 또는 API 키(Claude·Gemini·GPT) ===== */
const IN_VIEWER = !!(window.claude && typeof window.claude.use === 'function');
const IN_APP = !!window.__TAURI__;
const HERE = IN_APP ? '이 컴퓨터' : '이 브라우저';
// 데스크톱 앱: 바깥 링크는 기본 브라우저로 열기
if (IN_APP) document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('a[href^="http"], a[href^="mailto:"]');
  if (!a) return;
  e.preventDefault();
  const T = window.__TAURI__;
  try {
    const p = T.opener && T.opener.openUrl ? T.opener.openUrl(a.href) : T.core.invoke('plugin:opener|open_url', { url: a.href });
    if (p && p.catch) p.catch(() => {});
  } catch (err) {}
}, true);
const PROVIDERS = {
  claude: {
    name: 'Claude', label: 'Claude API', keyUrl: 'https://console.anthropic.com/settings/keys', keyHost: 'console.anthropic.com',
    keyHint: 'sk-ant-로 시작하는 키',
    models: [['claude-sonnet-5-5', 'Claude Sonnet 5.5 · 추천'], ['claude-haiku-5-5', 'Claude Haiku 5.5 · 빠르고 저렴'], ['claude-opus-5-5', 'Claude Opus 5.5 · 가장 꼼꼼']]
  },
  gemini: {
    name: 'Gemini', label: 'Gemini API', keyUrl: 'https://aistudio.google.com/apikey', keyHost: 'aistudio.google.com',
    keyHint: 'AIza로 시작하는 키',
    models: [['gemini-3.8-flash', 'Gemini 3.8 Flash · 추천'], ['gemini-3.5-flash-lite', 'Gemini 3.5 Flash-Lite · 빠르고 저렴'], ['gemini-3.1-pro-preview', 'Gemini 3.1 Pro · 미리보기']]
  },
  openai: {
    name: 'GPT', label: 'GPT API', keyUrl: 'https://platform.openai.com/api-keys', keyHost: 'platform.openai.com',
    keyHint: 'sk-로 시작하는 키',
    models: [['gpt-6-luna', 'GPT-6 Luna · 추천·저렴'], ['gpt-6-sol', 'GPT-6 Sol'], ['gpt-5.4-mini', 'GPT-5.4 mini']]
  },
  // 업스테이지: OpenAI 방식 채팅. 이미지는 글자 읽기(OCR)로 글을 뽑아 보냄
  upstage: {
    name: '업스테이지 Solar', label: '업스테이지 API', keyUrl: 'https://console.upstage.ai/api-keys', keyHost: 'console.upstage.ai',
    keyHint: '업스테이지 콘솔에서 받은 키',
    models: [['solar-pro3', 'Solar Pro 3 · 추천'], ['solar-pro2', 'Solar Pro 2'], ['solar-mini', 'Solar Mini · 빠르고 저렴']]
  }
};
const UPSTAGE_CHAT = 'https://api.upstage.ai/v1/chat/completions';
const UPSTAGE_OCR = 'https://api.upstage.ai/v1/document-digitization';
const E = {
  engine: null, // 'account' | 'claude' | 'gemini' | 'openai' | 'upstage' | null
  keys: { claude: '', gemini: '', openai: '', upstage: '' },
  models: { claude: PROVIDERS.claude.models[0][0], gemini: PROVIDERS.gemini.models[0][0], openai: PROVIDERS.openai.models[0][0], upstage: PROVIDERS.upstage.models[0][0] },
  remember: true
};
function loadEngine() {
  try {
    const v = JSON.parse(localStorage.getItem('ssam:engine') || 'null');
    if (v) {
      if (v.engine) E.engine = v.engine;
      if (v.models) Object.assign(E.models, v.models);
      if (v.keys) Object.assign(E.keys, v.keys);
      if (typeof v.remember === 'boolean') E.remember = v.remember;
    }
  } catch (e) {}
}
function saveEngine() {
  try {
    localStorage.setItem('ssam:engine', JSON.stringify({
      engine: E.engine, models: E.models, remember: E.remember,
      keys: E.remember ? E.keys : { claude: '', gemini: '', openai: '', upstage: '' }
    }));
  } catch (e) {}
}
loadEngine();
// 예전에 Claude Fable 모델을 골라 두었으면 Opus로 바꿈 (한 번만)
try {
  if (!localStorage.getItem('ssam:mig:fable')) {
    localStorage.setItem('ssam:mig:fable', '1');
    if (/fable|mythos/i.test(E.models.claude || '')) { E.models.claude = 'claude-opus-5-5'; saveEngine(); }
  }
} catch (e) {}
function engineReady() {
  if (E.engine === 'account') return !!cap.sample;
  if (E.engine && PROVIDERS[E.engine]) return !!(E.keys[E.engine] || '').trim();
  return false;
}
function engineName() {
  if (E.engine === 'account') return 'Claude 계정';
  return E.engine && PROVIDERS[E.engine] ? PROVIDERS[E.engine].label : '';
}
/* 업무별 AI 고르기용: 회사·모델 목록과 키가 있는지만(키 값은 주지 않음). 직접 입력한 모델도 목록에 */
function aiProviders() {
  return Object.entries(PROVIDERS).map(([id, p]) => {
    const models = p.models.slice();
    if (E.models[id] && !models.some(m => m[0] === E.models[id])) models.push([E.models[id], E.models[id]]);
    return { id, name: p.name, label: p.label, models, hasKey: !!(E.keys[id] || '').trim() };
  });
}
/* 처음 정하기: Claude 안이면 계정, 아니면 키가 있는 곳 */
function settleEngine() {
  if (E.engine === 'account' && cap.sample) return;
  if (E.engine && PROVIDERS[E.engine] && E.keys[E.engine]) return;
  if (cap.sample) { E.engine = 'account'; return; }
  const withKey = Object.keys(PROVIDERS).find(p => E.keys[p]);
  E.engine = withKey || (E.engine && PROVIDERS[E.engine] ? E.engine : null);
}

/* ---------- API 부르기 ---------- */
async function readSSE(res, onData, onChunk) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '', finished = false;
  try {
  for (;;) {
    const { value, done } = await reader.read();
    if (done) { finished = true; break; }
    onChunk && onChunk();
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).replace(/\r$/, '');
      buf = buf.slice(i + 1);
      if (!line.startsWith('data:')) continue;
      const d = line.slice(5).trim();
      if (!d || d === '[DONE]') continue;
      let j; try { j = JSON.parse(d); } catch (e) { continue; }
      onData(j);
    }
  }
  } finally {
    // 오류로 중간에 나가면 연결을 닫음
    if (!finished) try { reader.cancel().catch(() => {}); } catch (e) {}
  }
}
/* 여러 신호 중 하나라도 멈추면 멈추는 신호 */
function anySignal(signals) {
  const list = signals.filter(Boolean);
  if (window.AbortSignal && AbortSignal.any) return AbortSignal.any(list);
  const c = new AbortController();
  for (const s of list) { if (s.aborted) { c.abort(s.reason); break; } s.addEventListener('abort', () => c.abort(s.reason), { once: true }); }
  return c.signal;
}
const timeoutError = msg => Object.assign(new Error(msg), { name: 'TimeoutError' });
async function httpError(res) {
  let body = '';
  try { body = await res.text(); } catch (e) {}
  let msg = '', er = null;
  try { const j = JSON.parse(body); er = Array.isArray(j) ? j[0] && j[0].error : j.error; msg = (er && (er.message || er.status || er.type)) || ''; } catch (e) { msg = body.slice(0, 200); }
  const s = res.status;
  const ra = +(res.headers && res.headers.get && res.headers.get('retry-after')) || 0;
  const sig = [msg, er && er.code, er && er.type, er && er.status].filter(Boolean).join(' ');
  if (s === 429) {
    // Gemini는 분당 한도도 "quota … billing"이라고 써서, 자세한 정보(details)로 하루 한도인지 가림
    const det = er && Array.isArray(er.details) ? er.details : [];
    const qf = det.find(d => /QuotaFailure/.test(d && d['@type'] || ''));
    const ids = qf && Array.isArray(qf.violations) ? qf.violations.map(v => `${v.quotaId || ''} ${v.quotaMetric || ''}`).join(' ') : '';
    const ri = det.find(d => /RetryInfo/.test(d && d['@type'] || ''));
    const delay = ri ? parseFloat(ri.retryDelay) || 0 : 0;
    if (/PerDay/i.test(ids)) return { code: 'quota', message: '하루 사용 한도를 다 썼어요. ' + msg };
    if (/insufficient_quota|credit balance/i.test(sig)) return { code: 'quota', message: msg };
    return { code: 'rate_limited', message: msg, retryAfter: ra || delay };
  }
  if (/credit balance|insufficient_quota|billing|exceeded your current quota|quota/i.test(sig) && s !== 401) return { code: 'quota', message: msg };
  if (s === 401 || s === 403 || /api[_ -]?key|invalid x-api-key|API_KEY_INVALID|PERMISSION_DENIED|authentication/i.test(msg)) return { code: 'auth', message: msg };
  if (s === 429) return { code: 'rate_limited', message: msg };
  if (s === 404 || /model/i.test(msg) && /not found|does not exist|not supported|invalid/i.test(msg)) return { code: 'bad_model', message: msg };
  if (s === 529 || s >= 500) return { code: 'upstream_error', message: msg };
  return { code: 'bad_request', message: msg || ('HTTP ' + s) };
}
/* 업스테이지 부르기. 브라우저에서 막히면(교차 출처 차단 등) Windows 앱은 Rust(ai_proxy)로 대신 보냄.
   대신 보낸 답도 Response로 감싸서 아래 코드는 똑같이 읽음 */
let upViaApp = false;
const abortError = () => Object.assign(new Error('aborted'), { name: 'AbortError' });
/* keepAlive: 대신 보내는 동안 30초마다 부름 (답이 통째로 와서 그동안 2분 멈춤 감시가 끊지 않게) */
async function upFetch(url, init, keepAlive) {
  const sig = init.signal;
  if (!(IN_APP && upViaApp)) {
    try { return await fetch(url, init); }
    catch (e) {
      // 멈추기·2분 멈춤으로 끊긴 것은 막힌 게 아니므로 대신 보내지 않음
      if (!IN_APP || (sig && sig.aborted) || (e && e.name === 'AbortError')) throw e;
      upViaApp = true;
    }
  }
  const req = new Request(url, init);
  const headers = [];
  req.headers.forEach((v, k) => headers.push([k, v]));
  const body = Array.from(new Uint8Array(await req.arrayBuffer()));
  const call = window.__TAURI__.core.invoke('ai_proxy', { url, headers, body });
  const ka = keepAlive ? setInterval(keepAlive, 30000) : null;
  let onAbort = null;
  try {
    // 멈추기는 바로 듣고, Rust 쪽 답은 버림
    const r = await new Promise((ok, no) => {
      if (sig) {
        if (sig.aborted) return no(abortError());
        onAbort = () => no(abortError());
        sig.addEventListener('abort', onAbort, { once: true });
      }
      call.then(ok, no);
    });
    return new Response(r.body, { status: r.status, headers: { 'content-type': r.contentType || 'application/json' } });
  } finally {
    if (ka) clearInterval(ka);
    if (sig && onAbort) sig.removeEventListener('abort', onAbort);
  }
}
/* 이미지를 글자로 읽음 (업스테이지 OCR). 실패하면 ocr_failed */
async function upstageRead(images, signal) {
  const key = (E.keys.upstage || '').trim();
  const out = [];
  for (let i = 0; i < images.length; i++) {
    const im = images[i];
    const blob = im.blob || await (await fetch(`data:${im.mime};base64,${im.b64}`)).blob();
    const fd = new FormData();
    fd.append('document', blob, `page-${i + 1}.${/png/.test(im.mime) ? 'png' : 'jpg'}`);
    fd.append('model', 'ocr');
    let res;
    try { res = await upFetch(UPSTAGE_OCR, { method: 'POST', signal, headers: { authorization: 'Bearer ' + key }, body: fd }); }
    catch (e) {
      if (e && e.name === 'AbortError') throw { code: 'cancelled' };
      throw { code: 'blocked', message: String(e && e.message || e) };
    }
    if (!res.ok) {
      const er = await httpError(res);
      // 키·한도·잠깐 끊김(429·5xx)은 그대로 넘겨 쉬었다가 다시 하게 함. 나머지는 이미지를 못 읽은 것
      throw ['auth', 'quota', 'rate_limited', 'upstream_error'].includes(er.code) ? er : { code: 'ocr_failed', message: er.message };
    }
    let j = null;
    try { j = await res.json(); } catch (e) { throw { code: 'ocr_failed' }; }
    const text = String((j && j.text) || (j && Array.isArray(j.pages) ? j.pages.map(p => p && p.text || '').join('\n') : '')).trim();
    out.push(`--- ${i + 1}번째 이미지 ---\n${text || '(읽은 글자 없음)'}`);
  }
  return `[이미지에서 읽은 글]\n${out.join('\n')}\n[이미지에서 읽은 글 끝]\n아래 요청에서 이미지라고 한 것은 위에 적은 글이에요.\n\n`;
}
/* Claude 5.x 등은 답하기 전에 먼저 생각(thinking)하고, 생각도 max_tokens 안에서 씀.
   평어 쓰기는 깊은 생각이 필요 없어서 effort를 낮춰 빠르게 하고, 글자 한도는 넉넉히 둠 */
const CLAUDE_EFFORT_RE = /^claude-(?:opus-(?:4-[5-9]|[5-9])|sonnet-(?:4-[6-9]|[5-9])|haiku-[5-9]|fable-|mythos-)/;
async function callApi(provider, prompt, { onText, signal: outer, images, careful, model: useModel }) {
  const imgs = images || [];
  // 2분 동안 아무것도 오지 않거나(연결이 멈춤) 모두 15분이 넘으면 끊음
  const wd = new AbortController();
  let idleT = null;
  const idle = () => { clearTimeout(idleT); idleT = setTimeout(() => wd.abort(timeoutError('응답이 2분 동안 멈춰 있어서 끊었어요')), 120000); };
  const totalT = setTimeout(() => wd.abort(timeoutError('응답이 너무 오래 걸려서 멈췄어요')), 900000);
  const signal = anySignal([outer, wd.signal]);
  idle();
  try {
  const key = (E.keys[provider] || '').trim();
  const model = useModel || E.models[provider];
  let text = '', truncated = false, stopReason = '';
  const push = t => { if (!t) return; text += t; onText && onText({ text, delta: t }); };
  let res;
  try {
    if (provider === 'claude') {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal,
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model, max_tokens: 32000, stream: true, ...(CLAUDE_EFFORT_RE.test(model) ? { output_config: { effort: careful ? 'medium' : 'low' } } : {}), messages: [{ role: 'user', content: imgs.length ? [...imgs.map(im => ({ type: 'image', source: { type: 'base64', media_type: im.mime, data: im.b64 } })), { type: 'text', text: prompt }] : prompt }] })
      });
    } else if (provider === 'gemini') {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
        method: 'POST', signal,
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [...imgs.map(im => ({ inline_data: { mime_type: im.mime, data: im.b64 } })), { text: prompt }] }] })
      });
    } else if (provider === 'upstage') {
      // 이미지는 generate에서 글로 바꿔 둠
      res = await upFetch(UPSTAGE_CHAT, {
        method: 'POST', signal,
        headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + key },
        body: JSON.stringify({ model, stream: true, messages: [{ role: 'user', content: prompt }] })
      }, idle);
    } else {
      res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', signal,
        headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + key },
        body: JSON.stringify({ model, stream: true, messages: [{ role: 'user', content: imgs.length ? [{ type: 'text', text: prompt }, ...imgs.map(im => ({ type: 'image_url', image_url: { url: `data:${im.mime};base64,${im.b64}`, detail: 'high' } }))] : prompt }] })
      });
    }
  } catch (e) {
    const er = wd.signal.aborted ? wd.signal.reason : e;
    if (er && er.name === 'TimeoutError') throw { code: 'upstream_error', message: er.message || '응답이 너무 오래 걸려서 멈췄어요' };
    if (e && e.name === 'AbortError') throw { code: 'cancelled' };
    throw { code: 'blocked', message: String(e && e.message || e) };
  }
  if (!res.ok) throw await httpError(res);
  idle();
  try {
    await readSSE(res, j => {
      if (provider === 'claude') {
        if (j.type === 'content_block_delta' && j.delta && j.delta.type === 'text_delta') push(j.delta.text);
        else if (j.type === 'message_delta' && j.delta && j.delta.stop_reason) { stopReason = j.delta.stop_reason; if (stopReason === 'max_tokens') truncated = true; }
        else if (j.type === 'error') throw { code: /overloaded|api_error/.test(j.error && j.error.type) ? 'upstream_error' : (j.error && j.error.type === 'rate_limit_error' ? 'rate_limited' : 'upstream_error'), message: j.error && j.error.message };
      } else if (provider === 'gemini') {
        if (j.error) throw { code: 'upstream_error', message: j.error.message };
        if (j.promptFeedback && j.promptFeedback.blockReason) throw { code: 'refused', message: j.promptFeedback.blockReason };
        const c = j.candidates && j.candidates[0];
        if (c && c.content && Array.isArray(c.content.parts)) c.content.parts.forEach(p => { if (p && !p.thought && typeof p.text === 'string') push(p.text); });
        if (c && c.finishReason === 'MAX_TOKENS') truncated = true;
      } else {
        if (j.error) throw { code: 'upstream_error', message: j.error.message };
        const ch = j.choices && j.choices[0];
        if (ch && ch.delta && typeof ch.delta.content === 'string') push(ch.delta.content);
        if (ch && ch.finish_reason === 'length') truncated = true;
      }
    }, idle);
  } catch (e) {
    const er = wd.signal.aborted ? wd.signal.reason : e;
    if (er && er.name === 'TimeoutError') throw { code: 'upstream_error', message: er.message || '응답이 너무 오래 걸려서 멈췄어요', text };
    if (e && e.name === 'AbortError') throw { code: 'cancelled', text };
    if (e && e.code) { e.text = text; throw e; }
    throw { code: 'upstream_error', message: String(e && e.message || e), text };
  }
  if (!text.trim()) {
    if (stopReason === 'refusal') throw { code: 'refused' };
    throw { code: 'empty_completion', message: stopReason === 'max_tokens' ? '생각하는 데 글자 한도를 다 써서 문장을 쓰지 못했어요' : '' };
  }
  return { text, truncated };
  } finally { clearTimeout(idleT); clearTimeout(totalT); }
}
/* 모든 생성은 여기로 */
/* images: [{ mime, b64, blob }] — 평가지 채점에서 씀.
   use: { engine, model } 이 AI로 부름. task: 업무(grade·writing·plan·notes) — 업무에 정한 AI(없으면 기본), role: 'main'|'review' */
function roleAI(use, task, role) {
  if (use) return use;
  const r = task && window.SSAM && window.SSAM.aiRoles;
  return r ? r.pick(task, role || 'main') : null;
}
async function generate(prompt, { onText, signal, fresh, images, careful, use, task, role } = {}) {
  const pickd = E.engine === 'account' ? null : roleAI(use, task, role);
  if (pickd && PROVIDERS[pickd.engine] && (E.keys[pickd.engine] || '').trim()) {
    const prov = pickd.engine;
    try {
      if (prov === 'upstage' && images && images.length) { prompt = await upstageRead(images, signal) + prompt; images = null; }
      return await callApi(prov, prompt, { onText, signal, images, careful, model: pickd.model });
    } catch (e) { if (e && typeof e === 'object' && !e.provider) e.provider = prov; throw e; }
  }
  if (E.engine === 'account') {
    const opts = { signal, onText, modelTier: careful || S.settings.tier === 'careful' ? 'default' : 'quick' };
    if (fresh || (images && images.length)) opts.cache = false;
    if (images && images.length) {
      let lim = null;
      try { lim = await cap.sample.limits(); } catch (e) {}
      if (!lim || !lim.images) throw { code: 'images_unavailable' };
      opts.images = await fitImages(images, lim.images.maxCount || 1);
    }
    return cap.sample(prompt, opts);
  }
  if (E.engine === 'upstage' && images && images.length) {
    prompt = await upstageRead(images, signal) + prompt;
    images = null;
  }
  if (E.engine && PROVIDERS[E.engine]) return callApi(E.engine, prompt, { onText, signal, images, careful });
  throw { code: 'no_engine' };
}
/* 한 번에 보낼 수 있는 장수보다 많으면 위아래로 이어 붙임 */
async function fitImages(images, max) {
  const blobs = images.map(im => im.blob);
  if (blobs.length <= max) return blobs;
  const per = Math.ceil(blobs.length / max), out = [];
  for (let i = 0; i < blobs.length; i += per) {
    const bmps = await Promise.all(blobs.slice(i, i + per).map(b => createImageBitmap(b)));
    const w = 1200, hs = bmps.map(b => Math.round(b.height * w / b.width));
    const c = document.createElement('canvas'); c.width = w; c.height = hs.reduce((x, y) => x + y, 0);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    let y = 0; bmps.forEach((b, k) => { g.drawImage(b, 0, y, w, hs[k]); y += hs[k]; });
    out.push(await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85)));
  }
  return out;
}

capP.sample.then(s => { cap.sample = s; settleEngine(); noteEngine(); renderPane(); pump(); });

/* ---------- 저장 ---------- */
/* 예전에 만든 '~할 수 있음.' 문장의 끝맺음만 고쳐 저장 (사용함 표시는 그대로) */
function fixSetEndings(planId, sets) {
  sets.forEach((set, k) => {
    let changed = false;
    const seen = new Set();
    const items = [];
    for (const x of set.items || []) {
      const t = fixEnding(x.t);
      if (t !== x.t) changed = true;
      const key = t.replace(/\s+/g, '');
      if (seen.has(key)) { changed = true; if (x.d) { const y = items.find(i => i.t.replace(/\s+/g, '') === key); if (y) y.d = 1; } continue; }
      seen.add(key); items.push({ ...x, t });
    }
    if (changed) { set.items = items; Store.saveSet(planId, k, set, sets); }
  });
  return sets;
}
const Store = {
  mode: 'memory',
  async init() {
    const [db, user] = await Promise.all([useCap('db'), useCap('user')]);
    if (db && user) {
      try { const id = await user.id(); if (id) { cap.db = db; cap.uid = id; this.mode = 'db'; return; } } catch (e) {}
    }
    try { localStorage.setItem('ssam:t', '1'); localStorage.removeItem('ssam:t'); this.mode = 'local'; } catch (e) { this.mode = 'memory'; }
  },
  base() { return 'data/users/' + cap.uid; },
  lsGet(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  lsSet(k, v) {
    if (S.wiping) return false; // 프로그램을 지우는 중에는 다시 쓰지 않음
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) { saveFailed({ code: e && (e.name === 'QuotaExceededError' || e.code === 22) ? 'quota_exceeded' : 'save_failed' }); return false; }
  },
  async getPrefs() {
    if (this.mode === 'db') { try { const s = await cap.db.doc(this.base() + '/prefs').get(); return s.exists ? s.data() : {}; } catch (e) { return {}; } }
    return this.lsGet('ssam:prefs', {});
  },
  setPrefs(p) {
    if (this.mode === 'db') return writeDoc(this.base() + '/prefs', p);
    if (this.mode === 'local') this.lsSet('ssam:prefs', p);
  },
  async savePlan(id, plan) {
    const body = slimPlan(plan);
    if (this.mode === 'db') return writeDoc(this.base() + '/p_' + id, body);
    if (this.mode === 'local') this.lsSet('ssam:plan:' + id, body);
  },
  async getPlan(id) {
    if (this.mode === 'db') { try { const s = await cap.db.doc(this.base() + '/p_' + id).get(); return s.exists ? JSON.parse(JSON.stringify(s.data())) : null; } catch (e) { return null; } }
    return this.lsGet('ssam:plan:' + id, null);
  },
  async listPlans() {
    if (this.mode === 'db') {
      try {
        const q = await cap.db.collection(this.base()).where('kind', '==', 'plan').get();
        return q.docs.map(d => { const b = d.data(); return { id: d.id.replace(/^p_/, ''), title: b.title, createdAt: b.createdAt, n: planUnitCount(b) }; })
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      } catch (e) { return []; }
    }
    const ids = this.lsGet('ssam:plans', []);
    return ids.map(id => { const b = this.lsGet('ssam:plan:' + id, null); return b && { id, title: b.title, createdAt: b.createdAt, n: planUnitCount(b) }; }).filter(Boolean);
  },
  rememberLocal(id) { if (this.mode !== 'local') return; const ids = this.lsGet('ssam:plans', []); if (!ids.includes(id)) { ids.unshift(id); this.lsSet('ssam:plans', ids); } },
  async loadSets(id) {
    const out = new Map();
    if (this.mode === 'db') {
      try {
        const q = await cap.db.doc(this.base() + '/p_' + id).collection('sets').limit(1000).get();
        q.docs.forEach(d => { const b = d.data(); out.set(d.id, { items: (b.items || []).map(itemOut), want: b.want || N, saved: 1 }); });
      } catch (e) {}
      return fixSetEndings(id, out);
    }
    const all = this.lsGet('ssam:sets:' + id, {});
    for (const k in all) out.set(k, { items: all[k].items || [], want: all[k].want || N });
    return fixSetEndings(id, out);
  },
  // sets: 그 평가계획의 묶음 (다른 평가계획을 연 뒤에 끝난 작업이 엉뚱한 묶음을 저장하지 않게 넘겨받음)
  saveSet(planId, key, set, sets = S.sets) {
    const body = { items: set.items.map(itemOut), want: set.want || N, at: Date.now() };
    if (this.mode === 'db') return writeDoc(this.base() + '/p_' + planId + '/sets/' + key, body);
    if (this.mode === 'local') {
      this._lt = this._lt || {}; this._lf = this._lf || {};
      clearTimeout(this._lt[planId]);
      const write = () => {
        delete this._lt[planId]; delete this._lf[planId];
        if (this._gone && this._gone.has(planId)) return; // 지운 평가계획
        const all = {};
        sets.forEach((v, k) => { if (v.items.length) all[k] = { items: v.items.map(itemOut), want: v.want }; });
        this.lsSet('ssam:sets:' + planId, all);
      };
      this._lf[planId] = write;
      this._lt[planId] = setTimeout(write, 300);
    }
  },
  // 평가계획에서 빠진 평가요소의 평어 묶음을 지움
  dropSets(planId, unitIds, sets) {
    const gone = new Set(unitIds);
    const keys = [...sets.keys()].filter(k => gone.has(k.slice(0, k.lastIndexOf('_'))));
    if (!keys.length) return;
    keys.forEach(k => sets.delete(k));
    if (this.mode === 'db') {
      keys.forEach(async k => {
        const path = this.base() + '/p_' + planId + '/sets/' + k;
        pend.delete(path); // 아직 안 쓴 저장은 버리고, 쓰는 중이면 끝난 뒤 지움
        while (busy.has(path)) await new Promise(r => setTimeout(r, 200));
        try { await cap.db.doc(path).delete(); } catch (e) {}
      });
      return;
    }
    if (this.mode === 'local') {
      const all = this.lsGet('ssam:sets:' + planId, {});
      keys.forEach(k => delete all[k]);
      this.lsSet('ssam:sets:' + planId, all);
    }
  },
  async deletePlan(id) {
    (this._gone = this._gone || new Set()).add(id);
    if (this._lt && this._lt[id]) { clearTimeout(this._lt[id]); delete this._lt[id]; }
    if (this.mode === 'db') {
      try {
        const q = await cap.db.doc(this.base() + '/p_' + id).collection('sets').limit(1000).get();
        for (const d of q.docs) await cap.db.doc(this.base() + '/p_' + id + '/sets/' + d.id).delete();
        await cap.db.doc(this.base() + '/p_' + id).delete();
      } catch (e) {}
      return;
    }
    try { localStorage.removeItem('ssam:plan:' + id); localStorage.removeItem('ssam:sets:' + id); } catch (e) {}
    this.lsSet('ssam:plans', this.lsGet('ssam:plans', []).filter(x => x !== id));
  }
};
const storeReady = Store.init();
const pend = new Map(), busy = new Set();
function writeDoc(path, body) {
  pend.set(path, body);
  if (!busy.has(path)) flushDoc(path);
}
async function flushDoc(path) {
  busy.add(path);
  while (pend.has(path)) {
    const b = pend.get(path); pend.delete(path);
    try { await cap.db.doc(path).set(b); }
    catch (e) {
      if (e && e.code === 'unavailable') { await new Promise(r => setTimeout(r, 600 + Math.random() * 600)); try { await cap.db.doc(path).set(b); } catch (e2) { saveFailed(e2); } }
      else saveFailed(e);
    }
  }
  busy.delete(path);
}
// 저장 실패 알림: 한 번만이 아니라 20초에 한 번까지 (fails: 넣는 일이 끝난 뒤 실패했는지 보려고 셈)
let saveWarnedAt = -1e9, saveFails = 0;
function saveFailed(e) {
  try { if (typeof saveWarnedAt === 'undefined') return; } catch (er) { return; }
  saveFails++;
  if (Date.now() - saveWarnedAt < 20000) return; saveWarnedAt = Date.now();
  const c = e && e.code;
  toast(c === 'quota_exceeded' ? '저장 공간이 가득 찼어요. 쓰지 않는 평가계획을 지워 주세요.' : '저장하지 못한 내용이 있어요. 페이지를 닫기 전에 다시 확인해 주세요.', 5000);
}
function slimPlan(plan) {
  const body = { kind: 'plan', title: plan.title, grade: plan.grade || null, source: plan.source || '', createdAt: plan.createdAt || Date.now(), subjects: plan.subjects };
  const bytes = new TextEncoder().encode(JSON.stringify(body)).length;
  if (bytes > 240000) {
    body.subjects = plan.subjects.map(s => ({ name: s.name, units: s.units.map(u => ({ ...u, focus: u.focus.slice(0, 400), std: u.std.slice(0, 600) })) }));
  }
  return body;
}

/* ---------- 도우미 ---------- */
const allUnits = () => S.plan ? S.plan.subjects.flatMap(s => s.units) : [];
const unitById = id => allUnits().find(u => u.id === id);
const setKey = (unitId, lv) => unitId + '_' + lv;
function getSet(unitId, lv) {
  const k = setKey(unitId, lv);
  if (!S.sets.has(k)) S.sets.set(k, { items: [], want: N, status: 'idle', err: '' });
  const s = S.sets.get(k);
  if (!s.status) s.status = s.items.length >= (s.want || N) ? 'done' : (s.items.length ? 'part' : 'idle');
  return s;
}
const normKey = t => String(t).replace(/[\s.,·ㆍ'"‘’“”~()!?;:\-]/g, '');
function unitKeys(unitId) {
  const full = new Set(), pre = new Set();
  for (const l of LV) for (const x of getSet(unitId, l.k).items) { const k = normKey(x.t); full.add(k); pre.add(k.slice(0, 18)); }
  return { full, pre };
}
let toastT;
function toast(msg, ms) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms || 2200);
}
const ICON = {
  check: '<svg class="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 6 6 6-6 6"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  redo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/></svg>'
};

/* ---------- 평어 만들기 (Claude) ---------- */
function lengthRange(u) {
  if (S.settings.len === 'short') return [35, 55];
  if (S.settings.len === 'long') return [90, 130];
  const cs = [u.crit.high, u.crit.mid, u.crit.low].filter(Boolean);
  const avg = cs.length ? cs.reduce((a, c) => a + c.length, 0) / cs.length : 65;
  const lo = Math.round(Math.min(110, Math.max(35, avg - 12)));
  return [lo, lo + 24];
}
function buildPrompt(u, lv, ask, mine, others) {
  const [lo, hi] = lengthRange(u);
  const grade = S.plan.grade ? S.plan.grade + '학년 ' : '';
  const anchor = {
    top: u.crit.top
      ? `평가기준 '최상': "${u.crit.top}"에 해당하는 학생.`
      : `평가기준 '상'("${u.crit.high || u.elem}")을 완전히 충족하고 한 걸음 더 나아간 학생. 배운 내용을 새로운 상황에 적용하거나, 자기 생각을 창의적으로 넓히거나, 근거를 들어 깊이 있게 설명하는 모습을 드러냅니다.`,
    high: `평가기준 '상': "${u.crit.high || '(없음) 성취기준을 잘 달성함'}"에 해당하는 학생. 정확하고 능숙하게 해내는 모습을 씁니다.`,
    mid: `평가기준 '중': "${u.crit.mid || '(없음) 성취기준을 대체로 달성함'}"에 해당하는 학생. 기본은 해내고 대체로 바르게 수행하는 모습을 씁니다.`,
    low: `평가기준 '하': "${u.crit.low || '(없음) 성취기준을 기초 수준에서 달성함'}"에 해당하는 학생. 부족한 점을 지적하거나 부정적으로 쓰지 말고, 해낸 것과 안내나 도움을 받아 해낼 수 있는 것, 꾸준히 노력하는 모습과 성장 가능성을 긍정적으로 씁니다.`
  }[lv];
  const da = S.settings.ending === 'da';
  const endRule = endingRule(da);
  const oneEx = da
    ? ["작품 속 인물의 마음을 자신의 경험과 견주어 읽으며 인물에게 하고 싶은 말을 까닭과 함께 또박또박 발표한다.", "작품 속 인물의 마음을 자신의 경험과 견주어 읽는다. 인물에게 하고 싶은 말을 발표한다."]
    : ["작품 속 인물의 마음을 자신의 경험과 견주어 읽으며 인물에게 하고 싶은 말을 까닭과 함께 또박또박 발표함.", "작품 속 인물의 마음을 자신의 경험과 견주어 읽음. 인물에게 하고 싶은 말을 발표함."];
  const avoid = [...mine, ...others].slice(-70);
  return [
    `당신은 초등학교 학교생활기록부 '교과학습발달상황' 평어를 쓰는 경력 많은 초등 담임교사입니다.`,
    `아래 평가 정보를 바탕으로 [${LVNAME[lv]}] 수준 학생에게 쓸 평어 문장을 정확히 ${ask}개 쓰세요.`,
    ``,
    `[학년·과목] ${grade}${u.subject}`,
    u.unit ? `[단원] ${u.unit}` : null,
    u.area ? `[평가영역] ${u.area}` : null,
    u.elem ? `[평가요소] ${u.elem}` : null,
    u.std ? `[성취기준] ${u.std.slice(0, 700)}` : null,
    u.focus ? `[수업·평가 방법과 주안점] ${u.focus.slice(0, 700)}` : null,
    `[평가기준] 상: ${u.crit.high || '-'} / 중: ${u.crit.mid || '-'} / 하: ${u.crit.low || '-'}`,
    ``,
    `[이 수준의 학생] ${anchor}`,
    ``,
    `[쓰기 규칙]`,
    `1. 평어 하나는 마침표가 하나뿐인 한 문장입니다. 관찰한 모습 두세 가지를 '~하며', '~하고', '~하여', '~할 뿐 아니라'처럼 이어 주는 말로 자연스럽게 이어 한 문장으로 쓰고, 중간에 마침표를 찍어 문장을 나누지 않습니다. 한 줄에 평어 하나만 쓰고 번호, 글머리표, 따옴표, 제목, 설명은 쓰지 않습니다.`,
    `   - 좋은 예(형식만 참고): ${oneEx[0]}`,
    `   - 나쁜 예(두 문장으로 나뉨): ${oneEx[1]}`,
    `2. ${endRule}`,
    `3. 학생 이름이나 '이 학생은', '○○는' 같은 주어를 쓰지 않고, 문장 앞에 '또한', '그리고', '그래서' 같은 이음말을 붙이지 않습니다.`,
    `4. 문장 하나는 공백을 포함해 ${lo}~${hi}자로 씁니다.`,
    `5. 평가요소와 관련된 구체적인 활동과 행동이 드러나게 쓰고, 평가기준 문장을 그대로 옮기지 않습니다.`,
    `6. 문장마다 시작하는 말, 핵심 표현, 서술어를 다르게 씁니다. 개념 이해, 표현과 발표, 탐구 과정, 협력, 태도와 습관, 실생활 적용, 성장과 변화 등 관찰 관점을 골고루 섞습니다.`,
    `7. '매우', '뛰어남', '훌륭함' 같은 꾸밈말을 되풀이하지 않습니다.`,
    `8. ${grade}학생의 실제 수업 모습으로 자연스럽고, 생활기록부에 바로 쓸 수 있는 문장이어야 합니다.`,
    `9. ${pronounRule()}`,
    avoid.length ? `[이미 만든 문장] 아래 문장들과 표현·구조·내용이 겹치지 않게 씁니다.\n${avoid.map(t => '- ' + t).join('\n')}\n` : null,
    ``,
    `문장 ${ask}개만 줄바꿈으로 구분해 출력하세요.`
  ].filter(x => x != null).join('\n');
}
/* ---------- 문장 끝맺음: 교과 평어·평가지 채점 평어는 '~할 수 있음.'이 아니라 '~함.', '~씀.'처럼 학생이 한 일로 끝냄 ---------- */
function endingRule(da) {
  return da
    ? "모든 문장은 '~한다.', '~쓴다.', '~작성한다.', '~설명한다.'처럼 학생이 실제로 한 일을 나타내는 말과 '다.'로 끝냅니다. '~할 수 있다.', '~수 있다.'로 끝내지 않습니다. 성취기준·평가기준의 '~할 수 있다' 끝맺음을 따라 하지 않습니다."
    : "모든 문장은 '~함.', '~씀.', '~작성함.', '~설명함.', '~발표함.', '~보임.'처럼 학생이 실제로 한 일을 나타내는 명사형 종결어미와 마침표로 끝냅니다. '~할 수 있음.', '~수 있음.'으로 끝내지 않습니다. 성취기준·평가기준의 '~할 수 있다' 끝맺음을 따라 하지 않습니다.";
}
/* ---------- 대명사: 꼭 필요할 때가 아니면 쓰지 않음 (교과 평어·평가지 채점 평어·행특) ---------- */
function pronounRule() {
  return "대명사('자신', '자기', '그', '이', '이것', '그것', '이를', '그들')와 '이러한', '그러한', '그 과정' 같은 가리키는 말은 꼭 필요할 때가 아니면 쓰지 않습니다. '자신의 생각을'은 '생각을'처럼 빼고, 가리키는 대상이 있으면 그 말을 직접 씁니다.";
}
// 글에 꼭 필요하지 않을 수 있는 대명사·가리키는 말이 있는지 ('자신 있게'·'자신감'·'자기 주도적'·'스스로'는 대명사로 보지 않음)
function hasPronoun(text) {
  const toks = String(text || '').split(/\s+/).map(w => w.replace(/^[("'“‘\[]+|[)"'”’\],.。!?·:;]+$/g, '')).filter(Boolean);
  const P = /^(자신|자기|그것|이것|저것|그들|이들|저들|여기|거기|저기|이곳|그곳|저곳|그녀)(의|을|를|이|가|은|는|도|에|에게|에게서|에서|만|만의|과|와|으로|로|처럼|보다|까지|부터|마다|이나|나|조차|뿐|대로)?$/;
  const D = /^(이를|그를|이에|그에|이와|그와|이로|그로|이로써|이러한|그러한|이런|그런)$/;
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i], next = toks[i + 1] || '';
    if (/^자기$/.test(w) && /^(주도|평가|소개|관리|성찰|조절|효능|표현|이해|계발|개발)/.test(next)) continue;
    if (/^자신(이|을)?$/.test(w) && /^(있|없|감)/.test(next)) continue;
    if (P.test(w) || D.test(w)) return true;
    if ((w === '이' || w === '그' || w === '저') && /^[가-힣]/.test(next)) return true;
  }
  return false;
}
// 한글 글자의 받침 번호 (ㄴ 4 · ㄹ 8 · ㄻ 10 · ㅁ 16), 한글이 아니면 -1
function jongOf(ch) { const c = ch ? ch.charCodeAt(0) - 0xAC00 : -1; return c >= 0 && c < 11172 ? c % 28 : -1; }
function setJong(ch, j) { const c = ch.charCodeAt(0) - 0xAC00; return String.fromCharCode(0xAC00 + c - (c % 28) + j); }
function nounEnding(w) {
  // 관형형(할·쓸·읽을…) → 명사형(함·씀·읽음…)
  if (w.length > 1 && w.endsWith('을')) return w.slice(0, -1) + '음';
  const last = w.slice(-1);
  if (jongOf(last) !== 8) return null; // 받침 ㄹ이 아니면 손대지 않음
  // 받침 ㄹ로 끝나는 말줄기(만들다·알다·풀다…): '만들 수 있음' → '만듦' (ㄹ을 ㅁ으로 바꾸면 '만듬'이 되어 틀림)
  const one = ['알', '풀', '열', '놀', '늘', '끌', '밀', '걸', '벌', '팔', '떨', '털', '들', '불', '달', '몰', '물'];
  const end = ['이끌', '흔들', '베풀', '부풀', '매달', '거들', '내밀', '드날'];
  if (w.endsWith('만들')) return w.slice(0, -1) + setJong(last, 10); // 만듦
  // 앎·풂·붊처럼 어색한 꼴 대신 '아는·푸는·부는 모습을 보임'
  if (one.includes(w) || end.some(x => w.endsWith(x))) return w.slice(0, -1) + setJong(last, 0) + '는 모습을 보임';
  return w.slice(0, -1) + setJong(last, 16); // 받침 ㄹ → ㅁ (함·씀·그림·도움)
}
function daEnding(w) {
  // '할 수 있다' → '한다', '쓸 수 있다' → '쓴다', '만들 수 있다' → '만든다' (받침 ㄹ → ㄴ)
  const last = w.slice(-1);
  if (w.endsWith('을') || jongOf(last) !== 8 || last === '울' || last === '올') return null; // 헷갈리는 활용은 그대로 둠
  return w.slice(0, -1) + setJong(last, 4) + '다';
}
function fixEnding(text) {
  let t = String(text || '');
  const m = t.match(/(\S+)\s+수\s*있(음|다)\s*([.。!]?)\s*$/);
  if (!m) return t;
  const head = t.slice(0, m.index);
  const w = m[2] === '음' ? nounEnding(m[1]) : daEnding(m[1]);
  if (!w) return t;
  return head + w + (m[3] || '.');
}
function cleanLine(line) {
  let t = String(line || '').trim();
  if (!t) return null;
  t = t.replace(/^\s*(?:\d{1,3}\s*[.)．:]|\(\d{1,3}\)|[-•*·▪◦○●■□>]+)\s*/, '').replace(/^["“'‘`]+|["”'’`]+$/g, '').trim();
  if (t.length < 14) return null;
  if (/^(\[|#|※|최상|상|중|하|다음|아래|참고)\s*[:：\]수]/.test(t) && t.length < 30) return null;
  if (/[:：]$/.test(t)) return null;
  if (!/[.。!]$/.test(t)) t += '.';
  // 교과 평어는 한 문장: 중간에 마침표로 나뉜 줄은 쓰지 않음
  if (/[.。!?]\s+\S/.test(t)) return null;
  return fixEnding(t);
}
function addLine(unitId, set, line, target, keys) {
  if (set.items.length >= target) return false;
  const t = cleanLine(line); if (!t) return false;
  const k = normKey(t);
  if (keys.full.has(k) || keys.pre.has(k.slice(0, 18))) return false;
  keys.full.add(k); keys.pre.add(k.slice(0, 18));
  set.items.push({ t, d: 0, fresh: 1 });
  return true;
}
function enqueue(unitId, lv, opt = {}) {
  const set = getSet(unitId, lv);
  const key = setKey(unitId, lv);
  if (set.status === 'running') {
    // 만드는 중이면 끝난 뒤에 이어서 함 (10개 더·다시 만들기가 사라지지 않게)
    if (opt.more) set.pendingMore = (set.pendingMore || 0) + opt.more;
    if (opt.fresh) set.pendingFresh = true;
    return;
  }
  const qi = S.queue.findIndex(j => setKey(j.unitId, j.lv) === key);
  if (qi >= 0) {
    if (opt.front) { const [j] = S.queue.splice(qi, 1); Object.assign(j, opt); S.queue.unshift(j); }
    return;
  }
  if (!opt.more && !opt.fresh && set.items.length >= (set.want || N)) return;
  const job = { unitId, lv, more: opt.more || 0, fresh: !!opt.fresh };
  set.status = 'queued'; set.err = '';
  if (opt.front) S.queue.unshift(job); else S.queue.push(job);
}
function enqueueUnit(unitId, front) {
  const order = front ? [...LV].reverse() : LV;
  for (const l of order) enqueue(unitId, l.k, { front });
}
function enqueueAll() {
  if (!S.plan) return;
  for (const u of allUnits()) for (const l of LV) enqueue(u.id, l.k);
  if (S.unitId) enqueueUnit(S.unitId, true);
  S.paused = null; S.consecutiveErr = 0;
  pump();
}
function pump() {
  if (!S.running.size && !S.queue.length) S.noReview = false; // 검토 실패로 멈춘 것은 그 차례에만
  if (S.paused || !engineReady()) { updateGen(); return; }
  while (S.running.size < conc() && S.queue.length) run(S.queue.shift());
  updateGen();
}
function pauseAll(reason) {
  S.paused = reason;
  for (const j of S.queue) { const s = getSet(j.unitId, j.lv); s.status = s.items.length ? 'part' : 'idle'; }
  if (reason === 'denied' || reason === 'stopped') S.queue = [];
  updateGen(); renderUnitsSoon(); renderPane();
}
function stopAll() {
  const keep = S.queue.slice(); S.queue = [];
  keep.forEach(j => { const s = getSet(j.unitId, j.lv); s.status = s.items.length ? 'part' : 'idle'; });
  S.running.forEach(r => r.ctl.abort());
  S.paused = null;
  updateGen(); renderUnitsSoon(); renderPane();
}
const SAMPLE_MSG = {
  rate_limited: 'Claude 사용량 한도에 걸렸어요. 만든 평어는 그대로 있어요. 잠시 뒤 이어서 만들기를 눌러 주세요.',
  session_expired: 'Claude 로그인이 풀렸어요. 다시 로그인한 뒤 이어서 만들기를 눌러 주세요.',
  not_granted: '이 페이지가 Claude를 쓰도록 허용되지 않았어요. 권한을 허용하면 평어를 만들 수 있어요.',
  sampling_disabled: '이 계정에서는 Claude로 평어를 만들 수 없어요.',
  refused: 'Claude가 이 평가요소로는 문장을 쓰지 않았어요. 평가 정보를 확인해 주세요.',
  empty_completion: '문장이 비어서 돌아왔어요. 다시 만들기를 눌러 주세요.',
  prompt_too_large: '평가 정보가 너무 길어요. 붙여넣은 내용을 줄여 주세요.',
  upstream_error: '연결이 잠깐 끊겼어요. 다시 시도를 눌러 주세요.'
};
/* 업스테이지를 쓰면 이미지 화면에 한 줄 안내 (쓰는 것은 막지 않음) */
const upNote = () => E.engine === 'upstage' ? '<p class="muted up-note">업스테이지는 이미지를 글자로 읽어서 보내요. 손글씨 이미지는 Claude·Gemini·GPT를 권장해요.</p>' : '';
function errMsg(code, e) {
  // 업무별 AI로 부른 오류는 그 회사 이름으로
  const nm = (e && e.provider && PROVIDERS[e.provider] ? PROVIDERS[e.provider].label : engineName()) || 'AI';
  const m = {
    auth: `${nm} 키가 맞지 않아요(또는 권한이 없어요). 왼쪽 아래 AI 버튼에서 API 키를 다시 확인해 주세요.`,
    quota: e && /^하루/.test(e.message || '') ? `${nm}의 하루 사용 한도를 다 썼어요. 내일 이어서 하거나 결제 설정을 확인해 주세요.` : `${nm} 사용 한도(크레딧·결제)가 부족해요. 결제나 한도를 확인한 뒤 이어서 만들기를 눌러 주세요.`,
    bad_model: `${nm}에서 이 모델을 쓸 수 없어요. 평어 쓰는 방식에서 다른 모델을 골라 주세요.`,
    blocked: IN_VIEWER ? 'claude.ai 안에서는 외부 API 호출이 막혀 있어요. 평어 쓰는 방식에서 \'Claude 계정\'을 고르거나, 배포한 주소에서 API 키를 써 주세요.' : `${nm}에 연결하지 못했어요. 인터넷 연결과 API 키를 확인해 주세요.` + (E.engine === 'upstage' && !IN_APP ? ' 웹에서 계속 막히면 업스테이지는 Windows 앱에서 써 주세요.' : ''),
    ocr_failed: '업스테이지가 이미지를 읽지 못했어요. 이미지 기능은 Claude·Gemini·GPT를 권장해요.',
    no_engine: '평어를 만들 AI가 아직 정해지지 않았어요. 평어 쓰는 방식에서 API 키를 넣어 주세요.',
    images_unavailable: '이 화면에서는 Claude 계정으로 이미지를 보낼 수 없어요. 평어 쓰는 방식에서 API 키를 넣어 주세요.',
    image_rejected: '평가지 이미지를 AI가 받지 않았어요. 스캔 파일이 너무 크거나 형식이 맞지 않아요.',
    bad_json: 'AI 답을 읽지 못했어요. 다시 시도해 주세요.',
    empty_completion: E.engine === 'account' ? SAMPLE_MSG.empty_completion : `${nm}가 빈 답을 보냈어요${e && e.message ? ' (' + e.message + ')' : ''}. 다시 만들기를 눌러 주세요.`,
    bad_request: `${nm}가 요청을 받지 않았어요` + (e && e.message ? ': ' + e.message : '.'),
    rate_limited: E.engine === 'account' ? SAMPLE_MSG.rate_limited : `${nm} 요청 한도에 걸렸어요. 만든 평어는 그대로 있어요. 잠시 뒤 이어서 만들기를 눌러 주세요.`,
    upstream_error: E.engine === 'account' ? SAMPLE_MSG.upstream_error : `${nm} 쪽 응답이 잠깐 끊겼어요. 다시 시도를 눌러 주세요.` + (e && e.message ? ' (' + String(e.message).slice(0, 120) + ')' : '')
  };
  return m[code] || SAMPLE_MSG[code] || SAMPLE_MSG.upstream_error;
}
/* ---------- 검토 AI (평어·행특·창체·평가지 평어 문장) ---------- */
const RV = () => (window.SSAM && window.SSAM.review) || null;
/* items: [{ o, f }] — o[f]가 문장. 검토 AI가 문제를 적은 문장에만 o[rv] = { problem, fix }, 검토한 문장은 o[d] = 1.
   반환: 'off'(검토 꺼짐·볼 문장 없음) | 'ok' | 'fail'(키·한도·연결 — 쓴 글은 그대로) */
async function reviewSentences(kind, info, items, signal, keys = { rv: 'rv', d: 'rvd' }) {
  const R = RV();
  if (!R || !R.texts) return 'off';
  const list = items.filter(x => x.o && !x.o[keys.d] && String(x.o[x.f] || '').trim());
  if (!list.length) return 'off';
  const sent = list.map(x => x.o[x.f]);
  const res = await R.texts(kind, info, sent, { signal });
  if (res == null) return 'off';
  const got = Array.isArray(res) ? res : (res.partial || []);
  // 검토하는 동안 바뀐 문장(다시 쓰기·손으로 고침)의 의견은 버림
  for (const r of got) { const x = list[r.i - 1]; if (x && x.o[x.f] === sent[r.i - 1]) x.o[keys.rv] = { problem: r.problem, fix: r.fix }; }
  if (!Array.isArray(res)) return res.error === 'cancelled' ? 'off' : 'fail';
  list.forEach((x, i) => { if (x.o[x.f] === sent[i]) x.o[keys.d] = 1; });
  return 'ok';
}
const rvOpen = (o, k = 'rv') => !!(o && o[k] && !o[k].done);
function rvInline(o, key, title, k = 'rv', f = 't') {
  const R = RV();
  if (!R || !rvOpen(o, k)) return '';
  return `<div class="rv-inline" data-rv-for="${esc(key)}">${R.opinionHTML({ title, main: o[f], alt: o[k].fix, why: o[k].problem, use: key, keep: key, useLabel: '고친 문장 쓰기' })}</div>`;
}
const rvBarHTML = n => { const R = RV(); return R ? R.reviewBar(n, 'data-rv-next') : ''; };
const GR_RV = { handle: () => false }; // 평가지 채점 점수 검토(아래에서 채움)
const RV_FAIL_HTML = '<p class="rv-fail" role="status">검토하지 못했어요. 쓴 글은 그대로 쓸 수 있어요.</p>';
/* 저장할 문장: 사용함 표시와 검토 의견 */
const itemOut = x => ({ t: x.t, d: x.d ? 1 : 0, ...(x.rvd ? { rvd: 1 } : {}), ...(x.rv ? { rv: x.rv } : {}) });
const pyInfo = (u, lv) => [u.std && `[성취기준] ${u.std}`, u.elem && `[평가요소] ${u.elem}`, `[수준] ${LVNAME[lv]}${u.crit[lv] ? ': ' + u.crit[lv] : ''}`].filter(Boolean).join('\n');
/* 의견 고르기: 열쇠 → 그 문장. py:평가요소:수준:번호 · hk:학생:번호 · cc:영역:번호:활동 · gr:학생 */
function rvTarget(key) {
  const p = String(key || '').split(':').map(decodeURIComponent);
  if (p[0] === 'py') { const set = getSet(p[1], p[2]), o = set.items[+p[3]]; return o && { o, f: 't', save: () => S.planId && Store.saveSet(S.planId, setKey(p[1], p[2]), set), render: () => { renderList(); renderTabs(); } }; }
  if (p[0] === 'hk') { const st = hkStudent(p[1]), o = st && (st.results || [])[+p[2]]; return o && { o, f: 't', save: () => HKStore.save(), render: () => { renderHKEditor(); renderHKList(); } }; }
  if (p[0] === 'cc') { const it = ccArea(p[1]).items[+p[2]], o = it && it.parts && it.parts[p[3]]; return o && { o, f: 't', save: () => CCStore.save(), render: renderCCResults }; }
  if (p[0] === 'gr') { const o = grStudent(p[1]); return o && { o, f: 'text', rv: 'trv', save: () => GRStore.save(), render: renderGRResults }; }
  return null;
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-rv-use],[data-rv-keep],[data-rv-next]');
  const view = b && b.closest('#planView,#hkView,#ccView,#grView');
  if (!view) return;
  e.stopPropagation(); e.preventDefault();
  if (b.dataset.rvNext != null) { const op = view.querySelector('.rv-op'); if (op) { op.scrollIntoView({ block: 'center', behavior: 'smooth' }); const x = op.querySelector('button'); if (x) x.focus({ preventScroll: true }); } return; }
  const use = b.dataset.rvUse != null, key = use ? b.dataset.rvUse : b.dataset.rvKeep;
  if (GR_RV.handle(key, use)) return;
  const tg = rvTarget(key);
  if (!tg) return;
  const k = tg.rv || 'rv';
  if (!rvOpen(tg.o, k)) return;
  if (use) { tg.o[tg.f] = tg.o[k].fix; if (k === 'trv') tg.o.stale = false; }
  tg.o[k] = { ...tg.o[k], done: use ? 'review' : 'main' };
  tg.save(); tg.render();
  toast(use ? '고친 문장을 썼어요' : '그대로 두었어요');
}, true);
async function run(job) {
  const u = unitById(job.unitId);
  const key = setKey(job.unitId, job.lv);
  const set = getSet(job.unitId, job.lv);
  if (!u) { set.status = 'idle'; pump(); return; }
  const ctl = new AbortController();
  const planId = S.planId, sets = S.sets;
  S.running.set(key, { ctl });
  set.status = 'running'; set.err = '';
  if (job.fresh) set.items = set.items.filter(x => x.d);
  const before = new Set(set.items); // 이번에 쓴 문장만 검토
  const target = job.more ? set.items.length + job.more : Math.max(set.want || N, N);
  set.want = Math.max(N, target);
  renderUnitsSoon(); renderListSoon(job.unitId, job.lv);
  let attempts = 0;
  try {
    while (set.items.length < target && attempts < 3) {
      attempts++;
      const need = target - set.items.length;
      const ask = Math.min(need + 4, 60);
      const others = LV.filter(l => l.k !== job.lv).flatMap(l => getSet(job.unitId, l.k).items.slice(0, 12).map(x => x.t));
      const prompt = buildPrompt(u, job.lv, ask, set.items.map(x => x.t), others);
      const keys = unitKeys(job.unitId);
      let consumed = 0, added = 0;
      const res = await generate(prompt, {
        signal: ctl.signal, task: 'writing',
        fresh: !!(job.fresh || job.more || attempts > 1),
        onText: ({ text }) => {
          const lines = text.split('\n'); const complete = lines.length - 1;
          let got = 0;
          for (let i = consumed; i < complete; i++) if (addLine(job.unitId, set, lines[i], target, keys)) { added++; got++; }
          consumed = Math.max(consumed, complete);
          // 새 문장이 생겼을 때만 다시 그림 (그리는 동안 누른 것이 사라지지 않게)
          if (got) renderListSoon(job.unitId, job.lv);
        }
      });
      const lines = res.text.split('\n');
      for (let i = consumed; i < lines.length; i++) if (addLine(job.unitId, set, lines[i], target, keys)) added++;
      renderListSoon(job.unitId, job.lv);
      if (!added) break;
    }
    set.status = set.items.length >= target ? 'done' : 'part';
    S.consecutiveErr = 0; concOk();
    // 검토 AI: 새로 쓴 문장을 10개씩 (사용함으로 표시한 문장은 빼고)
    const fresh = set.items.filter(x => !before.has(x) && !x.d);
    if (!S.noReview && fresh.length && RV() && RV().pick('writing', 'review')) {
      renderListSoon(job.unitId, job.lv);
      // 검토하는 동안 창을 닫아도 쓴 문장은 남게 먼저 저장
      if (planId) { Store.saveSet(planId, key, set, sets); set.saved = 1; }
      const r = await reviewSentences('pyeongeo', pyInfo(u, job.lv), fresh.map(o => ({ o, f: 't' })), ctl.signal);
      if (r === 'fail') { S.noReview = true; set.rvErr = 1; } else if (r === 'ok') delete set.rvErr;
    }
  } catch (e) {
    const code = (e && e.code) || 'upstream_error';
    if (e && e.text) { const keys = unitKeys(job.unitId); e.text.split('\n').slice(0, -1).forEach(l => addLine(job.unitId, set, l, target, keys)); }
    set.status = set.items.length ? 'part' : 'idle';
    const apiMode = E.engine !== 'account';
    if (code === 'cancelled') { /* 멈춤 */ }
    else if (code === 'rate_limited' && apiMode && (job.retries || 0) < 4) {
      concBackoff();
      // API 키 방식: 잠깐 쉬었다가 저절로 이어서
      const sec = Math.min(90, Math.max(15, Math.round(e.retryAfter || 20 * Math.pow(2, job.retries || 0))));
      S.queue.unshift({ unitId: job.unitId, lv: job.lv, more: 0, fresh: false, retries: (job.retries || 0) + 1 }); set.status = 'queued';
      S.lastMsg = `${engineName()} 요청 한도에 걸려 ${sec}초 쉬었다가 이어서 만들어요. 만든 평어는 그대로 있어요.`;
      pauseAll('wait');
      clearTimeout(S.waitT); S.waitT = setTimeout(() => { if (S.paused === 'wait') { S.paused = null; S.lastMsg = ''; pump(); renderPane(); } }, sec * 1000);
    } else if ((code === 'upstream_error' || code === 'empty_completion') && apiMode && (job.retries || 0) < 3) {
      // 서버가 붐빔(529·5xx)·연결이 잠깐 끊김: 동시 요청을 줄이고 잠깐 쉬었다가 저절로 이어서
      concBackoff();
      const sec = [5, 15, 30][job.retries || 0];
      S.queue.unshift({ unitId: job.unitId, lv: job.lv, more: 0, fresh: false, retries: (job.retries || 0) + 1 }); set.status = 'queued';
      S.lastMsg = code === 'empty_completion' ? `${engineName()}가 빈 답을 보내서 ${sec}초 뒤 다시 만들어요. 만든 평어는 그대로 있어요.` : `${engineName()} 서버가 붐비거나 연결이 잠깐 끊겨서 ${sec}초 쉬었다가 이어서 만들어요. 만든 평어는 그대로 있어요.`;
      pauseAll('wait');
      clearTimeout(S.waitT); S.waitT = setTimeout(() => { if (S.paused === 'wait') { S.paused = null; S.lastMsg = ''; pump(); renderPane(); } }, sec * 1000);
    } else if (code === 'rate_limited' || code === 'session_expired' || code === 'quota') {
      S.queue.unshift({ unitId: job.unitId, lv: job.lv, more: 0, fresh: false }); set.status = 'queued';
      S.lastMsg = errMsg(code, e); pauseAll(code === 'session_expired' ? 'session' : 'limit');
    } else if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed', 'auth', 'bad_model', 'blocked', 'no_engine'].includes(code)) {
      S.lastMsg = errMsg(code, e); pauseAll('denied');
    } else {
      set.status = 'error'; set.err = errMsg(code, e);
      if (++S.consecutiveErr >= 3) { S.lastMsg = `오류가 이어져서 잠시 멈췄어요. 이어서 만들기를 눌러 다시 시작하세요. (마지막 오류: ${set.err})`; pauseAll('errors'); }
    }
  } finally {
    S.running.delete(key);
    set.items.forEach(x => { delete x.fresh; });
    if (planId && (set.items.length || set.saved)) { Store.saveSet(planId, key, set, sets); set.saved = 1; }
    if (planId !== S.planId) { set.pendingMore = 0; set.pendingFresh = false; pump(); return; }
    if (set.pendingMore || set.pendingFresh) {
      const more = set.pendingMore || 0, fresh = !!set.pendingFresh;
      set.pendingMore = 0; set.pendingFresh = false;
      if (!ctl.signal.aborted) enqueue(job.unitId, job.lv, { front: true, more, fresh }); // 멈추기를 눌렀으면 버림
    }
    renderUnitsSoon(); renderListSoon(job.unitId, job.lv, true);
    pump();
  }
}

/* ---------- 생성 상태(앱바) ---------- */
function totals() {
  let made = 0, target = 0, used = 0;
  for (const u of allUnits()) for (const l of LV) {
    const s = getSet(u.id, l.k); target += Math.max(N, s.want || N); made += Math.min(s.items.length, Math.max(N, s.want || N)); used += s.items.filter(x => x.d).length;
  }
  return { made, target, used };
}
function updateGen() {
  const pill = $('#genPill');
  if (!S.plan) { pill.hidden = true; return; }
  const { made, target } = totals();
  const active = S.running.size > 0 || (S.queue.length > 0 && !S.paused);
  const incomplete = made < target;
  pill.hidden = !(active || incomplete || S.paused);
  $('#genSpin').hidden = !active;
  $('#genMeter').style.width = (target ? Math.round(made / target * 100) : 0) + '%';
  const btn = $('#genBtn');
  if (active) { $('#genText').textContent = `평어 ${made.toLocaleString()} / ${target.toLocaleString()}`; btn.textContent = '멈추기'; btn.dataset.act = 'stop'; btn.className = 'btn'; }
  else if (S.paused === 'wait') { $('#genText').textContent = '잠시 쉬었다가 이어서 만드는 중'; btn.textContent = '멈추기'; btn.dataset.act = 'stop'; btn.className = 'btn'; }
  else if (S.paused === 'limit' || S.paused === 'session' || S.paused === 'errors') { $('#genText').textContent = S.paused === 'limit' ? '사용량 한도로 멈춤' : '잠시 멈춤'; btn.textContent = '이어서 만들기'; btn.dataset.act = 'resume'; btn.className = 'btn primary'; }
  else if (incomplete || S.paused === 'denied') { $('#genText').textContent = `평어 ${made.toLocaleString()} / ${target.toLocaleString()}`; btn.textContent = '평어 만들기'; btn.dataset.act = 'pick'; btn.className = 'btn primary'; }
  if ((btn.dataset.act === 'resume' || btn.dataset.act === 'pick') && !engineReady()) { btn.textContent = 'AI 설정하기'; btn.dataset.act = 'settings'; }
  btn.disabled = false;
  if (!active && !incomplete && !S.paused) pill.hidden = true;
}
$('#genBtn').addEventListener('click', () => {
  const act = $('#genBtn').dataset.act;
  if (act === 'stop') { clearTimeout(S.waitT); stopAll(); toast('멈췄어요. 만든 평어는 그대로 있어요.'); }
  else if (act === 'settings') openSettings();
  else if (act === 'pick') openGenPicker();
  else resumeGen();
});

/* ---------- 과목 골라 만들기 ---------- */
// 고른 과목의 평가요소마다 최상·상·중·하를 줄 세움 (fresh: 쓰지 않은 문장을 지우고 새로)
function enqueueSubjects(names, opt = {}) {
  if (!S.plan) return 0;
  const want = new Set(names);
  const units = S.plan.subjects.filter(s => want.has(s.name)).flatMap(s => s.units);
  for (const u of units) for (const l of LV) enqueue(u.id, l.k, opt.fresh ? { fresh: true } : {});
  if (S.unitId && units.some(u => u.id === S.unitId)) enqueueUnit(S.unitId, true);
  S.paused = null; S.consecutiveErr = 0; S.lastMsg = '';
  pump(); renderUnitsSoon(); renderPane();
  return units.length;
}
function resumeGen() {
  if (!engineReady()) { openSettings(); return; }
  const names = (S.genSubjects || []).filter(n => S.plan && S.plan.subjects.some(s => s.name === n));
  if (!names.length) { openGenPicker(); return; }
  enqueueSubjects(names); toast('평어를 이어서 만들어요.');
}
function openGenPicker() {
  if (!S.plan) return;
  if (!engineReady()) { S.autoStart = true; openSettings(); return; }
  const subs = S.plan.subjects;
  const pre = new Set(S.genSubjects && S.genSubjects.length ? S.genSubjects : [S.subject]);
  const row = s => {
    const st = subjStats(s);
    const pct = st.target ? Math.round(st.made / st.target * 100) : 0;
    return `<label class="pick"><input type="checkbox" data-pick="${esc(s.name)}" ${pre.has(s.name) ? 'checked' : ''}><b>${esc(s.name)}</b><span class="muted num">평가요소 ${s.units.length}개 · ${pct === 100 ? '다 만듦' : pct ? pct + '% 만듦' : '아직 없음'}</span></label>`;
  };
  openSheet(`<h3>어떤 과목의 평어를 만들까요?</h3>
    <div class="picks">
      <label class="pick all"><input type="checkbox" id="pickAll"><b>모두</b><span class="muted num">${subs.length}과목</span></label>
      ${subs.map(row).join('')}
    </div>
    <p class="muted" style="margin:0">고른 과목의 평가요소마다 최상·상·중·하 평어를 ${N}개씩 만들어요. 이미 만든 문장은 그대로 두고 모자란 만큼만 만들어요.</p>
    <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close>취소</button><button class="btn primary" type="button" id="pickGo">만들기</button></div>`,
    sh => {
      const boxes = [...sh.querySelectorAll('[data-pick]')], all = sh.querySelector('#pickAll'), go = sh.querySelector('#pickGo');
      const sync = () => {
        const n = boxes.filter(b => b.checked).length;
        all.checked = n === boxes.length; all.indeterminate = n > 0 && n < boxes.length;
        go.disabled = !n; go.textContent = n ? (n === boxes.length ? '모두 만들기' : `${n}과목 만들기`) : '과목을 골라 주세요';
      };
      all.addEventListener('change', () => { boxes.forEach(b => { b.checked = all.checked; }); sync(); });
      boxes.forEach(b => b.addEventListener('change', sync));
      go.addEventListener('click', () => {
        const names = boxes.filter(b => b.checked).map(b => b.dataset.pick);
        if (!names.length) return;
        S.genSubjects = names;
        closeSheet();
        const n = enqueueSubjects(names);
        toast(`${names.length === subs.length ? '모든 과목' : names.join('·')} 평가요소 ${n}개의 평어를 만들어요.`);
      });
      sync();
    });
}
// 과목 전체 다시 만들기
function confirmRegenSubject(name) {
  const s = S.plan && S.plan.subjects.find(x => x.name === name); if (!s) return;
  let used = 0;
  for (const u of s.units) for (const l of LV) used += getSet(u.id, l.k).items.filter(x => x.d).length;
  openSheet(`<h3>${esc(name)} 평어를 모두 다시 만들까요?</h3>
    <p class="muted" style="margin:0">평가요소 ${s.units.length}개의 최상·상·중·하 평어를 새로 만들어요. 쓰지 않은 문장은 지우고, 완료로 표시한 문장 ${used}개는 그대로 둬요.</p>
    <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close>취소</button><button class="btn primary" type="button" id="regenSubjGo">다시 만들기</button></div>`,
    sh => sh.querySelector('#regenSubjGo').addEventListener('click', async () => {
      closeSheet();
      if (!engineReady()) { openSettings(); return; }
      const ids = new Set(s.units.map(u => u.id));
      // 이 과목에서 만드는 중인 것은 멈추고 줄에서 뺌
      S.queue = S.queue.filter(j => !ids.has(j.unitId));
      S.running.forEach((r, key) => { if (ids.has(key.slice(0, key.lastIndexOf('_')))) r.ctl.abort(); });
      await new Promise(r => setTimeout(r, 120));
      for (const u of s.units) for (const l of LV) {
        const set = getSet(u.id, l.k);
        set.items = set.items.filter(x => x.d); set.want = N; set.status = 'idle'; set.err = '';
        if (S.planId) Store.saveSet(S.planId, setKey(u.id, l.k), set);
      }
      S.genSubjects = [...new Set([...(S.genSubjects || []), name])];
      enqueueSubjects([name], { fresh: true });
      toast(`${name} 평어를 다시 만들어요.`);
    }));
}

/* ---------- 그리기 ---------- */
let rUnitsT = null, rListPending = false;
function renderUnitsSoon() {
  if (rUnitsT) return;
  rUnitsT = setTimeout(() => { rUnitsT = null; renderNav(); renderUnits(); updateGen(); }, 250);
}
function renderListSoon(unitId, lv, force) {
  if (unitId !== S.unitId) { renderUnitsSoon(); return; }
  if (force) { renderPane(); return; }
  if (rListPending) return;
  rListPending = true;
  requestAnimationFrame(() => { rListPending = false; if (lv === S.lv) renderList(); renderTabs(); });
}
function subjStats(s) {
  let made = 0, target = 0, used = 0;
  for (const u of s.units) for (const l of LV) { const x = getSet(u.id, l.k); target += Math.max(N, x.want || N); made += Math.min(x.items.length, Math.max(N, x.want || N)); used += x.items.filter(i => i.d).length; }
  return { made, target, used };
}
function renderNav() {
  if (!S.plan) return;
  const subs = S.plan.subjects;
  $('#rail').innerHTML = `<div class="cap">과목</div>` + subs.map(s => {
    const st = subjStats(s);
    return `<button class="subj" type="button" data-subj="${esc(s.name)}" aria-current="${s.name === S.subject}">
      <b>${esc(s.name)}</b><small class="num">${s.units.length}개</small>
      <span class="bar"><i style="width:${st.target ? Math.round(st.made / st.target * 100) : 0}%"></i></span></button>`;
  }).join('');
  $('#chips').innerHTML = subs.map(s => `<button type="button" data-subj="${esc(s.name)}" aria-current="${s.name === S.subject}">${esc(s.name)}<small class="num">${s.units.length}</small></button>`).join('');
}
function unitDots(u) {
  return LV.map(l => {
    const s = getSet(u.id, l.k);
    const used = s.items.filter(x => x.d).length;
    const cls = s.status === 'running' ? 'run' : s.status === 'error' ? 'err' : s.items.length >= (s.want || N) ? 'done' : s.items.length ? 'part' : '';
    return `<span class="dot ${l.cls} ${cls}" title="${l.name} ${s.items.length}개 · 사용 ${used}개"><i></i>${l.name}${used ? `<span class="num">·${used}</span>` : ''}</span>`;
  }).join('');
}
function renderUnits() {
  const box = $('#units');
  const s = S.plan && S.plan.subjects.find(x => x.name === S.subject);
  if (!s) { box.innerHTML = ''; return; }
  const st = subjStats(s);
  box.innerHTML = `<div class="head"><h2>${esc(s.name)}</h2><span class="muted num">사용 ${st.used}개</span></div>
    <div class="subj-acts"><button class="btn tiny" type="button" data-act="regenSubj" title="이 과목의 평어를 모두 새로 만들어요">${ICON.redo}${esc(s.name)} 전체 다시 만들기</button></div>` +
    s.units.map(u => `<button class="unit" type="button" data-unit="${esc(u.id)}" aria-current="${u.id === S.unitId}">
      <span class="meta">${u.period ? `<span class="chip">${esc(u.period)}</span>` : ''}${u.area ? `<span class="chip area">${esc(u.area)}</span>` : ''}</span>
      <h3>${esc(u.elem || u.unit || firstCode(u.std) || '평가요소')}</h3>
      ${u.unit && u.elem ? `<span class="sub">${esc(u.unit)}</span>` : ''}
      <span class="dots">${unitDots(u)}</span>
    </button>`).join('');
}
const firstCode = s => (String(s || '').match(/\[[^\]]+\]/) || [''])[0];

function renderTabs() {
  const el = $('#lvTabs'); if (!el) return;
  const u = unitById(S.unitId); if (!u) return;
  el.innerHTML = LV.map(l => {
    const s = getSet(u.id, l.k); const used = s.items.filter(x => x.d).length;
    return `<button class="tab ${l.cls}" role="tab" type="button" data-lv="${l.k}" aria-selected="${l.k === S.lv}"><span class="sw"></span>${l.name}<span class="ct num">${s.status === 'running' ? '만드는 중 ' : ''}${used}/${s.items.length}</span></button>`;
  }).join('');
}
function renderPane() {
  const pane = $('#pane');
  const u = unitById(S.unitId);
  if (!S.plan) { pane.innerHTML = ''; return; }
  if (!u) { pane.innerHTML = `<div class="empty"><h3>평가요소를 골라 주세요</h3><p>왼쪽 목록에서 평가요소를 누르면 수준별 평어가 나와요.</p></div>`; return; }
  const noCrit = !u.crit.high && !u.crit.mid && !u.crit.low;
  const critRows = LV.filter(l => u.crit[l.k]).map(l => `<div class="${l.cls}"><span class="lvtag">${l.name}</span><span>${esc(u.crit[l.k])}</span></div>`).join('');
  const banner = S.paused && S.lastMsg ? `<div class="banner ${S.paused === 'denied' ? 'err' : S.paused === 'wait' ? 'info' : 'warn'}"><span class="grow">${esc(S.lastMsg)}</span>${S.paused === 'denied' ? (E.engine === 'account' && cap.perms ? `<button class="btn" type="button" data-act="perms">권한 설정</button>` : `<button class="btn" type="button" data-act="settings">평어 쓰는 방식</button>`) : S.paused === 'wait' ? '' : `<button class="btn" type="button" data-act="resume">이어서 만들기</button>`}</div>` : '';
  pane.innerHTML = `
    <div class="pane-head">
      <button class="btn text back" type="button" data-act="back">${ICON.back}평가요소 목록</button>
      <div class="row">${u.period ? `<span class="chip">${esc(u.period)}</span>` : ''}${u.area ? `<span class="chip area">${esc(u.area)}</span>` : ''}<span class="muted">${esc(u.subject)}${u.unit ? ' · ' + esc(u.unit) : ''}</span></div>
      <h2>${esc(u.elem || u.unit || '평가요소')}</h2>
    </div>
    ${banner}
    <div class="ai-row" data-ai-row="writing"></div>
    ${noCrit ? `<div class="banner warn"><span class="grow">이 평가요소에서는 평가기준(상·중·하)을 찾지 못했어요. 성취기준과 평가요소만으로 평어를 만들어요.</span></div>` : ''}
    <details class="info" id="infoBox" ${S.infoOpen ? 'open' : ''}>
      <summary>${ICON.chev}성취기준과 평가기준 보기</summary>
      <div class="info-body">
        <dl>
          ${u.std ? `<dt>성취기준</dt><dd>${esc(u.std)}</dd>` : ''}
          ${u.elem ? `<dt>평가요소</dt><dd>${esc(u.elem)}</dd>` : ''}
          ${u.focus ? `<dt>수업·평가 방법</dt><dd>${esc(u.focus)}</dd>` : ''}
        </dl>
        ${critRows ? `<div class="crit">${critRows}</div>` : ''}
      </div>
    </details>
    <div class="tabs" id="lvTabs" role="tablist" aria-label="수준"></div>
    <div class="tools">
      <div class="left"><label class="switch"><input type="checkbox" id="remainOnly" ${S.remainOnly ? 'checked' : ''}>안 쓴 문장만 보기</label></div>
      <div class="right">
        <button class="btn" type="button" data-act="copyAll">${ICON.copy}모두 복사</button>
        <button class="btn" type="button" data-act="more">${ICON.plus}10개 더</button>
        <button class="btn" type="button" data-act="regen">${ICON.redo}다시 만들기</button>
      </div>
    </div>
    <div id="listBox"></div>`;
  $('#infoBox').addEventListener('toggle', e => { S.infoOpen = e.target.open; });
  renderTabs();
  renderList();
}
function renderList() {
  const box = $('#listBox'); if (!box) return;
  const u = unitById(S.unitId); if (!u) return;
  const s = getSet(u.id, S.lv);
  const lvc = LV.find(l => l.k === S.lv).cls;
  const busy = s.status === 'running' || s.status === 'queued';
  let items = s.items.map((x, i) => ({ ...x, i }));
  if (S.remainOnly) items = items.filter(x => !x.d);
  const rows = items.map(x => `<li class="sent ${x.d ? 'done' : ''} ${x.fresh ? 'fresh' : ''}${rvOpen(x) ? ' rv-mark' : ''}" data-i="${x.i}" tabindex="0" role="button" aria-label="${x.d ? '사용함. ' : ''}${esc(x.t)} 복사">
      <span class="n"><span class="num-text">${x.i + 1}</span>${ICON.check}</span>
      <span class="t">${esc(x.t)}</span>
      <span class="side"><span class="len">${x.t.length}자</span><button class="icon-btn x" type="button" data-x="${x.i}" aria-label="이 문장 빼기" title="이 문장 빼기">${ICON.x}</button><button class="undo" type="button" data-undo="${x.i}">되돌리기</button></span>
    </li>${rvOpen(x) ? `<li class="rv-li">${rvInline(x, ['py', u.id, S.lv, x.i].map(encodeURIComponent).join(':'), `${x.i + 1}번 문장`)}</li>` : ''}`).join('');
  let tail = '';
  if (s.status === 'running') tail = `<li class="skel" aria-hidden="true"></li><li class="skel" aria-hidden="true"></li>`;
  else if (s.status === 'queued' && !s.items.length) tail = `<li class="skel" aria-hidden="true"></li><li class="skel" aria-hidden="true"></li><li class="skel" aria-hidden="true"></li>`;
  let head = '';
  if (!s.items.length && !busy) {
    if (!engineReady()) head = `<div class="empty"><h3>평어를 만들 AI를 정해 주세요</h3><p>${IN_VIEWER ? 'Claude 계정이나' : ''} Claude·Gemini·GPT·업스테이지 중 하나의 API 키를 넣으면 바로 만들어요. 키는 ${HERE}에만 저장돼요.</p>
      <button class="btn primary" type="button" data-act="settings">API 키 넣기</button></div>`;
    else head = `<div class="empty"><h3>${LVNAME[S.lv]} 수준 평어가 아직 없어요</h3><p>이 평가요소의 최상·상·중·하 평어를 50개씩 만들어요.</p>
      <button class="btn primary" type="button" data-act="genUnit">${ICON.spark}이 평가요소 평어 만들기</button></div>`;
  }
  if (s.status === 'error') head = `<div class="banner err"><span class="grow">${esc(s.err || SAMPLE_MSG.upstream_error)}</span><button class="btn" type="button" data-act="retry">다시 시도</button></div>` + head;
  if (busy) head = `<div class="muted" style="display:flex;gap:8px;align-items:center;padding:2px 2px 6px"><span class="spin"></span>${s.status === 'queued' ? '차례를 기다리는 중이에요' : `${LVNAME[S.lv]} 수준 평어를 쓰는 중이에요 · ${s.items.length}/${s.want || N}`}</div>` + head;
  head += (s.rvErr ? RV_FAIL_HTML : '') + rvBarHTML(s.items.filter(x => rvOpen(x)).length);
  if (S.remainOnly && s.items.length && !items.length) head += `<div class="empty"><h3>이 수준 문장을 모두 썼어요</h3><p>10개 더를 누르면 겹치지 않는 문장을 더 만들어요.</p></div>`;
  box.innerHTML = head + ((rows || tail) ? `<ul class="list ${lvc}">${rows}${tail}</ul>` : '');
  s.items.forEach(x => { delete x.fresh; });
}

function renderAll() {
  const has = !!S.plan, hk = S.mode === 'hk', gr = S.mode === 'gr', cc = S.mode === 'cc', other = hk || gr || cc;
  $('#hkView').hidden = !hk;
  $('#grView').hidden = !gr;
  $('#ccView').hidden = !cc;
  $('#importView').hidden = other || has;
  $('#planView').hidden = other || !has;
  $('#planTitle').textContent = cc ? '창의적 체험활동 · 공통 활동으로 학생별 특기사항 쓰기' : hk ? '행동특성 및 종합의견 · 메모로 글 완성하기' : gr ? '평가지 채점 · 스캔한 수행평가지로 수준과 평어 정하기' : has ? S.plan.title : '교과학습발달상황 · 평가계획으로 수준별 평어 만들기';
  if (has && !other) { renderNav(); renderUnits(); renderPane(); $('#planView').classList.toggle('show-pane', S.showPane); }
  updateGen();
}
function selectSubject(name) {
  S.subject = name;
  const s = S.plan.subjects.find(x => x.name === name);
  S.unitId = s && s.units[0] ? s.units[0].id : null;
  S.showPane = false;
  renderNav(); renderUnits(); renderPane(); $('#planView').classList.remove('show-pane');
  $('#units').scrollTop = 0;
}
function selectUnit(id) {
  S.unitId = id; S.showPane = true;
  $('#planView').classList.add('show-pane');
  renderUnits(); renderPane();
  $('#pane').scrollTop = 0;
  // 만드는 중이면, 이미 줄 서 있는 이 평가요소 작업만 앞으로 (새로 만들지는 않음)
  if (S.queue.some(j => j.unitId === id)) { S.queue = [...S.queue.filter(j => j.unitId === id), ...S.queue.filter(j => j.unitId !== id)]; pump(); }
}

/* ---------- 문장 누르기: 복사 + 완료 ---------- */
function fallbackCopy(t) {
  const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', '');
  ta.style.position = 'fixed'; ta.style.opacity = '0'; ta.style.top = '0';
  document.body.appendChild(ta); ta.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
  ta.remove(); return ok;
}
function copyText(t) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).then(() => true, () => fallbackCopy(t));
  } catch (e) {}
  return Promise.resolve(fallbackCopy(t));
}
function selectText(el) {
  try { const r = document.createRange(); r.selectNodeContents(el); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); } catch (e) {}
}
function pickSentence(li) {
  const i = +li.dataset.i; const s = getSet(S.unitId, S.lv); const x = s.items[i]; if (!x) return;
  const was = x.d;
  copyText(x.t).then(ok => {
    if (!ok) { selectText(li.querySelector('.t')); toast('자동 복사가 막혔어요. 선택된 문장을 Ctrl+C로 복사해 주세요.', 4000); return; }
    if (!was) { x.d = 1; Store.saveSet(S.planId, setKey(S.unitId, S.lv), s); renderList(); renderTabs(); renderUnitsSoon(); toast('복사했어요 · 완료로 표시했어요'); }
    else toast('다시 복사했어요');
  });
}
document.addEventListener('click', e => {
  const t = e.target;
  const menu = $('#menu');
  if (!menu.hidden && !t.closest('#menu') && !t.closest('#menuBtn')) menu.hidden = true;

  const subj = t.closest('[data-subj]'); if (subj) { selectSubject(subj.dataset.subj); return; }
  const unit = t.closest('[data-unit]'); if (unit) { selectUnit(unit.dataset.unit); return; }
  const tab = t.closest('#lvTabs [data-lv]'); if (tab) { S.lv = tab.dataset.lv; renderTabs(); renderList(); return; }
  const x = t.closest('[data-x]');
  if (x) { const s = getSet(S.unitId, S.lv); s.items.splice(+x.dataset.x, 1); Store.saveSet(S.planId, setKey(S.unitId, S.lv), s); renderList(); renderTabs(); renderUnitsSoon(); toast('문장을 뺐어요'); return; }
  const undo = t.closest('[data-undo]');
  if (undo) { const s = getSet(S.unitId, S.lv); const it = s.items[+undo.dataset.undo]; if (it) { it.d = 0; Store.saveSet(S.planId, setKey(S.unitId, S.lv), s); renderList(); renderTabs(); renderUnitsSoon(); toast('완료 표시를 지웠어요'); } return; }
  const li = t.closest('.pane .sent'); if (li) { pickSentence(li); return; }
  const act = t.closest('[data-act]'); if (act) doAct(act.dataset.act, act);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { $('#menu').hidden = true; if (!UPD.busy) closeSheet(); }
  const li = e.target.closest && e.target.closest('.pane .sent');
  if (li && e.target === li && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pickSentence(li); }
});
document.addEventListener('change', e => {
  if (e.target.id === 'remainOnly') { S.remainOnly = e.target.checked; renderList(); }
});
$('#menuBtn').addEventListener('click', () => { const m = $('#menu'); m.hidden = !m.hidden; });

function doAct(act, el) {
  const u = unitById(S.unitId);
  switch (act) {
    case 'back': S.showPane = false; $('#planView').classList.remove('show-pane'); break;
    case 'genUnit': if (u) { if (!engineReady()) { openSettings(); break; } enqueueUnit(u.id, true); S.paused = null; pump(); renderList(); } break;
    case 'retry': if (u) { enqueue(u.id, S.lv, { front: true }); S.paused = null; pump(); renderList(); } break;
    case 'more': if (u) { if (!engineReady()) { openSettings(); break; } enqueue(u.id, S.lv, { front: true, more: 10 }); S.paused = null; pump(); renderList(); renderTabs(); toast(`${LVNAME[S.lv]} 수준에 10개를 더 만들어요`); } break;
    case 'regen': if (u) confirmRegen(u); break;
    case 'copyAll': {
      const s = u && getSet(u.id, S.lv); if (!s || !s.items.length) { toast('복사할 문장이 없어요'); break; }
      const list = (S.remainOnly ? s.items.filter(x => !x.d) : s.items).map(x => x.t).join('\n');
      copyText(list).then(ok => toast(ok ? `${LVNAME[S.lv]} 수준 문장을 모두 복사했어요` : '복사가 막혔어요.'));
      break;
    }
    case 'resume': resumeGen(); break;
    case 'regenSubj': confirmRegenSubject(S.subject); break;
    case 'perms': if (cap.perms && cap.perms.manage) cap.perms.manage().catch(() => toast('권한 창을 열지 못했어요. 이 페이지의 권한 메뉴를 이용해 주세요.')); break;
    // 다른 평가 탭(단원평가·창체·평가지 채점)에서 눌러도 넣기 화면이 보이게 교과 평어로 감
    case 'new': $('#menu').hidden = true; S.plan = null; S.planId = null; stopAll(); setMode('pyeongeo'); noteEngine(); break;
    case 'plans': $('#menu').hidden = true; openPlans(); break;
    case 'settings': $('#menu').hidden = true; openSettings(); break;
    case 'keys': openSettings(); break;
    case 'uninstall': $('#menu').hidden = true; openUninstall(); break;
    case 'update': $('#menu').hidden = true; checkUpdate(true); break;
    case 'pronoun': $('#menu').hidden = true; openPronounSheet(false).catch(() => {}); break;
  }
}

/* ---------- 시트 ---------- */
function openSheet(html, bind) {
  $('#sheetRoot').innerHTML = `<div class="sheet-bg" id="sheetBg"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
  $('#sheetBg').addEventListener('click', e => { if (e.target.id === 'sheetBg' || e.target.closest('[data-close]')) closeSheet(); });
  bind && bind($('#sheetRoot .sheet'));
  const f = $('#sheetRoot button'); f && f.focus();
}
function closeSheet() { const had = !!$('#engSeg'); $('#sheetRoot').innerHTML = ''; if (had) closeSettingsHook(); }
function confirmRegen(u) {
  const s = getSet(u.id, S.lv);
  const n = s.items.filter(x => !x.d).length;
  openSheet(`<h3>${LVNAME[S.lv]} 수준 평어를 다시 만들까요?</h3>
    <p class="muted" style="margin:0">쓰지 않은 문장 ${n}개를 지우고 새 문장으로 채워요. 완료로 표시한 문장 ${s.items.length - n}개는 그대로 둬요.</p>
    <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close>취소</button><button class="btn primary" type="button" id="okRegen">다시 만들기</button></div>`,
    sh => sh.querySelector('#okRegen').addEventListener('click', () => {
      closeSheet(); if (!engineReady()) { openSettings(); return; }
      enqueue(u.id, S.lv, { front: true, fresh: true }); S.paused = null; pump(); renderList();
    }));
}
function openSettings() {
  const seg = (name, opts) => `<div class="seg" data-name="${name}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${S.settings[name] === v}">${l}</button>`).join('')}</div>`;
  const engines = [...(cap.sample ? [['account', 'Claude 계정']] : []), ['claude', 'Claude API'], ['gemini', 'Gemini API'], ['openai', 'GPT API'], ['upstage', '업스테이지 API']];
  openSheet(`<h3>평어 쓰는 방식</h3>
    <div class="opt"><span class="lab">평어를 만드는 AI</span>
      <div class="seg" id="engSeg">${engines.map(([v, l]) => `<button type="button" data-e="${v}" aria-pressed="${E.engine === v}">${l}</button>`).join('')}</div>
      <div id="engBody" class="keybox"></div>
    </div>
    <div class="opt"><span class="lab">문장 길이</span>${seg('len', [['auto', '평가기준 길이에 맞춤'], ['short', '짧게 (35~55자)'], ['long', '길게 (90~130자)']])}</div>
    <div class="opt"><span class="lab">문장 끝</span>${seg('ending', [['eum', '~함. (명사형)'], ['da', '~한다. (서술형)']])}<span class="muted">바꾼 방식은 앞으로 만드는 평어부터 적용돼요.</span></div>
    <div class="row" style="justify-content:flex-end"><button class="btn primary" type="button" data-close>닫기</button></div>`,
    sh => {
      sh.querySelectorAll('.seg[data-name]').forEach(g => g.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        S.settings[g.dataset.name] = b.dataset.v;
        g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
        Store.setPrefs({ current: S.planId, settings: S.settings });
      }));
      sh.querySelector('#engSeg').addEventListener('click', e => {
        const b = e.target.closest('[data-e]'); if (!b) return;
        E.engine = b.dataset.e; saveEngine();
        sh.querySelectorAll('#engSeg button').forEach(x => x.setAttribute('aria-pressed', x === b));
        if (S.paused === 'denied') { S.paused = null; S.lastMsg = ''; }
        drawEngine(sh); engineChanged();
      });
      drawEngine(sh);
    });
}
function engineChanged() {
  updateGen(); noteEngine();
  if (S.plan) renderPane();
  if (S.mode === 'hk') { HK.err = ''; hkPump(); }
  if (S.mode === 'gr') { GR.err = ''; renderGR(); }
}

/* ---------- 프로그램 삭제 (Windows 앱) ---------- */
if (IN_APP) { $('#menuUninstall').hidden = false; $('#menuSep').hidden = false; $('#menuUpdate').hidden = false; }

/* ---------- 자동 업데이트 (Windows 앱) ---------- */
const UPD = { busy: false, info: null, version: '' };
const UPD_SKIP = 'ssam:updSkip';
const fmtMB = n => n > 0 ? (n / 1048576).toFixed(1) + 'MB' : '';
const fmtDay = s => { const d = new Date(s); return isNaN(d) ? '' : d.toLocaleDateString('ko-KR'); };
// 바뀐 점(마크다운 조금): ### 제목, - 목록, **굵게**
function mdLite(text) {
  const inl = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
  let html = '', list = false;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    const li = line.match(/^[-*]\s+(.*)$/);
    if (li) { if (!list) { html += '<ul>'; list = true; } html += `<li${/^\s{2,}/.test(raw) ? ' class="sub"' : ''}>${inl(li[1])}</li>`; continue; }
    if (list) { html += '</ul>'; list = false; }
    if (!line) continue;
    const h = line.match(/^#{1,6}\s+(.*)$/);
    html += h ? `<h4>${inl(h[1])}</h4>` : `<p>${inl(line)}</p>`;
  }
  if (list) html += '</ul>';
  return html;
}
// 지금 평어·행특·채점을 만드는 중인지
function workBusy() {
  try {
    if (S.running.size || (S.queue.length && !S.paused)) return true;
    if (typeof HK !== 'undefined' && (HK.running.size || HK.queue.length)) return true;
    if (typeof GR !== 'undefined' && (GR.running.size || ['grading', 'ranking', 'writing'].includes(GR.phase))) return true;
  } catch (e) {}
  return false;
}
async function checkUpdate(manual) {
  const T = window.__TAURI__;
  if (!T || !T.core || UPD.busy) return;
  if (manual) toast('새 버전을 확인하고 있어요…');
  let info;
  try { info = await T.core.invoke('check_update'); }
  catch (e) { if (manual) toast('업데이트를 확인하지 못했어요: ' + String(e && (e.message || e)).slice(0, 120), 5000); return; }
  UPD.info = info;
  if (!info.available) {
    if (manual) toast(info.latest ? `최신 버전이에요 (${info.current})` : '아직 올라온 업데이트가 없어요');
    return;
  }
  const dot = $('#menuUpdate');
  if (dot && !dot.querySelector('.dot')) { dot.insertAdjacentHTML('beforeend', '<span class="dot"></span>'); dot.lastChild.previousSibling.textContent = `새 버전 ${info.latest} 설치`; }
  if (!manual) {
    let skip = null; try { skip = JSON.parse(localStorage.getItem(UPD_SKIP) || 'null'); } catch (e) {}
    if (skip && skip.v === info.latest && Date.now() < skip.until) return;
  }
  // 다른 창이 열려 있으면 닫힐 때까지 기다렸다가 알림
  const show = () => { if (UPD.busy) return; if ($('#sheetRoot').innerHTML) setTimeout(show, 5000); else openUpdate(info); };
  if (manual) openUpdate(info); else show();
}
function openUpdate(info) {
  const T = window.__TAURI__;
  const busy = workBusy();
  const meta = [`지금 ${esc(info.current)}`, fmtDay(info.published), fmtMB(info.size)].filter(Boolean).join(' · ');
  openSheet(`<h3>새 버전이 나왔어요 (${esc(info.latest)})</h3>
    <p class="muted" style="margin:0">${meta}</p>
    ${info.notes ? `<div class="upd-notes">${mdLite(info.notes)}</div>` : ''}
    ${busy ? '<div class="banner warn"><span class="grow">지금 만들고 있는 내용이 있어요. 업데이트하면 앱이 다시 켜지면서 하던 작업이 멈춰요. 끝난 뒤에 업데이트하는 것이 좋아요.</span></div>' : ''}
    <div class="upd-prog" id="updProg" hidden><div class="meter big"><i style="width:0"></i></div><span class="muted" id="updMsg"></span></div>
    <p class="muted" style="margin:0" id="updNote">받은 파일의 확인값(SHA-256)을 검사한 뒤 ${info.portable ? '이 실행 파일을 새 버전으로 바꿔요' : '설치해요'}. 끝나면 앱이 다시 켜져요. 저장된 API 키와 자료는 그대로 남아요.</p>
    <div class="row" style="justify-content:flex-end"><button class="btn" type="button" id="updLater">나중에</button><button class="btn primary" type="button" id="updGo">지금 업데이트</button></div>`,
    sh => {
      const bg = $('#sheetBg');
      // 받는 동안에는 바깥을 눌러도 닫히지 않게
      bg.addEventListener('click', e => { if (UPD.busy && (e.target === bg || e.target.closest('[data-close]'))) e.stopImmediatePropagation(); }, true);
      sh.querySelector('#updLater').addEventListener('click', () => {
        try { localStorage.setItem(UPD_SKIP, JSON.stringify({ v: info.latest, until: Date.now() + 864e5 })); } catch (e) {}
        closeSheet(); toast('오른쪽 위 메뉴(⋮)에서 언제든 업데이트할 수 있어요');
      });
      sh.querySelector('#updGo').addEventListener('click', () => runUpdate(sh, info));
    });
}
async function runUpdate(sh, info) {
  const T = window.__TAURI__;
  const go = sh.querySelector('#updGo'), later = sh.querySelector('#updLater');
  const prog = sh.querySelector('#updProg'), bar = prog.querySelector('.meter'), fill = bar.querySelector('i'), msg = sh.querySelector('#updMsg');
  UPD.busy = true; go.disabled = true; later.disabled = true; go.textContent = '업데이트하는 중…';
  prog.hidden = false; msg.textContent = '새 버전을 받는 중…';
  let un = null;
  try {
    if (T.event && T.event.listen) un = await T.event.listen('update-progress', ev => {
      const p = ev.payload || {};
      if (p.stage === 'download') {
        bar.classList.toggle('wait', !p.total);
        if (p.total) fill.style.width = Math.min(100, p.done / p.total * 100).toFixed(1) + '%';
        msg.textContent = p.total ? `새 버전을 받는 중… ${fmtMB(p.done)} / ${fmtMB(p.total)}` : `새 버전을 받는 중… ${fmtMB(p.done)}`;
      } else if (p.stage === 'verify') { bar.classList.remove('wait'); fill.style.width = '100%'; msg.textContent = '확인값(SHA-256)을 검사하는 중…'; }
      else if (p.stage === 'install') { msg.textContent = '확인값이 맞아요. 설치를 시작해요…'; }
    });
  } catch (e) {}
  try {
    await T.core.invoke('install_update');
    fill.style.width = '100%'; bar.classList.remove('wait');
    msg.textContent = info.portable ? '새 버전으로 바꿨어요. 앱이 곧 닫혔다가 새 버전으로 다시 켜져요.' : '설치 창이 열려요. 설치가 끝나면 앱이 새 버전으로 다시 켜져요.';
    msg.style.color = 'var(--ok)';
  } catch (e) {
    UPD.busy = false; go.disabled = false; later.disabled = false; go.textContent = '다시 시도';
    bar.classList.remove('wait'); fill.style.width = '0';
    msg.innerHTML = `<span style="color:var(--err)">${esc(String(e && (e.message || e)).slice(0, 200))}</span><br>안 되면 <a href="${esc(info.page)}" target="_blank" rel="noopener">릴리즈 페이지</a>에서 직접 내려받아 주세요.`;
  } finally { if (un) try { un(); } catch (e) {} }
}
if (IN_APP) {
  try {
    window.__TAURI__.core.invoke('app_version').then(v => { UPD.version = v; const el = $('#menuVer'); el.textContent = `쌤비서 ${v}`; el.hidden = false; }).catch(() => {});
  } catch (e) {}
  setTimeout(() => checkUpdate(false), 2500);
}
async function openUninstall() {
  const T = window.__TAURI__;
  if (!T || !T.core) return;
  let info = { installed: false, exePath: '' };
  try { info = await T.core.invoke('uninstall_info'); } catch (e) {}
  openSheet(`<h3>프로그램 삭제</h3>
    <p class="muted" style="margin:0">${info.installed
      ? '쌤비서를 이 컴퓨터에서 지워요. 삭제하기를 누르면 앱이 닫히고 Windows 제거 창이 열려요.'
      : '설치하지 않고 쓰는 실행 파일이에요. 삭제하기를 누르면 앱이 닫히고 탐색기에서 이 파일을 보여 줘요. 그 파일을 지우면 끝이에요.'}</p>
    <label class="switch"><input type="checkbox" id="unData" checked>저장된 API 키, 평가계획, 평어, 행특, 채점 기록도 지우기</label>
    ${!info.installed && info.exePath ? `<p class="muted mono" style="margin:0;word-break:break-all">${esc(info.exePath)}</p>` : ''}
    <p class="muted" style="margin:0">지운 내용은 되돌릴 수 없어요. 필요한 평어는 먼저 복사해 두세요.</p>
    <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close>취소</button><button class="btn danger" type="button" id="unGo">삭제하기</button></div>`,
    sh => sh.querySelector('#unGo').addEventListener('click', async ev => {
      const clearData = sh.querySelector('#unData').checked;
      ev.target.disabled = true; ev.target.textContent = '지우는 중…';
      // 만들던 것을 모두 멈추고, 곧 저장하려던 것도 취소
      try {
        stopAll(); clearTimeout(S.waitT);
        HK.queue = []; HK.running.forEach(c => c.abort()); clearTimeout(HK.waitT);
        grStop();
        Object.values(Store._lt || {}).forEach(clearTimeout); clearTimeout(HKStore.t); clearTimeout(GRStore.t);
      } catch (e) {}
      try {
        await T.core.invoke('run_uninstall', { clearData });
        // 삭제가 시작된 뒤에만 자료를 지움 (실패하면 자료는 그대로)
        if (clearData) { S.wiping = true; try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} }
      } catch (e) {
        ev.target.disabled = false; ev.target.textContent = '삭제하기';
        toast('지우지 못했어요: ' + String(e && (e.message || e)).slice(0, 120), 5000);
      }
    }));
}
function drawEngine(sh) {
  const box = sh.querySelector('#engBody');
  const p = E.engine;
  if (!p) { box.innerHTML = '<p class="muted">위에서 하나를 고르세요. API 키는 각 회사 사이트에서 받을 수 있어요.</p>'; return; }
  if (p === 'account') {
    box.innerHTML = `<p class="muted">claude.ai에 로그인한 선생님 계정으로 만들어요. 따로 키가 필요 없고 계정 사용량에서 차감돼요.</p>
      <span class="lab">만드는 속도</span>
      <div class="seg" data-name="tier"><button type="button" data-v="quick" aria-pressed="${S.settings.tier !== 'careful'}">빠르게</button><button type="button" data-v="careful" aria-pressed="${S.settings.tier === 'careful'}">꼼꼼하게 (느림)</button></div>`;
    box.querySelector('.seg').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      S.settings.tier = b.dataset.v;
      box.querySelectorAll('.seg button').forEach(x => x.setAttribute('aria-pressed', x === b));
      Store.setPrefs({ current: S.planId, settings: S.settings });
    });
    return;
  }
  const P = PROVIDERS[p];
  const known = P.models.some(m => m[0] === E.models[p]);
  box.innerHTML = `
    ${IN_VIEWER ? `<div class="banner warn"><span class="grow">claude.ai 안에서는 외부 API 호출이 막혀 있어요. API 키는 배포한 주소에서 열었을 때 쓰여요.${cap.sample ? " 여기서는 'Claude 계정'을 고르세요." : ''}</span></div>` : ''}
    <label class="lab" for="apiKey">${esc(P.name)} API 키</label>
    <div class="row"><input class="field mono" id="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="${esc(P.keyHint)}" value="${esc(E.keys[p])}"><button class="btn" type="button" id="keyShow">보기</button></div>
    <label class="lab" for="apiModel">모델</label>
    <div class="row">
      <select class="field" id="apiModel">${P.models.map(([v, l]) => `<option value="${esc(v)}" ${E.models[p] === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}<option value="__custom" ${known ? '' : 'selected'}>직접 입력</option></select>
      <input class="field mono" id="apiModelCustom" type="text" placeholder="모델 이름 (예: ${esc(P.models[0][0])})" value="${known ? '' : esc(E.models[p])}" ${known ? 'hidden' : ''}>
    </div>
    <label class="switch"><input type="checkbox" id="keyRemember" ${E.remember ? 'checked' : ''}>${HERE}에 키 기억하기</label>
    ${!IN_APP && /\.github\.io$/i.test(location.hostname) ? `<p class="muted" style="margin:0">웹판은 ${esc(location.hostname)} 주소를 같은 계정의 다른 웹페이지와 함께 써요. 함께 쓰는 PC에서는 키를 기억하지 않거나 Windows 앱을 쓰는 것이 안전해요.</p>` : ''}
    <div class="row"><button class="btn tonal" type="button" id="keyTest">연결 확인</button><span class="muted" id="keyMsg"></span></div>
    <p class="muted" style="margin:0">키 받는 곳: <a href="${esc(P.keyUrl)}" target="_blank" rel="noopener">${esc(P.keyHost)}</a><br>키는 ${HERE}에만 저장되고, 평어를 만들 때 ${esc(P.name)} 회사로만 보내져요. 사용 요금은 키 주인에게 청구돼요.</p>`;
  const key = box.querySelector('#apiKey');
  key.addEventListener('input', () => { E.keys[p] = key.value.trim(); saveEngine(); box.querySelector('#keyMsg').textContent = ''; updateGen(); });
  box.querySelector('#keyShow').addEventListener('click', e => { const on = key.type === 'password'; key.type = on ? 'text' : 'password'; e.target.textContent = on ? '숨기기' : '보기'; });
  const sel = box.querySelector('#apiModel'), custom = box.querySelector('#apiModelCustom');
  sel.addEventListener('change', () => {
    if (sel.value === '__custom') { custom.hidden = false; custom.focus(); if (custom.value.trim()) E.models[p] = custom.value.trim(); }
    else { custom.hidden = true; E.models[p] = sel.value; }
    saveEngine();
  });
  custom.addEventListener('input', () => { if (custom.value.trim()) { E.models[p] = custom.value.trim(); saveEngine(); } });
  box.querySelector('#keyRemember').addEventListener('change', e => { E.remember = e.target.checked; saveEngine(); });
  box.querySelector('#keyTest').addEventListener('click', async e => {
    const msg = box.querySelector('#keyMsg');
    if (!E.keys[p]) { msg.textContent = '키를 먼저 넣어 주세요.'; return; }
    e.target.disabled = true;
    msg.innerHTML = '<span style="display:inline-flex;gap:6px;align-items:center"><span class="spin"></span>확인하는 중…</span>';
    try {
      const r = await callApi(p, '다음 말만 그대로 답하세요: 연결 확인', {});
      msg.innerHTML = `<span style="color:var(--ok);font-weight:500">연결됐어요 · ${esc(E.models[p])}</span>`;
      if (S.paused === 'denied') { S.paused = null; S.lastMsg = ''; }
      engineChanged();
    } catch (err) {
      const prev = E.engine; E.engine = p;
      msg.innerHTML = `<span style="color:var(--err)">${esc(errMsg(err && err.code, err))}</span>`;
      E.engine = prev;
    } finally { e.target.disabled = false; }
  });
}
function closeSettingsHook() {
  engineChanged();
  if (S.autoStart && S.plan && engineReady()) { S.autoStart = false; setTimeout(openGenPicker, 0); }
}
async function openPlans() {
  openSheet(`<h3>저장된 평가계획</h3><div class="plans" id="plansList"><div class="skel"></div></div>
    <div class="row" style="justify-content:space-between"><button class="btn" type="button" data-act="new" data-close>${ICON.plus}새 평가계획 넣기</button><button class="btn primary" type="button" data-close>닫기</button></div>`);
  const list = await Store.listPlans();
  const box = $('#plansList'); if (!box) return;
  box.innerHTML = list.length ? list.map(p => `<div class="p"><div class="nm"><div>${esc(p.title)}</div><small class="num">평가요소 ${p.n}개 · ${p.createdAt ? new Date(p.createdAt).toLocaleDateString('ko-KR') : ''}</small></div>
      ${p.id === S.planId ? '<span class="chip area">지금 보는 계획</span>' : `<button class="btn" type="button" data-open="${esc(p.id)}">열기</button>`}
      <button class="icon-btn" type="button" data-del="${esc(p.id)}" aria-label="지우기" title="지우기">${ICON.x}</button></div>`).join('')
    : '<p class="muted">저장된 평가계획이 없어요.</p>';
  box.addEventListener('click', async e => {
    const o = e.target.closest('[data-open]'); if (o) { closeSheet(); await openPlan(o.dataset.open); return; }
    const d = e.target.closest('[data-del]');
    if (d) {
      const row = d.closest('.p');
      if (!row.dataset.armed) { row.dataset.armed = '1'; d.outerHTML = `<button class="btn" type="button" data-del="${esc(d.dataset.del)}" style="color:var(--err)">정말 지우기</button>`; return; }
      const id = d.dataset.del; row.remove();
      if (id === S.planId) { stopAll(); S.plan = null; S.planId = null; Store.setPrefs({ current: null, settings: S.settings }); renderAll(); }
      await Store.deletePlan(id); toast('평가계획을 지웠어요');
    }
  });
}
/* 예전에 넣은 평가계획에서 「▶ 2학기 국어 총 횟수: 3회」처럼 평가요소가 아닌 줄을 뺌 */
function prunePlan(plan) {
  const gone = [];
  plan.subjects = (plan.subjects || [])
    .map(s => ({ ...s, units: s.units.filter(u => isCountRow(u) ? (gone.push(u.id), false) : true) }))
    .filter(s => s.units.length);
  return gone;
}
const planUnitCount = b => (b.subjects || []).reduce((a, s) => a + s.units.filter(u => !isCountRow(u)).length, 0);
async function openPlan(id) {
  const plan = await Store.getPlan(id);
  if (!plan) { toast('평가계획을 불러오지 못했어요'); return; }
  stopAll();
  const gone = prunePlan(plan);
  if (gone.length) Store.savePlan(id, plan);
  S.plan = plan; S.planId = id; S.sets = await Store.loadSets(id);
  if (gone.length) Store.dropSets(id, gone, S.sets);
  const first = plan.subjects[0];
  S.subject = first ? first.name : null; S.unitId = first && first.units[0] ? first.units[0].id : null; S.lv = 'top'; S.showPane = false;
  Store.setPrefs({ current: id, settings: S.settings });
  renderAll();
}

/* ---------- 평가계획 넣기 ---------- */
const READ_MSG = {
  NOT_CFB: '한글 파일로 읽을 수 없어요. 파일이 .hwp 또는 .hwpx인지 확인해 주세요.',
  NOT_HWP: '한글 파일로 읽을 수 없어요. 파일이 .hwp 또는 .hwpx인지 확인해 주세요.',
  HWP_PASSWORD: '암호가 걸린 한글 파일이에요. 한글에서 암호를 풀고 다시 저장한 뒤 넣어 주세요.',
  HWP_DISTRIBUTION: '배포용 문서라 내용을 읽을 수 없어요. 한글에서 일반 문서로 다시 저장하거나, 표를 복사해 붙여넣어 주세요.',
  HWP_EMPTY: '파일 안에서 본문을 찾지 못했어요.',
  HWPX_EMPTY: '파일 안에서 본문을 찾지 못했어요.',
  NOT_ZIP: '파일 형식을 알아보지 못했어요.',
  PDF: 'PDF는 아직 읽지 못해요. 한글 파일(.hwp)을 넣거나, 표를 복사해 붙여넣어 주세요.',
  DOCX: '워드 파일은 아직 읽지 못해요. 한글 파일(.hwp)을 넣거나, 표를 복사해 붙여넣어 주세요.',
  INFLATE: '한글 파일의 압축된 내용을 풀지 못했어요. 파일이 손상됐을 수 있어요. 한글에서 다시 저장해 넣거나, 표를 복사해 붙여넣어 주세요.',
  NO_UNITS: '평가계획 표를 찾지 못했어요. 성취기준·평가요소·평가기준이 들어 있는 표인지 확인하거나, 표를 복사해 붙여넣어 주세요.'
};
function importNote(msg, kind) {
  const n = $('#importNote');
  if (!msg) { n.hidden = true; return; }
  n.className = 'banner ' + (kind || 'warn'); n.innerHTML = /class="grow"/.test(msg) ? msg : `<span class="grow">${msg}</span>`; n.hidden = false;
}
function noteEngine() {
  if (S.plan) return;
  if (engineReady()) { importNote(`<span class="grow">평어는 <b>${esc(engineName())}</b>(으)로 만들어요.</span><button class="btn" type="button" data-act="keys">바꾸기</button>`, 'info'); return; }
  importNote(`<span class="grow">평어를 만들려면 Claude·Gemini·GPT·업스테이지 중 하나의 API 키가 필요해요. 키는 ${HERE}에만 저장돼요.</span><button class="btn primary" type="button" data-act="keys">API 키 넣기</button>`, 'info');
}
const baseName = n => String(n || '').replace(/\.(hwpx?|txt|pdf|docx?)$/i, '').trim();
async function readBytes(u8, name, source) {
  const head = u8.subarray(0, 8);
  const isCFB = head[0] === 0xD0 && head[1] === 0xCF && head[2] === 0x11 && head[3] === 0xE0;
  const isZip = head[0] === 0x50 && head[1] === 0x4B;
  const isPDF = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46;
  const meta = { title: baseName(name) || '평가계획', source, grade: gradeFrom(name) };
  if (isPDF) throw new Error('PDF');
  if (isCFB) return buildPlan(await parseHWP(u8), meta);
  if (isZip) {
    const z = await unzip(u8);
    if (z.names.some(n => /^word\//.test(n))) throw new Error('DOCX');
    return buildPlan(await parseHWPX(u8, DOMParser), meta);
  }
  return planFromText(new TextDecoder().decode(u8), meta);
}
async function adoptPlan(plan) {
  const n = plan.subjects.reduce((a, s) => a + s.units.length, 0);
  if (!n) throw new Error('NO_UNITS');
  plan.createdAt = Date.now();
  const id = plan.createdAt.toString(36);
  stopAll();
  S.plan = plan; S.planId = id; S.sets = new Map(); S.paused = null;
  S.subject = plan.subjects[0].name; S.unitId = plan.subjects[0].units[0].id; S.lv = 'top'; S.showPane = false;
  importNote(null);
  renderAll();
  await storeReady;
  const fails = saveFails;
  await Store.savePlan(id, plan); Store.rememberLocal(id); Store.setPrefs({ current: id, settings: S.settings });
  const summary = plan.subjects.map(s => `${s.name} ${s.units.length}`).join(', ');
  // 저장하지 못했으면 「찾았어요」로 덮지 않음 (지금 화면에서는 쓸 수 있지만 다시 열면 없음)
  const lost = saveFails > fails ? `평가요소 ${n}개를 찾았지만 저장 공간이 모자라 저장하지 못했어요. 쓰지 않는 평가계획을 지워 주세요.` : '';
  if (cap.sample === undefined) { await capP.sample; settleEngine(); }
  if (engineReady()) toast(lost || `평가요소 ${n}개를 찾았어요 (${summary}). 오른쪽 위 「평어 만들기」를 눌러 과목을 골라 주세요.`, lost ? 8000 : 6000);
  else { S.autoStart = true; toast(lost || `평가요소 ${n}개를 찾았어요 (${summary}). 평어를 만들 API 키를 넣어 주세요.`, lost ? 8000 : 5000); openSettings(); }
}
function busyImport(on, text) {
  ['#srcDrive', '#srcFile', '#srcPaste', '#pasteGo'].forEach(s => { const b = $(s); if (b) b.disabled = on; });
  if (on) importNote(`<span style="display:inline-flex;gap:8px;align-items:center"><span class="spin"></span>${esc(text)}</span>`, 'info');
}
async function importFile(u8, name, source) {
  busyImport(true, '평가계획을 읽고 있어요…');
  try { const plan = await readBytes(u8, name, source); busyImport(false); await adoptPlan(plan); }
  catch (e) { busyImport(false); importNote(esc(READ_MSG[e && e.message] || ('파일을 읽지 못했어요. 표를 복사해 붙여넣어 보세요. (' + ((e && e.message) || '알 수 없는 오류') + ')')), 'err'); }
}

function pressSrc(id) {
  ['#srcDrive', '#srcFile', '#srcPaste'].forEach(s => $(s).setAttribute('aria-pressed', s === id));
  $('#drivePanel').hidden = id !== '#srcDrive';
  $('#pastePanel').hidden = id !== '#srcPaste';
}
$('#srcFile').addEventListener('click', () => { pressSrc('#srcFile'); $('#fileInput').click(); });
$('#fileInput').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0]; if (!f) return;
  const u8 = new Uint8Array(await f.arrayBuffer()); e.target.value = '';
  importFile(u8, f.name, '파일');
});
['dragenter', 'dragover'].forEach(ev => $('#importView').addEventListener(ev, e => { e.preventDefault(); $('#srcFile').classList.add('drop-on'); }));
['dragleave', 'drop'].forEach(ev => $('#importView').addEventListener(ev, e => { if (ev === 'dragleave' && e.target !== $('#importView')) return; $('#srcFile').classList.remove('drop-on'); }));
$('#importView').addEventListener('drop', async e => {
  e.preventDefault(); $('#srcFile').classList.remove('drop-on');
  const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (!f) return;
  importFile(new Uint8Array(await f.arrayBuffer()), f.name, '파일');
});
$('#srcPaste').addEventListener('click', () => { pressSrc('#srcPaste'); setTimeout(() => $('#pasteBox').focus(), 50); });
$('#pasteGo').addEventListener('click', async () => {
  const v = $('#pasteBox').value.trim(); if (!v) { toast('붙여넣은 내용이 없어요'); return; }
  try { await adoptPlan(planFromText(v, { title: '붙여넣은 평가계획', source: '붙여넣기', grade: gradeFrom(v) })); }
  catch (e) { importNote(esc(READ_MSG[e.message] || '내용을 읽지 못했어요.'), 'err'); }
});

/* ---------- 구글 드라이브 ---------- */
const DRIVE = 'Google Drive';
function driveErr(e) {
  const c = (e && e.code) || 'upstream_error';
  const m = {
    server_not_connected: 'Google Drive가 연결되어 있지 않아요. claude.ai 설정 → 커넥터에서 Google Drive를 추가한 뒤 다시 찾아 주세요.',
    needs_reauth: 'Google Drive 연결이 만료됐어요. claude.ai 설정 → 커넥터에서 Google Drive를 다시 연결해 주세요.',
    selection_required: 'Google Drive 연결이 여러 개예요. 화면에 뜬 선택 창에서 하나를 고른 뒤 다시 찾아 주세요.',
    not_in_manifest: '이 페이지에서 Google Drive 사용이 허용되지 않았어요. 권한 설정에서 허용하거나 파일 올리기를 이용해 주세요.',
    not_granted: '이 페이지에서 Google Drive를 쓸 수 없어요. 파일 올리기를 이용해 주세요.',
    capability_disabled: '이 화면에서는 Google Drive를 쓸 수 없어요. 파일 올리기를 이용해 주세요.',
    blocked_by_policy: '학교(조직) 설정 때문에 Google Drive를 쓸 수 없어요. 파일 올리기를 이용해 주세요.',
    approval_required: 'Google Drive 사용 승인이 필요해요. 다시 찾기를 누르고 뜨는 창에서 허용해 주세요.',
    server_unavailable: 'Google Drive가 잠시 응답하지 않아요. 잠시 뒤 다시 시도해 주세요.',
    tool_error: 'Google Drive가 요청을 처리하지 못했어요' + (e && e.message ? ': ' + e.message : '.')
  }[c];
  return m || ('Google Drive에서 가져오지 못했어요. 잠시 뒤 다시 시도해 주세요. (' + c + ')');
}
function driveMsg(html) { $('#driveMsg').innerHTML = html || ''; }
$('#srcDrive').addEventListener('click', async () => {
  pressSrc('#srcDrive');
  const mcp = cap.mcp === undefined ? await capP.mcp : cap.mcp;
  if (!mcp) { driveMsg('구글 드라이브는 claude.ai나 Claude 앱에서 이 페이지를 열었을 때만 쓸 수 있어요. 파일 올리기를 이용해 주세요.'); return; }
  if (!$('#driveList').children.length) driveSearch($('#driveQ').value);
});
$('#driveForm').addEventListener('submit', e => { e.preventDefault(); driveSearch($('#driveQ').value); });
const qEsc = w => w.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
async function driveSearch(q) {
  const mcp = cap.mcp === undefined ? await capP.mcp : cap.mcp;
  if (!mcp) { driveMsg('구글 드라이브는 claude.ai나 Claude 앱에서 이 페이지를 열었을 때만 쓸 수 있어요.'); return; }
  const words = String(q || '').trim().split(/\s+/).filter(Boolean).slice(0, 4);
  const titleQ = words.length ? words.map(w => `title contains '${qEsc(w)}'`).join(' and ') : `(title contains '평가계획' or title contains '평가 계획')`;
  const query = `${titleQ} and mimeType != 'application/vnd.google-apps.folder'`;
  driveMsg('<span style="display:inline-flex;gap:8px;align-items:center"><span class="spin"></span>드라이브에서 찾는 중…</span>');
  $('#driveList').innerHTML = '';
  try {
    const r = await mcp.callTool(DRIVE, 'search_files', { query, pageSize: 30, excludeContentSnippets: true });
    const p = r && r.payload;
    const files = (p && Array.isArray(p.files) ? p.files : []).slice()
      .sort((a, b) => String(b.modifiedTime || '').localeCompare(String(a.modifiedTime || '')));
    if (!files.length) { driveMsg('찾는 파일이 없어요. 다른 이름으로 찾아보세요.'); return; }
    driveMsg(`${files.length}개 파일을 찾았어요. 평가계획 파일을 누르세요.`);
    $('#driveList').innerHTML = files.map(f => {
      const ext = (f.fileExtension || (f.mimeType === 'application/vnd.google-apps.document' ? 'gdoc' : (f.title || '').split('.').pop() || '')).toLowerCase().slice(0, 5);
      const ok = /^(hwp|hwpx|gdoc|txt)$/.test(ext);
      const d = f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString('ko-KR') : '';
      return `<li><button type="button" data-file="${esc(f.id)}" data-name="${esc(f.title || '')}" data-mime="${esc(f.mimeType || '')}" ${ok ? '' : 'data-bad="1"'}>
        <span class="ft ${/hwp/.test(ext) ? 'hwp' : ''}">${esc(ext.toUpperCase() || '파일')}</span>
        <span class="nm"><div>${esc(f.title || '(제목 없음)')}</div><small class="num">${esc(d)}${ok ? '' : ' · 읽을 수 없는 형식'}</small></span></button></li>`;
    }).join('');
  } catch (e) { driveMsg(esc(driveErr(e)) + (e && e.code === 'not_in_manifest' && cap.perms ? ' <button class="btn" type="button" data-act="perms">권한 설정</button>' : '')); }
}
$('#driveList').addEventListener('click', async e => {
  const b = e.target.closest('[data-file]'); if (!b) return;
  if (b.dataset.bad) { driveMsg('이 형식은 읽지 못해요. 한글 파일(.hwp, .hwpx)을 골라 주세요.'); return; }
  const mcp = cap.mcp; if (!mcp) return;
  busyImport(true, `「${b.dataset.name}」을 드라이브에서 가져오는 중…`);
  try {
    const input = { fileId: b.dataset.file };
    if (b.dataset.mime === 'application/vnd.google-apps.document') input.exportMimeType = 'text/plain';
    const r = await mcp.callTool(DRIVE, 'download_file_content', input, { cache: false });
    const p = r && r.payload;
    const b64 = p && (p.content || p.data || p.base64);
    if (!b64 || typeof b64 !== 'string') throw { code: 'tool_error', message: '파일 내용을 받지 못했어요' };
    const bin = atob(b64.replace(/\s+/g, ''));
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    busyImport(false);
    await importFile(u8, b.dataset.name, '구글 드라이브');
  } catch (err) {
    busyImport(false);
    if (err && err.code) importNote(esc(driveErr(err)), 'err');
    else importNote(esc(READ_MSG[err && err.message] || '파일을 가져오지 못했어요.'), 'err');
  }
});

/* ---------- 시작 ---------- */
renderAll();
storeReady.then(async () => {
  const sn = $('#storeNote');
  if (sn) sn.textContent = Store.mode === 'db'
    ? '학생 이름이나 개인정보는 들어가지 않아요. 평가계획과 만든 평어는 선생님 Claude 계정에 저장돼요.'
    : `학생 이름이나 개인정보는 들어가지 않아요. 평가계획과 만든 평어, API 키는 ${HERE}에만 저장돼요. 다른 컴퓨터에서는 보이지 않아요.`;
  const prefs = await Store.getPrefs();
  if (prefs && prefs.settings) Object.assign(S.settings, prefs.settings);
  if (prefs && prefs.current && !S.plan) await openPlan(prefs.current);
  if (Store.mode === 'local' && !S.plan) { /* 브라우저 저장 */ }
});

/* ===== 학급 명단: 학생 수와 예외 번호(전출 등)를 창체·행특·평가지 채점이 같이 씀 ===== */
const CLASS = { count: 0, except: [], loaded: false };
// 명단에 있는 번호 (예외 번호는 나이스에도 칸이 없으므로 뺌)
function classNos() {
  const ex = new Set(CLASS.except), out = [];
  for (let n = 1; n <= CLASS.count; n++) if (!ex.has(n)) out.push(n);
  return out;
}
// 학생 수를 아직 정하지 않았으면 모두 보여 줌
const inClass = no => !CLASS.count || (no >= 1 && no <= CLASS.count && !CLASS.except.includes(no));
const parseNos = text => [...new Set((String(text || '').match(/\d+/g) || []).map(Number).filter(n => n >= 1 && n <= 99))].sort((a, b) => a - b);
// 받침이 있으면 a, 없으면 b (평어가/특기사항이)
const jo = (w, a, b) => { const c = String(w || '').slice(-1).charCodeAt(0) - 0xAC00; return c >= 0 && c < 11172 && c % 28 ? a : b; };

const ClassStore = {
  async load() {
    await storeReady;
    let b = null;
    if (Store.mode === 'db') { try { const s = await cap.db.doc(Store.base() + '/class').get(); b = s.exists ? s.data() : null; } catch (e) {} }
    else b = Store.lsGet('ssam:class', null);
    if (b) {
      CLASS.count = Math.max(0, Math.min(60, b.count | 0));
      CLASS.except = parseNos((b.except || []).join(','));
    } else {
      // 처음: 행특 학생 칸과 지난 채점의 예외 번호에서 가져옴
      await HKStore.ready;
      const nos = HK.students.map(s => s.no | 0).filter(n => n > 0);
      CLASS.count = nos.length ? Math.min(60, Math.max(...nos)) : 0;
      const g = Store.lsGet('ssam:grset', null);
      CLASS.except = parseNos(((g && g.except) || []).join(','));
      if (CLASS.count || CLASS.except.length) this.save();
    }
    CLASS.loaded = true;
    onClassChange('load');
  },
  save() {
    const body = { count: CLASS.count, except: CLASS.except, at: Date.now() };
    if (Store.mode === 'db') writeDoc(Store.base() + '/class', body);
    else if (Store.mode === 'local') Store.lsSet('ssam:class', body);
  }
};

function rosterHTML(note) {
  return `<div class="roster">
    <label class="ro-f"><span>학생 수</span><input class="field num sm" type="number" min="1" max="60" data-cls="count" value="${CLASS.count || ''}" placeholder="25" aria-label="학생 수"><span class="muted">명</span></label>
    <label class="ro-f"><span>예외 번호</span><input class="field sm ro-ex" data-cls="except" value="${esc(CLASS.except.join(', '))}" placeholder="예) 20" autocomplete="off" inputmode="numeric" aria-label="예외 번호"></label>
    <p class="muted ro-note">${note || '전출 등으로 나이스에 칸이 없는 번호는 예외 번호에 넣어요. 창체·행특·평가지 채점이 같은 명단을 써요.'}</p>
  </div>`;
}
/* 명단 바꾸기. from: 바꾼 곳 ('gr'이면 채점 화면이 이미 반영함) */
function setClass(count, except, from) {
  CLASS.count = Math.max(0, Math.min(60, count | 0));
  CLASS.except = parseNos(except.join(','));
  ClassStore.save();
  onClassChange(from);
}
function onClassChange(from) {
  // 다른 화면의 명단 칸도 맞춤 (지금 고치는 칸은 그대로)
  document.querySelectorAll('[data-cls]').forEach(el => {
    if (el === document.activeElement) return;
    el.value = el.dataset.cls === 'count' ? (CLASS.count || '') : CLASS.except.join(', ');
  });
  // 행특: 명단 번호의 학생 칸을 채움 (예외 번호 학생은 지우지 않고 숨김)
  if (hkSyncRoster() && S.mode === 'hk') renderHK();
  else if (S.mode === 'hk' && from !== 'load') renderHKList();
  // 평가지 채점: 예외 번호를 같이 씀 (채점을 시작하기 전이면 번호를 다시 매김)
  if (from !== 'gr' && (GR.settings.except || []).join(',') !== CLASS.except.join(',')) {
    GR.settings.except = CLASS.except.slice();
    if (GR.students.length && !GR.students.some(s => s.status === 'done' || s.text)) grRenumber();
    Store.lsSet('ssam:grset', GR.settings);
    if (S.mode === 'gr') renderGR();
  }
  if (S.mode === 'cc') renderCC();
}
document.addEventListener('change', e => {
  const t = e.target;
  if (!t.matches || !t.matches('[data-cls]')) return;
  if (t.dataset.cls === 'count') {
    const n = Math.max(0, Math.min(60, +t.value | 0));
    if (n === CLASS.count) return;
    setClass(n, CLASS.except, 'roster');
    toast(n ? `학생 ${n}명으로 정했어요${CLASS.except.length ? ` · ${CLASS.except.join(', ')}번 제외` : ''}` : '학생 수를 지웠어요');
  } else {
    const ex = parseNos(t.value);
    t.value = ex.join(', ');
    if (ex.join(',') === CLASS.except.join(',')) return;
    setClass(CLASS.count, ex, 'roster');
    toast(ex.length ? `${ex.join(', ')}번은 나이스에 칸이 없는 번호로 건너뛰어요` : '예외 번호를 지웠어요');
  }
});
storeReady.then(() => ClassStore.load());

/* ===== 행동특성 및 종합의견 ===== */
const HK = {
  settings: { unit: 'char', min: 300, max: 500, variants: 2, ending: 'eum', grade: 3 },
  students: [], sel: null, showEditor: false,
  queue: [], running: new Map(), err: '', loaded: false
};
const KW = ['성실함', '책임감 강함', '1인 1역 꾸준함', '친구를 잘 도와줌', '배려심 깊음', '모둠 활동 적극적', '규칙을 잘 지킴', '정리정돈 잘함',
  '발표에 자신감', '질문을 많이 함', '독서를 즐김', '꼼꼼함', '창의적인 생각', '리더십 있음', '밝고 긍정적', '교우 관계 원만',
  '감정 표현 솔직함', '끈기 있게 도전', '운동을 좋아함', '그림·만들기 소질', '차분함', '유머 감각', '집중하는 시간이 늘어남', '감정 조절 노력 중'];

/* 나이스 기준 세기: 한글 등 3바이트, 영문·숫자·공백 1바이트, 줄바꿈 2바이트 */
const enc8 = new TextEncoder();
function neisBytes(t) {
  let b = 0;
  for (const ch of String(t)) { if (ch === '\n') b += 2; else if (ch === '\r') continue; else b += enc8.encode(ch).length; }
  return b;
}
const charCount = t => [...String(t).replace(/\r/g, '')].length;
function measure(t) { return HK.settings.unit === 'byte' ? neisBytes(t) : charCount(t); }
function unitWord() { return HK.settings.unit === 'byte' ? '바이트' : '자'; }
function rangeOk(t) { const n = measure(t); return n >= HK.settings.min && n <= HK.settings.max; }
/* 글자 수 목표(바이트 기준이면 글자 수로 바꿔 줌) */
function charTarget() {
  const s = HK.settings;
  let lo = s.min, hi = s.max;
  if (s.unit === 'byte') { lo = Math.ceil(s.min / 2.4); hi = Math.floor(s.max / 2.6); }
  const pad = Math.round((hi - lo) * 0.15);
  return { lo, hi, tlo: Math.max(lo, lo + pad), thi: Math.max(lo + 10, hi - pad) };
}

/* ---------- 저장 ---------- */
const HKStore = {
  async load() {
    await storeReady;
    let b = null;
    if (Store.mode === 'db') { try { const s = await cap.db.doc(Store.base() + '/hk').get(); b = s.exists ? JSON.parse(JSON.stringify(s.data())) : null; } catch (e) {} }
    else b = Store.lsGet('ssam:hk', null);
    if (b) {
      if (b.settings) Object.assign(HK.settings, b.settings);
      if (Array.isArray(b.students)) HK.students = b.students;
    }
    HK.loaded = true;
  },
  save() {
    clearTimeout(this.t);
    this.t = setTimeout(() => this.write(), 500);
  },
  write() {
    this.t = null;
    const body = { settings: HK.settings, students: HK.students.map(s => ({ id: s.id, no: s.no, label: s.label || '', memo: s.memo || '', done: s.done ? 1 : 0, results: (s.results || []).slice(0, 4).map(itemOut), ...(s.rvErr ? { rvErr: 1 } : {}) })), at: Date.now() };
    if (Store.mode === 'db') writeDoc(Store.base() + '/hk', body);
    else if (Store.mode === 'local') Store.lsSet('ssam:hk', body);
  }
};

/* ---------- 학생 ---------- */
const hkId = () => Math.random().toString(36).slice(2, 9);
function hkStudent(id) { return HK.students.find(s => s.id === id); }
/* 학급 명단 번호의 학생 칸을 채움. 바뀌었으면 true */
function hkSyncRoster() {
  if (!CLASS.count) return false;
  const have = new Set(HK.students.map(s => s.no));
  let added = 0;
  for (const no of classNos()) if (!have.has(no)) { HK.students.push({ id: hkId(), no, label: '', memo: '', results: [], done: 0 }); added++; }
  if (!added) return false;
  HK.students.sort((a, b) => a.no - b.no);
  if (!HK.sel && HK.students[0]) HK.sel = HK.students[0].id;
  HKStore.save();
  return true;
}
const hkShown = () => HK.students.filter(s => inClass(s.no));
function hkMakeRoster(n) {
  n = Math.max(1, Math.min(60, n | 0));
  const have = new Set(HK.students.map(s => s.no));
  for (let i = 1; i <= n; i++) if (!have.has(i)) HK.students.push({ id: hkId(), no: i, label: '', memo: '', results: [], done: 0 });
  HK.students.sort((a, b) => a.no - b.no);
  if (!HK.sel && HK.students[0]) HK.sel = HK.students[0].id;
  HKStore.save();
}
function hkStatus(s) {
  if (HK.running.has(s.id)) return ['run', '쓰는 중'];
  if (HK.queue.includes(s.id)) return ['wait', '기다리는 중'];
  if (s.done) return ['done', '완료'];
  if (s.err) return ['err', '오류'];
  if (s.results && s.results.length) return ['has', '후보 ' + s.results.length];
  if (s.memo && s.memo.trim()) return ['memo', '메모 있음'];
  return ['', '메모 없음'];
}

/* ---------- 프롬프트 ---------- */
function hkEndRule() {
  return HK.settings.ending === 'da'
    ? "모든 문장은 '~한다.', '~할 수 있다.'처럼 '다.'로 끝냅니다."
    : "모든 문장은 '~함.', '~임.', '~보임.', '~할 수 있음.'처럼 명사형 종결어미와 마침표로 끝냅니다.";
}
function hkPrompt(s, count, others) {
  const t = charTarget();
  const grade = HK.settings.grade ? HK.settings.grade + '학년 ' : '';
  const byteNote = HK.settings.unit === 'byte' ? ` 나이스 기준 ${HK.settings.min}~${HK.settings.max}바이트 안에 들어가야 하므로 넘치지 않게 씁니다.` : '';
  return [
    `당신은 초등학교 학교생활기록부 '행동특성 및 종합의견'을 쓰는 경력 많은 담임교사입니다.`,
    `아래 교사 메모를 바탕으로 ${grade}학생의 행동특성 및 종합의견을 ${count}가지 써 주세요.`,
    ``,
    `[교사 메모]`,
    s.memo.trim(),
    ``,
    `[분량] 글 하나는 공백을 포함해 ${t.tlo}~${t.thi}자로 씁니다.${byteNote}`,
    ``,
    `[쓰기 규칙]`,
    `1. 글 하나는 줄바꿈 없는 한 문단입니다. 번호, 제목, 따옴표, 설명을 붙이지 않습니다.`,
    `2. ${hkEndRule()}`,
    `3. 학생 이름이나 '이 학생은', '○○는' 같은 주어를 쓰지 않습니다.`,
    `4. 메모의 특성이 드러나는 구체적인 학교생활 모습(수업 태도, 모둠 활동, 1인 1역, 교우 관계, 생활 습관 등)으로 풀어 씁니다. 메모에 없는 수상, 특정 사건, 숫자, 기관 이름은 지어내지 않습니다.`,
    `5. 장점은 구체적으로 쓰고, 고쳐 나갈 점은 단정하거나 부정적으로 쓰지 않고 노력하는 모습과 성장 가능성, 앞으로의 기대로 씁니다.`,
    `6. 학교 밖 대회 수상, 자격증·인증시험, 사교육, 부모의 직업이나 경제 형편은 쓰지 않습니다.`,
    `7. 상투적인 시작과 끝을 피하고, ${count > 1 ? '글마다 시작하는 말과 구성, 강조하는 특성의 순서를 서로 다르게 씁니다.' : '자연스럽게 이어지는 한 편의 글로 씁니다.'}`,
    `8. ${pronounRule()}`,
    others && others.length ? `\n[이미 쓴 글] 아래 글과 표현이 겹치지 않게 씁니다.\n${others.map(x => '- ' + x).join('\n')}` : null,
    ``,
    `[출력 형식] 글 ${count}개를 한 줄에 하나씩 출력합니다. 글과 글 사이는 줄바꿈 하나로 구분하고, 다른 말은 쓰지 않습니다.`
  ].filter(x => x != null).join('\n');
}
function hkFixPrompt(s, text, dir) {
  const t = charTarget();
  const now = charCount(text);
  const goal = dir === 'longer' ? `${Math.min(t.hi, now + Math.max(40, Math.round(now * 0.15)))}자 안팎` : dir === 'shorter' ? `${Math.max(t.lo, now - Math.max(40, Math.round(now * 0.15)))}자 안팎` : `${t.tlo}~${t.thi}자`;
  const how = (dir === 'longer' || (dir === 'fit' && measure(text) < HK.settings.min))
    ? '메모의 특성이 더 잘 드러나도록 학교생활 모습을 조금 더 풀어 쓰되, 메모에 없는 사실은 지어내지 않습니다.'
    : '겹치거나 덜 중요한 표현을 덜어 내되, 메모의 핵심 특성은 모두 남깁니다.';
  return [
    `아래 행동특성 및 종합의견을 공백 포함 ${goal}로 고쳐 써 주세요. 지금은 ${now}자입니다.`,
    how,
    `${hkEndRule()} ${pronounRule()} 줄바꿈 없는 한 문단으로, 고친 글만 출력합니다.`,
    ``,
    `[교사 메모]`, s.memo.trim(), ``, `[고칠 글]`, text
  ].join('\n');
}
function hkClean(line) {
  let t = String(line || '').trim().replace(/^\s*(?:\d{1,2}\s*[.)．:]|\(\d\)|[-•*·▪◦○●]|글\s*\d+\s*[:：.])\s*/, '').replace(/^["“'‘]+|["”'’]+$/g, '').trim();
  if (charCount(t) < 40) return null;
  return t;
}
/* 문장 단위로 잘라 최대치 맞추기(마지막 수단) */
function hkTrim(text) {
  if (measure(text) <= HK.settings.max) return text;
  const parts = text.match(/[^.!?。]+[.!?。]+\s*/g) || [text];
  while (parts.length > 1 && measure(parts.join('').trim()) > HK.settings.max) parts.pop();
  return parts.join('').trim();
}

/* ---------- 만들기 ---------- */
function hkEnqueue(id, front) {
  if (HK.running.has(id) || HK.queue.includes(id)) return;
  if (front) HK.queue.unshift(id); else HK.queue.push(id);
  hkPump();
}
function hkPump() {
  if (!HK.running.size && !HK.queue.length) HK.noReview = false; // 검토 실패로 멈춘 것은 그 차례에만
  if (HK.waitUntil && Date.now() < HK.waitUntil) { if (S.mode === 'hk') { renderHKList(); hkEditorSoft(); } return; }
  if (engineReady()) while (HK.running.size < conc() && HK.queue.length) hkRun(HK.queue.shift());
  if (S.mode === 'hk') { renderHKList(); hkEditorSoft(); }
}
/* 선생님이 메모나 결과를 고치는 중이면 편집 칸을 다시 그리지 않음 (커서·한글 입력이 끊기지 않게).
   손을 떼면(포커스가 나가면) 그때 다시 그림 */
const hkTyping = () => { const box = $('#hkEditor'), a = document.activeElement; return !!(box && a && box.contains(a) && /^(TEXTAREA|INPUT)$/.test(a.tagName)); };
function hkEditorSoft(id) {
  if (S.mode !== 'hk' || (id && id !== HK.sel)) return;
  if (hkTyping()) { HK.editorDirty = true; return; }
  renderHKEditor();
}
document.addEventListener('focusout', e => {
  const box = $('#hkEditor');
  if (!HK.editorDirty || !box || !box.contains(e.target)) return;
  setTimeout(() => { if (!hkTyping()) { HK.editorDirty = false; renderHKEditor(); } }, 0);
});
async function hkCall(prompt, signal) {
  const r = await generate(prompt, { signal, fresh: true, task: 'writing' });
  return r.text;
}
async function hkRun(id) {
  const s = hkStudent(id); if (!s || !s.memo.trim()) { hkPump(); return; }
  const ctl = new AbortController();
  HK.running.set(id, ctl); s.err = ''; HK.err = '';
  if (S.mode === 'hk') { renderHKList(); hkEditorSoft(id); }
  try {
    const want = HK.settings.variants;
    const keep = (s.results || []).filter(r => r.d);
    const text = await hkCall(hkPrompt(s, want, keep.map(r => r.t)), ctl.signal);
    let outs = text.split('\n').map(hkClean).filter(Boolean).slice(0, want);
    if (!outs.length) throw { code: 'empty_completion' };
    // 범위 밖이면 두 번까지 고쳐 쓰기
    const fixed = [];
    for (let t of outs) {
      for (let k = 0; k < 2 && !rangeOk(t); k++) {
        const r = await hkCall(hkFixPrompt(s, t, 'fit'), ctl.signal);
        const c = r.split('\n').map(hkClean).filter(Boolean).join(' ');
        if (c) t = c;
      }
      fixed.push(hkTrim(t));
    }
    s.results = [...keep, ...fixed.map(t => ({ t, d: 0 }))];
    s.rl = 0; concOk();
    // 검토 AI: 새 후보만 (메인 결과는 먼저 보여 줌)
    const fresh = s.results.filter(x => !keep.includes(x));
    if (!HK.noReview && fresh.length && RV() && RV().pick('writing', 'review')) {
      HKStore.save(); // 검토하는 동안 창을 닫아도 후보는 남게
      if (S.mode === 'hk') { renderHKList(); hkEditorSoft(id); }
      const r = await reviewSentences('hk', `[분량] ${HK.settings.min}~${HK.settings.max}${unitWord()}`, fresh.map(o => ({ o, f: 't' })), ctl.signal);
      if (r === 'fail') { HK.noReview = true; s.rvErr = 1; } else if (r === 'ok') delete s.rvErr;
    }
  } catch (e) {
    const code = (e && e.code) || 'upstream_error';
    if (code === 'rate_limited' && E.engine !== 'account' && (s.rl = (s.rl || 0) + 1) <= 4) {
      // API 키 방식: 한도에 걸리면 동시 요청을 줄이고 20초 뒤 저절로 이어서 (네 번까지)
      concBackoff();
      if (!HK.queue.includes(id)) HK.queue.unshift(id);
      HK.err = errMsg(code, e) + ' 20초 뒤 이어서 써요.';
      HK.waitUntil = Date.now() + 20000;
      clearTimeout(HK.waitT); HK.waitT = setTimeout(() => { HK.waitUntil = 0; HK.err = ''; hkPump(); }, 20000);
    } else if (code !== 'cancelled') {
      s.rl = 0;
      s.err = errMsg(code, e);
      if (['not_granted', 'sampling_disabled', 'auth', 'bad_model', 'blocked', 'no_engine', 'quota', 'rate_limited', 'session_expired'].includes(code)) {
        HK.err = s.err; HK.queue = [];
      }
    }
  } finally {
    HK.running.delete(id);
    HKStore.save();
    hkPump();
  }
}
async function hkAdjust(id, idx, dir) {
  const s = hkStudent(id); const r = s && s.results[idx]; if (!r) return;
  if (!engineReady()) { openSettings(); return; }
  r.busy = 1; renderHKEditor();
  try {
    const out = await hkCall(hkFixPrompt(s, r.t, dir));
    const c = out.split('\n').map(hkClean).filter(Boolean).join(' ');
    if (c) { r.t = dir === 'longer' ? c : hkTrim(c); r.d = 0; delete r.rv; }
    toast(dir === 'longer' ? '조금 길게 고쳤어요' : '조금 짧게 고쳤어요');
  } catch (e) { toast(errMsg((e && e.code) || 'upstream_error', e), 4500); }
  finally { delete r.busy; HKStore.save(); renderHKEditor(); renderHKList(); }
}

function hkCountLabel(t) {
  const n = measure(t);
  const diff = n < HK.settings.min ? `${(HK.settings.min - n).toLocaleString()}${unitWord()} 모자람` : n > HK.settings.max ? `${(n - HK.settings.max).toLocaleString()}${unitWord()} 넘침` : '범위 안';
  return `${charCount(t).toLocaleString()}자 · ${neisBytes(t).toLocaleString()}바이트 · ${diff}`;
}
/* ---------- 그리기 ---------- */
function renderHK() {
  if (S.mode !== 'hk') return;
  renderHKSettings(); renderHKList(); renderHKEditor();
}
function renderHKSettings() {
  const s = HK.settings;
  const box = $('#hkSet'); if (!box) return;
  const active = document.activeElement && box.contains(document.activeElement) ? document.activeElement.id : null;
  box.innerHTML = `<div class="ai-row" data-ai-row="writing"></div>
    <div class="hk-opt"><span class="lab">분량 기준</span>
      <div class="seg" data-hkset="unit"><button type="button" data-v="char" aria-pressed="${s.unit === 'char'}">글자 수</button><button type="button" data-v="byte" aria-pressed="${s.unit === 'byte'}">나이스 바이트</button></div></div>
    <div class="hk-opt"><span class="lab">분량</span>
      <div class="row nowrap"><input class="field num sm" id="hkMin" type="number" min="20" step="10" value="${s.min}" aria-label="최소"><span class="muted">${unitWord()} 이상</span>
      <input class="field num sm" id="hkMax" type="number" min="40" step="10" value="${s.max}" aria-label="최대"><span class="muted">${unitWord()} 이하</span></div></div>
    <div class="hk-opt"><span class="lab">후보</span>
      <div class="seg" data-hkset="variants">${[1, 2, 3].map(n => `<button type="button" data-v="${n}" aria-pressed="${s.variants === n}">${n}개</button>`).join('')}</div></div>
    <div class="hk-opt"><span class="lab">문장 끝</span>
      <div class="seg" data-hkset="ending"><button type="button" data-v="eum" aria-pressed="${s.ending !== 'da'}">~함.</button><button type="button" data-v="da" aria-pressed="${s.ending === 'da'}">~한다.</button></div></div>
    <div class="hk-opt hk-roster"><span class="lab">학급 명단 <span class="muted">· 창체·평가지 채점과 같이 씀</span></span>${rosterHTML(' ')}</div>
    <div class="hk-opt"><span class="lab">학년</span>
      <select class="field sm" id="hkGrade">${[1, 2, 3, 4, 5, 6].map(g => `<option value="${g}" ${s.grade === g ? 'selected' : ''}>${g}학년</option>`).join('')}</select></div>
    <p class="muted hk-note">${s.unit === 'byte' ? '나이스 바이트: 한글 3바이트, 영문·숫자·공백 1바이트, 줄바꿈 2바이트로 셉니다.' : '공백을 포함한 글자 수로 셉니다.'} 범위를 벗어나면 저절로 다시 고쳐 써요.</p>`;
  if (active) { const el = document.getElementById(active); el && el.focus(); }
}
function renderHKList() {
  const box = $('#hkList'); if (!box) return;
  if (!HK.students.length) {
    box.innerHTML = `<div class="empty"><h3>학생 칸을 만들어 주세요</h3><p>학생 수를 넣으면 번호별 칸이 생겨요. 이름 대신 번호로 관리해요.</p>
      <div class="row" style="justify-content:center"><input class="field num sm" id="hkCount" type="number" min="1" max="60" value="25" aria-label="학생 수"><button class="btn primary" type="button" data-hk="roster">칸 만들기</button></div></div>`;
    return;
  }
  const shown = hkShown();
  const doneN = shown.filter(s => s.done).length;
  const memoN = shown.filter(s => s.memo && s.memo.trim()).length;
  box.innerHTML = `<div class="head"><h2>학생</h2><span class="muted num">완료 ${doneN} / ${shown.length}</span></div>
    <div class="row"><button class="btn primary" type="button" data-hk="all" ${memoN ? '' : 'disabled'}>메모 있는 학생 모두 만들기</button><button class="btn" type="button" data-hk="bulk">한꺼번에 넣기</button></div>
    ${HK.err ? `<div class="banner err"><span class="grow">${esc(HK.err)}</span><button class="btn" type="button" data-act="settings">평어 쓰는 방식</button></div>` : ''}
    <ul class="hk-students">${shown.map(s => {
      const [k, label] = hkStatus(s);
      return `<li><button type="button" class="hk-stu ${k}" data-hkstu="${esc(s.id)}" aria-current="${s.id === HK.sel}">
        <span class="no num">${s.no}</span>
        <span class="mid"><b>${esc(s.label || s.no + '번')}</b><small>${esc((s.memo || '').trim().slice(0, 40) || '메모를 넣어 주세요')}</small></span>
        <span class="st">${k === 'run' || k === 'wait' ? '<span class="spin"></span>' : k === 'done' ? ICON.check : ''}${label}</span></button></li>`;
    }).join('')}</ul>
    <div class="row" style="justify-content:space-between"><button class="btn text" type="button" data-hk="addOne">${ICON.plus}학생 더하기</button><span class="row"><button class="btn" type="button" data-hk="copyAll">${ICON.copy}완료한 글 모두 복사</button><button class="btn text" type="button" data-hk="reset" style="color:var(--err)">새로 시작</button></span></div>`;
}
function renderHKEditor() {
  const box = $('#hkEditor'); if (!box) return;
  const s = hkStudent(HK.sel);
  if (!s) { box.innerHTML = HK.students.length ? `<div class="empty"><h3>학생을 골라 주세요</h3></div>` : ''; return; }
  const busy = HK.running.has(s.id) || HK.queue.includes(s.id);
  const memoFocused = document.activeElement && document.activeElement.id === 'hkMemo';
  const labelFocused = document.activeElement && document.activeElement.id === 'hkLabel';
  const res = (s.results || []).map((r, i) => {
    const cur = r.draft != null ? r.draft : r.t;
    const ok = rangeOk(cur);
    return `<div class="hk-res ${r.d ? 'done' : ''}${rvOpen(r) ? ' rv-mark' : ''}" data-ri="${i}">
      ${r.edit ? `<textarea class="field hk-edit" data-edit="${i}" rows="7">${esc(cur)}</textarea>`
        : `<div class="hk-text" role="button" tabindex="0" data-pick="${i}" aria-label="${r.d ? '사용함. ' : ''}눌러서 복사">${r.d ? ICON.check : ''}${esc(r.t)}</div>`}
      <div class="hk-meta">
        <span class="cnt ${ok ? 'ok' : 'warn'} num">${hkCountLabel(cur)}</span>
        <span class="right">
          ${r.busy ? '<span class="spin"></span>' : ''}
          <button class="btn" type="button" data-hkr="edit" data-i="${i}">${r.edit ? '고친 내용 저장' : '고치기'}</button>
          <button class="btn" type="button" data-hkr="longer" data-i="${i}" ${r.busy ? 'disabled' : ''}>조금 길게</button>
          <button class="btn" type="button" data-hkr="shorter" data-i="${i}" ${r.busy ? 'disabled' : ''}>조금 짧게</button>
          <button class="icon-btn" type="button" data-hkr="del" data-i="${i}" aria-label="이 글 지우기" title="이 글 지우기">${ICON.x}</button>
        </span>
      </div>
      ${r.edit ? '' : rvInline(r, ['hk', s.id, i].map(encodeURIComponent).join(':'), `후보 ${i + 1}`)}
    </div>`;
  }).join('');
  box.innerHTML = `
    <button class="btn text back" type="button" data-hk="back">${ICON.back}학생 목록</button>
    <div class="hk-top"><span class="badge num">${s.no}</span>
      <input class="field" id="hkLabel" value="${esc(s.label || '')}" placeholder="${s.no}번 · 별칭 (이름은 쓰지 마세요)" autocomplete="off">
      ${s.done ? `<span class="chip done">${ICON.check}완료</span>` : ''}</div>
    <label class="lab" for="hkMemo">교사 메모 · 단어나 짧은 문장</label>
    <textarea class="field" id="hkMemo" rows="4" placeholder="예) 1인 1역(우유 당번) 한 학기 동안 성실, 친구가 다치면 먼저 도와줌, 발표할 때 목소리가 작았는데 2학기에 자신감 생김, 수학 문제를 끝까지 풀려고 함">${esc(s.memo || '')}</textarea>
    <div class="kw">${KW.map(k => `<button type="button" class="kwc" data-kw="${esc(k)}">${esc(k)}</button>`).join('')}</div>
    <div class="row">
      <button class="btn primary" type="button" data-hk="gen" ${busy ? 'disabled' : ''}>${busy ? '<span class="spin"></span>쓰는 중' : ICON.spark + (s.results && s.results.length ? '새 후보 만들기' : '행특 만들기')}</button>
      <span class="muted num">후보 ${HK.settings.variants}개 · ${HK.settings.min}~${HK.settings.max}${unitWord()}${engineReady() ? ' · ' + esc(engineName()) : ''}</span>
    </div>
    ${s.err ? `<div class="banner err"><span class="grow">${esc(s.err)}</span></div>` : ''}${s.rvErr ? RV_FAIL_HTML : ''}
    ${!engineReady() ? `<div class="banner info"><span class="grow">글을 만들 AI를 먼저 정해 주세요.</span><button class="btn primary" type="button" data-act="settings">API 키 넣기</button></div>` : ''}
    <div class="hk-results">${res || (busy ? '<div class="skel" style="height:120px"></div>' : '')}</div>
    ${res ? '<p class="muted">글을 누르면 복사되고 완료로 표시돼요. 마음에 드는 글만 쓰고 나머지는 지워도 돼요.</p>' : ''}`;
  if (memoFocused) { const m = $('#hkMemo'); m.focus(); m.selectionStart = m.selectionEnd = m.value.length; }
  if (labelFocused) $('#hkLabel').focus();
}

/* ---------- 이벤트 ---------- */
/* 쌤비서: 평가 화면이 숨겨져 있으면(다른 메뉴·단원평가 탭) 행특·채점 손잡이는 쉼 — 다른 화면의 data-pick 등을 잡지 않게 */
function evalShown() { const s = document.querySelector('section[data-menu="evaluate"]'); return !s || (!s.hidden && !s.classList.contains('ev-new')); }
document.addEventListener('click', e => {
  if (S.mode !== 'hk' || !evalShown()) return;
  const t = e.target;
  const stu = t.closest('[data-hkstu]');
  if (stu) { HK.sel = stu.dataset.hkstu; HK.showEditor = true; $('#hkView').classList.add('show-pane'); renderHKList(); renderHKEditor(); return; }
  const seg = t.closest('[data-hkset] button');
  if (seg) {
    const k = seg.closest('[data-hkset]').dataset.hkset;
    const v = k === 'variants' ? +seg.dataset.v : seg.dataset.v;
    if (k === 'unit' && v !== HK.settings.unit) {
      // 단위를 바꾸면 값도 대략 바꿔 줌
      if (v === 'byte') { HK.settings.min = Math.round(HK.settings.min * 2.5 / 10) * 10; HK.settings.max = Math.round(HK.settings.max * 3 / 10) * 10; }
      else { HK.settings.min = Math.round(HK.settings.min / 2.5 / 10) * 10; HK.settings.max = Math.round(HK.settings.max / 3 / 10) * 10; }
    }
    HK.settings[k] = v; HKStore.save(); renderHK(); return;
  }
  const kw = t.closest('[data-kw]');
  if (kw) {
    const s = hkStudent(HK.sel); if (!s) return;
    s.memo = (s.memo || '').trim(); s.memo = s.memo ? s.memo.replace(/[,，\s]*$/, '') + ', ' + kw.dataset.kw : kw.dataset.kw;
    HKStore.save(); renderHKEditor(); renderHKList(); return;
  }
  const pick = t.closest('[data-pick]');
  if (pick) {
    const s = hkStudent(HK.sel); const r = s && s.results[+pick.dataset.pick]; if (!r) return;
    copyText(r.t).then(ok => {
      if (!ok) { selectText(pick); toast('자동 복사가 막혔어요. 선택된 글을 Ctrl+C로 복사해 주세요.', 4000); return; }
      const was = r.d; r.d = 1; s.done = 1; HKStore.save(); renderHKEditor(); renderHKList();
      toast(was ? '다시 복사했어요' : `${s.no}번 행특을 복사했어요 · 완료로 표시했어요`);
    });
    return;
  }
  const rb = t.closest('[data-hkr]');
  if (rb) {
    const s = hkStudent(HK.sel); const i = +rb.dataset.i; const r = s && s.results[i]; if (!r) return;
    const a = rb.dataset.hkr;
    if (a === 'edit') {
      if (r.edit) { const v = r.draft != null ? r.draft : r.t, nt = v.replace(/\s*\n+\s*/g, ' ').trim(); if (nt !== r.t) delete r.rv; r.t = nt; delete r.draft; delete r.edit; HKStore.save(); renderHKList(); }
      else r.edit = 1;
      renderHKEditor(); if (r.edit) { const ta = document.querySelector(`[data-edit="${i}"]`); ta && ta.focus(); }
    } else if (a === 'del') { s.results.splice(i, 1); if (!s.results.some(x => x.d)) s.done = 0; HKStore.save(); renderHKEditor(); renderHKList(); }
    else hkAdjust(s.id, i, a);
    return;
  }
  const b = t.closest('[data-hk]'); if (!b) return;
  const act = b.dataset.hk;
  if (act === 'roster') { setClass(+$('#hkCount').value || 25, CLASS.except, 'hk'); renderHK(); }
  else if (act === 'addOne') {
    const n = Math.max(CLASS.count, 0, ...HK.students.map(s => s.no)) + 1;
    if (n > 60) { toast('60명까지 넣을 수 있어요'); return; }
    setClass(n, CLASS.except, 'hk');
    const s = HK.students.find(x => x.no === n); if (s) HK.sel = s.id;
    renderHK();
  }
  else if (act === 'back') { HK.showEditor = false; $('#hkView').classList.remove('show-pane'); }
  else if (act === 'gen') {
    const s = hkStudent(HK.sel); if (!s) return;
    if (!s.memo || !s.memo.trim()) { toast('메모를 먼저 넣어 주세요'); $('#hkMemo') && $('#hkMemo').focus(); return; }
    if (!engineReady()) { openSettings(); return; }
    s.results = (s.results || []).filter(r => r.d); HK.err = '';
    hkEnqueue(s.id, true);
  }
  else if (act === 'all') {
    if (!engineReady()) { openSettings(); return; }
    HK.err = '';
    const list = hkShown().filter(s => s.memo && s.memo.trim() && !(s.results && s.results.length));
    if (!list.length) { toast('새로 만들 학생이 없어요. 메모를 넣었거나 아직 글이 없는 학생만 만들어요.'); return; }
    list.forEach(s => hkEnqueue(s.id)); toast(`${list.length}명의 행특을 만들어요`);
  }
  else if (act === 'bulk') openHKBulk();
  else if (act === 'copyAll') {
    const lines = hkShown().filter(s => s.results && s.results.some(r => r.d)).map(s => `${s.no}\t${s.results.find(r => r.d).t}`);
    if (!lines.length) { toast('완료한 글이 아직 없어요'); return; }
    copyText(lines.join('\n')).then(ok => toast(ok ? `${lines.length}명의 글을 번호와 함께 복사했어요 (엑셀에 붙여넣기 좋아요)` : '복사가 막혔어요.', 3500));
  }
  else if (act === 'reset') {
    openSheet(`<h3>행특을 새로 시작할까요?</h3><p class="muted" style="margin:0">학생 ${HK.students.length}명의 메모와 만든 글을 모두 지워요. 되돌릴 수 없어요.</p>
      <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close>취소</button><button class="btn primary" type="button" id="hkResetOk">모두 지우기</button></div>`,
      sh => sh.querySelector('#hkResetOk').addEventListener('click', () => { HK.queue = []; HK.running.forEach(c => c.abort()); clearTimeout(HK.waitT); HK.waitUntil = 0; HK.students = []; HK.sel = null; HK.err = ''; HKStore.save(); closeSheet(); renderHK(); toast('지웠어요'); }));
  }
});
document.addEventListener('input', e => {
  if (S.mode !== 'hk' || !evalShown()) return;
  const s = hkStudent(HK.sel);
  if (e.target.id === 'hkMemo' && s) { s.memo = e.target.value; HKStore.save(); clearTimeout(HK.lt); HK.lt = setTimeout(renderHKList, 400); }
  const ed = e.target.closest && e.target.closest('[data-edit]');
  if (ed && s) {
    const r = s.results[+ed.dataset.edit];
    if (r) { r.draft = ed.value; const c = ed.closest('.hk-res').querySelector('.cnt'); c.textContent = hkCountLabel(r.draft); c.className = 'cnt num ' + (rangeOk(r.draft) ? 'ok' : 'warn'); }
  }
  if (e.target.id === 'hkLabel' && s) { s.label = e.target.value.trim(); HKStore.save(); clearTimeout(HK.lt); HK.lt = setTimeout(renderHKList, 400); }
});
document.addEventListener('change', e => {
  if (S.mode !== 'hk' || !evalShown()) return;
  const id = e.target.id;
  if (id === 'hkMin' || id === 'hkMax') {
    let mn = Math.max(20, +$('#hkMin').value || 0), mx = Math.max(40, +$('#hkMax').value || 0);
    if (mn >= mx) { if (id === 'hkMin') mx = mn + 50; else mn = Math.max(20, mx - 50); }
    HK.settings.min = mn; HK.settings.max = mx; HKStore.save(); renderHK();
  }
  if (id === 'hkGrade') { HK.settings.grade = +e.target.value; HKStore.save(); }
});
document.addEventListener('keydown', e => {
  if (S.mode !== 'hk' || !evalShown()) return;
  const p = e.target.closest && e.target.closest('[data-pick]');
  if (p && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); p.click(); }
});
function openHKBulk() {
  openSheet(`<h3>메모 한꺼번에 넣기</h3>
    <p class="muted" style="margin:0">한 줄에 학생 한 명씩 넣어요. 줄 앞에 번호를 쓰면 그 번호 학생에게, 번호가 없으면 차례대로 들어가요. 엑셀에서 번호 칸과 메모 칸을 함께 복사해 붙여넣어도 돼요.</p>
    <textarea class="field" id="hkBulkBox" rows="10" placeholder="1 성실함, 1인 1역 꾸준함, 발표 자신감 생김&#10;2 친구를 잘 도와줌, 정리정돈 잘함&#10;3	독서를 즐김, 질문을 많이 함"></textarea>
    <label class="switch"><input type="checkbox" id="hkBulkOver" checked>이미 있는 메모는 새 메모로 바꾸기</label>
    <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close>취소</button><button class="btn primary" type="button" id="hkBulkOk">넣기</button></div>`,
    sh => sh.querySelector('#hkBulkOk').addEventListener('click', () => {
      const over = sh.querySelector('#hkBulkOver').checked;
      const lines = sh.querySelector('#hkBulkBox').value.split('\n').map(l => l.trim()).filter(Boolean);
      let next = 1, n = 0;
      for (const l of lines) {
        const m = l.match(/^(\d{1,2})\s*(?:번)?[\s\t.)\-:]+(.+)$/);
        const no = m ? +m[1] : next; const memo = (m ? m[2] : l).trim();
        next = no + 1;
        let s = HK.students.find(x => x.no === no);
        if (!s) { s = { id: hkId(), no, label: '', memo: '', results: [], done: 0 }; HK.students.push(s); }
        s.memo = over || !s.memo ? memo : s.memo + ', ' + memo; n++;
      }
      HK.students.sort((a, b) => a.no - b.no);
      if (!HK.sel && HK.students[0]) HK.sel = HK.students[0].id;
      HKStore.save(); closeSheet(); renderHK(); toast(`${n}명의 메모를 넣었어요`);
    }));
}

/* ---------- 탭 바꾸기 ---------- */
function setMode(m) {
  S.mode = m;
  try { localStorage.setItem('ssam:mode', m); } catch (e) {}
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-selected', b.dataset.mode === m));
  renderAll();
  if (m === 'hk') { if (!HK.sel && HK.students[0]) HK.sel = HK.students[0].id; renderHK(); }
  if (m === 'gr' && typeof renderGR === 'function') renderGR();
  if (m === 'cc') renderCC();
  modeHooks.forEach(fn => { try { fn(m); } catch (e) {} });
}
document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
HKStore.ready = HKStore.load().then(() => { if (S.mode === 'hk') { if (!HK.sel && HK.students[0]) HK.sel = HK.students[0].id; renderHK(); } });


/* ===== 평가지 채점: 스캔 → 학생별로 나누기 → 이름 가리기 → 채점 → 비율대로 수준 → 평어 ===== */
const GR = {
  id: null, title: '', unitId: '', criteria: '', critImgs: [], critDocs: [], createdAt: 0,
  // critDocs: 한글 정답표에서 읽은 글 [{ name, text }]
  pages: [],          // [{ name, blob, url, w, h }] — 이 화면에만 있고 저장하지 않음
  students: [],       // [{ id, no, pages:[i], skip, status, score, score0, level, manual, summary, evidence, strengths, improve, unreadable, text, d, stale, err }]
  settings: { pagesPer: 1, startNo: 1, except: [], ratio: { top: 10, high: 30, mid: 40, low: 20 }, maskOn: true, maskAll: false, mask: [], mix: 'mix', byNo: false, noBox: null },
  // byNo·noBox: 적힌 번호로 학생 맞추기(걷은 순서와 상관없이, core/student-no.js) · 번호 칸 { x, y, w, h }
  // mix: 평어 내용 — 'plan' 평가계획 위주 · 'mix' 섞어서(기본) · 'sheet' 평가지 위주
  phase: 'setup',     // setup | grading | ranking | writing | done
  queue: [], running: new Map(), err: '', loading: '', view: 'no', calibrated: false, history: [], showRes: false,
  refs: [], refsAll: false  // refs: 평어에 참고할 단원평가·활동지 ['activity:<id>' | 'unit:<id>'] (활동지 스펙 4.8)
};
const LV_KEYS = ['top', 'high', 'mid', 'low'];
// 나이스에 차례로 붙여넣기 상태 (아래 「전체복사」 부분에서 씀)
const NEIS = { open: false, state: 'idle', src: null, ids: [], from: 0, job: null, seq: 0, done: 0, total: 0, until: 0, reason: '', msg: '', note: '', stopping: false, timer: null, listening: false, rearmT: null };
// state: arming 준비 중 · armed Ctrl+V 기다림 · running 붙여넣는 중 · end 끝 · expired 시간 지남 · error 오류
// job: 앱이 실제로 준비해 둔 것 { gen, ids, from } — 진행 알림은 이것과 번호(gen)가 맞을 때만 반영
ICON.upload = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 18v-6M9 14.5l3-3 3 3"/></svg>';

/* ---------- 저장 ---------- */
const GRStore = {
  body() {
    return {
      kind: 'gr', title: (grUnit() && (grUnit().elem || grUnit().unit)) || GR.title, unitId: GR.unitId, criteria: GR.criteria, critDocs: GR.critDocs.map(d => ({ name: d.name, text: d.text })), createdAt: GR.createdAt || Date.now(),
      settings: { ...GR.settings, mask: GR.settings.mask.map(r => ({ ...r })) }, calibrated: GR.calibrated, refs: GR.refs.slice(),
      // 채점에서 뺀 학생도 번호 자리를 지키도록 저장 (나이스에 차례로 붙여넣을 때 칸이 밀리지 않게)
      students: GR.students.map(s => ({
        id: s.id, no: s.no, n: s.pages.length, skip: s.skip ? 1 : 0, score: s.score ?? null, level: s.level || null, manual: s.manual ? 1 : 0,
        summary: s.summary || '', evidence: s.evidence || [], strengths: s.strengths || '', improve: s.improve || '',
        unreadable: s.unreadable ? 1 : 0, text: s.text || '', d: s.d ? 1 : 0, stale: s.stale ? 1 : 0,
        ...(s.trv ? { trv: s.trv } : {}), ...(s.trvd ? { trvd: 1 } : {}), ...(s.rv ? { rv: s.rv } : {})
      }))
    };
  },
  save() {
    if (!GR.id || !GR.students.some(s => s.status === 'done' || s.text)) return;
    clearTimeout(this.t);
    this.t = setTimeout(() => this.write(), 600);
  },
  async write() {
    this.t = null;
    await storeReady;
    const body = this.body();
    if (Store.mode === 'db') writeDoc(Store.base() + '/g_' + GR.id, body);
    else if (Store.mode === 'local') {
      Store.lsSet('ssam:gr:' + GR.id, body);
      const ids = Store.lsGet('ssam:grs', []);
      // 오래된 채점 기록도 말없이 지우지 않음 (저장 공간이 차면 알림이 뜨고, 선생님이 목록에서 지움)
      if (!ids.includes(GR.id)) { ids.unshift(GR.id); Store.lsSet('ssam:grs', ids); }
    }
    this.list();
  },
  async list() {
    await storeReady;
    let out = [];
    if (Store.mode === 'db') {
      try {
        const q = await cap.db.collection(Store.base()).where('kind', '==', 'gr').get();
        out = q.docs.map(d => { const b = d.data(); return { id: d.id.replace(/^g_/, ''), title: b.title, createdAt: b.createdAt, n: (b.students || []).filter(x => !x.skip).length }; });
      } catch (e) {}
    } else {
      out = Store.lsGet('ssam:grs', []).map(id => { const b = Store.lsGet('ssam:gr:' + id, null); return b && { id, title: b.title, createdAt: b.createdAt, n: (b.students || []).filter(x => !x.skip).length }; }).filter(Boolean);
    }
    GR.history = out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (S.mode === 'gr') renderGRSetup();
  },
  async get(id) {
    await storeReady;
    if (Store.mode === 'db') { try { const s = await cap.db.doc(Store.base() + '/g_' + id).get(); return s.exists ? JSON.parse(JSON.stringify(s.data())) : null; } catch (e) { return null; } }
    return Store.lsGet('ssam:gr:' + id, null);
  },
  async del(id) {
    await storeReady;
    if (Store.mode === 'db') { try { await cap.db.doc(Store.base() + '/g_' + id).delete(); } catch (e) {} }
    else { try { localStorage.removeItem('ssam:gr:' + id); } catch (e) {} Store.lsSet('ssam:grs', Store.lsGet('ssam:grs', []).filter(x => x !== id)); }
    this.list();
  }
};
function grLoadLastSettings() {
  const v = Store.lsGet('ssam:grset', null);
  if (v) { Object.assign(GR.settings, v); if (v.ratio) GR.settings.ratio = { ...v.ratio }; GR.settings.mask = Array.isArray(v.mask) ? v.mask : []; }
  GR.settings.byNo = !!GR.settings.byNo;
  if (!(GR.settings.noBox && typeof GR.settings.noBox.x === 'number')) GR.settings.noBox = null;
  GR.settings.except = Array.isArray(GR.settings.except) ? GR.settings.except.map(Number).filter(n => n > 0) : [];
  if (CLASS.loaded) GR.settings.except = CLASS.except.slice(); // 학급 명단의 예외 번호
  GR.settings.startNo = 1; // 채점은 늘 1번부터 (이번 채점 안에서만 바꿀 수 있음)
}
function grSaveSettings() { Store.lsSet('ssam:grset', GR.settings); GRStore.save(); }

/* ---------- 파일 읽기 ---------- */
let pdfP = null;
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load')); document.head.appendChild(s); });
}
function loadPdfJs() {
  if (window.pdfjsLib && window.pdfjsWorker) return Promise.resolve(window.pdfjsLib);
  if (pdfP) return pdfP;
  // 앱 안의 파일(vendor/pdfjs)을 먼저: 학교망·인터넷이 막혀도 PDF를 읽게. 없으면 같은 판을 CDN에서
  const bases = ['vendor/pdfjs/', 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/', 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/'];
  pdfP = (async () => {
    for (const b of bases) {
      try {
        if (!window.pdfjsLib) await loadScript(b + 'pdf.min.js');
        if (!window.pdfjsWorker) await loadScript(b + 'pdf.worker.min.js');
        if (window.pdfjsLib && window.pdfjsWorker) return window.pdfjsLib;
      } catch (e) {}
    }
    pdfP = null;
    throw new Error('PDFJS');
  })();
  return pdfP;
}
const toBlob = (c, type, q) => new Promise(r => c.toBlob(r, type, q));
function blobToB64(blob) {
  return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(blob); });
}
async function loadBitmap(blob) {
  if (window.createImageBitmap) { try { return await createImageBitmap(blob); } catch (e) {} }
  const url = URL.createObjectURL(blob);
  try { const img = new Image(); img.src = url; await img.decode(); return img; } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
// 다 쓴 그림·캔버스는 바로 놓아 메모리를 아낌
function freeBitmap(b) { try { if (b && b.close) b.close(); } catch (e) {} }
function freeCanvas(c) { if (c) { c.width = 0; c.height = 0; } }
async function canvasToPage(c, name) {
  const blob = await toBlob(c, 'image/jpeg', 0.9);
  // 목록에 쓰는 작은 그림(가로 200px)을 한 번만 만들어 둠
  const s = Math.min(1, 200 / c.width);
  const [t, tg] = whiteCanvas(c.width * s, c.height * s);
  tg.drawImage(c, 0, 0, t.width, t.height);
  const tb = await toBlob(t, 'image/jpeg', 0.8);
  freeCanvas(t);
  const page = { name, blob, url: URL.createObjectURL(blob), thumb: URL.createObjectURL(tb), w: c.width, h: c.height };
  freeCanvas(c);
  return page;
}
function grFreePages() {
  for (const p of GR.pages) { URL.revokeObjectURL(p.url); if (p.thumb) URL.revokeObjectURL(p.thumb); p._enc = null; }
}
function whiteCanvas(w, h) {
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  return [c, g];
}
async function readPdfPages(file, onPage) {
  const lib = await loadPdfJs();
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  const out = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const p = await doc.getPage(i);
      const v0 = p.getViewport({ scale: 1 });
      const vp = p.getViewport({ scale: Math.min(3, 1800 / Math.max(v0.width, v0.height)) });
      const [c, g] = whiteCanvas(vp.width, vp.height);
      await p.render({ canvasContext: g, viewport: vp }).promise;
      const page = await canvasToPage(c, `${file.name} ${i}쪽`);
      // 글자층(인쇄본 PDF 쪽): 한꺼번에 넣기에서 정답·교사용 쪽을 가리는 데 씀
      try { const tc = await p.getTextContent(); page.text = tc.items.map(it => it.str || '').join(' ').replace(/\s+/g, ' ').trim().slice(0, 2000); } catch (e) { page.text = ''; }
      out.push(page);
      p.cleanup();
      onPage && onPage(i, doc.numPages);
    }
  } finally { doc.destroy(); }
  return out;
}
/* PDF 한 쪽의 글 층 → 글. columns(단원평가 문제지·정답지만): 2쪽 모아찍기(가로 쪽, 가운데 세로 띠가 비고 양쪽에 3줄 넘게)면
   왼쪽 단을 다 읽고 오른쪽 단(글 층이 줄마다 왼쪽·오른쪽을 번갈아 내도). 가운데를 건너는 글·돌린 쪽·기운 글이 있으면 그대로 */
function pdfPageText(items, w, h, columns, rotate) {
  const flat = () => items.map(it => (it.str || '') + (it.hasEOL ? '\n' : '')).join('');
  if (!columns || !(w > h) || rotate % 360 || items.some(it => it.transform && (it.transform[1] || it.transform[2]))) return flat();
  const mid = w / 2, band = w * 0.02, L = [], R = [];
  for (const it of items) {
    const s = it.str || '';
    if (!s || !it.transform) continue;
    const x = it.transform[4], x2 = x + (it.width || 0);
    if (x2 <= mid - band) L.push(it);
    else if (x >= mid + band) R.push(it);
    else if (s.trim()) return flat();
  }
  const lines = list => new Set(list.filter(it => it.str.trim()).map(it => Math.round(it.transform[5]))).size;
  if (lines(L) < 3 || lines(R) < 3) return flat();
  const col = list => {
    let out = '', y = null;
    for (const it of list) {
      const y2 = it.transform[5], fh = Math.abs(it.transform[3]) || it.height || 10;
      if (y != null && Math.abs(y2 - y) > fh * 0.5) out += '\n';
      out += it.str; y = y2;
    }
    return out;
  };
  return col(L) + '\n' + col(R);
}
async function readImagePage(file) {
  const bmp = await loadBitmap(file);
  const s = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  const [c, g] = whiteCanvas(bmp.width * s, bmp.height * s);
  g.drawImage(bmp, 0, 0, c.width, c.height);
  freeBitmap(bmp);
  return canvasToPage(c, file.name);
}
const isPdf = f => /pdf/i.test(f.type) || /\.pdf$/i.test(f.name);
const isImg = f => /^image\/(jpe?g|png|webp|bmp|gif)$/i.test(f.type) || /\.(jpe?g|png|webp|bmp|gif)$/i.test(f.name);
const isHwp = f => /\.hwpx?$/i.test(f.name);
const CRIT_DOC_MAX = 12000, CRIT_IMG_MAX = 6;
/* 한글 정답표 → 글 (표는 행마다 「칸 | 칸」, 수식은 3/4처럼) */
async function readCritDoc(f) {
  const u8 = new Uint8Array(await f.arrayBuffer());
  const isCFB = u8[0] === 0xD0 && u8[1] === 0xCF && u8[2] === 0x11 && u8[3] === 0xE0;
  const isZip = u8[0] === 0x50 && u8[1] === 0x4B;
  if (!isCFB && !isZip) throw new Error('NOT_HWP');
  return blocksToText(isCFB ? await parseHWP(u8) : await parseHWPX(u8, DOMParser));
}
/* 채점에 쓰는 기준 글: 직접 쓴 기준 + 한글 정답표에서 읽은 글 */
function grCritText() {
  const parts = [];
  if (GR.criteria.trim()) parts.push(GR.criteria.trim());
  for (const d of GR.critDocs) if (d.text.trim()) parts.push(`(정답표 파일 「${d.name}」에서 읽은 내용)\n${d.text.trim()}`);
  return parts.join('\n\n');
}
/* 정답표 넣기: 한글은 글로, PDF·사진은 쪽 이미지로 */
async function grAddCrit(files) {
  if (!files || !files.length || ['grading', 'ranking', 'writing'].includes(GR.phase)) return;
  const list = [...files].sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }));
  const bad = []; let added = 0, cut = 0;
  for (const f of list) {
    GR.loading = `정답표 「${f.name}」 읽는 중`; renderGRBusy();
    try {
      if (isHwp(f)) {
        const text = (await readCritDoc(f)).trim();
        if (text.replace(/\s/g, '').length < 2) { bad.push(`「${f.name}」에서 글자를 찾지 못했어요. 그림으로 된 정답표라면 PDF나 사진으로 넣어 주세요.`); continue; }
        GR.critDocs.push({ name: f.name, text: text.slice(0, CRIT_DOC_MAX) }); added++;
        if (text.length > CRIT_DOC_MAX) bad.push(`「${f.name}」이 길어서 앞부분 ${CRIT_DOC_MAX.toLocaleString()}자만 써요.`);
      } else if (isPdf(f) || isImg(f)) {
        const { pages } = await readFiles([f]);
        const room = Math.max(0, CRIT_IMG_MAX - GR.critImgs.length);
        GR.critImgs.push(...pages.slice(0, room)); added += Math.min(room, pages.length); cut += Math.max(0, pages.length - room);
      } else bad.push(`「${f.name}」은 넣을 수 없는 파일이에요. 한글(.hwp·.hwpx)·PDF·사진만 돼요.`);
    } catch (e) {
      const m = e && e.message;
      bad.push(m === 'PDFJS' ? 'PDF를 읽는 도구를 불러오지 못했어요. 인터넷 연결을 확인하거나 사진으로 넣어 주세요.'
        : `「${f.name}」: ${READ_MSG[m] || (isHwp(f) ? '한글 파일을 읽지 못했어요.' : '파일을 읽지 못했어요. 암호가 걸린 파일인지 확인해 주세요.')}`);
    }
  }
  if (cut) bad.push(`정답지 쪽 이미지는 ${CRIT_IMG_MAX}쪽까지만 넣어요. ${cut}쪽은 빠졌어요.`);
  GR._critCache = null; GR.loading = '';
  renderGRSetup(); GRStore.save();
  if (bad.length) toast(bad.join(' '), 6000);
  else if (added) toast('정답표를 넣었어요. 채점할 때 함께 봐요.');
}
function openCritDoc(i) {
  const d = GR.critDocs[i]; if (!d) return;
  const locked = ['grading', 'ranking', 'writing'].includes(GR.phase);
  openSheet(`<h3>정답표 · ${esc(d.name)}</h3>
    <p class="muted" style="margin:0">한글 파일에서 읽은 내용이에요. 채점할 때 이 글을 기준으로 봐요. 잘못 읽힌 곳은 고칠 수 있어요.</p>
    <textarea class="field mono" id="critDocText" rows="14" style="font-size:13px;line-height:1.55" ${locked ? 'disabled' : ''}>${esc(d.text)}</textarea>
    <div class="row" style="justify-content:space-between"><button class="btn" type="button" id="critDocDel" ${locked ? 'disabled' : ''}>빼기</button><span class="row"><button class="btn" type="button" data-close>닫기</button><button class="btn primary" type="button" id="critDocSave" ${locked ? 'disabled' : ''}>저장</button></span></div>`,
    sh => {
      sh.querySelector('#critDocSave').addEventListener('click', () => { d.text = sh.querySelector('#critDocText').value.slice(0, CRIT_DOC_MAX); GRStore.save(); closeSheet(); renderGRSetup(); toast('정답표를 고쳤어요'); });
      sh.querySelector('#critDocDel').addEventListener('click', () => { GR.critDocs.splice(i, 1); GRStore.save(); closeSheet(); renderGRSetup(); });
    });
}
// say: 읽는 중 알림 (기본은 평가지 채점 화면)
async function readFiles(fileList, say = m => { GR.loading = m; renderGRBusy(); }) {
  const files = [...fileList].sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }));
  const pages = [], skipped = [];
  for (const f of files) {
    try {
      if (isPdf(f)) pages.push(...await readPdfPages(f, (i, n) => say(`「${f.name}」 ${i}/${n}쪽 읽는 중`)));
      else if (isImg(f)) { say(`「${f.name}」 읽는 중`); pages.push(await readImagePage(f)); }
      else skipped.push(f.name);
    } catch (e) {
      if (e && e.message === 'PDFJS') throw e;
      skipped.push(f.name);
    }
  }
  return { pages, skipped };
}

/* ---------- 학생 나누기 ---------- */
const grId = () => Math.random().toString(36).slice(2, 9);
/* 시작 번호부터 예외 번호(전학 등)를 건너뛰며 번호를 매김 */
function grNumbers(n) {
  const ex = new Set(GR.settings.except || []);
  const out = [];
  for (let no = Math.max(1, GR.settings.startNo | 0); out.length < n; no++) if (!ex.has(no)) out.push(no);
  return out;
}
function grRenumber() {
  const nos = grNumbers(GR.students.length);
  GR.students.forEach((s, i) => { s.no = nos[i]; });
}
function grBuildStudents() {
  const per = Math.max(1, GR.settings.pagesPer | 0);
  const skipIdx = new Set(GR.students.map((s, i) => s.skip ? i : -1).filter(i => i >= 0));
  GR.students = [];
  for (let i = 0, k = 0; i < GR.pages.length; i += per, k++) {
    GR.students.push({ id: grId(), no: 0, pages: Array.from({ length: Math.min(per, GR.pages.length - i) }, (_, j) => i + j), skip: skipIdx.has(k), status: 'idle' });
  }
  grRenumber();
}
function grParseNos(text) {
  return [...new Set((String(text || '').match(/\d+/g) || []).map(Number).filter(n => n >= 1 && n <= 99))].sort((a, b) => a - b);
}
const grActive = () => GR.students.filter(s => !s.skip);
const grStudent = id => GR.students.find(s => s.id === id);

/* ---------- 이미지 보내기 준비 ---------- */
/* 쪽 하나를 보낼 그림으로 (mask: 흰색으로 가릴 상자들, 없으면 그대로) */
async function pageImage(p, mask) {
  const masked = !!(mask && mask.length);
  const key = masked ? 'm' + JSON.stringify(mask) : 'raw';
  if (p._enc && p._enc.key === key) return p._enc.img;
  const bmp = await loadBitmap(p.blob);
  const s = Math.min(1, 1568 / Math.max(bmp.width, bmp.height));
  const [c, g] = whiteCanvas(bmp.width * s, bmp.height * s);
  g.drawImage(bmp, 0, 0, c.width, c.height);
  freeBitmap(bmp);
  if (masked) { g.fillStyle = '#fff'; for (const r of mask) g.fillRect(r.x * c.width, r.y * c.height, r.w * c.width, r.h * c.height); }
  const blob = await toBlob(c, 'image/jpeg', 0.85);
  freeCanvas(c);
  const img = { mime: 'image/jpeg', blob, b64: await blobToB64(blob) };
  p._enc = { key, img };
  return img;
}
const grPageImage = (idx, masked) => pageImage(GR.pages[idx], masked ? GR.settings.mask : null);
async function grStudentImages(st) {
  const out = [];
  for (let j = 0; j < st.pages.length; j++) {
    const masked = GR.settings.maskOn && GR.settings.mask.length && (GR.settings.maskAll || j === 0);
    out.push(await grPageImage(st.pages[j], masked));
  }
  return out;
}
async function grCritImages() {
  const out = [];
  for (const im of GR.critImgs) {
    const bmp = await loadBitmap(im.blob);
    const s = Math.min(1, 1568 / Math.max(bmp.width, bmp.height));
    const [c, g] = whiteCanvas(bmp.width * s, bmp.height * s);
    g.drawImage(bmp, 0, 0, c.width, c.height);
    freeBitmap(bmp);
    const blob = await toBlob(c, 'image/jpeg', 0.85);
    freeCanvas(c);
    out.push({ mime: 'image/jpeg', blob, b64: await blobToB64(blob) });
  }
  return out;
}

/* ---------- 프롬프트 ---------- */
function grUnit() { return GR.unitId ? unitById(GR.unitId) : null; }
function grTaskText() {
  const u = grUnit();
  const grade = (S.plan && S.plan.grade) || HK.settings.grade || '';
  if (u) return [
    `[학년·과목] ${grade ? grade + '학년 ' : ''}${u.subject}`,
    u.unit ? `[단원] ${u.unit}` : null, u.area ? `[평가영역] ${u.area}` : null, u.elem ? `[평가요소] ${u.elem}` : null,
    u.std ? `[성취기준] ${u.std.slice(0, 700)}` : null, u.focus ? `[수업·평가 방법과 주안점] ${u.focus.slice(0, 700)}` : null,
    `[평가기준] 상: ${u.crit.high || '-'} / 중: ${u.crit.mid || '-'} / 하: ${u.crit.low || '-'}`
  ].filter(Boolean).join('\n');
  return [`[학년] ${grade ? grade + '학년' : '초등학교'}`, `[수행평가] ${GR.title || '(제목 없음)'}`].join('\n');
}
function grJSON(text) {
  let t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(t); } catch (e) {}
  const a = Math.min(...['{', '['].map(ch => { const i = t.indexOf(ch); return i < 0 ? Infinity : i; }));
  const b = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (a < Infinity && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) {} }
  throw { code: 'bad_json' };
}
function grGradePrompt(st, nCrit) {
  const n = st.pages.length;
  const crit = grCritText();
  return [
    `당신은 초등학교 수행평가를 채점하는 경력 많은 담임교사입니다.`,
    `첨부한 이미지 중 앞의 ${n}장은 한 학생의 수행평가지(${n > 1 ? '순서대로' : '1쪽'})입니다.${nCrit ? ` 뒤의 ${nCrit}장은 정답·채점 기준입니다.` : ''} 이름 칸은 가려져 있을 수 있습니다.`,
    ``,
    `[평가 정보]`, grTaskText(),
    ``,
    crit || nCrit ? `[채점 기준]\n${crit || '(첨부한 정답·채점 기준 이미지를 따릅니다.)'}` : `[채점 기준] 따로 정한 채점 기준이 없습니다. 위 평가 정보의 성취기준과 평가기준, 그리고 교사로서의 판단으로 채점합니다.`,
    ``,
    `[할 일]`,
    `1. 학생이 쓴 답, 그림, 풀이 과정을 빠짐없이 읽고 문항마다 맞고 틀림과 이해 정도를 판단합니다.`,
    `2. 100점 만점으로 점수를 매깁니다. 90점 이상은 평가기준 '상'을 넘어서는 수준, 70~89점은 '상', 40~69점은 '중', 39점 이하는 '하'입니다. 같은 수준 안에서도 차이가 드러나게 1점 단위로 매깁니다.`,
    `3. 글씨를 알아보기 어렵거나 비어 있는 곳이 많으면 그 점을 적고 점수에 반영합니다.`,
    `4. 가려진 부분은 무시하고, 학생 이름을 추측하거나 적지 않습니다.`,
    ``,
    `[출력] 아래 형식의 JSON 하나만 출력합니다.`,
    `{"score": 0~100 정수, "summary": "답안에서 드러난 수행 모습 한두 문장", "evidence": ["답안에서 확인한 구체적인 근거", "..."], "strengths": "잘한 점", "improve": "보완할 점", "unreadable": false}`
  ].join('\n');
}
function grCalibPrompt(list) {
  return [
    `같은 수행평가를 본 학생 ${list.length}명의 채점 결과입니다. 학생마다 따로 채점해서 점수 기준이 조금씩 다를 수 있습니다.`,
    `관찰 내용을 서로 비교해 점수를 일관되게 다시 매겨 주세요. 더 잘한 학생이 더 높은 점수, 비슷한 학생은 비슷한 점수가 되게 하고, 90점 이상 최상·70~89 상·40~69 중·39 이하 하의 기준은 그대로 지킵니다.`,
    ``, `[평가 정보]`, grTaskText(), grCritText() ? `\n[채점 기준]\n${grCritText()}` : '',
    ``, `[학생별 결과]`,
    ...list.map(s => `- ${s.no}번 | ${s.score0}점 | ${s.summary} | 근거: ${(s.evidence || []).join(' / ')} | 보완: ${s.improve || '-'}`),
    ``, `[출력] 모든 학생을 빠짐없이 담은 JSON 배열 하나만 출력합니다. 예: [{"no": 1, "score": 85}]`
  ].filter(x => x !== '').join('\n');
}
function grAnchor(lv) {
  const u = grUnit();
  const c = u ? u.crit : {};
  return {
    top: c.top ? `평가기준 '최상': "${c.top}"에 해당하는 학생.` : `평가기준 '상'${c.high ? `("${c.high}")` : ''}을 완전히 충족하고 한 걸음 더 나아간 학생. 배운 내용을 새로운 상황에 적용하거나, 근거를 들어 깊이 있게 설명하는 모습을 드러냅니다.`,
    high: `평가기준 '상'${c.high ? `: "${c.high}"` : ''}에 해당하는 학생. 정확하고 능숙하게 해내는 모습을 씁니다.`,
    mid: `평가기준 '중'${c.mid ? `: "${c.mid}"` : ''}에 해당하는 학생. 기본은 해내고 대체로 바르게 수행하는 모습을 씁니다.`,
    low: `평가기준 '하'${c.low ? `: "${c.low}"` : ''}에 해당하는 학생. 부족한 점을 지적하거나 부정적으로 쓰지 말고, 해낸 것과 안내를 받아 해낼 수 있는 것, 노력하는 모습과 성장 가능성을 긍정적으로 씁니다.`
  }[lv];
}
function grLength() {
  const u = grUnit();
  if (u || S.settings.len !== 'auto') return lengthRange(u || { crit: {} });
  return [50, 75];
}
const GR_MIX = {
  plan: {
    label: '평가계획 위주',
    hint: '성취기준·평가기준에 맞춘 공통적인 문장이 중심이에요. 평가지 내용은 거의 드러나지 않아요.',
    intro: '학생마다 성취기준과 평가기준에 비추어 그 수준 학생에게 두루 쓸 수 있는 공통적인 평어를 써 주세요. 학생 정보는 표현을 서로 다르게 하는 데만 참고합니다.',
    rule: '성취기준과 평가기준에 드러난 지식·기능·태도를 중심으로, 그 수준 학생에게 공통으로 쓸 수 있는 내용으로 씁니다. 문제 번호, 정답, 평가지에만 나오는 숫자·낱말·작품 이름 같은 세부 내용은 쓰지 않습니다.'
  },
  mix: {
    label: '섞어서',
    hint: '성취기준·평가기준에 맞춘 공통적인 내용을 바탕으로, 그 학생의 모습을 한 가지 짧게 녹여요.',
    intro: '학생마다 성취기준과 평가기준에 비추어 그 수준에서 두루 쓸 수 있는 공통적인 내용을 바탕으로 쓰고, 그 학생의 답안에서 드러난 모습을 한 가지만 짧게 녹여 평어를 써 주세요.',
    rule: '평어의 중심은 성취기준·평가기준에 따른 공통적인 내용(무엇을 알고 할 수 있는지, 어떤 태도를 보이는지)이고, 그 학생의 답안에서 드러난 모습은 한 가지만 일반적인 말로 짧게 덧붙입니다. 문제 번호, 정답, 평가지에만 나오는 숫자·낱말·작품 이름 같은 세부 내용은 쓰지 않습니다.'
  },
  sheet: {
    label: '평가지 위주',
    hint: '학생마다 답안에서 드러난 구체적인 모습을 중심으로 써요.',
    intro: '학생마다 실제 답안에서 드러난 모습을 살려 평어를 써 주세요.',
    rule: '그 학생의 근거와 잘한 점이 구체적으로 드러나게 씁니다.'
  }
};
/* 평어에 참고할 단원평가·활동지(체크한 것만): 그 학생 한 줄 */
const grRefList = () => GR.refs.map(k => ({ kind: k.slice(0, k.indexOf(':')), id: k.slice(k.indexOf(':') + 1) }));
function grRefLine(no) {
  const R = window.SSAM && window.SSAM.evalRefs;
  const L = R && GR.refs.length ? R.lines(grRefList(), no) : '';
  return L ? `\n  참고: ${L}` : '';
}
/* 평가요소에 이어 둔 단원평가·활동지 목록(최근 5개 → 더보기), 기본 체크 안 함 */
function grRefsHTML(u) {
  const R = window.SSAM && window.SSAM.evalRefs;
  if (!u || !R) return '';
  const list = R.linked({ id: u.id, subject: u.subject, label: [u.area, u.elem || u.unit].filter(Boolean).join(' · ') });
  if (!list.length) return '<p class="muted gr-refs-none">이 평가요소에 이어 둔 단원평가·활동지가 없어요. 단원평가·활동지에서 「교과 평어에 참고하기」를 켜면 여기에 나와요.</p>';
  const show = GR.refsAll ? list : list.slice(0, 5);
  return `<div class="gr-refs" id="grRefs"><span class="lab">참고할 단원평가·활동지 <span class="muted">(체크한 것만 평어를 쓸 때 참고해요)</span></span>
    ${show.map(r => { const k = `${r.kind}:${r.id}`; return `<label class="switch"><input type="checkbox" data-gr-ref="${esc(k)}"${GR.refs.includes(k) ? ' checked' : ''}>${r.kind === 'unit' ? '단원평가' : '활동지'} 「${esc(r.title)}」 <span class="muted">${esc(r.date)}</span></label>`; }).join('')}
    ${list.length > show.length ? `<button class="btn text tiny" type="button" data-gr-ref-more>더보기 (${list.length - show.length}개)</button>` : ''}</div>`;
}
/* 한꺼번에 넣기(gr-bundle.js가 나눠 줌): 정답·기준 글 → 정답표 문서, 정답·교사용·빈 쪽 → 정답표 그림, 학생 쪽 → 평가지 */
function grPutBundle(b) {
  if (['grading', 'ranking', 'writing'].includes(GR.phase)) { toast('채점하는 중에는 넣을 수 없어요. 끝나거나 멈춘 뒤에 넣어 주세요.', 5000); return; }
  const crit = b.pages.filter((p, i) => b.roles[i] !== 'student'), stu = b.pages.filter((p, i) => b.roles[i] === 'student');
  const text = String(b.doc.teacher || b.doc.student || '').trim();
  if (stu.length && (GR.id || GR.students.some(s => s.status === 'done' || s.text))) grNew(false);
  if (text) GR.critDocs.push({ name: '한꺼번에 넣은 정답·기준', text: text.slice(0, CRIT_DOC_MAX) });
  const room = Math.max(0, CRIT_IMG_MAX - GR.critImgs.length);
  if (crit.length) GR.critImgs.push(...crit.slice(0, room));
  if (stu.length) { GR.pages.push(...stu); grBuildStudents(); }
  GR._critCache = null; renderGR(); GRStore.save();
  toast([text && '정답·기준 문서', crit.length && `정답표 그림 ${Math.min(room, crit.length)}쪽`, stu.length && `학생 ${GR.students.length}명`].filter(Boolean).join(' · ') + '을 넣었어요', 5000);
}
function grWritePrompt(lv, group, avoid) {
  const [lo, hi] = grLength();
  const mode = GR_MIX[GR.settings.mix] ? GR.settings.mix : 'mix';
  const M = GR_MIX[mode];
  const endRule = endingRule(S.settings.ending === 'da');
  const who = s => {
    const base = `- ${s.no}번 (${s.score ?? '-'}점): `;
    if (mode === 'plan') return base + `잘한 점: ${s.strengths || '-'} / 보완할 점: ${s.improve || '-'}`;
    if (mode === 'mix') return base + `${s.summary || ''} / 잘한 점: ${s.strengths || '-'} / 보완할 점: ${s.improve || '-'}`;
    return base + `${s.summary || ''} / 근거: ${(s.evidence || []).join(', ')} / 잘한 점: ${s.strengths || '-'} / 보완할 점: ${s.improve || '-'}`;
  };
  return [
    `당신은 초등학교 학교생활기록부 '교과학습발달상황' 평어를 쓰는 경력 많은 담임교사입니다.`,
    `아래 학생들은 이번 수행평가에서 [${LVNAME[lv]}] 수준으로 판정되었습니다. ${M.intro}`,
    ``, `[평가 정보]`, grTaskText(),
    ``, `[이 수준의 학생] ${grAnchor(lv)}`,
    ``, `[쓰기 규칙]`,
    `1. ${endRule} 평어 하나는 마침표가 하나뿐인 한 문장으로, 두세 가지 모습을 '~하며', '~하고'처럼 이어 씁니다.`,
    `2. 학생 이름이나 '이 학생은', '○○는' 같은 주어를 쓰지 않습니다.`,
    `3. 평어 하나는 공백을 포함해 ${lo}~${hi}자로 씁니다.`,
    `4. ${M.rule} 평가기준 문장을 그대로 옮기지 않습니다.`,
    `5. 점수, 수준 이름, 등급, '수행평가지', '답안'이라는 말은 쓰지 않습니다. 점수는 같은 수준 안에서 성취 정도를 조금씩 다르게 쓰는 데만 참고합니다.`,
    `6. 학생마다 시작하는 말, 핵심 표현, 서술어를 다르게 써서 서로 겹치지 않게 합니다.`,
    `7. ${pronounRule()}`,
    ``, `[학생]`,
    ...(GR.refs.length ? ['', '[참고: 단원평가·활동지] 학생 줄 아래 「참고:」는 같은 평가 영역의 다른 평가 결과입니다. 그 학생다운 평어를 쓰는 데만 참고하고, 점수·평가 이름은 쓰지 않습니다.', ''] : []),
    ...group.map(s => who(s) + grRefLine(s.no)),
    avoid.length ? `\n[이미 쓴 평어] 아래와 표현이 겹치지 않게 씁니다.\n${avoid.slice(-30).map(t => '- ' + t).join('\n')}` : '',
    ``, `[출력] JSON 배열 하나만 출력합니다. 예: [{"no": ${group[0].no}, "text": "평어"}]`
  ].filter(x => x !== '').join('\n');
}

/* ---------- 채점 ---------- */
const FATAL = ['not_granted', 'sampling_disabled', 'auth', 'bad_model', 'blocked', 'no_engine', 'quota', 'session_expired', 'images_unavailable', 'ocr_failed'];
async function grGrade(st) {
  const ctl = new AbortController();
  GR.running.set(st.id, ctl);
  st.status = 'run'; st.err = '';
  renderGRSoon();
  try {
    const imgs = await grStudentImages(st);
    if (!GR._critCache) { GR._critCache = grCritImages(); GR._critCache.catch(() => { GR._critCache = null; }); }
    const crit = await GR._critCache;
    const r = await generate(grGradePrompt(st, crit.length), { signal: ctl.signal, images: [...imgs, ...crit], fresh: true, careful: true, task: 'grade' });
    const j = grJSON(r.text);
    const sc = Math.round(Number(j.score));
    if (!Number.isFinite(sc)) throw { code: 'bad_json' };
    const prevLevel = st.level;
    Object.assign(st, {
      score0: Math.max(0, Math.min(100, sc)), score: Math.max(0, Math.min(100, sc)),
      summary: String(j.summary || '').trim(), evidence: Array.isArray(j.evidence) ? j.evidence.map(String).slice(0, 5) : [],
      strengths: String(j.strengths || '').trim(), improve: String(j.improve || '').trim(), unreadable: !!j.unreadable,
      status: 'done'
    });
    if (GR.single && prevLevel) { st.level = prevLevel; st.stale = true; }
    delete st.rv; // 다시 채점하면 지난 검토 의견은 지움
    st.rl = 0; concOk();
  } catch (e) {
    const code = (e && e.code) || 'upstream_error';
    st.status = code === 'cancelled' ? 'idle' : 'err';
    if (code !== 'cancelled') st.err = errMsg(code, e);
    if (code === 'rate_limited' && E.engine !== 'account' && (st.rl = (st.rl || 0) + 1) <= 4) {
      // 한도에 걸리면 20초 쉬었다가 저절로 이어서 (학생마다 네 번까지)
      concBackoff(); st.status = 'queued'; GR.queue.unshift(st.id); GR.err = errMsg(code, e) + ' 20초 뒤 이어서 해요.';
      GR.waitUntil = Date.now() + 20000;
      clearTimeout(GR.waitT); GR.waitT = setTimeout(() => { GR.waitUntil = 0; GR.err = ''; grPump(); }, 20000);
    }
    else if (FATAL.includes(code) || code === 'rate_limited') { GR.err = errMsg(code, e); GR.queue.forEach(id => { const s = grStudent(id); if (s) s.status = 'idle'; }); GR.queue = []; }
  } finally {
    GR.running.delete(st.id);
    grPump();
  }
}
function grPump() {
  if (GR.waitUntil && Date.now() < GR.waitUntil) { renderGRSoon(); return; }
  if (GR.phase === 'grading') {
    while (GR.running.size < conc() && GR.queue.length) { const s = grStudent(GR.queue.shift()); if (s && !s.skip) grGrade(s); }
    if (!GR.running.size && !GR.queue.length) {
      const act = grActive();
      if (GR.single) { GR.single = false; GR.phase = act.every(s => s.status === 'done' && s.text && !s.stale) ? 'done' : 'partial'; GRStore.save(); }
      else if (act.every(s => s.status === 'done')) grAfterGrading();
      else { GR.phase = act.some(s => s.status === 'done') ? 'partial' : 'setup'; }
    }
  }
  renderGRSoon();
}
async function grStart() {
  if (!engineReady()) { openSettings(); return; }
  if (GR.phase === 'partial' && grActive().every(s => s.status === 'done')) { if (grActive().some(s => s.level)) grWrite(); else grAfterGrading(); return; }
  if (!GR.pages.length) { toast('평가지를 먼저 올려 주세요'); return; }
  if (!GR.unitId && !GR.title.trim()) { toast('평가요소를 고르거나 수행평가 제목을 넣어 주세요'); $('#grTitle') && $('#grTitle').focus(); return; }
  const sum = LV_KEYS.reduce((a, k) => a + (+GR.settings.ratio[k] || 0), 0);
  if (sum !== 100) { toast(`비율의 합이 ${sum}%예요. 100%로 맞춰 주세요`); return; }
  // 적힌 번호로 학생 맞추기: 번호를 읽어 확인한 뒤에 채점 (스캔·번호가 바뀌면 다시 읽음)
  if (GR.settings.byNo && GR.noSig !== grNoSig()) { grAskNos(); return; }
  if (!GR.id) { GR.id = Date.now().toString(36); GR.createdAt = Date.now(); }
  if (neisIsGr() && (NEIS.state === 'armed' || NEIS.state === 'arming')) neisClose();
  GR.err = ''; GR.calibrated = false; GR._critCache = null;
  const todo = grActive().filter(s => s.status !== 'done');
  if (!todo.length) { grAfterGrading(); return; }
  todo.forEach(s => { s.status = 'queued'; });
  GR.queue = todo.map(s => s.id);
  GR.phase = 'grading'; GR.showRes = true;
  $('#grView') && $('#grView').classList.add('show-pane');
  grPump();
}
function grStop() {
  GR.queue.forEach(id => { const s = grStudent(id); if (s) s.status = 'idle'; });
  GR.queue = [];
  GR.running.forEach(c => c.abort());
  GR.writeCtl && GR.writeCtl.abort();
  GR.calCtl && GR.calCtl.abort();
  clearTimeout(GR.waitT); GR.waitUntil = 0;
  GR.students.forEach(s => { s.rl = 0; });
  GR.phase = grActive().some(s => s.status === 'done') ? 'partial' : 'setup';
  renderGRSoon();
}

/* ---------- 비율 맞추기 ---------- */
function grTargets(n) {
  const r = GR.settings.ratio;
  const raw = LV_KEYS.map(k => n * (+r[k] || 0) / 100);
  const cnt = raw.map(Math.floor);
  let left = n - cnt.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) cnt[order[k][1]]++;
  return Object.fromEntries(LV_KEYS.map((k, i) => [k, cnt[i]]));
}
function grAssign(keepManual) {
  const list = grActive().filter(s => s.status === 'done' && !(keepManual && s.manual));
  const fixed = keepManual ? grActive().filter(s => s.status === 'done' && s.manual) : [];
  const tg = grTargets(list.length + fixed.length);
  fixed.forEach(s => { tg[s.level] = Math.max(0, tg[s.level] - 1); });
  const sorted = list.slice().sort((a, b) => (b.score - a.score) || (a.no - b.no));
  let i = 0;
  for (const k of LV_KEYS) for (let c = 0; c < tg[k] && i < sorted.length; c++, i++) {
    const s = sorted[i];
    if (s.level !== k) { if (s.level) s.stale = true; s.level = k; }
    if (!keepManual) s.manual = false;
  }
  while (i < sorted.length) { const s = sorted[i++]; if (s.level !== 'low') { s.stale = !!s.level; s.level = 'low'; } }
}
async function grCalibrate(signal) {
  const list = grActive().filter(s => s.status === 'done');
  if (list.length < 3) return;
  GR.loading = '학생들끼리 견주어 점수를 맞추는 중'; renderGRSoon();
  try {
    const r = await generate(grCalibPrompt(list), { fresh: true, careful: true, signal, task: 'grade' });
    const arr = grJSON(r.text);
    if (!Array.isArray(arr)) return;
    const m = new Map(arr.map(x => [Number(x.no), Math.round(Number(x.score))]));
    let hit = 0;
    for (const s of list) { const v = m.get(s.no); if (Number.isFinite(v)) { s.score = Math.max(0, Math.min(100, v)); hit++; } }
    GR.calibrated = hit >= list.length * 0.8;
    if (!GR.calibrated) list.forEach(s => { s.score = s.score0; });
  } catch (e) { list.forEach(s => { s.score = s.score0; }); }
  finally { GR.loading = ''; }
}
async function grAfterGrading() {
  // 이미 쓴 평어가 있으면(빼 두었던 학생을 넣고 이어서 할 때 등) 다른 학생의 점수·수준·평어는 그대로 둠
  const hadTexts = grActive().some(s => s.text);
  GR.phase = 'ranking'; renderGRSoon();
  const ctl = new AbortController(); GR.calCtl = ctl;
  if (!hadTexts) await grCalibrate(ctl.signal);
  GR.calCtl = null;
  if (ctl.signal.aborted || GR.phase !== 'ranking') return; // 멈추기를 눌렀음
  if (hadTexts) grAssign(true);
  else { grAssign(false); grActive().forEach(s => { if (s.status === 'done') s.stale = true; }); }
  GRStore.save();
  GR.calCtl = ctl;
  await grReviewScores(ctl.signal);
  GR.calCtl = null;
  if (ctl.signal.aborted || GR.phase !== 'ranking') return; // 멈추기를 눌렀음
  await grWrite();
}
/* 검토 AI: 「읽기 어려움」과 나눈 수준이 바뀌는 바로 위·아래 학생만 같은 그림·채점 기준으로 다시 채점.
   10점 이상 다르면 두 의견(st.rv). 키·한도·연결로 실패하면 「검토하지 못했어요」, 남은 검토는 그만둠 */
async function grReviewScores(signal) {
  const R = RV(), use = R && R.pick ? R.pick('grade', 'review') : null;
  if (!use) return;
  const ids = R.grReviewNeeded(grActive());
  if (!ids.length) return;
  delete GR.rvErr;
  GR.loading = '검토 AI가 수준 경계에 있는 학생을 다시 보고 있어요'; renderGRSoon();
  try {
    if (!GR._critCache) { GR._critCache = grCritImages(); GR._critCache.catch(() => { GR._critCache = null; }); }
    const crit = await GR._critCache;
    for (const id of ids) {
      if (signal.aborted) return;
      const st = grStudent(id);
      if (!st || st.status !== 'done') continue;
      try {
        const imgs = await grStudentImages(st);
        if (!imgs.length) continue;
        const r = await generate(grGradePrompt(st, crit.length), { signal, images: [...imgs, ...crit], fresh: true, careful: true, use });
        const j = grJSON(r.text), sc = Math.round(Number(j && j.score));
        if (!Number.isFinite(sc)) continue;
        const v = Math.max(0, Math.min(100, sc));
        if (R.grDiffers(st.score, v)) st.rv = { score: v, summary: String(j.summary || '').trim().slice(0, 300) };
        else delete st.rv;
      } catch (e) {
        const code = (e && e.code) || 'upstream_error';
        if (code === 'cancelled') return;
        if (code === 'bad_json') continue;
        GR.rvErr = 1; return;
      }
    }
  } finally { GR.loading = ''; GRStore.save(); renderGRSoon(); }
}
/* 두 의견 고르기: [검토 점수 쓰기]는 점수·요약을 바꾸고 수준을 다시 맞춤 */
GR_RV.handle = (key, use) => {
  if (!String(key).startsWith('grs:')) return false;
  const s = grStudent(decodeURIComponent(String(key).slice(4)));
  if (!s || !rvOpen(s)) return true;
  if (use) {
    s.score = s.rv.score; if (s.rv.summary) s.summary = s.rv.summary;
    if (!GR.running.size && !GR.writeCtl) grAssign(true);
    else if (GR.writeCtl) GR.needAssign = true; // 평어를 다 쓴 뒤에 맞춤
  }
  s.rv = { ...s.rv, done: use ? 'review' : 'main' };
  GRStore.save(); renderGR();
  toast(use ? '검토 점수를 썼어요' : '그대로 두었어요');
  return true;
};

/* ---------- 평어 쓰기 ---------- */
function grConfirmRewrite() {
  const list = grActive().filter(s => s.status === 'done' && s.level && s.text);
  if (!list.length) return;
  const used = list.filter(s => s.d).length;
  const m = GR_MIX[GR.settings.mix] || GR_MIX.mix;
  openSheet(`<h3>평어를 모두 다시 쓸까요?</h3>
    <p class="muted" style="margin:0">${list.length}명의 평어를 「${esc(m.label)}」 방식으로 새로 써요.${used ? ` 복사해서 완료로 표시한 ${used}명은 그대로 둬요.` : ''}</p>
    <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close>취소</button><button class="btn primary" type="button" id="grRewriteGo">다시 쓰기</button></div>`,
    sh => sh.querySelector('#grRewriteGo').addEventListener('click', () => {
      closeSheet();
      const ids = list.filter(s => !s.d).map(s => s.id);
      if (!ids.length) { toast('다시 쓸 평어가 없어요'); return; }
      ids.forEach(id => { const s = grStudent(id); if (s) s.stale = true; });
      renderGR(); grWrite(ids);
    }));
}
async function grWrite(only) {
  if (!engineReady()) { openSettings(); return; }
  if (neisIsGr() && (NEIS.state === 'armed' || NEIS.state === 'arming')) neisClose();
  if (GR.writeCtl) { GR.pendingWrite = GR.pendingWrite || new Set(); (only || grActive().map(s => s.id)).forEach(id => GR.pendingWrite.add(id)); return; }
  GR.phase = 'writing'; GR.err = '';
  const ctl = new AbortController(); GR.writeCtl = ctl;
  grWrote = new Set();
  renderGRSoon();
  const want = grActive().filter(s => s.status === 'done' && s.level && (only ? only.includes(s.id) : s.stale || !s.text));
  want.forEach(s => { s.writing = true; });
  renderGRSoon();
  const jobs = LV_KEYS.map(lv => want.filter(s => s.level === lv)).filter(g => g.length);
  try {
    const W = conc();
    await Promise.all(jobs.slice(0, W).map(async (_, w) => {
      for (let j = w; j < jobs.length; j += W) {
        const group = jobs[j];
        for (let i = 0; i < group.length; i += 10) {
          if (ctl.signal.aborted) return;
          const chunk = group.slice(i, i + 10);
          const lv = chunk[0].level;
          const avoid = grActive().filter(s => s.level === lv && s.text && !chunk.includes(s)).map(s => s.text);
          try { await grWriteChunk(lv, chunk, avoid, ctl.signal); }
          catch (e) {
            const code = (e && e.code) || 'upstream_error';
            if (code === 'cancelled') return;
            if (FATAL.includes(code) || code === 'rate_limited') { GR.err = errMsg(code, e); ctl.abort(); return; }
            GR.err = errMsg(code, e); chunk.forEach(s => { delete s.writing; });
          }
          renderGRSoon();
        }
      }
    }));
    // 겹치는 평어는 하나씩 다시 씀
    const seen = new Map();
    for (const s of grActive().filter(x => x.text)) {
      const k = normKey(s.text).slice(0, 18);
      if (seen.has(k) && !ctl.signal.aborted) { const avoid = grActive().filter(x => x.level === s.level && x.text && x !== s).map(x => x.text); await grWriteChunk(s.level, [s], avoid, ctl.signal); }
      seen.set(normKey(s.text).slice(0, 18), s.id);
    }
    // 검토 AI: 이번에 쓴 평어만 10개씩 (사용함 표시한 학생은 빼고). 검토하는 동안 창을 닫아도 평어는 남게 먼저 저장
    const wrote = [...grWrote].filter(x => x.text && !x.d);
    if (!ctl.signal.aborted && wrote.length && RV() && RV().pick('writing', 'review')) {
      GRStore.save();
      const r = await reviewSentences('gr', grTaskText(), wrote.map(o => ({ o, f: 'text' })), ctl.signal, { rv: 'trv', d: 'trvd' });
      if (r === 'fail') GR.rvErr = 1; else if (r === 'ok') delete GR.rvErr;
    }
  } catch (e) {
    const code = (e && e.code) || 'upstream_error';
    if (code !== 'cancelled') GR.err = errMsg(code, e);
  } finally {
    grActive().forEach(s => { delete s.writing; });
    GR.writeCtl = null;
    // 쓰는 동안 [검토 점수 쓰기]를 골랐으면 이제 수준을 다시 맞춤 (바뀐 학생은 「다시 쓰세요」)
    if (GR.needAssign) { GR.needAssign = false; grAssign(true); }
    GR.phase = grActive().some(s => s.status === 'done' && (!s.text || s.stale)) ? 'partial' : 'done';
    GRStore.save();
    renderGRSoon();
    if (GR.pendingWrite && GR.pendingWrite.size) { const ids = [...GR.pendingWrite]; GR.pendingWrite = null; setTimeout(() => grWrite(ids), 0); }
  }
}
let grWrote = new Set(); // 이번 쓰기에서 평어를 쓴 학생 (검토는 이 학생만)
async function grWriteChunk(lv, chunk, avoid, signal) {
  const r = await generate(grWritePrompt(lv, chunk, avoid), { signal, fresh: true, task: 'writing' });
  const arr = grJSON(r.text);
  const list = Array.isArray(arr) ? arr : (arr && Array.isArray(arr.items) ? arr.items : []);
  for (const x of list) {
    const s = chunk.find(c => c.no === Number(x.no));
    const t = cleanLine(String(x.text || ''));
    if (s && t) { s.text = t; s.stale = false; s.d = 0; delete s.writing; delete s.trv; delete s.trvd; grWrote.add(s); }
  }
  // 빠진 학생은 한 명씩
  for (const s of chunk.filter(c => c.writing)) {
    if (signal && signal.aborted) return;
    const r2 = await generate(grWritePrompt(lv, [s], avoid.concat(chunk.filter(c => c.text).map(c => c.text))), { signal, fresh: true, task: 'writing' });
    const a2 = grJSON(r2.text);
    const x = Array.isArray(a2) ? a2[0] : a2;
    const t = x && cleanLine(String(x.text || ''));
    if (t) { s.text = t; s.stale = false; s.d = 0; delete s.trv; delete s.trvd; grWrote.add(s); }
    delete s.writing;
  }
}

/* ---------- 그리기 ---------- */
let grT = null;
function renderGRSoon() {
  if (grT) return;
  grT = setTimeout(() => { grT = null; renderGR(); }, 120);
}
function renderGR() {
  if (S.mode !== 'gr') return;
  renderGRSetup(); renderGRResults();
}
function renderGRBusy() {
  const el = $('#grBusy'); if (!el) return;
  el.hidden = !GR.loading;
  el.innerHTML = GR.loading ? `<span class="spin"></span>${esc(GR.loading)}` : '';
}
function grUnitOptions() {
  if (!S.plan) return '';
  return S.plan.subjects.map(s => `<optgroup label="${esc(s.name)}">${s.units.map(u => `<option value="${esc(u.id)}" ${GR.unitId === u.id ? 'selected' : ''}>${esc((u.period ? u.period + ' · ' : '') + (u.elem || u.unit || '평가요소'))}</option>`).join('')}</optgroup>`).join('');
}
function renderGRSetup() {
  const box = $('#grSetup'); if (!box) return;
  const keep = document.activeElement && box.contains(document.activeElement) ? document.activeElement.id : null;
  const st = GR.settings, act = grActive();
  const sum = LV_KEYS.reduce((a, k) => a + (+st.ratio[k] || 0), 0);
  const tg = grTargets(act.length);
  const locked = ['grading', 'ranking', 'writing'].includes(GR.phase);
  const u = grUnit();
  const per = Math.max(1, st.pagesPer | 0), rem = GR.pages.length % per;
  box.innerHTML = `<div class="ai-row" data-ai-row="grade"></div><div class="ai-row" data-ai-row="writing"></div>
    <div class="gr-step">
      <div class="gr-h"><span class="sn">1</span><b>무엇을 채점할까요</b></div>
      ${!locked && window.SSAM.bundleBoxHTML ? window.SSAM.bundleBoxHTML('gr', '정답·채점 기준 문서와 학생 평가지 스캔을 한꺼번에 넣으면 알아서 나눠요') : ''}
      <label class="lab" for="grUnit">평가요소</label>
      <select class="field" id="grUnit" ${locked ? 'disabled' : ''}>
        <option value="">${S.plan ? '직접 입력' : '직접 입력 (교과 평어 탭에서 평가계획을 넣으면 고를 수 있어요)'}</option>
        ${grUnitOptions()}
      </select>
      ${u ? `<p class="muted gr-crit">${esc(u.subject)} · ${esc(u.unit || '')}<br>상: ${esc(u.crit.high || '-')}</p>` : `<input class="field" id="grTitle" placeholder="수행평가 제목 (예: 3학년 수학 곱셈 서술형)" value="${esc(GR.title)}" ${locked ? 'disabled' : ''} autocomplete="off">`}
      ${grRefsHTML(u)}
      <div class="crit-box" id="grCritBox">
      <label class="lab" for="grCrit">채점 기준·정답 <span class="muted">(있으면 넣기)</span></label>
      <textarea class="field" id="grCrit" rows="3" placeholder="예) 1번 정답 456, 풀이식이 있으면 만점 / 2번 까닭을 두 가지 이상 쓰면 상" ${locked ? 'disabled' : ''}>${esc(GR.criteria)}</textarea>
      <div class="row">
        <button class="btn" type="button" data-gr="critImg" ${locked ? 'disabled' : ''}>${ICON.plus}정답표 파일</button>
        ${GR.critDocs.map((d, i) => `<span class="chip"><button class="chip-open" type="button" data-grcritview="${i}" title="읽은 내용 보기·고치기">${esc(d.name)} · ${d.text.length.toLocaleString()}자</button><button class="icon-btn tiny" type="button" data-grcritdocdel="${i}" aria-label="빼기" ${locked ? 'disabled' : ''}>${ICON.x}</button></span>`).join('')}
        ${GR.critImgs.map((im, i) => `<span class="chip">${esc(im.name)}<button class="icon-btn tiny" type="button" data-grcritdel="${i}" aria-label="빼기" ${locked ? 'disabled' : ''}>${ICON.x}</button></span>`).join('')}
      </div>
      <p class="muted">정답표는 한글(.hwp·.hwpx)·PDF·사진 파일로 넣거나 이 칸에 끌어다 놓으세요. 한글 파일은 글자를 읽고, PDF와 사진은 쪽 그대로 봐요(${CRIT_IMG_MAX}쪽까지). 채점 기준이 없으면 평가계획의 평가기준과 AI 판단으로 채점해요.</p>
      </div>
    </div>
    <div class="gr-step">
      <div class="gr-h"><span class="sn">2</span><b>평가지 올리기</b></div>
      <div class="drop" id="grDrop" role="button" tabindex="0" ${locked ? 'aria-disabled="true"' : ''}>
        ${ICON.upload}<b>${GR.pages.length ? `${GR.pages.length}쪽을 올렸어요` : 'PDF나 사진 파일을 끌어다 놓거나 눌러서 고르세요'}</b>
        <span>번호 순서대로 스캔한 파일 · 여러 개면 파일 이름 순서로 이어 붙여요</span>
      </div>
      <div class="busy" id="grBusy" hidden></div>
      <div class="row nowrap">
        <label class="lab" for="grPer">학생당</label><input class="field num sm" id="grPer" type="number" min="1" max="20" value="${per}" ${locked ? 'disabled' : ''}><span class="muted">쪽</span>
        <label class="lab" for="grStartNo">시작 번호</label><input class="field num sm" id="grStartNo" type="number" min="1" max="99" value="${st.startNo}" ${locked ? 'disabled' : ''}>
      </div>
      <label class="lab" for="grExcept">예외 번호 <span class="muted">(전출처럼 나이스에 칸이 없는 번호 · 학급 명단과 같이 씀)</span></label>
      <input class="field" id="grExcept" placeholder="예) 7, 15" value="${esc((st.except || []).join(', '))}" ${locked ? 'disabled' : ''} autocomplete="off" inputmode="numeric">
      <label class="switch"><input type="checkbox" id="grByNo" ${st.byNo ? 'checked' : ''} ${locked ? 'disabled' : ''}>적힌 번호로 학생 맞추기 <span class="muted">(걷은 순서와 상관없이 첫 쪽에 쓴 번호로)</span></label>
      ${st.byNo ? `<div class="row"><button class="btn ${st.noBox ? '' : 'tonal'}" type="button" data-gr="noBox" ${GR.pages.length && !locked ? '' : 'disabled'}>${st.noBox ? '번호 칸 · 고치기' : '번호 칸 정하기'}</button><span class="muted">${st.noBox ? '채점 전에 번호를 읽어 확인해요(AI는 번호 칸만 봐요)' : '학생이 번호를 쓰는 칸을 정해 주세요'}</span></div>` : ''}
      ${GR.pages.length ? `<p class="muted">학생 ${GR.students.length}명 (${GR.students[0] ? GR.students[0].no : st.startNo}~${GR.students.length ? GR.students[GR.students.length - 1].no : ''}번${grExceptIn().length ? `, ${grExceptIn().join('·')}번 제외` : ''})${rem ? ` · 마지막 학생은 ${rem}쪽뿐이에요` : ''} <button class="btn text tiny" type="button" data-gr="reverse" ${locked ? 'disabled' : ''}>쪽 순서 거꾸로</button> <button class="btn text tiny" type="button" data-gr="clearPages" ${locked ? 'disabled' : ''}>모두 빼기</button></p>` : ''}
    </div>
    <div class="gr-step">
      <div class="gr-h"><span class="sn">3</span><b>이름 칸 가리기</b></div>
      <label class="switch"><input type="checkbox" id="grMaskOn" ${st.maskOn ? 'checked' : ''} ${locked ? 'disabled' : ''}>이름 칸을 가리고 보내기</label>
      ${st.maskOn ? `<div class="row"><button class="btn ${st.mask.length ? '' : 'tonal'}" type="button" data-gr="mask" ${GR.pages.length && !locked ? '' : 'disabled'}>${st.mask.length ? `가릴 곳 ${st.mask.length}개 · 고치기` : '가릴 곳 정하기'}</button>${!GR.pages.length ? '<span class="muted">평가지를 올리면 정할 수 있어요</span>' : ''}</div>` : '<p class="muted">학생 이름이 그대로 AI 회사로 보내져요.</p>'}
    </div>
    <div class="gr-step">
      <div class="gr-h"><span class="sn">4</span><b>수준 비율</b><span class="muted num ${sum === 100 ? '' : 'warn'}">합 ${sum}%</span></div>
      <div class="ratio">${LV.map(l => `<label class="${l.cls}"><span class="lvtag">${l.name}</span><input class="field num sm" type="number" min="0" max="100" step="5" id="grR_${l.k}" value="${st.ratio[l.k]}" ${locked ? 'disabled' : ''}><span class="muted">%</span><small class="num">${act.length ? tg[l.k] + '명' : ''}</small></label>`).join('')}</div>
      <p class="muted">점수 순위대로 이 비율에 맞춰 나눠요. 나눈 뒤에도 학생을 다른 수준으로 옮길 수 있어요.</p>
    </div>
    <div class="gr-step">
      <div class="gr-h"><span class="sn">5</span><b>평어 내용</b></div>
      <div class="seg" id="grMix">${Object.entries(GR_MIX).map(([k, m]) => `<button type="button" data-grmix="${k}" aria-pressed="${(st.mix || 'mix') === k}">${m.label}</button>`).join('')}</div>
      <p class="muted">${esc((GR_MIX[st.mix] || GR_MIX.mix).hint)}${GR.students.some(s => s.text) ? ' 바꾼 뒤 결과 화면의 「평어 모두 다시 쓰기」를 누르면 새로 써요.' : ''}</p>
    </div>
    ${GR.err ? `<div class="banner err"><span class="grow">${esc(GR.err)}</span><button class="btn" type="button" data-act="settings">평어 쓰는 방식</button></div>` : ''}
    ${!engineReady() ? `<div class="banner info"><span class="grow">채점할 AI를 먼저 정해 주세요. 이미지를 읽을 수 있는 Claude·Gemini·GPT 키가 필요해요.</span><button class="btn primary" type="button" data-act="settings">API 키 넣기</button></div>` : ''}
    ${upNote()}
    <div class="row gr-go">
      ${locked ? `<button class="btn" type="button" data-gr="stop">멈추기</button>` :
        GR.phase === 'done' ? '' : `<button class="btn primary" type="button" data-gr="start" ${GR.pages.length || GR.phase === 'partial' ? '' : 'disabled'}>${ICON.spark}${GR.phase === 'partial' ? '이어서 하기' : `채점하고 평어 쓰기${act.length ? ` (${act.length}명)` : ''}`}</button>`}
      ${GR.id || GR.pages.length ? `<button class="btn text" type="button" data-gr="new" ${locked ? 'disabled' : ''}>새 채점</button>` : ''}
    </div>
    <p class="muted">스캔 이미지는 이 화면에만 있고 저장하지 않아요. 점수·평어만 ${HERE}에 저장돼요.</p>
    ${GR.history.length ? `<div class="gr-step"><div class="gr-h"><b>지난 채점</b></div><ul class="gr-hist">${GR.history.slice(0, 10).map(h => `<li><button type="button" data-grhist="${esc(h.id)}" ${h.id === GR.id ? 'aria-current="true"' : ''}><span>${esc(h.title || '(제목 없음)')}</span><small class="num">${h.createdAt ? new Date(h.createdAt).toLocaleDateString('ko-KR') : ''} · ${h.n}명</small></button><button class="icon-btn tiny" type="button" data-grhistdel="${esc(h.id)}" aria-label="지우기" title="지우기">${ICON.x}</button></li>`).join('')}</ul></div>` : ''}`;
  renderGRBusy();
  if (keep) { const el = document.getElementById(keep); if (el) { el.focus(); if (el.setSelectionRange && el.type !== 'number') try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {} } }
}
function grExceptIn() {
  if (!GR.students.length) return [];
  const lo = GR.students[0].no, hi = GR.students[GR.students.length - 1].no;
  return (GR.settings.except || []).filter(n => n > lo && n < hi);
}
// j쪽에 가린 자리 보여 주기 (all: 모든 쪽에서 가림, 아니면 첫 쪽만)
function maskOverlay(mask, all, j) {
  if (!mask || !mask.length || !(all || j === 0)) return '';
  return mask.map(r => `<i class="mk" style="left:${r.x * 100}%;top:${r.y * 100}%;width:${r.w * 100}%;height:${r.h * 100}%"></i>`).join('');
}
const grMaskOverlay = j => GR.settings.maskOn ? maskOverlay(GR.settings.mask, GR.settings.maskAll, j) : '';
function grStatusChip(s) {
  if (s.skip) return '<span class="chip">채점 안 함</span>';
  if (s.writing) return '<span class="chip run"><span class="spin"></span>평어 쓰는 중</span>';
  return {
    idle: '<span class="chip">기다림</span>', queued: '<span class="chip">차례 기다림</span>',
    run: '<span class="chip run"><span class="spin"></span>채점 중</span>', err: '<span class="chip err">오류</span>', done: ''
  }[s.status] || '';
}
function renderGRResults() {
  const box = $('#grResults'); if (!box) return;
  const act = grActive();
  if (!GR.students.length) {
    box.innerHTML = `<button class="btn text back" type="button" data-gr="back">${ICON.back}채점 설정</button>
      <div class="empty"><h3>평가지를 올리면 학생별로 나눠서 보여 줘요</h3>
      <p>번호 순서대로 스캔한 PDF(또는 사진)를 왼쪽에 올리세요. 학생당 쪽 수에 맞춰 1번, 2번… 순서로 나눠요.</p>
      <div class="gr-flow"><span>스캔 올리기</span>${ICON.chev}<span>이름 가리기</span>${ICON.chev}<span>AI 채점</span>${ICON.chev}<span>비율대로 최상·상·중·하</span>${ICON.chev}<span>학생별 평어</span></div></div>`;
    return;
  }
  const done = act.filter(s => s.status === 'done');
  const graded = done.length, total = act.length;
  const lvCount = Object.fromEntries(LV_KEYS.map(k => [k, done.filter(s => s.level === k).length]));
  const tg = grTargets(total);
  const hasLevels = done.some(s => s.level);
  const phaseText = {
    grading: `채점 중 · ${graded}/${total}명`, ranking: GR.loading || '점수를 견주어 수준을 나누는 중',
    writing: `평어 쓰는 중 · ${done.filter(s => s.text && !s.stale).length}/${graded}명`,
    partial: `${graded}/${total}명 채점함`, done: '채점과 평어를 마쳤어요', setup: `학생 ${total}명`
  }[GR.phase] || '';
  const busy = ['grading', 'ranking', 'writing'].includes(GR.phase);
  let list = GR.students.slice();
  if (GR.view === 'lv' && hasLevels) list.sort((a, b) => (LV_KEYS.indexOf(a.level) - LV_KEYS.indexOf(b.level)) || ((b.score ?? -1) - (a.score ?? -1)));
  const [lo, hi] = grLength();
  box.innerHTML = `
    <button class="btn text back" type="button" data-gr="back">${ICON.back}채점 설정</button>
    <div class="gr-top">
      <div><h2>${esc(grUnit() ? (grUnit().elem || grUnit().unit) : (GR.title || '수행평가'))}</h2>
        <p class="muted">${busy ? '<span class="spin"></span>' : ''}${esc(phaseText)}${GR.calibrated ? ' · 학생끼리 견주어 점수를 맞췄어요' : ''}</p></div>
      ${busy ? `<div class="meter big"><i style="width:${GR.phase === 'grading' ? Math.round(graded / Math.max(1, total) * 100) : GR.phase === 'writing' ? Math.round(done.filter(s => s.text && !s.stale).length / Math.max(1, graded) * 100) : 100}%"></i></div>` : ''}
    </div>
    ${hasLevels ? `<div class="dist">${LV.map(l => `<span class="dchip ${l.cls} ${lvCount[l.k] !== tg[l.k] ? 'off' : ''}"><span class="sw"></span>${l.name} <b class="num">${lvCount[l.k]}</b><small class="num">/ ${tg[l.k]}명</small></span>`).join('')}</div>` : ''}
    <div class="tools">
      <div class="left">
        ${hasLevels ? `<div class="seg"><button type="button" data-grview="no" aria-pressed="${GR.view !== 'lv'}">번호순</button><button type="button" data-grview="lv" aria-pressed="${GR.view === 'lv'}">수준순</button></div>` : ''}
      </div>
      <div class="right">
        ${hasLevels && !busy ? `<button class="btn" type="button" data-gr="reassign">비율대로 다시 나누기</button>` : ''}
        ${done.some(s => s.text) && !busy ? `<button class="btn" type="button" data-gr="rewriteAll">${ICON.redo}평어 모두 다시 쓰기</button>` : ''}
        ${done.some(s => s.text) ? `<button class="btn" type="button" data-gr="copyTable" title="번호·수준·평어를 엑셀에 붙여넣기 좋게 복사">표로 복사</button>
          <button class="btn tonal" type="button" data-gr="copyAll" ${busy ? 'disabled' : ''} title="${IN_APP ? '나이스 학생 칸에 1번부터 차례로 붙여넣기' : '번호순으로 한 줄에 한 명씩 복사'}">${ICON.copy}전체복사</button>` : ''}
        ${GR.phase === 'partial' && done.some(s => s.level && (!s.text || s.stale)) ? `<button class="btn primary" type="button" data-gr="writeRest">남은 평어 쓰기</button>` : ''}
      </div>
    </div>
    ${GR.rvErr ? RV_FAIL_HTML : ''}${rvBarHTML(act.filter(s => rvOpen(s)).length + act.filter(s => rvOpen(s, 'trv')).length)}
    <ul class="gr-list">${list.map(s => {
      const p0 = GR.pages[s.pages[0]];
      const lvc = s.level ? LV.find(l => l.k === s.level).cls : '';
      const n = s.text ? s.text.length : 0;
      return `<li class="gr-row ${s.skip ? 'skip' : ''} ${lvc}${rvOpen(s) ? ' rv-mark' : ''}" data-grrow="${esc(s.id)}">
        <button class="thumb" type="button" data-grview1="${esc(s.id)}" aria-label="${s.no}번 평가지 크게 보기">${p0 ? `<img src="${p0.thumb || p0.url}" alt="" loading="lazy" decoding="async">${grMaskOverlay(0)}` : `<span class="noimg">${s.no}</span>`}${s.pages.length > 1 ? `<small>${s.pages.length}쪽</small>` : ''}</button>
        <div class="body">
          <div class="head">
            <span class="badge num">${s.no}</span>
            ${s.status === 'done' && !s.skip ? `<span class="score num">${s.score}점</span>
              <select class="lvsel" data-grlv="${esc(s.id)}" aria-label="${s.no}번 수준" ${busy ? 'disabled' : ''}>${LV.map(l => `<option value="${l.k}" ${s.level === l.k ? 'selected' : ''}>${l.name}</option>`).join('')}${s.level ? '' : '<option value="" selected>-</option>'}</select>
              ${s.manual ? '<span class="chip">직접 옮김</span>' : ''}${s.unreadable ? '<span class="chip warn">알아보기 어려움</span>' : ''}` : ''}
            ${grStatusChip(s)}
            <span class="grow"></span>
            ${s.d && s.text ? `<span class="chip done">${ICON.check}사용함</span>` : ''}
          </div>
          ${s.text && !s.skip ? `<div class="gr-text ${s.d ? 'done' : ''} ${s.stale ? 'stale' : ''}${rvOpen(s, 'trv') ? ' rv-mark' : ''}" role="button" tabindex="0" data-grcopy="${esc(s.id)}" aria-label="${s.d ? '사용함. ' : ''}${s.no}번 평어 복사">${esc(s.text)}</div>${rvInline(s, 'gr:' + encodeURIComponent(s.id), `${s.no}번 평어`, 'trv', 'text')}` : ''}
          ${s.stale && s.text && !s.writing ? `<p class="muted warn">수준이 바뀌었어요. 평어를 다시 쓰세요.</p>` : ''}
          ${s.summary && !s.skip ? `<p class="muted gr-sum">${esc(s.summary)}</p>` : ''}
          ${rvOpen(s) && RV() ? `<div class="rv-inline" data-rv-for="grs:${esc(s.id)}">${RV().opinionHTML({ title: '두 AI의 점수가 10점 넘게 달라요', main: `${s.score}점 · ${s.summary || ''}`, alt: `${s.rv.score}점 · ${s.rv.summary || ''}`, use: 'grs:' + encodeURIComponent(s.id), keep: 'grs:' + encodeURIComponent(s.id), useLabel: '검토 점수 쓰기' })}</div>` : ''}
          ${s.err ? `<p class="muted err">${esc(s.err)}</p>` : ''}
          <div class="acts">
            ${s.text ? `<span class="muted num ${n < lo || n > hi ? 'warn' : ''}">${n}자</span>` : ''}
            ${s.d && s.text ? `<button class="btn text tiny" type="button" data-grundo="${esc(s.id)}">사용 표시 지우기</button>` : ''}
            ${s.status === 'done' && s.level && !busy && !s.skip ? `<button class="btn text tiny" type="button" data-grre="${esc(s.id)}">평어 다시 쓰기</button>` : ''}
            ${!busy && !s.skip && (s.status === 'err' || s.status === 'done') ? `<button class="btn text tiny" type="button" data-grregrade="${esc(s.id)}">다시 채점</button>` : ''}
            ${!busy && GR.phase !== 'done' ? `<button class="btn text tiny" type="button" data-grskip="${esc(s.id)}">${s.skip ? '채점에 넣기' : '채점에서 빼기'}</button>` : ''}
          </div>
        </div>
      </li>`;
    }).join('')}</ul>`;
}

/* ---------- 이름 칸 정하기 ---------- */
// shots: 학생마다 첫 쪽 [{ url, label }] · mask, all: 지금 가릴 곳 · what: '평가지'·'학습지' · save(mask, all)
// kind: 'name'(이름 칸 가리기) · 'no'(적힌 번호를 읽을 번호 칸 — 상자 하나, 모든 쪽 칸 없음)
function openMaskEditor({ shots, mask, all, what, save, kind = 'name' }) {
  if (!shots.length) return;
  let at = 0;
  const isNo = kind === 'no';
  const draft = mask.map(r => ({ ...r }));
  openSheet(`<h3>${isNo ? '번호 칸 정하기' : '이름 칸 가리기'}</h3>
    <p class="muted" style="margin:0">${isNo ? `${what}에서 학생이 번호를 쓰는 칸을 끌어서 상자로 표시하세요. 모든 학생의 같은 자리를 잘라 번호만 읽어요. 이름이 들어가지 않게 번호 칸만 표시해 주세요.` : `${what}에서 이름이 적힌 곳을 끌어서 상자로 표시하세요. 여러 곳을 표시할 수 있어요. 모든 학생의 같은 자리에 똑같이 가려요.`}</p>
    <div class="row" style="justify-content:space-between"><span class="row"><button class="icon-btn" type="button" id="mkPrev" aria-label="앞 학생">${ICON.back}</button><b class="num" id="mkWho"></b><button class="icon-btn" type="button" id="mkNext" aria-label="다음 학생">${ICON.chev}</button></span><button class="btn text tiny" type="button" id="mkClear">모두 지우기</button></div>
    <div class="mask-stage" id="mkStage"><div class="mk-inner" id="mkInner"><img id="mkImg" alt="${what}" draggable="false"><div id="mkBoxes"></div></div></div>
    ${isNo ? '' : `<label class="switch"><input type="checkbox" id="mkAll" ${all ? 'checked' : ''}>학생의 모든 쪽에서 가리기 (끄면 첫 쪽만)</label>`}
    <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close>취소</button><button class="btn primary" type="button" id="mkOk">다 했어요</button></div>`,
    sh => {
      sh.classList.add('wide');
      const stage = sh.querySelector('#mkStage'), inner = sh.querySelector('#mkInner'), img = sh.querySelector('#mkImg'), boxes = sh.querySelector('#mkBoxes');
      const show = () => {
        img.src = shots[at].url;
        sh.querySelector('#mkWho').textContent = shots[at].label;
        draw();
      };
      const draw = () => {
        boxes.innerHTML = draft.map((r, i) => `<i class="mk edit" style="left:${r.x * 100}%;top:${r.y * 100}%;width:${r.w * 100}%;height:${r.h * 100}%"><button type="button" data-mkdel="${i}" aria-label="이 상자 지우기">${ICON.x}</button></i>`).join('');
      };
      let start = null, cur = null;
      const pos = e => { const b = inner.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)), y: Math.max(0, Math.min(1, (e.clientY - b.top) / b.height)) }; };
      stage.addEventListener('pointerdown', e => {
        if (e.target.closest('[data-mkdel]')) return;
        e.preventDefault(); stage.setPointerCapture(e.pointerId);
        start = pos(e); cur = { x: start.x, y: start.y, w: 0, h: 0 }; if (isNo) draft.length = 0; draft.push(cur); draw();
      });
      stage.addEventListener('pointermove', e => {
        if (!start) return;
        const p = pos(e);
        Object.assign(cur, { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) });
        draw();
      });
      const end = () => { if (!start) return; if (cur.w < 0.01 || cur.h < 0.008) draft.splice(draft.indexOf(cur), 1); start = null; cur = null; draw(); };
      stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
      boxes.addEventListener('click', e => { const b = e.target.closest('[data-mkdel]'); if (b) { draft.splice(+b.dataset.mkdel, 1); draw(); } });
      sh.querySelector('#mkPrev').addEventListener('click', () => { at = (at - 1 + shots.length) % shots.length; show(); });
      sh.querySelector('#mkNext').addEventListener('click', () => { at = (at + 1) % shots.length; show(); });
      sh.querySelector('#mkClear').addEventListener('click', () => { draft.length = 0; draw(); });
      sh.querySelector('#mkOk').addEventListener('click', () => {
        const m = draft.map(r => ({ x: +r.x.toFixed(4), y: +r.y.toFixed(4), w: +r.w.toFixed(4), h: +r.h.toFixed(4) }));
        closeSheet(); save(m, isNo ? false : sh.querySelector('#mkAll').checked);
        toast(isNo ? (m.length ? '번호 칸을 정했어요' : '번호 칸을 지웠어요') : m.length ? `가릴 곳 ${m.length}개를 정했어요` : '가릴 곳을 지웠어요');
      });
      show();
    });
}
function openGRMask() {
  if (!GR.pages.length) return;
  const list = GR.students.filter(s => !s.skip);
  openMaskEditor({
    shots: list.length ? list.map(s => ({ url: GR.pages[s.pages[0]].url, label: `${s.no}번 첫 쪽` })) : [{ url: GR.pages[0].url, label: '첫 쪽' }],
    mask: GR.settings.mask, all: GR.settings.maskAll, what: '평가지',
    save: (mask, all) => { GR.settings.mask = mask; GR.settings.maskAll = all; grSaveSettings(); renderGR(); }
  });
}
/* ---------- 적힌 번호로 학생 맞추기 (core/student-no.js가 window.SSAM.studentNo로 줌) ---------- */
function openGRNoBox(then) {
  if (!GR.pages.length) return;
  openMaskEditor({
    kind: 'no', what: '평가지', all: false,
    shots: GR.students.map(s => ({ url: GR.pages[s.pages[0]].url, label: `${s.no}번 첫 쪽` })),
    mask: GR.settings.noBox ? [GR.settings.noBox] : [],
    save: m => { GR.settings.noBox = m.length ? m[m.length - 1] : null; grSaveSettings(); renderGR(); if (then && GR.settings.noBox) then(); }
  });
}
// 읽어 확인한 번호가 지금 쪽·학생과 같은지 (쪽을 더하거나 거꾸로 하거나 번호를 다시 매기면 달라짐)
const grNoSig = () => GR.students.map(s => `${GR.pages[s.pages[0]] ? GR.pages[s.pages[0]].url : ''}-${s.no}`).join(',');
async function grAskNos() {
  const N = window.SSAM.studentNo;
  if (!N) { toast('번호 읽기를 불러오지 못했어요. 새로고침해 주세요'); return; }
  if (!GR.settings.noBox) { toast('학생이 번호를 쓰는 칸을 먼저 정해 주세요'); openGRNoBox(() => grStart()); return; }
  if (GR.noBusy) return;
  // 「채점 안 함」 학생은 번호를 묻지 않고 맨 뒤에 그대로
  const list = GR.students.filter(s => !s.skip), skipped = GR.students.filter(s => s.skip);
  if (!list.length) return;
  GR.noBusy = true;
  const wait = N.openNoWait();
  let r;
  try { r = await N.readNos(list.map(s => GR.pages[s.pages[0]]), { box: GR.settings.noBox, mask: GR.settings.maskOn ? GR.settings.mask : [], signal: wait.signal }); }
  catch (e) { if (wait.gone()) return; wait.close(); toast(e && e.code === 'NO_AI' ? 'AI 키를 먼저 넣어 주세요' : errMsg(e && e.code, e), 6000); return; }
  finally { GR.noBusy = false; }
  if (wait.gone()) return; // 그만두기
  N.openNoCheck({ rows: list.map((s, k) => ({ crop: r.crops[k], ...r.nos[k] })), allowed: N.rosterAllowed(GR.settings.except), onOk: nos => {
    // 그 사이 쪽을 바꾸거나 채점을 시작했으면 버림
    const now = GR.students.filter(s => !s.skip);
    if (now.length !== list.length || now.some((s, i) => s !== list[i]) || ['grading', 'ranking', 'writing'].includes(GR.phase)) { toast('번호를 읽는 동안 평가지가 바뀌었어요. 다시 눌러 주세요'); return; }
    GR.students = [...N.byNoOrder(nos).map(k => ({ ...list[k], no: nos[k] })), ...skipped];
    GR.noSig = grNoSig();
    GRStore.save(); renderGR(); grStart();
  } });
}
function openGRView(id) {
  const s = grStudent(id); if (!s) return;
  openSheet(`<h3>${s.no}번 평가지</h3>
    ${s.status === 'done' ? `<p class="muted" style="margin:0"><b class="num">${s.score}점</b>${s.level ? ' · ' + LVNAME[s.level] : ''} · ${esc(s.summary || '')}</p>
      ${(s.evidence || []).length ? `<ul class="ev">${s.evidence.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${s.strengths ? `<p class="muted" style="margin:0">잘한 점: ${esc(s.strengths)}</p>` : ''}${s.improve ? `<p class="muted" style="margin:0">보완할 점: ${esc(s.improve)}</p>` : ''}` : ''}
    <div class="pages">${s.pages.map((pi, j) => GR.pages[pi] ? `<figure><div class="pg"><img src="${GR.pages[pi].url}" alt="${j + 1}쪽">${grMaskOverlay(j)}</div><figcaption class="muted">${esc(GR.pages[pi].name)}</figcaption></figure>` : '').join('') || '<p class="muted">스캔 이미지는 저장하지 않아서 지금은 볼 수 없어요.</p>'}</div>
    <div class="row" style="justify-content:flex-end"><button class="btn primary" type="button" data-close>닫기</button></div>`, sh => sh.classList.add('wide'));
}

/* ---------- 이벤트 ---------- */
/* 파일 고르기 칸은 화면에 붙여 둠. 어디에도 붙지 않은 칸은 파일 창이 열려 있는 동안
   메모리 정리(GC)로 치워져서, 파일을 골라도 아무 일이 일어나지 않음 (Windows 앱에서 자주 생김) */
let grPicker = null;
function grPickFiles(accept, multiple) {
  if (grPicker) grPicker.remove();
  const inp = grPicker = document.createElement('input');
  inp.type = 'file'; inp.accept = accept; inp.multiple = multiple; inp.hidden = true;
  document.body.appendChild(inp);
  return new Promise(res => {
    const done = files => { if (grPicker === inp) grPicker = null; inp.remove(); res(files); };
    inp.addEventListener('change', () => done(inp.files));
    inp.addEventListener('cancel', () => done(null));
    inp.click();
  });
}
async function grAddPages(files) {
  if (!files || !files.length) return;
  if (['grading', 'ranking', 'writing'].includes(GR.phase)) return;
  GR.loading = '평가지를 읽는 중'; renderGRBusy();
  try {
    const { pages, skipped } = await readFiles(files);
    if (pages.length) {
      // 끝난 채점(또는 불러온 기록) 뒤에 올리면 새 채점: 지난 평가지를 비우고 1번부터
      if (GR.id || GR.students.some(s => s.status === 'done' || s.text)) grNew(false);
      GR.pages.push(...pages); grBuildStudents();
      toast(`${pages.length}쪽을 올렸어요 · 학생 ${GR.students.length}명`);
    }
    if (skipped.length) toast(`읽지 못한 파일: ${skipped.slice(0, 3).join(', ')}${skipped.length > 3 ? ' 외' : ''} (PDF, JPG, PNG만 돼요)`, 4500);
  } catch (e) {
    toast(e && e.message === 'PDFJS' ? 'PDF를 읽는 도구를 불러오지 못했어요. 인터넷 연결을 확인하거나 사진(JPG·PNG)으로 올려 주세요.' : 'PDF를 읽지 못했어요. 암호가 걸린 파일인지 확인해 주세요.', 5000);
  } finally { GR.loading = ''; renderGR(); }
}
// 채점 평어를 붙여넣으려고 준비해 둔 것만 풂 (창체 붙여넣기는 그대로)
const neisIsGr = () => !NEIS.src || NEIS.src.key === 'gr';
function grNew(keepPages) {
  if (neisIsGr()) neisClose();
  grStop();
  GR.id = null; GR.createdAt = 0; GR.calibrated = false; GR.err = ''; GR._critCache = null;
  if (!keepPages) { grFreePages(); GR.pages = []; GR.students = []; GR.settings.startNo = 1; }
  else GR.students.forEach(s => Object.assign(s, { status: 'idle', score: null, score0: null, level: null, manual: false, summary: '', evidence: [], strengths: '', improve: '', text: '', d: 0, stale: false, err: '' }));
  GR.phase = 'setup'; GR.showRes = false;
}
async function grOpenHistory(id) {
  const b = await GRStore.get(id);
  if (!b) { toast('채점 기록을 불러오지 못했어요'); return; }
  grNew(false);
  GR.id = id; GR.title = b.title || ''; GR.unitId = b.unitId || ''; GR.refs = Array.isArray(b.refs) ? b.refs.filter(x => typeof x === 'string') : []; GR.criteria = b.criteria || ''; GR.critDocs = (b.critDocs || []).map(d => ({ name: String(d.name || ''), text: String(d.text || '') })); GR.createdAt = b.createdAt || 0; GR.calibrated = !!b.calibrated;
  if (b.settings) { const { except, ...rest } = b.settings; Object.assign(GR.settings, rest); GR.settings.ratio = { ...GR.settings.ratio, ...(b.settings.ratio || {}) }; }
  let fixed = 0;
  GR.students = (b.students || []).map(s => {
    // 예전 기록의 '~할 수 있음.' 끝맺음 고치기
    const text = s.text ? fixEnding(s.text) : s.text;
    if (text !== s.text) fixed++;
    return { ...s, text, pages: [], skip: !!s.skip, status: s.score == null ? 'idle' : 'done', manual: !!s.manual, stale: !!s.stale, d: s.d ? 1 : 0 };
  });
  // 예전 기록에는 채점에서 뺀 학생이 없음 → 예외 번호가 아닌 빈 번호는 「채점 안 함」 학생으로 채움
  const ex = new Set(((b.settings && b.settings.except) || []).map(Number));
  const have = new Set(GR.students.map(s => s.no));
  const nos = [...have].filter(n => n > 0);
  if (nos.length) {
    const hi = Math.max(...nos);
    for (let no = Math.min(...nos); no <= hi; no++) if (!have.has(no) && !ex.has(no)) GR.students.push({ id: grId(), no, pages: [], skip: true, status: 'idle', score: null, level: null, text: '', d: 0, stale: false, manual: false });
  }
  GR.students.sort((x, y) => x.no - y.no);
  GR.phase = grActive().every(s => s.text && !s.stale) ? 'done' : 'partial';
  if (fixed) GRStore.save();
  GR.showRes = true; $('#grView').classList.add('show-pane');
  renderGR();
}
document.addEventListener('click', async e => {
  if (S.mode !== 'gr' || !evalShown()) return;
  const t = e.target;
  const b = t.closest('[data-gr]');
  if (b && !b.disabled) {
    const a = b.dataset.gr;
    if (a === 'start') grStart();
    else if (a === 'stop') { grStop(); toast('멈췄어요. 채점한 결과는 그대로 있어요.'); }
    else if (a === 'new') { grNew(false); GR.title = ''; GR.criteria = ''; GR.critImgs = []; GR.critDocs = []; GR.refs = []; GR.refsAll = false; renderGR(); }
    else if (a === 'mask') openGRMask();
    else if (a === 'noBox') openGRNoBox();
    else if (a === 'reverse') { GR.pages.reverse(); grBuildStudents(); renderGR(); toast('쪽 순서를 거꾸로 바꿨어요'); }
    else if (a === 'clearPages') { grNew(false); renderGR(); }
    else if (a === 'critImg') {
      const fs = await grPickFiles('.hwp,.hwpx,.pdf,image/*', true); if (!fs || !fs.length) return;
      await grAddCrit(fs);
    }
    else if (a === 'back') { GR.showRes = false; $('#grView').classList.remove('show-pane'); }
    else if (a === 'reassign') {
      grAssign(false); const n = grActive().filter(s => s.stale).length;
      renderGR();
      if (n) { toast(`${n}명의 수준이 바뀌어 평어를 다시 써요`); grWrite(); } else toast('비율에 맞게 나뉘어 있어요');
    }
    else if (a === 'writeRest') grWrite();
    else if (a === 'rewriteAll') grConfirmRewrite();
    else if (a === 'copyAll') grCopyAll();
    else if (a === 'copyTable') {
      const lines = grActive().filter(s => s.text).sort((x, y) => x.no - y.no).map(s => `${s.no}\t${LVNAME[s.level] || ''}\t${s.text}`);
      copyText(lines.join('\n')).then(ok => toast(ok ? `${lines.length}명의 번호·수준·평어를 복사했어요 (엑셀에 붙여넣기 좋아요)` : '복사가 막혔어요.', 3500));
    }
    return;
  }
  const v = t.closest('[data-grview]'); if (v) { GR.view = v.dataset.grview; renderGRResults(); return; }
  const v1 = t.closest('[data-grview1]'); if (v1) { openGRView(v1.dataset.grview1); return; }
  const cp = t.closest('[data-grcopy]');
  if (cp) {
    const s = grStudent(cp.dataset.grcopy); if (!s) return;
    copyText(s.text).then(ok => {
      if (!ok) { selectText(cp); toast('자동 복사가 막혔어요. 선택된 평어를 Ctrl+C로 복사해 주세요.', 4000); return; }
      const was = s.d; s.d = 1; GRStore.save(); renderGRResults();
      toast(was ? `${s.no}번 평어를 다시 복사했어요` : `${s.no}번 평어를 복사했어요 · 사용함으로 표시했어요`);
    });
    return;
  }
  const ud = t.closest('[data-grundo]'); if (ud) { const s = grStudent(ud.dataset.grundo); if (s) { s.d = 0; GRStore.save(); renderGRResults(); toast(`${s.no}번 사용 표시를 지웠어요`); } return; }
  const re = t.closest('[data-grre]'); if (re) { const s = grStudent(re.dataset.grre); if (s) { s.stale = true; grWrite([s.id]); } return; }
  const rg = t.closest('[data-grregrade]');
  if (rg) {
    const s = grStudent(rg.dataset.grregrade); if (!s) return;
    if (!s.pages.length) { toast('스캔 이미지가 없어서 다시 채점할 수 없어요. 평가지를 다시 올려 주세요.', 4000); return; }
    if (!engineReady()) { openSettings(); return; }
    GR.single = true; GR.phase = 'grading'; GR.queue.push(s.id); s.status = 'queued'; GR._critCache = null;
    grPump();
    return;
  }
  const sk = t.closest('[data-grskip]'); if (sk) { const s = grStudent(sk.dataset.grskip); if (s) { s.skip = !s.skip; renderGR(); } return; }
  const cd = t.closest('[data-grcritdel]'); if (cd) { GR.critImgs.splice(+cd.dataset.grcritdel, 1); GR._critCache = null; renderGRSetup(); return; }
  const mx = t.closest('[data-grmix]'); if (mx) { GR.settings.mix = mx.dataset.grmix; grSaveSettings(); renderGRSetup(); if (GR.students.some(s => s.text)) toast('「평어 모두 다시 쓰기」를 누르면 새 방식으로 써요'); return; }
  const cdd = t.closest('[data-grcritdocdel]'); if (cdd) { GR.critDocs.splice(+cdd.dataset.grcritdocdel, 1); GRStore.save(); renderGRSetup(); return; }
  const cv = t.closest('[data-grcritview]'); if (cv) { openCritDoc(+cv.dataset.grcritview); return; }
  const hi = t.closest('[data-grhist]'); if (hi) { if (!['grading', 'ranking', 'writing'].includes(GR.phase)) grOpenHistory(hi.dataset.grhist); return; }
  const hd = t.closest('[data-grhistdel]');
  if (hd) {
    if (!hd.dataset.armed) { hd.dataset.armed = '1'; hd.classList.add('armed'); hd.title = '한 번 더 누르면 지워요'; toast('한 번 더 누르면 이 채점 기록을 지워요'); return; }
    const id = hd.dataset.grhistdel; if (id === GR.id) { grNew(false); }
    await GRStore.del(id); toast('채점 기록을 지웠어요'); renderGR(); return;
  }
  const dz = t.closest('#grDrop');
  if (dz && dz.getAttribute('aria-disabled') !== 'true') { const fs = await grPickFiles('.pdf,image/*', true); grAddPages(fs); }
});
/* 참고할 단원평가·활동지 체크·더보기 */
document.addEventListener('change', e => {
  if (S.mode !== 'gr' || !evalShown() || !e.target.dataset || !e.target.dataset.grRef) return;
  const k = e.target.dataset.grRef;
  GR.refs = e.target.checked ? [...new Set([...GR.refs, k])] : GR.refs.filter(x => x !== k);
  GRStore.save();
});
document.addEventListener('click', e => {
  if (S.mode !== 'gr' || !evalShown() || !e.target.closest || !e.target.closest('[data-gr-ref-more]')) return;
  GR.refsAll = true; renderGRSetup();
});
document.addEventListener('keydown', e => {
  if (S.mode !== 'gr' || !evalShown()) return;
  const el = e.target;
  if ((e.key === 'Enter' || e.key === ' ') && el.matches && (el.matches('[data-grcopy]') || el.matches('#grDrop'))) { e.preventDefault(); el.click(); }
});
document.addEventListener('input', e => {
  if (S.mode !== 'gr' || !evalShown()) return;
  const id = e.target.id;
  if (id === 'grTitle') { GR.title = e.target.value; GRStore.save(); }
  if (id === 'grCrit') { GR.criteria = e.target.value; GRStore.save(); }
});
document.addEventListener('change', e => {
  if (S.mode !== 'gr' || !evalShown()) return;
  const el = e.target, id = el.id;
  if (id === 'grUnit') { GR.unitId = el.value; renderGRSetup(); renderGRResults(); GRStore.save(); }
  else if (id === 'grPer' || id === 'grStartNo') {
    GR.settings.pagesPer = Math.max(1, Math.min(20, +$('#grPer').value || 1));
    GR.settings.startNo = Math.max(1, Math.min(99, +$('#grStartNo').value || 1));
    if (GR.students.some(s => s.status === 'done')) grNew(true);
    grBuildStudents(); grSaveSettings(); renderGR();
  }
  else if (id === 'grExcept') {
    GR.settings.except = grParseNos(el.value);
    if (!GR.settings.byNo) grRenumber(); // 적힌 번호로 맞추면 읽은 번호를 그대로 둠(예외 번호는 명단 점검에만 씀)
    grSaveSettings(); renderGR();
    setClass(CLASS.count, GR.settings.except, 'gr'); // 학급 명단과 같이 씀
    toast(GR.settings.byNo ? '예외 번호를 바꿨어요. 읽은 번호는 그대로예요' : GR.settings.except.length ? `${GR.settings.except.join(', ')}번을 건너뛰고 번호를 매겼어요` : '예외 번호를 지웠어요');
  }
  else if (id === 'grMaskOn') { GR.settings.maskOn = el.checked; grSaveSettings(); renderGR(); }
  else if (id === 'grByNo') { GR.settings.byNo = el.checked; grSaveSettings(); renderGR(); }
  else if (/^grR_/.test(id)) { GR.settings.ratio[id.slice(4)] = Math.max(0, Math.min(100, Math.round(+el.value || 0))); grSaveSettings(); renderGRSetup(); }
  else if (el.matches('[data-grlv]')) {
    const s = grStudent(el.dataset.grlv); if (!s) return;
    if (s.level !== el.value) { s.level = el.value; s.manual = true; s.stale = true; GRStore.save(); renderGRResults(); grWrite([s.id]); toast(`${s.no}번을 ${LVNAME[s.level]}(으)로 옮겼어요. 평어를 다시 써요`); }
  }
});
/* ---------- 전체복사 → 나이스 학생 칸에 차례로 붙여넣기 (Windows 앱) ----------
   전체복사를 누르면 앱이 Ctrl+V를 잠깐 맡아 둠. 나이스(브라우저)에서 첫 학생 칸을 누르고 Ctrl+V를 누르면
   학생마다 평어 넣기 → Tab을 정한 횟수만큼 눌러 다음 학생 칸으로 옮기기를 되풀이함.
   전출 등으로 뺀 번호(예외 번호)는 나이스에도 칸이 없으므로 넣지 않고, 평어가 없는 학생은 칸을 비워 두고 넘어감 */
// 나이스 화면마다 Tab 횟수 등이 다를 수 있어 설정을 따로 둠 (채점 평어 'gr' · 창체 'cc')
const neisOptKey = k => (k && k !== 'gr' ? 'ssam:neis:' + k : 'ssam:neis');
function neisOpts(k = NEIS.src && NEIS.src.key) {
  const o = Store.lsGet(neisOptKey(k), null) || {};
  return { tabs: Math.min(9, Math.max(1, (o.tabs | 0) || 3)), slow: !!o.slow, overwrite: !!o.overwrite, method: o.method === 'paste' ? 'paste' : 'type', anyWindow: !!o.anyWindow };
}
function neisSaveOpts(o, k = NEIS.src && NEIS.src.key) { Store.lsSet(neisOptKey(k), o); }
const grNeisText = s => (s && s.text && !s.skip ? s.text : '');
function grNeisList() { return GR.students.slice().sort((a, b) => a.no - b.no); }
// 붙여넣을 글의 출처: { key, what, text(id), no(id), mark(id), saved() }
const GR_NEIS_SRC = {
  key: 'gr', what: '평어',
  text: id => grNeisText(grStudent(id)),
  no: id => { const s = grStudent(id); return s ? s.no : 0; },
  mark: id => { const s = grStudent(id); if (grNeisText(s)) s.d = 1; },
  saved: () => { GRStore.save(); renderGRResults(); }
};
const neisSrc = () => NEIS.src || GR_NEIS_SRC;
const neisNoOf = (ids, i, src = neisSrc()) => src.no(ids[i]) || i + 1;
const neisNo = i => neisNoOf(NEIS.ids, i);
function neisInvoke(cmd, args) {
  try { const p = window.__TAURI__.core.invoke(cmd, args); return p && p.then ? p : Promise.resolve(p); } catch (e) { return Promise.reject(e); }
}
function grCopyAll() { neisCopyAll(GR_NEIS_SRC, grNeisList().map(s => s.id)); }
/* 전체복사: 웹은 번호순으로 한 줄에 한 명씩 복사, Windows 앱은 나이스에 차례로 넣을 준비 */
function neisCopyAll(src, ids) {
  if (NEIS.state === 'running') { toast('나이스에 붙여넣는 중이에요. 끝난 뒤에 다시 눌러 주세요'); return; }
  const texts = ids.map(id => src.text(id));
  const n = texts.filter(Boolean).length;
  if (!n) { toast(`복사할 ${src.what}${jo(src.what, '이', '가')} 없어요`); return; }
  copyText(texts.join('\n')).then(ok => {
    if (!IN_APP) {
      if (!ok) { toast('복사가 막혔어요. 브라우저의 클립보드 권한을 확인해 주세요.', 4000); return; }
      ids.forEach(id => src.mark(id));
      src.saved();
      toast(`${n}명의 ${src.what}${jo(src.what, '을', '를')} 번호순으로 한 줄에 한 명씩 복사했어요 · 나이스 학생 칸에 차례로 넣기는 Windows 앱에서 돼요`, 5000);
      return;
    }
    if (NEIS.open && NEIS.src && NEIS.src !== src && NEIS.state !== 'idle') neisInvoke('neis_disarm').catch(() => {});
    NEIS.src = src; NEIS.ids = ids.slice();
    neisArm(0);
  });
}
function neisListen() {
  if (NEIS.listening || !IN_APP) return;
  const T = window.__TAURI__;
  if (!T.event || !T.event.listen) return;
  NEIS.listening = true;
  T.event.listen('neis-paste', ev => neisOnEvent(ev.payload || {})).catch(() => { NEIS.listening = false; });
}
async function neisArm(from) {
  if (NEIS.state === 'running') return;
  neisListen();
  clearTimeout(NEIS.rearmT);
  const seq = ++NEIS.seq;
  NEIS.from = Math.max(0, Math.min(NEIS.ids.length - 1, from | 0));
  NEIS.done = 0; NEIS.reason = ''; NEIS.msg = ''; NEIS.note = ''; NEIS.stopping = false; NEIS.open = true; NEIS.state = 'arming';
  const ids = NEIS.ids.slice(), start = NEIS.from, src = neisSrc();
  const texts = ids.slice(start).map(id => src.text(id));
  NEIS.total = texts.length;
  const o = neisOpts();
  renderNeis();
  let r = null, err = '';
  try { r = await neisInvoke('neis_arm', { texts, tabs: o.tabs, slow: o.slow, overwrite: o.overwrite, method: o.method, anyWindow: o.anyWindow }); }
  catch (e) { err = String((e && e.message) || e || '준비하지 못했어요'); }
  if (seq !== NEIS.seq) return; // 그새 다시 준비했음 (새 요청이 처리함)
  if (NEIS.state !== 'arming') {
    // 그새 창을 닫았으면 방금 한 준비도 풂
    if (NEIS.state === 'idle' && !err) neisInvoke('neis_disarm').catch(() => {});
    return;
  }
  if (err) { NEIS.state = 'error'; NEIS.msg = err; NEIS.job = null; }
  else { NEIS.state = 'armed'; NEIS.job = { gen: r && r.gen, ids, from: start, src }; NEIS.until = Date.now() + ((r && +r.secs) || 300) * 1000; }
  renderNeis();
}
function neisClose() {
  clearTimeout(NEIS.rearmT);
  if (IN_APP && NEIS.state !== 'idle') neisInvoke('neis_disarm').catch(() => {});
  if (NEIS.state === 'running') {
    // 지금 학생까지 넣고 멈춤 → 끝 알림이 오면 결과와 「이어서」를 보여 줌
    NEIS.stopping = true; renderNeis(); return;
  }
  NEIS.seq++; NEIS.job = null;
  NEIS.open = false; NEIS.state = 'idle';
  renderNeis();
}
function neisMark(job, done) {
  for (let i = 0; i < done; i++) job.src.mark(job.ids[job.from + i]);
}
function neisOnEvent(p) {
  const job = NEIS.job;
  if (!job || p.gen !== job.gen) return; // 다른(예전) 준비에 대한 알림
  if (p.state === 'expired') { if (NEIS.state === 'armed') { NEIS.state = 'expired'; NEIS.job = null; renderNeis(); } return; }
  if (p.state === 'elsewhere') {
    if (NEIS.state === 'armed') { NEIS.note = p.message || '다른 프로그램'; renderNeis(); }
    return;
  }
  if (p.state === 'start') { clearTimeout(NEIS.rearmT); NEIS.seq++; NEIS.state = 'running'; NEIS.done = 0; NEIS.total = p.total || NEIS.total; NEIS.open = true; NEIS.note = ''; }
  else if (p.state === 'progress') { NEIS.done = p.done | 0; }
  else if (p.state === 'end') {
    NEIS.done = p.done | 0; NEIS.reason = p.reason || 'finished'; NEIS.msg = p.message || '';
    NEIS.state = 'end'; NEIS.stopping = false;
    neisMark(job, NEIS.done); job.src.saved();
  }
  renderNeis();
}
function renderNeis() {
  let box = document.getElementById('neisPanel');
  if (!NEIS.open) { if (box) box.remove(); clearInterval(NEIS.timer); NEIS.timer = null; return; }
  if (!box) { box = document.createElement('section'); box.id = 'neisPanel'; box.className = 'neis'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
  const o = neisOpts();
  const src = neisSrc();
  const st = NEIS.state, from = NEIS.from, n = NEIS.total;
  const missing = NEIS.ids.slice(from).filter(id => !src.text(id)).map(id => src.no(id));
  const opts = `<details class="neis-opts" ${st === 'error' ? 'open' : ''}><summary>붙여넣기 설정</summary>
      <div class="neis-row"><span>시작 번호</span><select data-neisfrom aria-label="시작 번호">${NEIS.ids.map((id, i) => `<option value="${i}" ${i === from ? 'selected' : ''}>${neisNo(i)}번</option>`).join('')}</select></div>
      <div class="neis-row"><span>다음 학생 칸까지 Tab</span><span class="stepper"><button class="icon-btn tiny" type="button" data-neistab="-1" aria-label="줄이기" ${o.tabs <= 1 ? 'disabled' : ''}>−</button><b class="num">${o.tabs}번</b><button class="icon-btn tiny" type="button" data-neistab="1" aria-label="늘리기" ${o.tabs >= 9 ? 'disabled' : ''}>+</button></span></div>
      <div class="neis-row"><span>넣는 방식</span><div class="seg"><button type="button" data-neismethod="type" aria-pressed="${o.method === 'type'}">글자 입력</button><button type="button" data-neismethod="paste" aria-pressed="${o.method === 'paste'}">붙여넣기</button></div></div>
      <div class="neis-row"><span>속도</span><div class="seg"><button type="button" data-neisslow="0" aria-pressed="${!o.slow}">보통</button><button type="button" data-neisslow="1" aria-pressed="${o.slow}">천천히</button></div></div>
      <label class="neis-row chk"><input type="checkbox" data-neisover ${o.overwrite ? 'checked' : ''}><span>칸에 있던 글을 지우고 넣기</span></label>
      <label class="neis-row chk"><input type="checkbox" data-neisany ${o.anyWindow ? 'checked' : ''}><span>브라우저가 아닌 창(가상 PC 등)에서도 쓰기</span></label>
      <p class="muted">Tab은 나이스에서 몇 번 눌러야 다음 학생 평어 칸으로 가는지 맞춰 주세요. 글이 안 들어가거나 깨지면 「붙여넣기」로, 칸이 밀리면 「천천히」로 바꾸세요.</p>
    </details>`;
  let body = '', acts = '';
  if (st === 'arming' || st === 'armed') {
    body = `<ol class="neis-steps">
        <li>나이스에서 <b>${neisNo(from)}번</b> 학생 ${esc(src.field || '평어')} 칸을 누르세요.</li>
        <li><kbd>Ctrl</kbd>+<kbd>V</kbd>를 누르면 ${n > 1 ? `${neisNo(from)}번부터 ${neisNo(from + n - 1)}번까지 ${n}명이` : `${neisNo(from)}번 1명이`} 차례로 들어가요.</li>
      </ol>
      ${missing.length ? `<p class="muted warn">${esc(src.what)}${jo(src.what, '이', '가')} 없는 ${missing.length}명(${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '…' : ''}번)은 칸을 비워 두고 넘어가요.</p>` : ''}
      ${NEIS.note ? `<p class="muted warn">방금 Ctrl+V를 누른 곳(${esc(NEIS.note)})은 브라우저가 아니어서 평소처럼 붙여넣었어요. 나이스 화면에서 눌러 주세요.</p>` : ''}
      <p class="muted">${st === 'arming' ? '<span class="spin"></span>준비하는 중…' : `이 창을 닫기 전까지 브라우저에서 누른 Ctrl+V는 나이스 붙여넣기로 쓰여요 · <span class="num" data-neisleft></span> 뒤에 저절로 꺼져요`}</p>
      ${opts}`;
    acts = `<button class="btn" type="button" data-neis="close">취소</button>`;
  } else if (st === 'running') {
    const job = NEIS.job || { ids: NEIS.ids, from, src };
    const cur = Math.min(NEIS.done, n - 1);
    body = `<p><span class="spin"></span>${NEIS.stopping ? '멈추는 중' : '붙여넣는 중'} · <b class="num">${Math.min(NEIS.done + 1, n)}</b>/${n}명 (${neisNoOf(job.ids, job.from + cur, job.src)}번)</p>
      <div class="meter big"><i style="width:${Math.round(NEIS.done / Math.max(1, n) * 100)}%"></i></div>
      <p class="muted">${NEIS.stopping ? '지금 학생까지 넣고 멈춰요.' : '끝날 때까지 마우스와 키보드를 놓아 두세요. <kbd>Esc</kbd>를 누르면 지금 학생까지 넣고 멈춰요.'}</p>`;
    acts = NEIS.stopping ? '' : `<button class="btn" type="button" data-neis="close">멈추기</button>`;
  } else if (st === 'end') {
    const job = NEIS.job || { ids: NEIS.ids, from, src };
    const next = job.from + NEIS.done;
    const more = next < job.ids.length;
    const no = i => neisNoOf(job.ids, i, job.src);
    if (NEIS.reason === 'finished') {
      const ids = job.ids.slice(job.from, next), put = ids.filter(id => job.src.text(id)).length;
      const range = NEIS.done > 1 ? `${no(job.from)}번부터 ${no(next - 1)}번까지` : `${no(job.from)}번`;
      body = `<p class="neis-ok">${ICON.check}<b>${range} ${put}명을 넣었어요</b></p>
        <p class="muted">${put < ids.length ? `${esc(job.src.what)}${jo(job.src.what, '이', '가')} 없는 ${ids.length - put}명은 칸을 비워 두었어요. ` : ''}나이스에서 내용을 확인하고 저장을 눌러 주세요.</p>`;
    } else {
      const why = {
        cancelled: 'Esc나 멈추기를 눌러 멈췄어요.', focus: 'Ctrl+V를 누른 창에서 다른 창으로 옮겨 가서 멈췄어요.',
        keys: '붙여넣는 동안 키보드를 눌러서 멈췄어요.', error: NEIS.msg || '오류로 멈췄어요.'
      }[NEIS.reason] || '멈췄어요.';
      const check = more && (NEIS.reason === 'focus' || NEIS.reason === 'keys') ? ` ${no(next)}번 칸에 글이 반쯤 들어갔을 수 있으니 확인해 주세요.` : '';
      body = `<p><b>${NEIS.done ? `${no(next - 1)}번까지 넣고 멈췄어요` : '넣지 못했어요'}</b></p><p class="muted">${esc(why + check)}</p>`;
    }
    acts = `${more && NEIS.reason !== 'finished' ? `<button class="btn primary" type="button" data-neis="resume">${no(next)}번부터 이어서</button>` : ''}<button class="btn" type="button" data-neis="close">닫기</button>`;
  } else if (st === 'expired') {
    body = `<p><b>준비한 지 5분이 지나 꺼졌어요</b></p><p class="muted">나이스에 넣으려면 다시 준비해 주세요.</p>`;
    acts = `<button class="btn primary" type="button" data-neis="again">다시 준비</button><button class="btn" type="button" data-neis="close">닫기</button>`;
  } else if (st === 'error') {
    body = `<p class="muted err">${esc(NEIS.msg)}</p>${opts}`;
    acts = `<button class="btn primary" type="button" data-neis="again">다시 준비</button><button class="btn" type="button" data-neis="close">닫기</button>`;
  }
  const keep = box.querySelector('details.neis-opts');
  const wasOpen = keep && keep.open;
  box.innerHTML = `<div class="neis-h"><span class="neis-ic">${ICON.copy}</span><h3>나이스에 차례로 붙여넣기${src.title ? `<small>${esc(src.title)}</small>` : ''}</h3>${st === 'running' ? '' : `<button class="icon-btn" type="button" data-neis="close" aria-label="닫기" title="닫기">${ICON.x}</button>`}</div>
    <div class="neis-b">${body}</div>${acts ? `<div class="neis-a">${acts}</div>` : ''}`;
  if (wasOpen) { const d = box.querySelector('details.neis-opts'); if (d) d.open = true; }
  neisTick();
  clearInterval(NEIS.timer); NEIS.timer = null;
  if (st === 'armed') NEIS.timer = setInterval(neisTick, 1000);
}
function neisTick() {
  const el = document.querySelector('#neisPanel [data-neisleft]'); if (!el) return;
  const left = Math.max(0, Math.round((NEIS.until - Date.now()) / 1000));
  el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
}
// 설정을 바꾸면 잠깐 뒤 새 설정으로 다시 준비
function neisRearmSoon() {
  clearTimeout(NEIS.rearmT);
  if (!['armed', 'arming', 'error', 'expired'].includes(NEIS.state)) { renderNeis(); return; }
  NEIS.rearmT = setTimeout(() => neisArm(NEIS.from), 350);
  renderNeis();
}
function neisSetOpt(k, v) { const o = neisOpts(); o[k] = v; neisSaveOpts(o); neisRearmSoon(); }
document.addEventListener('click', e => {
  const t = e.target; if (!t.closest || !t.closest('#neisPanel')) return;
  const b = t.closest('[data-neis]');
  if (b) {
    const a = b.dataset.neis;
    if (a === 'close') neisClose();
    else if (a === 'resume') { const j = NEIS.job; if (j) { NEIS.ids = j.ids; NEIS.src = j.src; neisArm(j.from + NEIS.done); } }
    else if (a === 'again') neisArm(NEIS.from);
    return;
  }
  const tb = t.closest('[data-neistab]');
  if (tb && !tb.disabled) { neisSetOpt('tabs', Math.min(9, Math.max(1, neisOpts().tabs + (+tb.dataset.neistab)))); return; }
  const sl = t.closest('[data-neisslow]'); if (sl) { neisSetOpt('slow', sl.dataset.neisslow === '1'); return; }
  const md = t.closest('[data-neismethod]'); if (md) { neisSetOpt('method', md.dataset.neismethod); return; }
});
document.addEventListener('change', e => {
  const t = e.target; if (!t.closest || !t.closest('#neisPanel')) return;
  if (t.matches('[data-neisover]')) neisSetOpt('overwrite', t.checked);
  else if (t.matches('[data-neisany]')) neisSetOpt('anyWindow', t.checked);
  else if (t.matches('[data-neisfrom]')) { NEIS.from = +t.value || 0; neisRearmSoon(); }
});
const grDropZone = t => t && t.closest && (t.closest('#grDrop') || t.closest('#grCritBox'));
['dragenter', 'dragover'].forEach(ev => document.addEventListener(ev, e => {
  if (S.mode !== 'gr' || !evalShown()) return;
  const dz = grDropZone(e.target); if (!dz) return;
  e.preventDefault(); dz.classList.add('on');
}));
document.addEventListener('dragleave', e => { const dz = grDropZone(e.target); if (dz && !dz.contains(e.relatedTarget)) dz.classList.remove('on'); });
document.addEventListener('drop', e => {
  if (S.mode !== 'gr' || !evalShown()) return;
  const dz = grDropZone(e.target); if (!dz) return;
  e.preventDefault(); dz.classList.remove('on');
  if (!(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length)) return;
  if (dz.id === 'grCritBox') grAddCrit(e.dataTransfer.files); else grAddPages(e.dataTransfer.files);
});
storeReady.then(() => { grLoadLastSettings(); GRStore.list(); });

/* ===== 창의적 체험활동: 공통 활동을 넣으면 학생마다 다른 특기사항 문장을 씀 =====
   영역: 자율·자치활동 · 동아리활동 · 진로활동. 활동마다 학생 한 명에 한 문장씩 쓰고 활동 차례대로 이어 붙임.
   동아리활동은 앞에 (동아리명)을 붙임. 학생 번호는 학급 명단(학생 수·예외 번호)을 따름 */
const CC_AREAS = [
  { k: 'auto', name: '자율·자치활동', ph: ['예) 1인 1역', '예) 학급에 필요한 역할을 스스로 정해 한 학기 동안 맡아 실천함'],
    ex: ['학급에 필요한 역할이 무엇인지 고민하고 알맞은 1인 1역을 스스로 골라 한 학기 동안 성실하게 수행함.', '학급에 필요한 역할이 무엇인지 고민하고 알맞은 1인 1역을 스스로 골라 한 학기 동안 성실하게 수행한다.'] },
  { k: 'club', name: '동아리활동', ph: ['예) 학교폭력 방어자 역할극', '예) 방관자와 방어자의 역할을 알아보고 역할극으로 대처 방법을 익힘'],
    ex: ['역할극에서 방어자의 입장을 체험하며 학교폭력 상황에 지혜롭게 대처하는 방법을 익힘.', '역할극에서 방어자의 입장을 체험하며 학교폭력 상황에 지혜롭게 대처하는 방법을 익힌다.'] },
  { k: 'career', name: '진로활동', ph: ['예) 직업 탐색', '예) 여러 직업이 하는 일과 필요한 능력을 알아보고 관심 있는 직업을 찾아봄'],
    ex: ['여러 직업이 하는 일과 필요한 능력을 알아보고 관심 있는 직업의 특징을 꼼꼼하게 탐색함.', '여러 직업이 하는 일과 필요한 능력을 알아보고 관심 있는 직업의 특징을 꼼꼼하게 탐색한다.'] }
];
const CC_LEN = { short: [30, 50], mid: [45, 70], long: [70, 100] };
const ccId = () => Math.random().toString(36).slice(2, 8);
const ccNewAct = () => ({ id: ccId(), name: '', desc: '' });
const CHE = {
  areas: { auto: { acts: [ccNewAct()], items: {} }, club: { club: '', acts: [ccNewAct()], items: {} }, career: { acts: [ccNewAct()], items: {} } },
  view: 'auto', len: 'mid', grade: 3,
  queue: [], running: new Map(), err: '', waitT: null, showRes: false, loaded: false,
  wrote: new Set(), rvCtl: null, // 이번 차례에 쓴 창체 문장(검토는 이것만), 검토 멈추기
  sheets: {}, loading: null // 학습지 스캔 (아래 「학습지 스캔」)
};
const ccInfo = k => CC_AREAS.find(a => a.k === k);
const ccArea = k => CHE.areas[k];
const ccSig = a => (a.name || '').trim() + '|' + (a.desc || '').trim();
// 내용이 있는 활동만
const ccActs = k => ccArea(k).acts.filter(a => (a.name || '').trim() || (a.desc || '').trim());
function ccItem(k, no) { const A = ccArea(k); return A.items[no] || (A.items[no] = { parts: {}, d: 0 }); }
/* 학생 한 명의 그 영역 글: (동아리명) + 활동별 문장 */
function ccText(k, no) {
  const A = ccArea(k), it = A.items[no]; if (!it) return '';
  const parts = ccActs(k).map(a => it.parts[a.id] && it.parts[a.id].t).filter(Boolean);
  if (!parts.length) return '';
  const club = k === 'club' ? (A.club || '').trim() : '';
  return (club ? `(${club}) ` : '') + parts.join(' ');
}
// none 아직 · part 일부 활동만 · stale 활동 내용이 바뀜 · ok
function ccState(k, no) {
  const it = ccArea(k).items[no], acts = ccActs(k);
  if (!it || !acts.some(a => it.parts[a.id])) return 'none';
  if (acts.some(a => !it.parts[a.id])) return 'part';
  if (acts.some(a => it.parts[a.id].sig !== ccSig(a))) return 'stale';
  if (acts.some(a => ccSheetNew(a.id, no, it.parts[a.id]))) return 'sheet'; // 넣은 학습지를 아직 읽지 않음
  return 'ok';
}
const ccBusy = () => CHE.running.size > 0 || CHE.queue.length > 0;
const ccAreaBusy = k => CHE.queue.some(j => j.k === k) || [...CHE.running.values()].some(r => r.k === k);

/* ---------- 학습지 스캔 ----------
   활동마다 학생들이 쓴 학습지를 번호 순서대로 스캔해 넣으면, 학생마다 학습지를 읽고 그 학생만의 문장을 씀.
   스캔은 이 화면에만 두고 저장하지 않음. AI가 학습지에서 읽은 내용(obs)은 학생 글과 함께 저장해서,
   스캔이 없어도 다시 쓸 때 그 내용으로 씀. 가릴 이름 칸(mask·maskAll)은 활동에 저장함
   CHE.sheets[활동 id] = { id, pages, per: 학생당 쪽, startNo: 시작 번호, skip: 학습지가 없는 번호 } */
function ccSheetMap(actId) {
  const sh = CHE.sheets[actId]; if (!sh) return null;
  const per = Math.max(1, sh.per | 0), skip = new Set(sh.skip);
  const nos = classNos().filter(no => no >= sh.startNo && !skip.has(no));
  const map = new Map(), keys = new Map();
  let i = 0;
  for (const no of nos) {
    if (i >= sh.pages.length) break;
    const pg = sh.pages.slice(i, i + per);
    map.set(no, pg); keys.set(no, `${sh.id}:${i}+${pg.length}`); i += per;
  }
  return { per, map, keys, nos, extra: Math.max(0, sh.pages.length - i) };
}
const ccSheetPages = (actId, no) => { const sm = ccSheetMap(actId); return (sm && sm.map.get(no)) || []; };
// 그 학생에게 간 학습지 쪽을 가리키는 값. 쪽 나누기를 바꾸면 달라짐
const ccSheetKey = (actId, no) => { const sm = ccSheetMap(actId); return (sm && sm.keys.get(no)) || ''; };
// 그 학생 학습지가 있는데 글(part)이 그 학습지로 쓴 것이 아님
const ccSheetNew = (actId, no, p) => { const key = ccSheetKey(actId, no); return !!(key && (!p || p.w !== key)); };
// 학습지에서 읽은 내용 { n: 내용, w: 읽은 학습지 쪽(ccSheetKey), b: 비어 있거나 알아보기 어려움 }
const ccObs = (k, no, actId) => { const it = ccArea(k).items[no]; return (it && it.obs && it.obs[actId]) || null; };
function ccFreeSheet(actId) {
  const sh = CHE.sheets[actId]; if (!sh) return;
  for (const p of sh.pages) { URL.revokeObjectURL(p.url); if (p.thumb) URL.revokeObjectURL(p.thumb); p._enc = null; }
  delete CHE.sheets[actId];
}
const ccMask = a => (Array.isArray(a.mask) ? a.mask : []);

/* ---------- 저장 ---------- */
const CCStore = {
  async load() {
    await storeReady;
    let b = null;
    if (Store.mode === 'db') { try { const s = await cap.db.doc(Store.base() + '/cc').get(); b = s.exists ? JSON.parse(JSON.stringify(s.data())) : null; } catch (e) {} }
    else b = Store.lsGet('ssam:cc', null);
    if (b && b.areas) {
      for (const a of CC_AREAS) {
        const src = b.areas[a.k] || {};
        const acts = Array.isArray(src.acts) ? src.acts.filter(x => x && x.id).map(x => {
          const a = { id: String(x.id), name: String(x.name || ''), desc: String(x.desc || '') };
          const m = Array.isArray(x.mask) ? x.mask.filter(r => r && r.w > 0 && r.h > 0).map(r => ({ x: +r.x || 0, y: +r.y || 0, w: +r.w, h: +r.h })) : [];
          if (m.length) { a.mask = m; a.maskAll = !!x.maskAll; }
          return a;
        }) : [];
        CHE.areas[a.k] = { acts: acts.length ? acts : [ccNewAct()], items: src.items && typeof src.items === 'object' ? src.items : {} };
        if (a.k === 'club') CHE.areas.club.club = String(src.club || '');
      }
      if (CC_LEN[b.len]) CHE.len = b.len;
      if (b.grade >= 1 && b.grade <= 6) CHE.grade = b.grade | 0;
    } else if (HK.settings.grade) CHE.grade = HK.settings.grade;
    CHE.loaded = true;
    if (S.mode === 'cc') renderCC();
  },
  save() {
    clearTimeout(this.t);
    this.t = setTimeout(() => this.write(), 400);
  },
  write() {
    this.t = null;
    const body = { areas: CHE.areas, len: CHE.len, grade: CHE.grade, at: Date.now() };
    if (Store.mode === 'db') writeDoc(Store.base() + '/cc', JSON.parse(JSON.stringify(body)));
    else if (Store.mode === 'local') Store.lsSet('ssam:cc', body);
  }
};

/* ---------- 프롬프트 ---------- */
// 학년·영역·동아리·활동
function ccHead(k, act) {
  const club = k === 'club' ? (ccArea('club').club || '').trim() : '';
  return [
    `[학년] ${CHE.grade}학년`,
    `[영역] ${ccInfo(k).name}`,
    club ? `[동아리] ${club}` : null,
    `[활동] ${(act.name || '').trim() || '(이름 없음)'}${(act.desc || '').trim() ? ` — ${act.desc.trim()}` : ''}`
  ];
}
function ccPrompt(k, act, n, avoid) {
  const info = ccInfo(k), A = ccArea(k);
  const [lo, hi] = CC_LEN[CHE.len] || CC_LEN.mid;
  const da = S.settings.ending === 'da';
  const club = k === 'club' ? (A.club || '').trim() : '';
  return [
    `당신은 초등학교 학교생활기록부 '창의적 체험활동 특기사항'을 쓰는 경력 많은 초등 담임교사입니다.`,
    `아래 활동에 함께 참여한 서로 다른 학생 ${n}명에게 쓸 특기사항 문장을 정확히 ${n}개 쓰세요. 학급이 같은 활동을 했어도 학생마다 드러나는 모습이 다르게 씁니다.`,
    ``,
    ...ccHead(k, act),
    ``,
    `[쓰기 규칙]`,
    `1. 한 줄에 마침표가 하나뿐인 한 문장만 씁니다. 번호, 글머리표, 따옴표, 제목, 설명은 쓰지 않습니다.`,
    `2. ${endingRule(da)}`,
    `3. ${pronounRule()}`,
    `4. 학생 이름이나 '이 학생은' 같은 주어를 쓰지 않고, 문장 앞에 '또한', '그리고' 같은 이음말을 붙이지 않습니다.`,
    `5. 문장 하나는 공백을 포함해 ${lo}~${hi}자로 씁니다.`,
    `6. 활동에서 학생이 실제로 한 일과 깨달은 점, 태도가 구체적으로 드러나게 씁니다. 활동 이해, 참여 태도, 실천, 협력, 배려, 책임감, 성찰, 성장 등 관점을 골고루 섞고, 문장마다 시작하는 말·핵심 표현·서술어를 다르게 씁니다.`,
    `7. 긍정적이고 따뜻한 말로 쓰되 지나치게 부풀리지 않습니다. 부족한 점이나 부정적인 표현은 쓰지 않습니다.`,
    `8. ${club ? '동아리 이름은 문장 앞에 따로 붙으므로 문장에 쓰지 않습니다. ' : ''}학교 밖 대회 수상, 사교육, 상표나 실제 인물 이름은 쓰지 않습니다.`,
    `   - 좋은 예(형식만 참고): ${info.ex[da ? 1 : 0]}`,
    avoid.length ? `\n[이미 쓴 문장] 아래 문장들과 표현·구조가 겹치지 않게 씁니다.\n${avoid.map(t => '- ' + t).join('\n')}\n` : null,
    ``,
    `문장 ${n}개만 줄바꿈으로 구분해 출력하세요.`
  ].filter(x => x != null).join('\n');
}
/* 학습지로 쓰는 문장: 학생마다 학습지에서 드러난 모습을 살림 */
function ccSheetRules(k) {
  const [lo, hi] = CC_LEN[CHE.len] || CC_LEN.mid;
  const da = S.settings.ending === 'da';
  const club = k === 'club' ? (ccArea('club').club || '').trim() : '';
  return [
    `[쓰기 규칙]`,
    `1. 마침표가 하나뿐인 한 문장으로 씁니다.`,
    `2. ${endingRule(da)}`,
    `3. ${pronounRule()}`,
    `4. 학생 이름이나 '이 학생은' 같은 주어를 쓰지 않고, 문장 앞에 '또한', '그리고' 같은 이음말을 붙이지 않습니다.`,
    `5. 문장은 공백을 포함해 ${lo}~${hi}자로 씁니다.`,
    `6. 학습지에서 드러난 그 학생만의 생각이나 실천을 한두 가지 골라, 학생이 한 일과 깨달은 점, 태도로 구체적으로 씁니다. 학습지에 쓴 말을 그대로 옮기지 않고, '학습지'라는 말이나 문항 번호는 쓰지 않습니다.`,
    `7. 긍정적이고 따뜻한 말로 쓰되 지나치게 부풀리지 않습니다. 부족한 점이나 부정적인 표현은 쓰지 않습니다.`,
    `8. ${club ? '동아리 이름은 문장 앞에 따로 붙으므로 문장에 쓰지 않습니다. ' : ''}가족 사정이나 건강처럼 민감한 내용, 학교 밖 대회 수상, 사교육, 상표나 실제 인물 이름은 쓰지 않습니다.`,
    `   - 좋은 예(형식만 참고): ${ccInfo(k).ex[da ? 1 : 0]}`
  ];
}
const ccAvoid = avoid => avoid.length ? `\n[다른 학생에게 쓴 문장] 아래 문장들과 표현·구조가 겹치지 않게 씁니다.\n${avoid.map(t => '- ' + t).join('\n')}\n` : null;
// 학생 한 명의 학습지 이미지 n장을 읽고 씀
function ccSheetPrompt(k, act, n, avoid) {
  return [
    `당신은 초등학교 학교생활기록부 '창의적 체험활동 특기사항'을 쓰는 경력 많은 초등 담임교사입니다.`,
    `첨부한 이미지 ${n}장은 한 학생이 아래 활동을 하며 쓴 학습지${n > 1 ? '(순서대로)' : ''}입니다. 이름 칸은 가려져 있을 수 있습니다. 학습지를 읽고 이 학생의 특기사항 문장을 하나 쓰세요.`,
    ``,
    ...ccHead(k, act),
    ``,
    `[할 일]`,
    `1. 학생이 쓴 글, 그림, 고른 답, 표시한 것을 빠짐없이 읽고 이 학생이 활동에서 한 일, 생각, 느낀 점, 다짐을 찾습니다.`,
    `2. 학습지가 비어 있거나 알아보기 어려우면 활동 내용을 바탕으로 무난하게 쓰고 "blank"를 true로 합니다.`,
    `3. 가려진 부분은 무시하고, 학생 이름을 추측하거나 적지 않습니다.`,
    ``,
    ...ccSheetRules(k),
    ccAvoid(avoid),
    ``,
    `[출력] 아래 형식의 JSON 하나만 출력합니다.`,
    `{"note": "학습지에서 읽은 이 학생의 활동과 생각을 한두 문장으로", "text": "특기사항 문장", "blank": false}`
  ].filter(x => x != null).join('\n');
}
// 전에 학습지에서 읽어 둔 내용으로 여러 학생을 한 번에 씀 (스캔 없이 다시 쓸 때)
function ccNotePrompt(k, act, list, avoid) {
  return [
    `당신은 초등학교 학교생활기록부 '창의적 체험활동 특기사항'을 쓰는 경력 많은 초등 담임교사입니다.`,
    `아래는 학생들이 이 활동에서 쓴 학습지를 읽고 적어 둔 내용입니다. 학생 ${list.length}명에게 각자의 내용을 살려 특기사항 문장을 하나씩 쓰세요. 학생끼리 시작하는 말·핵심 표현·서술어가 겹치지 않게 씁니다.`,
    ``,
    ...ccHead(k, act),
    ``,
    ...ccSheetRules(k),
    ``,
    `[학생별 학습지 내용]`,
    ...list.map(x => `- ${x.no}번: ${x.note || '(학습지가 비어 있음 — 활동 내용을 바탕으로 무난하게 씁니다)'}`),
    ccAvoid(avoid),
    ``,
    `[출력] 모든 학생을 빠짐없이 담은 JSON 배열 하나만 출력합니다. 예: [{"no": ${list[0].no}, "text": "특기사항 문장"}]`
  ].filter(x => x != null).join('\n');
}

/* ---------- 만들기 ---------- */
const CC_FATAL = ['not_granted', 'sampling_disabled', 'auth', 'bad_model', 'blocked', 'no_engine', 'quota', 'session_expired', 'images_unavailable', 'ocr_failed'];
const CC_BATCH = 10;
/* 만들 학생 고르기. mode: fill(없거나 바뀐 것) · fresh(쓰지 않은 학생 모두) · [번호](그 학생)
   학습지가 있는 학생은 한 명씩 학습지를 읽고 씀(kind 'sheet'). 읽어 둔 내용이 있으면 그 내용으로('note'),
   둘 다 없으면 활동 내용만으로 씀('plain'). note·plain은 10명씩 */
function ccEnqueue(k, mode) {
  const acts = ccActs(k);
  if (!acts.length) return 0;
  const one = Array.isArray(mode);
  const nos = one ? mode : classNos();
  let n = 0;
  for (const a of acts) {
    const want = nos.filter(no => {
      const it = ccArea(k).items[no];
      if (one) return true;
      if (it && it.d) return false; // 사용함으로 표시한 학생은 그대로
      if (mode === 'fresh') return true;
      const p = it && it.parts[a.id];
      return !p || p.sig !== ccSig(a) || ccSheetNew(a.id, no, p);
    });
    // 이미 줄 서 있거나 쓰는 중인 학생은 빼기
    const taken = new Set([...CHE.queue, ...[...CHE.running.values()].map(r => r.job)].filter(j => j.k === k && j.actId === a.id).flatMap(j => j.nos));
    const left = want.filter(no => !taken.has(no));
    // 한 학생만 다시 쓸 때는 학습지를 새로 읽음
    const kind = no => {
      const o = ccObs(k, no, a.id), key = ccSheetKey(a.id, no);
      if (key && (one || !o || o.w !== key)) return 'sheet';
      return o ? 'note' : 'plain';
    };
    for (const no of left) if (kind(no) === 'sheet') CHE.queue.push({ k, actId: a.id, nos: [no], kind: 'sheet', tries: 0, rl: 0 });
    for (const kd of ['note', 'plain']) {
      const l = left.filter(no => kind(no) === kd);
      for (let i = 0; i < l.length; i += CC_BATCH) CHE.queue.push({ k, actId: a.id, nos: l.slice(i, i + CC_BATCH), kind: kd, tries: 0, rl: 0 });
    }
    n += left.length;
  }
  CHE.err = '';
  ccPump();
  return n;
}
function ccPump() {
  if (CHE.waitUntil && Date.now() < CHE.waitUntil) { renderCCSoon(); return; }
  if (engineReady()) while (CHE.running.size < conc() && CHE.queue.length) ccRun(CHE.queue.shift());
  renderCCSoon();
}
function ccStop() {
  CHE.wrote.clear(); if (CHE.rvCtl) CHE.rvCtl.abort(); // 멈추면 검토도 하지 않음
  CHE.queue = [];
  CHE.running.forEach(r => r.ctl.abort());
  clearTimeout(CHE.waitT); CHE.waitUntil = 0;
  renderCCSoon();
}
async function ccRun(job) {
  const A = ccArea(job.k);
  const act = A.acts.find(a => a.id === job.actId);
  if (!act) { ccPump(); return; }
  const ctl = new AbortController(), key = ccId();
  CHE.running.set(key, { k: job.k, ctl, job });
  renderCCSoon();
  try {
    const sig = ccSig(act);
    const others = classNos().filter(no => !job.nos.includes(no)).map(no => { const it = A.items[no]; return it && it.parts[act.id] && it.parts[act.id].t; }).filter(Boolean);
    await ({ sheet: ccRunSheet, note: ccRunNotes }[job.kind] || ccRunPlain)(job, act, sig, others, ctl.signal);
    concOk();
  } catch (e) {
    const code = (e && e.code) || 'upstream_error';
    if (code === 'rate_limited' && E.engine !== 'account' && (job.rl = (job.rl || 0) + 1) <= 4) {
      concBackoff(); CHE.queue.unshift(job);
      CHE.err = errMsg(code, e) + ' 20초 뒤 이어서 써요.';
      CHE.waitUntil = Date.now() + 20000;
      clearTimeout(CHE.waitT); CHE.waitT = setTimeout(() => { CHE.waitUntil = 0; CHE.err = ''; ccPump(); }, 20000);
    } else if (code !== 'cancelled') {
      if ((code === 'upstream_error' || code === 'empty_completion' || code === 'timeout' || code === 'bad_json') && job.tries < 2) CHE.queue.push({ ...job, tries: job.tries + 1 });
      else {
        CHE.err = errMsg(code, e);
        if (CC_FATAL.includes(code) || code === 'rate_limited') CHE.queue = [];
      }
    }
  } finally {
    CHE.running.delete(key);
    CCStore.save();
    ccPump();
    if (!CHE.running.size && !CHE.queue.length) ccReviewAll();
  }
}
/* 검토 AI: 이 차례에 쓴 창체 문장(활동마다)을 10개씩. 실패하면 남은 검토는 그만둠 */
async function ccReviewAll() {
  if (CHE.reviewing || !CHE.wrote.size || !RV() || !RV().pick('writing', 'review')) { CHE.wrote.clear(); return; }
  const wrote = CHE.wrote; CHE.wrote = new Set();
  CHE.reviewing = true;
  const ctl = new AbortController(); CHE.rvCtl = ctl;
  renderCCSoon();
  try {
    for (const a of CC_AREAS) {
      const A = ccArea(a.k);
      for (const act of A.acts) {
        const items = classNos().map(no => { const it = A.items[no], p = it && it.parts && it.parts[act.id]; return p && wrote.has(p) && !(it && it.d) ? { o: p, f: 't' } : null; }).filter(Boolean);
        const r = await reviewSentences('cc', `[${a.name}] ${act.name || ''}${act.desc ? ' — ' + act.desc : ''}`, items, ctl.signal);
        if (ctl.signal.aborted) return;
        if (r === 'fail') { CHE.rvErr = 1; return; }
        if (r === 'ok') delete CHE.rvErr;
      }
    }
  } finally { CHE.reviewing = false; CHE.rvCtl = null; CCStore.save(); renderCCSoon(); }
}

/* 활동 내용만으로 여러 학생 */
async function ccRunPlain(job, act, sig, others, signal) {
  const r = await generate(ccPrompt(job.k, act, job.nos.length + 2, others.slice(-40)), { signal, fresh: true, task: 'writing' });
  const seen = new Set(others.map(t => normKey(t).slice(0, 18)));
  const lines = [];
  for (const raw of String(r.text || '').split('\n')) {
    const t = cleanLine(raw); if (!t) continue;
    const kk = normKey(t).slice(0, 18); if (seen.has(kk)) continue;
    seen.add(kk); lines.push(t);
  }
  if (!lines.length) throw { code: 'empty_completion' };
  const left = [];
  for (const no of job.nos) {
    const t = lines.shift();
    if (!t) { left.push(no); continue; }
    const it = ccItem(job.k, no);
    it.parts[act.id] = { t, sig }; CHE.wrote.add(it.parts[act.id]);
    it.d = 0;
  }
  if (left.length && job.tries < 2) CHE.queue.unshift({ ...job, nos: left, tries: job.tries + 1 });
}
/* 학생 한 명: 학습지 이미지를 보내 읽은 내용과 문장을 받음 */
async function ccRunSheet(job, act, sig, others, signal) {
  const no = job.nos[0], pages = ccSheetPages(act.id, no), key = ccSheetKey(act.id, no);
  if (!pages.length) { CHE.queue.unshift({ ...job, kind: ccObs(job.k, no, act.id) ? 'note' : 'plain' }); return; } // 그사이 학습지를 뺐음
  const mask = ccMask(act), imgs = [];
  for (let j = 0; j < pages.length; j++) imgs.push(await pageImage(pages[j], act.maskAll || j === 0 ? mask : null));
  const r = await generate(ccSheetPrompt(job.k, act, pages.length, others.slice(-30)), { signal, images: imgs, fresh: true, careful: true, task: 'writing' });
  const j = grJSON(r.text);
  const t = cleanLine(String((j && j.text) || ''));
  if (!t) throw { code: 'bad_json' };
  const it = ccItem(job.k, no);
  (it.obs || (it.obs = {}))[act.id] = { n: String(j.note || '').trim().slice(0, 400), w: key, b: j.blank ? 1 : 0 };
  it.parts[act.id] = { t, sig, w: key }; CHE.wrote.add(it.parts[act.id]);
  it.d = 0;
}
/* 읽어 둔 내용으로 여러 학생 */
async function ccRunNotes(job, act, sig, others, signal) {
  const list = job.nos.map(no => { const o = ccObs(job.k, no, act.id); return { no, note: o && !o.b ? o.n : '' }; });
  const r = await generate(ccNotePrompt(job.k, act, list, others.slice(-30)), { signal, fresh: true, task: 'writing' });
  const arr = grJSON(r.text);
  const xs = Array.isArray(arr) ? arr : (arr && Array.isArray(arr.items) ? arr.items : []);
  const left = [];
  for (const no of job.nos) {
    const x = xs.find(y => y && Number(y.no) === no);
    const t = x && cleanLine(String(x.text || ''));
    if (!t) { left.push(no); continue; }
    const it = ccItem(job.k, no), o = ccObs(job.k, no, act.id);
    it.parts[act.id] = o && o.w ? { t, sig, w: o.w } : { t, sig }; CHE.wrote.add(it.parts[act.id]);
    it.d = 0;
  }
  if (left.length === job.nos.length) throw { code: 'bad_json' };
  if (left.length && job.tries < 2) CHE.queue.unshift({ ...job, nos: left, tries: job.tries + 1 });
}

/* ---------- 화면 ---------- */
/* 누르는 도중에 결과를 다시 그리면 그 버튼이 바뀌어 눌림이 사라지므로, 손을 뗀 뒤에 그림 */
let ccRT = null, ccPtr = false, ccPending = false;
document.addEventListener('pointerdown', () => { ccPtr = true; }, true);
document.addEventListener('pointerup', () => { ccPtr = false; if (ccPending) { ccPending = false; setTimeout(renderCCSoon, 0); } }, true);
document.addEventListener('pointercancel', () => { ccPtr = false; }, true);
function renderCCSoon() {
  if (S.mode !== 'cc' || ccRT) return;
  if (ccPtr) { ccPending = true; return; }
  ccRT = requestAnimationFrame(() => { ccRT = null; renderCCResults(); });
}
function renderCC() {
  if (S.mode !== 'cc') return;
  renderCCSetup(); renderCCResults();
}
const ccTyping = () => { const box = $('#ccSetup'), a = document.activeElement; return !!(box && a && box.contains(a) && /^(TEXTAREA|INPUT)$/.test(a.tagName)); };
function renderCCSetup() {
  const box = $('#ccSetup'); if (!box) return;
  if (ccTyping()) return; // 입력하는 중에는 다시 그리지 않음 (한글 입력이 끊기지 않게)
  const actRows = k => ccArea(k).acts.map((a, i) => `
      <div class="cc-act" data-ccact="${esc(a.id)}">
        <div class="cc-act-h"><span class="num">${i + 1}</span>
          <input class="field" data-ccf="name" data-cck="${k}" data-ccid="${esc(a.id)}" value="${esc(a.name)}" placeholder="${esc(ccInfo(k).ph[0])}" autocomplete="off" aria-label="활동 이름">
          ${ccArea(k).acts.length > 1 ? `<button class="icon-btn tiny" type="button" data-ccdel="${esc(a.id)}" data-cck="${k}" aria-label="이 활동 빼기" title="이 활동 빼기">${ICON.x}</button>` : ''}</div>
        <textarea class="field" rows="2" data-ccf="desc" data-cck="${k}" data-ccid="${esc(a.id)}" placeholder="${esc(ccInfo(k).ph[1])}" aria-label="활동 내용">${esc(a.desc)}</textarea>
        ${ccSheetBox(k, a)}
      </div>`).join('');
  const step = (n, k) => {
    const info = ccInfo(k);
    return `<div class="gr-step">
      <div class="gr-h"><span class="sn">${n}</span><b>${info.name}</b></div>
      ${k === 'club' ? `<label class="lab" for="ccClub">동아리 이름 <span class="muted">· 문장 앞에 (동아리 이름)으로 붙어요</span></label>
        <input class="field" id="ccClub" data-ccf="club" data-cck="club" value="${esc(ccArea('club').club)}" placeholder="예) 3-2평화물결그리기" autocomplete="off">` : ''}
      <label class="lab">공통 활동 <span class="muted">· 활동마다 학생 한 명에 한 문장씩 써요</span></label>
      ${actRows(k)}
      <button class="btn text tiny" type="button" data-ccadd="${k}">${ICON.plus}활동 더하기</button>
    </div>`;
  };
  box.innerHTML = `<div class="ai-row" data-ai-row="writing"></div>
    <div class="gr-step">
      <div class="gr-h"><span class="sn">1</span><b>학급 명단</b></div>
      ${rosterHTML()}
      <label class="lab" for="ccGrade">학년</label>
      <select class="field" id="ccGrade">${[1, 2, 3, 4, 5, 6].map(g => `<option value="${g}" ${CHE.grade === g ? 'selected' : ''}>${g}학년</option>`).join('')}</select>
    </div>
    ${step(2, 'auto')}${step(3, 'club')}${step(4, 'career')}
    <div class="gr-step">
      <div class="gr-h"><span class="sn">5</span><b>문장 길이</b></div>
      <div class="seg">${[['short', '짧게'], ['mid', '보통'], ['long', '길게']].map(([v, l]) => `<button type="button" data-cclen="${v}" aria-pressed="${CHE.len === v}">${l} <small class="num">${CC_LEN[v][0]}~${CC_LEN[v][1]}자</small></button>`).join('')}</div>
      <p class="muted">활동이 두 개면 학생마다 두 문장을 이어 써요. 문장 끝은 교과 평어 설정(${S.settings.ending === 'da' ? '~한다.' : '~함.'})을 따라요.</p>
    </div>
    ${upNote()}
    <div class="cc-go">
      <button class="btn primary" type="button" data-cc="genAll">${ICON.spark}모든 영역 만들기</button>
      <button class="btn text back" type="button" data-cc="showRes">결과 보기</button>
    </div>`;
}
/* 활동 카드의 학습지 칸 (끌어다 놓아도 됨) */
function ccSheetInfo(actId) {
  const sh = CHE.sheets[actId], sm = ccSheetMap(actId);
  if (!sm) return '';
  if (!classNos().length) return '학급 명단에 학생 수를 넣으면 번호 순서대로 나눠요.';
  const got = [...sm.map.keys()];
  if (!got.length) return '나눌 학생이 없어요. 시작 번호와 학습지가 없는 번호를 확인해 주세요.';
  const last = sm.map.get(got[got.length - 1]), miss = sm.nos.length - got.length;
  return `${got[0]}${got.length > 1 ? '~' + got[got.length - 1] : ''}번 ${got.length}명에게 나눠요${sh.skip.length ? ` (${sh.skip.join('·')}번 빼고)` : ''}.`
    + (last.length < sm.per ? ` 마지막 학생은 ${last.length}쪽뿐이에요.` : '')
    + (sm.extra ? ` ${sm.extra}쪽이 남아요.` : '')
    + (miss ? ` 학습지가 모자란 ${miss}명은 활동 내용으로 써요.` : '');
}
function ccSheetBusyHTML(actId) {
  const on = CHE.loading && CHE.loading.id === actId;
  return `<div class="busy" data-ccbusy="${esc(actId)}" ${on ? '' : 'hidden'}>${on ? `<span class="spin"></span>${esc(CHE.loading.msg)}` : ''}</div>`;
}
function ccSheetBox(k, a) {
  const sh = CHE.sheets[a.id], id = esc(a.id);
  const off = CHE.loading ? 'disabled' : '';
  if (!sh) {
    const nObs = classNos().filter(no => ccObs(k, no, a.id)).length;
    return `<div class="cc-sheet" data-ccsheetbox="${id}" data-cck="${k}">
      <div class="row"><button class="btn text tiny" type="button" data-ccsheet="${id}" data-cck="${k}" ${off}>${ICON.upload}학습지 스캔 넣기</button>
        ${nObs ? `<span class="muted">학습지를 읽은 학생 ${nObs}명</span><button class="btn text tiny" type="button" data-ccobsdel="${id}" data-cck="${k}" ${off}>읽은 내용 지우기</button>` : ''}</div>
      ${ccSheetBusyHTML(a.id)}
      ${nObs ? '' : '<p class="muted">학생들이 쓴 학습지를 번호 순서대로 스캔해(PDF·사진) 넣거나 끌어다 놓으면, 학생마다 학습지 내용을 살려 써요.</p>'}
    </div>`;
  }
  const mask = ccMask(a);
  return `<div class="cc-sheet has" data-ccsheetbox="${id}" data-cck="${k}">
      <div class="row"><span class="chip">${ICON.upload}학습지 ${sh.pages.length}쪽<button class="icon-btn tiny" type="button" data-ccsheetdel="${id}" aria-label="학습지 빼기" title="학습지 빼기" ${off}>${ICON.x}</button></span>
        <button class="btn text tiny" type="button" data-ccsheet="${id}" data-cck="${k}" ${off}>다른 파일로 바꾸기</button></div>
      ${ccSheetBusyHTML(a.id)}
      <div class="row nowrap">
        <label class="lab" for="ccPer_${id}">학생당</label><input class="field num sm" id="ccPer_${id}" type="number" min="1" max="20" value="${sh.per}" data-ccsh="per" data-ccid="${id}" ${off}><span class="muted">쪽</span>
        <label class="lab" for="ccStart_${id}">시작 번호</label><input class="field num sm" id="ccStart_${id}" type="number" min="1" max="99" value="${sh.startNo}" data-ccsh="start" data-ccid="${id}" ${off}>
      </div>
      <label class="lab" for="ccSkip_${id}">학습지가 없는 번호 <span class="muted">(결석 등 · 이 번호는 건너뛰고 나눠요)</span></label>
      <input class="field" id="ccSkip_${id}" data-ccsh="skip" data-ccid="${id}" value="${esc(sh.skip.join(', '))}" placeholder="예) 4, 12" autocomplete="off" inputmode="numeric" ${off}>
      <p class="muted" data-ccsheetinfo="${id}">${esc(ccSheetInfo(a.id))}</p>
      <div class="row"><button class="btn tiny ${mask.length ? '' : 'tonal'}" type="button" data-ccmask="${id}" data-cck="${k}" ${off}>${mask.length ? `가릴 이름 칸 ${mask.length}곳 · 고치기` : '이름 칸 가리기'}</button>
        ${mask.length ? '' : '<span class="muted warn">정하지 않으면 학생 이름이 그대로 AI 회사로 보내져요</span>'}</div>
    </div>`;
}
function renderCCResults() {
  const box = $('#ccResults'); if (!box) return;
  const k = CHE.view, info = ccInfo(k), A = ccArea(k), acts = ccActs(k), nos = classNos();
  const busy = ccAreaBusy(k), anyBusy = ccBusy();
  const states = nos.map(no => ccState(k, no));
  const hasText = s => s === 'ok' || s === 'stale' || s === 'sheet';
  const made = states.filter(hasText).length;
  const stale = nos.filter((no, i) => states[i] === 'stale' && !(A.items[no] && A.items[no].d)).length;
  const sheetN = nos.filter((no, i) => states[i] === 'sheet' && !(A.items[no] && A.items[no].d)).length;
  const sheetActs = acts.filter(a => CHE.sheets[a.id]);
  const need = nos.filter((no, i) => states[i] !== 'ok' && !(A.items[no] && A.items[no].d)).length;
  const used = nos.filter(no => A.items[no] && A.items[no].d && ccText(k, no)).length;
  const tab = a => {
    const ns = nos.map(no => ccState(a.k, no));
    return `<button type="button" data-ccview="${a.k}" aria-pressed="${k === a.k}">${a.name} <small class="num">${ns.filter(hasText).length}/${nos.length}</small></button>`;
  };
  let body;
  if (!nos.length) body = `<div class="empty"><h3>학생 수를 먼저 넣어 주세요</h3><p>왼쪽 「학급 명단」에 학생 수와 예외 번호(전출 등)를 넣으면 번호별로 문장을 써요. 행동특성·평가지 채점과 같은 명단이에요.</p></div>`;
  else if (!acts.length) body = `<div class="empty"><h3>${info.name} 공통 활동을 넣어 주세요</h3><p>왼쪽에 활동 이름이나 내용을 넣고 「만들기」를 누르면 학생마다 다른 문장을 써요. 학생들이 쓴 학습지를 스캔해 넣으면 학생마다 학습지 내용을 살려 써요.</p></div>`;
  else body = `<ul class="gr-list cc-list ${sheetActs.length ? 'thumbs' : ''}">${nos.map((no, i) => {
      const it = A.items[no], t = ccText(k, no), st = states[i];
      const run = [...CHE.running.values()].find(r => r.k === k && r.job.nos.includes(no));
      const running = !!run || CHE.queue.some(j => j.k === k && j.nos.includes(no));
      // 학습지: 첫 쪽 작은 그림, 읽은 내용
      let shot = null;
      for (const a of sheetActs) { const pg = ccSheetPages(a.id, no); if (pg.length) { shot = { p: pg[0], a, n: pg.length }; break; } }
      const obs = acts.map(a => [a, ccObs(k, no, a.id)]).filter(x => x[1]);
      return `<li class="gr-row cc-row ${it && it.d ? 'used' : ''}${it && it.parts && acts.some(a => rvOpen(it.parts[a.id])) ? ' rv-mark' : ''}">
        ${sheetActs.length ? (shot ? `<button class="thumb" type="button" data-ccview1="${no}" aria-label="${no}번 학습지 크게 보기"><img src="${shot.p.thumb || shot.p.url}" alt="" loading="lazy" decoding="async">${maskOverlay(ccMask(shot.a), shot.a.maskAll, 0)}${shot.n > 1 ? `<small>${shot.n}쪽</small>` : ''}</button>` : '<span class="thumb none" title="학습지 없음"><span class="noimg">-</span></span>') : ''}
        <div class="body">
          <div class="head"><span class="badge num">${no}</span>
            ${running ? `<span class="chip run"><span class="spin"></span>${run && run.job.kind === 'sheet' ? '학습지 읽는 중' : '쓰는 중'}</span>` : st === 'part' ? '<span class="chip warn">일부 활동만</span>' : st === 'stale' ? '<span class="chip warn">활동이 바뀜</span>' : st === 'sheet' && !(it && it.d) ? '<span class="chip warn">학습지 반영 전</span>' : ''}
            ${obs.some(x => x[1].b) ? '<span class="chip warn">학습지가 비어 있음</span>' : ''}
            <span class="grow"></span>${it && it.d && t ? `<span class="chip done">${ICON.check}사용함</span>` : ''}</div>
          ${t ? `<div class="gr-text ${it && it.d ? 'done' : ''}" role="button" tabindex="0" data-cccopy="${no}" aria-label="${it && it.d ? '사용함. ' : ''}${no}번 ${info.name} 복사">${esc(t)}</div>` : (running ? '<div class="skel"></div>' : '<p class="muted">아직 쓰지 않았어요</p>')}
          ${obs.filter(x => x[1].n).map(([a, o]) => `<p class="muted gr-sum">${acts.length > 1 ? esc((a.name || '').trim() || '활동') + ' ' : ''}학습지: ${esc(o.n)}</p>`).join('')}
          ${it && it.parts ? acts.map(a => rvInline(it.parts[a.id], ['cc', k, no, a.id].map(encodeURIComponent).join(':'), `${no}번${acts.length > 1 ? ' ' + ((a.name || '').trim() || '활동') : ''}`)).join('') : ''}
          <div class="acts">${t ? `<span class="muted num">${t.length}자</span>` : ''}
            ${!running && engineReady() ? `<button class="btn text tiny" type="button" data-ccre="${no}">${t ? '다시 쓰기' : '쓰기'}</button>` : ''}
            ${it && it.d && t ? `<button class="btn text tiny" type="button" data-ccundo="${no}">사용 표시 지우기</button>` : ''}</div>
        </div></li>`;
    }).join('')}</ul>`;
  box.innerHTML = `
    <button class="btn text back" type="button" data-cc="back">${ICON.back}활동 입력</button>
    <div class="gr-top"><div><h2>창의적 체험활동</h2>
      <p class="muted">${anyBusy ? '<span class="spin"></span>쓰는 중 · ' : ''}${nos.length ? `학생 ${nos.length}명${CLASS.except.length ? ` (${CLASS.except.join('·')}번 제외)` : ''} · ${info.name} ${made}/${nos.length}명${used ? ` · 사용함 ${used}명` : ''}` : '학급 명단을 넣어 주세요'}</p></div></div>
    <div class="seg cc-tabs" role="tablist">${CC_AREAS.map(tab).join('')}</div>
    ${CHE.err ? `<div class="banner err"><span class="grow">${esc(CHE.err)}</span>${CHE.waitUntil ? '' : '<button class="btn" type="button" data-act="settings">평어 쓰는 방식</button>'}</div>` : ''}
    ${!engineReady() ? `<div class="banner info"><span class="grow">문장을 만들 AI를 먼저 정해 주세요.</span><button class="btn primary" type="button" data-act="settings">API 키 넣기</button></div>` : ''}
    ${upNote()}${CHE.rvErr ? RV_FAIL_HTML : ''}${CHE.reviewing ? '<p class="muted rv-busy"><span class="spin"></span> 검토 AI가 문장을 살펴보고 있어요…</p>' : ''}${rvBarHTML(nos.reduce((n, no) => { const it = A.items[no]; return n + (it && it.parts ? acts.filter(a => rvOpen(it.parts[a.id])).length : 0); }, 0))}
    ${stale && !busy ? `<div class="banner warn"><span class="grow">활동 내용이 바뀐 학생이 ${stale}명 있어요. 「만들기」를 누르면 새 활동으로 고쳐 써요. 사용함으로 표시한 학생은 그대로 둬요.</span></div>` : ''}
    ${sheetN && !busy ? `<div class="banner info"><span class="grow">학습지를 넣은 학생 ${sheetN}명은 아직 학습지 내용이 글에 들어가지 않았어요. 「남은 학생 쓰기」를 누르면 학습지를 읽고 고쳐 써요.</span></div>` : ''}
    ${nos.length && acts.length ? `<div class="tools"><div class="left">${k === 'club' && (A.club || '').trim() ? `<span class="muted">문장 앞에 <b>(${esc(A.club.trim())})</b>를 붙여요</span>` : ''}</div>
      <div class="right">
        ${busy ? `<button class="btn" type="button" data-cc="stop">멈추기</button>` : `<button class="btn primary" type="button" data-cc="gen" ${need ? '' : 'disabled'}>${ICON.spark}${made ? `남은 학생 쓰기${need ? ` (${need})` : ''}` : '만들기'}</button>`}
        ${made && !busy ? `<button class="btn" type="button" data-cc="fresh">${ICON.redo}모두 다시 쓰기</button>` : ''}
        ${made ? `<button class="btn" type="button" data-cc="copyTable" title="번호와 글을 엑셀에 붙여넣기 좋게 복사">표로 복사</button>
          <button class="btn tonal" type="button" data-cc="copyAll" ${busy ? 'disabled' : ''} title="${IN_APP ? '나이스 학생 칸에 1번부터 차례로 붙여넣기' : '번호순으로 한 줄에 한 명씩 복사'}">${ICON.copy}전체복사</button>` : ''}
      </div></div>` : ''}
    ${body}`;
}

/* ---------- 나이스 붙여넣기 출처 (영역마다) ---------- */
const CC_SRC = {};
function ccNeisSrc(k) {
  if (CC_SRC[k]) return CC_SRC[k];
  const name = ccInfo(k).name;
  const no = id => +String(id).split(':')[1];
  return (CC_SRC[k] = {
    key: 'cc', what: '특기사항', field: name + ' 특기사항', title: name,
    text: id => ccText(k, no(id)),
    no,
    mark: id => { if (ccText(k, no(id))) ccItem(k, no(id)).d = 1; },
    saved: () => { CCStore.save(); renderCCResults(); }
  });
}

/* ---------- 학습지 넣기·보기 ---------- */
// 입력하는 중이면 손을 뗀 뒤에 다시 그림
function ccSetupNow() { if (ccTyping()) { CHE.setupDirty = true; return; } renderCCSetup(); }
document.addEventListener('focusout', () => {
  if (!CHE.setupDirty || S.mode !== 'cc') return;
  setTimeout(() => { if (CHE.setupDirty && !ccTyping()) { CHE.setupDirty = false; renderCCSetup(); } }, 0);
});
function ccBusyShow(actId) {
  const el = document.querySelector(`[data-ccbusy="${actId}"]`);
  if (el) el.outerHTML = ccSheetBusyHTML(actId);
}
async function ccAddSheet(k, actId, files) {
  if (!files || !files.length || CHE.loading) return;
  const act = ccArea(k).acts.find(a => a.id === actId); if (!act) return;
  CHE.loading = { id: actId, msg: '학습지를 읽는 중' }; ccSetupNow();
  try {
    const { pages, skipped } = await readFiles(files, m => { CHE.loading.msg = m; ccBusyShow(actId); });
    if (pages.length) {
      // 다른 파일로 바꾸면 쪽 나누기 설정은 그대로 둠
      const old = CHE.sheets[actId];
      ccFreeSheet(actId);
      CHE.sheets[actId] = { id: ccId(), pages, per: old ? old.per : 1, startNo: old ? old.startNo : 1, skip: old ? old.skip : [] };
      const n = ccSheetMap(actId).map.size;
      toast(`학습지 ${pages.length}쪽을 넣었어요${n ? ` · 학생 ${n}명` : ''}${ccMask(act).length ? '' : ' · 이름 칸을 가려 주세요'}`, 3500);
    }
    if (skipped.length) toast(`읽지 못한 파일: ${skipped.slice(0, 3).join(', ')}${skipped.length > 3 ? ' 외' : ''} (PDF, JPG, PNG만 돼요)`, 4500);
  } catch (e) {
    toast(e && e.message === 'PDFJS' ? 'PDF를 읽는 도구를 불러오지 못했어요. 인터넷 연결을 확인하거나 사진(JPG·PNG)으로 넣어 주세요.' : 'PDF를 읽지 못했어요. 암호가 걸린 파일인지 확인해 주세요.', 5000);
  } finally { CHE.loading = null; ccSetupNow(); renderCCSoon(); }
}
function openCCMask(k, actId) {
  const a = ccArea(k).acts.find(x => x.id === actId), sm = a && ccSheetMap(actId);
  if (!sm) return;
  const shots = [...sm.map].map(([no, pg]) => ({ url: pg[0].url, label: `${no}번 첫 쪽` }));
  openMaskEditor({
    shots: shots.length ? shots : [{ url: CHE.sheets[actId].pages[0].url, label: '첫 쪽' }],
    mask: ccMask(a), all: !!a.maskAll, what: '학습지',
    save: (mask, all) => {
      if (mask.length) { a.mask = mask; a.maskAll = all; } else { delete a.mask; delete a.maskAll; }
      CCStore.save(); ccSetupNow(); renderCCSoon();
    }
  });
}
function openCCSheetView(k, no) {
  const acts = ccActs(k).filter(a => ccSheetPages(a.id, no).length || ccObs(k, no, a.id));
  if (!acts.length) return;
  openSheet(`<h3>${no}번 학습지 · ${esc(ccInfo(k).name)}</h3>
    ${acts.map(a => {
      const pg = ccSheetPages(a.id, no), o = ccObs(k, no, a.id);
      return `<div class="cc-view"><b>${esc((a.name || '').trim() || '활동')}</b>
        ${o ? `<p class="muted" style="margin:0">AI가 읽은 내용: ${esc(o.n || '-')}${o.b ? ' (비어 있거나 알아보기 어려움)' : ''}</p>` : ''}
        ${pg.length ? `<div class="pages">${pg.map((p, j) => `<figure><div class="pg"><img src="${p.url}" alt="${j + 1}쪽">${maskOverlay(ccMask(a), a.maskAll, j)}</div><figcaption class="muted">${esc(p.name)}</figcaption></figure>`).join('')}</div>` : '<p class="muted">스캔은 저장하지 않아서 지금은 볼 수 없어요.</p>'}
      </div>`;
    }).join('')}
    <div class="row" style="justify-content:flex-end"><button class="btn primary" type="button" data-close>닫기</button></div>`, sh => sh.classList.add('wide'));
}
const ccDropZone = t => t && t.closest && t.closest('[data-ccsheetbox]');
// 파일을 학습지 칸 밖에 놓으면 창에 그 파일이 열려 앱 화면이 사라지므로 막음
const hasFiles = e => !!(e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files'));
['dragenter', 'dragover'].forEach(ev => document.addEventListener(ev, e => {
  if (S.mode !== 'cc' || !hasFiles(e)) return;
  e.preventDefault();
  const dz = ccDropZone(e.target);
  if (dz) dz.classList.add('on'); else e.dataTransfer.dropEffect = 'none';
}));
document.addEventListener('dragleave', e => { const dz = ccDropZone(e.target); if (dz && !dz.contains(e.relatedTarget)) dz.classList.remove('on'); });
document.addEventListener('drop', e => {
  if (S.mode !== 'cc' || !hasFiles(e)) return;
  e.preventDefault();
  const dz = ccDropZone(e.target); if (!dz) return;
  dz.classList.remove('on');
  if (e.dataTransfer.files.length) ccAddSheet(dz.dataset.cck, dz.dataset.ccsheetbox, e.dataTransfer.files);
});

/* ---------- 이벤트 ---------- */
document.addEventListener('input', e => {
  if (S.mode !== 'cc') return;
  const t = e.target;
  const f = t.dataset && t.dataset.ccf; if (!f) return;
  const k = t.dataset.cck;
  if (f === 'club') ccArea('club').club = t.value;
  else { const a = ccArea(k).acts.find(x => x.id === t.dataset.ccid); if (a) a[f] = t.value; }
  CCStore.save();
});
document.addEventListener('change', e => {
  if (S.mode !== 'cc') return;
  const t = e.target;
  if (t.id === 'ccGrade') { CHE.grade = +t.value || 3; CCStore.save(); return; }
  if (t.dataset && t.dataset.ccsh) {
    // 학습지 쪽 나누기: 안내 글만 고치고 칸은 다시 그리지 않음 (입력이 끊기지 않게)
    const id = t.dataset.ccid, sh = CHE.sheets[id]; if (!sh) return;
    const f = t.dataset.ccsh;
    if (f === 'per') sh.per = Math.max(1, Math.min(20, +t.value | 0 || 1));
    else if (f === 'start') sh.startNo = Math.max(1, Math.min(99, +t.value | 0 || 1));
    else { sh.skip = parseNos(t.value); t.value = sh.skip.join(', '); }
    const el = document.querySelector(`[data-ccsheetinfo="${id}"]`); if (el) el.textContent = ccSheetInfo(id);
    renderCCSoon(); return;
  }
  if (t.dataset && t.dataset.ccf) renderCCSoon(); // 바뀐 활동 표시
});
document.addEventListener('click', e => {
  if (S.mode !== 'cc') return;
  const t = e.target;
  const view = t.closest('[data-ccview]'); if (view) { CHE.view = view.dataset.ccview; renderCCResults(); return; }
  const add = t.closest('[data-ccadd]');
  if (add) {
    const k = add.dataset.ccadd; const a = ccNewAct(); ccArea(k).acts.push(a); CCStore.save(); renderCCSetup();
    const el = document.querySelector(`[data-ccid="${a.id}"][data-ccf="name"]`); el && el.focus();
    return;
  }
  const del = t.closest('[data-ccdel]');
  if (del) {
    const k = del.dataset.cck, A = ccArea(k);
    ccFreeSheet(del.dataset.ccdel);
    A.acts = A.acts.filter(a => a.id !== del.dataset.ccdel);
    if (!A.acts.length) A.acts.push(ccNewAct());
    CCStore.save(); renderCC(); return;
  }
  const sp = t.closest('[data-ccsheet]');
  if (sp) {
    if (sp.disabled || CHE.loading) return;
    grPickFiles('.pdf,image/*', true).then(fs => ccAddSheet(sp.dataset.cck, sp.dataset.ccsheet, fs));
    return;
  }
  const sd = t.closest('[data-ccsheetdel]'); if (sd) { ccFreeSheet(sd.dataset.ccsheetdel); ccSetupNow(); renderCCSoon(); toast('학습지를 뺐어요. 이미 쓴 글과 읽은 내용은 그대로예요.'); return; }
  const mk = t.closest('[data-ccmask]'); if (mk) { openCCMask(mk.dataset.cck, mk.dataset.ccmask); return; }
  const v1 = t.closest('[data-ccview1]'); if (v1) { openCCSheetView(CHE.view, +v1.dataset.ccview1); return; }
  const od = t.closest('[data-ccobsdel]');
  if (od) {
    for (const it of Object.values(ccArea(od.dataset.cck).items)) if (it && it.obs) delete it.obs[od.dataset.ccobsdel];
    CCStore.save(); ccSetupNow(); renderCCSoon();
    toast('학습지에서 읽은 내용을 지웠어요. 이미 쓴 글은 그대로예요.');
    return;
  }
  const len = t.closest('[data-cclen]'); if (len) { CHE.len = len.dataset.cclen; CCStore.save(); renderCCSetup(); toast('바꾼 길이는 새로 쓰는 문장부터 적용돼요'); return; }
  const cp = t.closest('[data-cccopy]');
  if (cp) {
    const k = CHE.view, no = +cp.dataset.cccopy, txt = ccText(k, no); if (!txt) return;
    copyText(txt).then(ok => {
      if (!ok) { selectText(cp); toast('자동 복사가 막혔어요. 선택된 글을 Ctrl+C로 복사해 주세요.', 4000); return; }
      const it = ccItem(k, no), was = it.d; it.d = 1; CCStore.save(); renderCCResults();
      toast(was ? `${no}번 글을 다시 복사했어요` : `${no}번 ${ccInfo(k).name} 글을 복사했어요 · 사용함으로 표시했어요`);
    });
    return;
  }
  const ud = t.closest('[data-ccundo]'); if (ud) { const it = ccItem(CHE.view, +ud.dataset.ccundo); it.d = 0; CCStore.save(); renderCCResults(); toast(`${ud.dataset.ccundo}번 사용 표시를 지웠어요`); return; }
  const re = t.closest('[data-ccre]');
  if (re) {
    if (!engineReady()) { openSettings(); return; }
    const no = +re.dataset.ccre; const it = ccItem(CHE.view, no); it.d = 0;
    ccEnqueue(CHE.view, [no]); return;
  }
  const b = t.closest('[data-cc]'); if (!b || b.disabled) return;
  const a = b.dataset.cc;
  const needSetup = () => {
    if (!classNos().length) { toast('학급 명단에 학생 수를 먼저 넣어 주세요'); const el = document.querySelector('#ccSetup [data-cls="count"]'); el && el.focus(); return true; }
    if (!engineReady()) { openSettings(); return true; }
    return false;
  };
  if (a === 'genAll') {
    if (needSetup()) return;
    const n = CC_AREAS.reduce((s, x) => s + ccEnqueue(x.k, 'fill'), 0);
    if (!n) { toast(CC_AREAS.some(x => ccActs(x.k).length) ? '새로 쓸 학생이 없어요. 모두 썼거나 사용함으로 표시했어요.' : '공통 활동을 먼저 넣어 주세요'); return; }
    CHE.showRes = true; $('#ccView').classList.add('show-pane');
  } else if (a === 'gen') {
    if (needSetup()) return;
    if (!ccEnqueue(CHE.view, 'fill')) toast('새로 쓸 학생이 없어요');
  } else if (a === 'fresh') {
    const k = CHE.view, n = classNos().filter(no => !(ccArea(k).items[no] && ccArea(k).items[no].d)).length;
    openSheet(`<h3>${ccInfo(k).name}을 모두 다시 쓸까요?</h3>
      <p class="muted" style="margin:0">쓰지 않은 학생 ${n}명의 글을 새로 써요. 사용함으로 표시한 학생은 그대로 둬요.</p>
      <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close>취소</button><button class="btn primary" type="button" id="ccFreshGo">다시 쓰기</button></div>`, sh => {
      sh.querySelector('#ccFreshGo').addEventListener('click', () => { closeSheet(); if (!needSetup()) ccEnqueue(k, 'fresh'); });
    });
  } else if (a === 'stop') { ccStop(); toast('멈췄어요. 쓴 문장은 그대로 있어요.'); }
  else if (a === 'copyTable') {
    const k = CHE.view;
    const lines = classNos().map(no => `${no}\t${ccText(k, no)}`).filter(l => l.split('\t')[1]);
    copyText(lines.join('\n')).then(ok => toast(ok ? `${lines.length}명의 번호와 글을 복사했어요 (엑셀에 붙여넣기 좋아요)` : '복사가 막혔어요.', 3500));
  } else if (a === 'copyAll') {
    const k = CHE.view;
    neisCopyAll(ccNeisSrc(k), classNos().map(no => k + ':' + no));
  } else if (a === 'back') { CHE.showRes = false; $('#ccView').classList.remove('show-pane'); }
  else if (a === 'showRes') { CHE.showRes = true; $('#ccView').classList.add('show-pane'); }
});
document.addEventListener('keydown', e => {
  if (S.mode !== 'cc') return;
  const el = e.target;
  if ((e.key === 'Enter' || e.key === ' ') && el.matches && el.matches('[data-cccopy]')) { e.preventDefault(); el.click(); }
});
CCStore.load();

/* ===== 대명사 줄이기: 이미 만든 글 중 아직 쓰지 않은 것에서 꼭 필요하지 않은 대명사를 AI로 고쳐 씀 =====
   교과 평어(모든 평가계획)·평가지 채점 평어(모든 채점 기록)·행특 후보 글이 대상. 사용함(완료)으로 표시한 글은 그대로 둠 */
const PRON = { busy: false, ctl: null, done: 0, total: 0, fixed: 0, err: '' };
const PRON_FATAL = ['not_granted', 'sampling_disabled', 'auth', 'bad_model', 'blocked', 'no_engine', 'quota', 'session_expired'];

async function pronCollect() {
  await storeReady;
  const jobs = [];
  const dirty = new Map(); // 모아 두었다가 한 번에 저장
  // 교과 평어
  let plans = [];
  try { plans = await Store.listPlans(); } catch (e) {}
  for (const p of plans) {
    const cur = p.id === S.planId;
    const sets = cur ? S.sets : await Store.loadSets(p.id);
    sets.forEach((set, k) => {
      for (const it of set.items || []) {
        if (it.d || !hasPronoun(it.t)) continue;
        const orig = it.t;
        jobs.push({
          kind: 'subj', text: orig,
          apply(t) {
            // 그사이 그 평가계획을 열었다 닫았거나, 문장을 쓰거나 지웠으면 손대지 않음
            if (cur ? (S.planId !== p.id || S.sets !== sets) : S.planId === p.id) return false;
            if (it.d || it.t !== orig || !set.items.includes(it)) return false;
            const c = cleanLine(t); if (!c) return false;
            it.t = c; delete it.rv;
            dirty.set('s:' + p.id + ':' + k, () => Store.saveSet(p.id, k, set, sets));
            return true;
          }
        });
      }
    });
  }
  // 평가지 채점 기록
  await GRStore.list();
  for (const h of GR.history) {
    const open = h.id === GR.id;
    const b = open ? null : await GRStore.get(h.id);
    const list = open ? GR.students : ((b && b.students) || []);
    for (const s of list) {
      if (s.d || s.skip || !s.text || !hasPronoun(s.text)) continue;
      const orig = s.text;
      jobs.push({
        kind: 'gr', text: orig,
        apply(t) {
          if (open ? GR.id !== h.id : GR.id === h.id) return false;
          if (s.d || s.text !== orig || s.writing) return false;
          const c = cleanLine(t); if (!c) return false;
          s.text = c; delete s.trv;
          dirty.set('g:' + h.id, open ? () => GRStore.save() : () => {
            if (Store.mode === 'db') writeDoc(Store.base() + '/g_' + h.id, b);
            else if (Store.mode === 'local') Store.lsSet('ssam:gr:' + h.id, b);
          });
          return true;
        }
      });
    }
  }
  // 행특 후보 글
  if (!HK.loaded) { try { await HKStore.load(); } catch (e) {} }
  for (const s of HK.students) {
    for (const r of s.results || []) {
      if (r.d || r.edit || r.busy || !hasPronoun(r.t)) continue;
      const orig = r.t;
      jobs.push({
        kind: 'hk', text: orig,
        apply(t) {
          if (r.d || r.edit || r.t !== orig || !(s.results || []).includes(r)) return false;
          const c = hkClean(t); if (!c) return false;
          r.t = hkTrim(c);
          dirty.set('h', () => HKStore.save());
          return true;
        }
      });
    }
  }
  return { jobs, flush: () => { dirty.forEach(fn => { try { fn(); } catch (e) {} }); dirty.clear(); } };
}

function pronPrompt(kind, texts) {
  const subj = kind !== 'hk';
  const form = subj
    ? `글 하나는 마침표가 하나뿐인 한 문장으로 둡니다. ${endingRule(S.settings.ending === 'da')}`
    : `글 하나는 줄바꿈 없는 한 문단으로 둡니다. ${hkEndRule()}`;
  return [
    `아래는 초등학교 학교생활기록부에 쓸 ${subj ? '교과 평어' : '행동특성 및 종합의견'}입니다.`,
    `글마다 꼭 필요하지 않은 대명사와 가리키는 말('자신', '자기', '그', '이', '이것', '그것', '이를', '그들', '이러한', '그러한', '이런', '그런' 등)을 빼거나, 가리키는 대상을 직접 써서 자연스럽게 고쳐 주세요.`,
    ``,
    `[고치는 규칙]`,
    `1. 내용, 길이, 말투는 그대로 두고 대명사가 들어간 부분만 고칩니다. 빼면 뜻이 흐려지는 곳만 남깁니다.`,
    `2. ${form}`,
    `3. 글의 수와 차례를 그대로 지켜, 고친 글만 담은 JSON 문자열 배열 하나만 출력합니다. 예: ["고친 글", "고친 글"]`,
    ``,
    `[글]`,
    ...texts.map((t, i) => `${i + 1}. ${t}`)
  ].join('\n');
}

async function pronBatch(kind, batch, signal) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await generate(pronPrompt(kind, batch.map(j => j.text)), { signal, fresh: true, task: 'writing' });
      const arr = grJSON(r.text);
      if (!Array.isArray(arr) || arr.length !== batch.length) throw { code: 'bad_json' };
      return arr.map(x => (typeof x === 'string' ? x : (x && (x.text || x.t)) || ''));
    } catch (e) {
      const code = (e && e.code) || 'upstream_error';
      if (code === 'cancelled' || signal.aborted) throw { code: 'cancelled' };
      if (PRON_FATAL.includes(code)) throw e;
      if (attempt === 2) throw e;
      if (code === 'rate_limited') concBackoff();
      await new Promise(res => setTimeout(res, code === 'rate_limited' ? 20000 : 4000));
    }
  }
  return null;
}

async function pronRun(col, onProgress) {
  const { jobs, flush } = col;
  const ctl = new AbortController();
  Object.assign(PRON, { busy: true, ctl, done: 0, total: jobs.length, fixed: 0, err: '' });
  const batches = [];
  for (const kind of ['subj', 'gr', 'hk']) {
    const list = jobs.filter(j => j.kind === kind), n = kind === 'hk' ? 3 : 12;
    for (let i = 0; i < list.length; i += n) batches.push({ kind, jobs: list.slice(i, i + n) });
  }
  let next = 0;
  const worker = async () => {
    while (next < batches.length && !ctl.signal.aborted) {
      const b = batches[next++];
      try {
        const outs = await pronBatch(b.kind, b.jobs, ctl.signal);
        b.jobs.forEach((j, i) => {
          const t = outs && String(outs[i] || '').trim();
          // 너무 짧아지거나 길어진 글은 받지 않음 (내용이 빠졌을 수 있음)
          if (!t || t.length < j.text.length * 0.6 || t.length > j.text.length * 1.4) return;
          if (t !== j.text && j.apply(t)) PRON.fixed++;
        });
        flush();
      } catch (e) {
        const code = (e && e.code) || 'upstream_error';
        if (code === 'cancelled') break;
        PRON.err = errMsg(code, e);
        if (PRON_FATAL.includes(code)) { ctl.abort(); break; }
      } finally {
        PRON.done = Math.min(PRON.total, PRON.done + b.jobs.length);
        onProgress && onProgress();
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, conc(), batches.length) || 1 }, worker));
  flush();
  PRON.busy = false; PRON.ctl = null;
  // 지금 보고 있는 화면 다시 그리기
  if (S.plan) { renderListSoon(S.unitId, S.lv, true); renderUnitsSoon(); }
  if (S.mode === 'gr') renderGRResults();
  if (S.mode === 'hk') { renderHKList(); hkEditorSoft(); }
}

async function openPronounSheet(auto) {
  if (PRON.busy) return;
  if (!engineReady()) { if (!auto) openSettings(); return; }
  const col = await pronCollect();
  const { jobs } = col;
  if (!jobs.length) { if (auto) Store.lsSet('ssam:mig:pron', 1); else toast('대명사가 들어간, 아직 쓰지 않은 글이 없어요'); return; }
  if (auto) {
    if ($('#sheetRoot').children.length) return; // 다른 창이 열려 있으면 다음에 켤 때 다시 알림
    Store.lsSet('ssam:mig:pron', 1);
  }
  const nS = jobs.filter(j => j.kind === 'subj').length, nG = jobs.filter(j => j.kind === 'gr').length, nH = jobs.filter(j => j.kind === 'hk').length;
  openSheet(`<h3>대명사 줄이기</h3>
    <p style="margin:0">이제 교과 평어·평가지 채점 평어·행특을 쓸 때 '자신의', '이를', '그 과정' 같은 대명사는 꼭 필요할 때만 써요.</p>
    <p class="muted" style="margin:0">이미 만든 글 중 아직 쓰지 않은 글에 대명사가 들어 있어요. AI가 대명사가 든 부분만 고쳐 써요. 사용함·완료로 표시한 글은 그대로 둬요.</p>
    <ul class="pron-n">${nS ? `<li>교과 평어 <b class="num">${nS}</b>문장</li>` : ''}${nG ? `<li>평가지 채점 평어 <b class="num">${nG}</b>명</li>` : ''}${nH ? `<li>행동특성 및 종합의견 <b class="num">${nH}</b>개</li>` : ''}</ul>
    <div id="pronProg" hidden><p class="muted" id="pronTxt" style="margin:0"></p><div class="meter big"><i id="pronBar" style="width:0%"></i></div></div>
    <div class="row" style="justify-content:flex-end" id="pronActs"><button class="btn" type="button" data-close>나중에</button><button class="btn primary" type="button" id="pronGo">다시 쓰기</button></div>
    <p class="muted" style="margin:0;font-size:12px">평어를 만들 때처럼 AI 사용량이 조금 들어요. 나중에 오른쪽 위 메뉴(⋮) → 「대명사 줄이기」로 할 수 있어요.</p>`, sh => {
    sh.querySelector('#pronGo').addEventListener('click', async () => {
      const prog = sh.querySelector('#pronProg'), acts = sh.querySelector('#pronActs');
      prog.hidden = false;
      acts.innerHTML = `<button class="btn" type="button" id="pronStop">멈추기</button>`;
      acts.querySelector('#pronStop').addEventListener('click', () => { PRON.ctl && PRON.ctl.abort(); });
      const upd = () => {
        const t = sh.querySelector('#pronTxt'), bar = sh.querySelector('#pronBar');
        if (t) t.innerHTML = `<span class="spin"></span>고치는 중 · <span class="num">${PRON.done}/${PRON.total}</span>`;
        if (bar) bar.style.width = Math.round(PRON.done / Math.max(1, PRON.total) * 100) + '%';
      };
      upd();
      await pronRun(col, upd);
      if (!document.body.contains(sh)) { toast(`대명사가 든 글 ${PRON.fixed}개를 고쳤어요`); return; }
      const t = sh.querySelector('#pronTxt'), bar = sh.querySelector('#pronBar');
      if (bar) bar.style.width = '100%';
      if (t) t.innerHTML = PRON.err ? `${esc(PRON.err)}<br>고친 글 ${PRON.fixed}개는 저장했어요.` : `대명사가 든 글 <b class="num">${PRON.fixed}</b>개를 고쳤어요.${PRON.fixed < PRON.total ? ' 나머지는 대명사가 꼭 필요하거나 고친 글이 맞지 않아 그대로 뒀어요.' : ''}`;
      acts.innerHTML = `<button class="btn primary" type="button" data-close>닫기</button>`;
    });
  });
}

// 업데이트 뒤 처음 한 번: 대명사가 든 쓰지 않은 글이 있으면 알려 줌
storeReady.then(() => setTimeout(() => {
  if (Store.lsGet('ssam:mig:pron', 0)) return;
  // 무언가 만들고 있으면 방해하지 않고 다음에 켤 때 알림
  if (S.running.size || S.queue.length || GR.running.size || GR.writeCtl || HK.running.size) return;
  openPronounSheet(true).catch(() => {});
}, 1500));

/* ===== 쌤비서 틀(core/shell.js)과 새 메뉴가 쓰는 다리 =====
   평가 화면 바꾸기, AI 부르기, 학급 명단, 알림·시트를 밖에 내보냄 */
var modeHooks = [];
window.SSAM = {
  // 떠 있는 버튼: 교과 평어 평가계획 넣기, 평가지 채점에 쪽 넣기
  inbox: {
    async evalPlan(file) {
      try { await adoptPlan(await readBytes(new Uint8Array(await file.arrayBuffer()), file.name, '파일')); }
      catch (e) { toast(READ_MSG[e && e.message] || '평가계획을 읽지 못했어요. 교과 평어에서 표를 붙여넣어 보세요.', 6000); }
    },
    grPages: files => grAddPages(files),
    grBusy: () => GR.running.size > 0 || ['grading', 'ranking', 'writing'].includes(GR.phase)
  },
  setMode, getMode: () => S.mode,
  // 평가지 채점 한꺼번에 넣기(gr-bundle.js)
  gr: { putBundle: b => grPutBundle(b), refresh: () => { if (S.mode === 'gr') renderGRSetup(); }, mask: () => (GR.settings.maskOn ? GR.settings.mask : []) },
  // 평가 영역 이음(활동지·단원평가 → 평가지 채점): 지금 평가계획의 영역 [{ id, subject, label }]
  planUnits: () => allUnits().map(u => ({ id: u.id, subject: u.subject, label: [u.area, u.elem || u.unit].filter(Boolean).join(' · ') })),
  onModeChange: fn => { modeHooks.push(fn); },
  ai: { generate, engineReady, engineName, providers: aiProviders, current: () => ({ engine: E.engine, model: E.engine && E.models[E.engine] || '' }), providerName: () => E.engine === 'account' ? 'Claude 계정' : (PROVIDERS[E.engine] ? PROVIDERS[E.engine].name : ''), errMsg, openSettings },
  rosterHTML, toast, openSheet, closeSheet, esc, copyText,
  // 단원평가: 이름 칸 가리기 편집기 { shots: [{ url, label }], mask, all, what, save(mask, all) }
  openMaskEditor,
  // 설정 › 학급 명단 엑셀 가져오기
  setClass: (count, except) => setClass(count, except, 'roster'),
  // 학년도를 옮기는 동안 평가 메뉴의 저장도 멈춤
  freeze: on => { S.wiping = !!on; },
  // 학년도를 옮기기 전: 평어·행특·채점·창체를 만드는 중인지, 미뤄 둔 저장을 바로 함
  busy: () => workBusy(),
  async flush() {
    const jobs = [];
    for (const st of [HKStore, GRStore, CCStore]) if (st && st.t) { clearTimeout(st.t); jobs.push(st.write()); }
    if (Store._lf) for (const k of Object.keys(Store._lf)) { clearTimeout(Store._lt[k]); Store._lf[k](); }
    await Promise.all(jobs);
  },
  // 새 메뉴(품의 등)가 쓰는 파일 읽기: 한글 파일 글, PDF·사진 → AI에 보낼 그림
  files: {
    readHwpxText: async u8 => blocksToText(await parseHWPX(u8, DOMParser)),
    // .hwp·.hwpx → 글 (CFB면 hwp, 아니면 hwpx)
    readHwpText: async u8 => blocksToText(u8[0] === 0xD0 && u8[1] === 0xCF ? await parseHWP(u8) : await parseHWPX(u8, DOMParser)),
    // 단원평가 정답지: 합친 칸을 풀어 쓴 표 글
    readHwpGridText: async u8 => blocksToGridText(u8[0] === 0xD0 && u8[1] === 0xCF ? await parseHWP(u8) : await parseHWPX(u8, DOMParser)),
    // PDF의 글자 층 → 글 (쪽 사이는 빈 줄). { columns: true }면 2쪽 모아찍기 쪽은 왼쪽 단을 먼저
    async pdfText(u8, opts = {}) {
      const lib = await loadPdfJs();
      const doc = await lib.getDocument({ data: u8, isEvalSupported: false }).promise;
      const out = [];
      try {
        for (let i = 1; i <= doc.numPages; i++) {
          const pg = await doc.getPage(i);
          const c = await pg.getTextContent(), v = pg.getViewport({ scale: 1 });
          out.push(pdfPageText(c.items, v.width, v.height, !!opts.columns, pg.rotate || 0));
          pg.cleanup();
        }
      } finally { doc.destroy(); }
      return out.join('\n\n');
    },
    // 단원평가: 스캔 PDF·사진 여러 개 → 쪽 [{ name, blob, url, thumb, w, h }] (파일 이름 차례), 쪽 → AI에 보낼 그림(가릴 곳은 흰색)
    readPages: (fileList, say) => readFiles(fileList, say || (() => {})),
    pageImage: (page, mask) => pageImage(page, mask && mask.length ? mask : null),
    freePages(pages) { for (const p of pages || []) { URL.revokeObjectURL(p.url); if (p.thumb) URL.revokeObjectURL(p.thumb); p._enc = null; } },
    async toImages(file) {
      const pages = /\.pdf$/i.test(file.name || '') || file.type === 'application/pdf' ? await readPdfPages(file) : [await readImagePage(file)];
      const out = [];
      for (const pg of pages) { out.push(await pageImage(pg, null)); URL.revokeObjectURL(pg.url); if (pg.thumb) URL.revokeObjectURL(pg.thumb); }
      return out;
    }
  }
};
try { const m = localStorage.getItem('ssam:mode'); if (m === 'hk' || m === 'gr' || m === 'cc') setMode(m); } catch (e) {}
})();
