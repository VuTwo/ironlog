/* gen-program.mjs — regenerate js/program-data.js from the FORGED spreadsheet.
   Usage:  node scripts/gen-program.mjs [FORGED-Powerbuilder-Tracker.xlsx]
   The .xlsx is the source of truth; js/program-data.js is generated (do not hand-edit). */
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const xlsxPath = join(root, process.argv[2] || 'FORGED-Powerbuilder-Tracker.xlsx');

// ---- minimal zip reader (central-directory walk) → { entryName: xmlString } ----
function unzip(buf) {
  const files = {};
  // find End Of Central Directory record
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  const total = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16); // central directory offset
  for (let i = 0; i < total; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    // read local header to find where the data actually starts
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);
    files[name] = (method === 0 ? raw : inflateRawSync(raw)).toString('utf8');
    p += 46 + nameLen + extraLen + commLen;
  }
  return files;
}

const zip = unzip(readFileSync(xlsxPath));

function dec(s){ return s
  .replace(/&#8212;/g,'—').replace(/&#8211;/g,'–').replace(/&#8226;/g,'•')
  .replace(/&#8804;/g,'≤').replace(/&#8805;/g,'≥').replace(/&#8594;/g,'→')
  .replace(/&#176;/g,'°').replace(/&#215;/g,'×').replace(/&#10;/g,'\n')
  .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'")
  .replace(/&amp;/g,'&'); }
function colToNum(col){ let n=0; for(const c of col){ n=n*26+(c.charCodeAt(0)-64);} return n; }

function readSheet(i){
  const xml = zip[`xl/worksheets/sheet${i}.xml`];
  const rows = [];
  const rowRe = /<row[^>]*r="(\d+)"[^>]*>(.*?)<\/row>/gs;
  let m;
  while((m=rowRe.exec(xml))){
    const cellRe = /<c[^>]*r="([A-Z]+)\d+"([^>]*)>(.*?)<\/c>/gs;
    let cm; const cells = {};
    while((cm=cellRe.exec(m[2]))){
      const col = colToNum(cm[1]); const inner = cm[3];
      const t = inner.match(/<t[^>]*>(.*?)<\/t>/s);
      const v = inner.match(/<v>(.*?)<\/v>/s);
      const val = t ? dec(t[1]) : (v ? dec(v[1]) : '');
      if(val!=='') cells[col]=val;
    }
    rows.push({ r:+m[1], cells });
  }
  return rows.sort((a,b)=>a.r-b.r);
}

const LIFT = {
  'Competition Squat':'squat', 'Paused Squat (2-ct)':'squat',
  'Competition Bench':'bench', 'Touch-and-Go Bench':'bench', 'Deadlift':'deadlift',
};
const DAY_KEYS = ['lowerA','upperA','lowerB','upperB'];
const DAY_RE = /^(TUESDAY|THURSDAY|SATURDAY|SUNDAY)\b/;

const cueList = []; const cueIdx = new Map();
function cueId(s){ s=(s||'').trim(); if(!s) return null; if(cueIdx.has(s)) return cueIdx.get(s);
  const id=cueList.length; cueList.push(s); cueIdx.set(s,id); return id; }

function parseDayHeader(txt){
  const day = txt.match(DAY_RE)[1];
  const dayName = day.charAt(0)+day.slice(1).toLowerCase();
  let rest = txt.replace(DAY_RE,'').replace(/^\s*—\s*/,'').trim();
  let note = ''; const paren = rest.match(/\(([^)]*)\)\s*$/);
  if(paren){ note = paren[1].trim(); rest = rest.slice(0, paren.index).trim(); }
  return { dayName, title: rest, note };
}

const weeks = [];
for(let sheet=2; sheet<=9; sheet++){
  const rows = readSheet(sheet);
  const title = rows[0]?.cells[1] || '';
  const block = (title.split('|')[1]||'').trim();
  const deload = /DELOAD/i.test(title);
  const days = []; let cur=null, expectHeader=false, dayCount=0;
  for(let k=1;k<rows.length;k++){
    const c = rows[k].cells; const c1 = c[1]||'';
    if(DAY_RE.test(c1)){ const h=parseDayHeader(c1);
      cur={ key:DAY_KEYS[dayCount++], day:h.dayName, title:h.title, note:h.note, items:[] };
      days.push(cur); expectHeader=true; continue; }
    if(c1==='Exercise'){ expectHeader=false; continue; }
    if(!cur || expectHeader || !Object.keys(c).length) continue;
    const setCol=c[2]||'', reps=c[3]||'', pct=c[4]||'', rpe=c[6]||'', rest=c[7]||'', cue=c[8]||'';
    if(!c1 && setCol){ const prev=cur.items[cur.items.length-1]; if(prev&&prev.t==='main') prev.sets++; continue; }
    if(!c1) continue;
    if(/^SUPERSET:/i.test(c1)){
      const names=c1.replace(/^SUPERSET:\s*/i,'').split('+').map(s=>s.trim());
      cur.items.push({ t:'ss', a:names[0], b:names[1], sets:parseInt(setCol,10)||1, reps, rpe, rest, cue:cueId(cue) });
    } else if(/%$/.test(pct)){
      cur.items.push({ t:'main', ex:c1, lift:LIFT[c1]||null, sets:1, reps, pct:parseFloat(pct), rpe, rest, cue:cueId(cue) });
    } else {
      cur.items.push({ t:'acc', ex:c1, sets:parseInt(setCol,10)||1, reps, rpe, rest, cue:cueId(cue) });
    }
  }
  weeks.push({ n:sheet-1, block, deload, days });
}

// Start-Here extras
const sh = readSheet(1);
const rpeCheat = [], weekMap = [];
for(const row of sh){ const a=row.cells[2], b=row.cells[3], cc=row.cells[4];
  if(a && b && /^(6|7|7\.5|8|8\.5|9|10)$/.test(String(a).trim())) rpeCheat.push([String(a).trim(), b]);
  if(a && b && cc && /^(1-3|4|5-7|8)$/.test(String(a).trim())) weekMap.push([String(a).trim(), b, cc]);
}

const PROGRAM = {
  id:'forged', name:'FORGED — 4-Day Powerbuilder', subtitle:'Strength you keep. Muscle you build.',
  defaultMaxesLb:{ squat:445, bench:275, deadlift:515 },
  lifts:[{key:'squat',name:'Squat'},{key:'bench',name:'Bench Press'},{key:'deadlift',name:'Deadlift'}],
  rpeCheat, weekMap, cues:cueList, weeks,
};

const banner = `/* program-data.js — GENERATED from FORGED-Powerbuilder-Tracker.xlsx by scripts/gen-program.mjs. Do not edit by hand. */\n`;
const js = banner + `(function(){'use strict';const FT=(window.FT=window.FT||{});FT.PROGRAM=${JSON.stringify(PROGRAM)};})();\n`;
writeFileSync(join(root, 'js/program-data.js'), js);
console.log(`Wrote js/program-data.js — ${weeks.length} weeks, ${cueList.length} cues, ${(js.length/1024).toFixed(1)} KB.`);
