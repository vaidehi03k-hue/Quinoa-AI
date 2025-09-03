// Quinoa core — embeddings + clustering + RICE + PRD (client-side)
const notesEl = document.getElementById('notes');
const npsCsvEl = document.getElementById('npsCsv');
const jiraCsvEl = document.getElementById('jiraCsv');
const synthBtn = document.getElementById('synthesizeBtn');
const embedStatus = document.getElementById('embedStatus');
const themesEl = document.getElementById('themes');
const prioEl = document.getElementById('prioritization');
const chartEl = document.getElementById('chart');
const draftPrdBtn = document.getElementById('draftPrdBtn');
const copyPrdBtn = document.getElementById('copyPrdBtn');
const downloadPrdBtn = document.getElementById('downloadPrdBtn');
const prdEl = document.getElementById('prd');
const downloadCsvBtn = document.getElementById('downloadCsv');

window.transformers?.env?.allowLocalModels = false;
let embedder;
window.current = { rawItems: [], themes: [], rice: [], jira: [], nps: [] };

async function ensureEmbedder() {
  if (embedder) return;
  embedStatus.textContent = 'Loading embedding model (all-MiniLM-L6-v2)…';
  const { pipeline } = window.transformers;
  embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  embedStatus.textContent = 'Model ready.';
}
async function embed(texts) {
  const out = [];
  for (let t of texts) {
    const res = await embedder(t, { pooling: 'mean', normalize: true });
    out.push(Array.from(res.data));
  }
  return out;
}
function cosine(a,b){ let s=0; for(let i=0;i<a.length;i++) s+=a[i]*b[i]; return s; }

const STOP = new Set(('a,an,the,of,in,for,to,from,with,and,or,but,if,on,at,by,as,be,is,are,was,were,that,this,these,those,it,its,into,not,no,yes,can,cannot,will,should,must,we,our,you,your,they,them,he,she,his,her,have,has,had,do,does,did,done,over,per,via,more,less,very,so,just,than,then,when,what,which,who,whom,why,how,about,across,within,without').split(','));
function tokenize(str){ return (str.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w=>w && !STOP.has(w))); }
function topKeywords(texts,k=4){ const freq=new Map(); for(const t of texts){ const seen=new Set(); for(const w of tokenize(t)){ if(seen.has(w)) continue; seen.add(w); freq.set(w,(freq.get(w)||0)+1); } } return [...freq.entries()].sort((a,b)=>b[1]-a[1]).slice(0,k).map(x=>x[0]); }
function download(filename,text){ const blob=new Blob([text],{type:'text/plain'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url); }

function greedyCluster(vectors, items, threshold=0.72){
  const clusters=[];
  for (let i=0;i<vectors.length;i++){
    const v=vectors[i]; let best=-1,score=-1;
    for (let c=0;c<clusters.length;c++){ const s=cosine(v,clusters[c].centroid); if(s>score){best=c;score=s;} }
    if(best===-1 || score<threshold){ clusters.push({centroid:v.slice(), idxs:[i]}); }
    else { const cl=clusters[best]; cl.idxs.push(i); for(let j=0;j<cl.centroid.length;j++){ cl.centroid[j]=(cl.centroid[j]*(cl.idxs.length-1)+v[j])/cl.idxs.length; } }
  }
  const themes = clusters.map((c,ci)=>{
    const texts=c.idxs.map(i=>items[i].text);
    const label=topKeywords(texts,4).join(' · ') || `Theme ${ci+1}`;
    return { id:`T${ci+1}`, label, items:c.idxs.map(i=>items[i]), centroid:c.centroid, keywords: topKeywords(texts,10) };
  });
  return themes.sort((a,b)=>b.items.length-a.items.length);
}

function buildRiceRows(themes, jiraIssues){
  const rows=[];
  for(const t of themes){
    const reach=t.items.length;
    const impact=Math.min(3, 1 + t.keywords.length/6);
    const confidence=Math.min(0.9, 0.5 + (t.items.length/(themes[0]?.items.length||1))*0.4);
    let effort=3;
    if(jiraIssues.length){
      const topWord=t.keywords[0];
      const related=jiraIssues.filter(j=>(j.summary||'').toLowerCase().includes((topWord||'').toLowerCase()));
      if(related.length){
        const pts=related.map(r=>r.points||3);
        effort=Math.max(1, Math.round(pts.reduce((a,b)=>a+b,0)/pts.length));
      }
    }
    const rice=Math.round((reach*impact*confidence)/Math.max(1,effort)*100)/100;
    rows.push({ id:t.id, theme:t.label, reach, impact:+impact.toFixed(2), confidence:+confidence.toFixed(2), effort, rice });
  }
  rows.sort((a,b)=>b.rice-a.rice);
  return rows;
}

function renderThemes(themes){
  themesEl.innerHTML='';
  themes.forEach(t=>{
    const div=document.createElement('div');
    div.className='theme';
    div.setAttribute('data-theme-id', t.id);
    const quotes = t.items.slice(0,5).map(it=>`<div class="quote">“${it.text}” <span class="muted tiny">— ${it.source||''}</span></div>`).join('');
    div.innerHTML=`<h4><span class="theme-title">${t.label}</span> <span class="muted tiny">(${t.items.length})</span></h4>${quotes}${t.items.length>5?`<div class="muted tiny">+${t.items.length-5} more…</div>`:''}`;
    themesEl.appendChild(div);
  });
}

function renderRiceTable(rows){
  prioEl.innerHTML='';
  const hasAlt = rows.some(r => typeof r.alt_score === 'number');
  const hasMoscow = rows.some(r => r.moscow);

  const table=document.createElement('table'); table.className='table';
  table.innerHTML=`
    <thead>
      <tr>
        <th>Rank</th><th>Theme</th><th>Reach</th><th>Impact</th><th>Confidence</th><th>Effort</th><th>RICE</th>
        ${hasAlt || hasMoscow ? '<th>AI Score / Category</th>' : ''}
      </tr>
    </thead>
    <tbody></tbody>`;
  const tb=table.querySelector('tbody');
  rows.forEach((r,idx)=>{
    const extra = hasAlt ? (typeof r.alt_score === 'number' ? r.alt_score.toFixed(2) : '—')
               : hasMoscow ? (r.moscow || '—')
               : '';
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${idx+1}</td>
      <td>${r.theme}</td>
      <td><input type="number" step="1" value="${r.reach}" data-id="${r.id}" data-field="reach"></td>
      <td><input type="number" step="0.1" value="${r.impact}" data-id="${r.id}" data-field="impact"></td>
      <td><input type="number" step="0.05" value="${r.confidence}" data-id="${r.id}" data-field="confidence"></td>
      <td><input type="number" step="1" value="${r.effort}" data-id="${r.id}" data-field="effort"></td>
      <td><b>${r.rice}</b></td>
      ${hasAlt || hasMoscow ? `<td>${extra}</td>` : ''}`;
    tb.appendChild(tr);
  });
  prioEl.appendChild(table);

  table.querySelectorAll('input').forEach(inp=>{
    inp.addEventListener('change', e=>{
      const id=e.target.dataset.id, field=e.target.dataset.field;
      const row=window.current.rice.find(x=>x.id===id);
      row[field]=Number(e.target.value);
      row.rice=Math.round((row.reach*row.impact*row.confidence)/Math.max(1,row.effort)*100)/100;

      const useAlt = window.current.rice.some(x => typeof x.alt_score === 'number');
      if (useAlt){
        window.current.rice.sort((a,b)=>{
          const sa = (b.alt_score ?? -Infinity) - (a.alt_score ?? -Infinity);
          if (sa !== 0) return sa;
          return b.rice - a.rice;
        });
      } else {
        window.current.rice.sort((a,b)=>b.rice-a.rice);
      }
      renderRiceTable(window.current.rice);
      drawChart(window.current.rice);
    });
  });
}

let chart;
function drawChart(rows){
  const labels=rows.slice(0,8).map(r => r.theme.slice(0,22)+(r.theme.length>22?'…':''));
  const data=rows.slice(0,8).map(r => r.rice);
  if(chart) chart.destroy();
  const ctx=chartEl.getContext('2d');
  chart=new Chart(ctx,{type:'bar', data:{labels, datasets:[{label:'RICE score', data}]}, options:{responsive:true, scales:{y:{beginAtZero:true}}}});
}

function prdFromState(){
  const today=new Date().toISOString().slice(0,10);
  const top=window.current.rice.slice(0,5);
  const evidence=window.current.themes.slice(0,4).map(t=>{
    const sample=t.items.slice(0,2).map(i=>`- "${i.text}" — ${i.source||''}`).join('\n');
    return `### ${t.label}\nMentions: ${t.items.length}\n${sample}`;
  }).join('\n\n');
  return `# PRD — Quinoa (Tiny grains, big insights)
Date: ${today}

## Problem & Context
PMs spend significant time synthesizing inputs (calls, NPS, tickets) into priorities and docs. Quinoa accelerates synthesis and sharpens decisions while keeping PM judgment central.

## Users & Jobs
- PMs: Decide what to build next; draft a solid PRD quickly.
- Tech/Design: Understand tradeoffs and success metrics with less reading.

## Goals (MVP)
- Cut research→priorities→PRD cycle by ~60%.
- First-pass stakeholder sign-off ≥ 80%.
- PRD sections grounded with evidence.

## Top Opportunities (by RICE)
${top.map((r,i)=>`${i+1}. **${r.theme}** — RICE ${r.rice} (R ${r.reach}, I ${r.impact}, C ${r.confidence}, E ${r.effort})`).join('\n')}

## Scope (v1)
- Local embeddings + clustering to extract themes with citations.
- Prioritization with editable values and auto-ranking.
- PRD exporter (Markdown).

## Risks & Mitigations
- Hallucinations → Show quotes & counts; keep template deterministic.
- Overconfidence → Editable RICE with “what-if” edits.
- Data sensitivity → All client-side; nothing leaves browser.

## Evidence
${evidence}

---
Generated locally via embeddings + clustering. Edit freely.`;
}

function parseCsvFile(file){
  return new Promise((resolve, reject)=>{
    Papa.parse(file, {header:true, skipEmptyLines:true, complete:r=>resolve(r.data), error:reject});
  });
}

function npsSeverity(score){
  const s = Number(score);
  if (isNaN(s)) return null;
  if (s <= 6) return 'Detractor';
  if (s <= 8) return 'Passive';
  return 'Promoter';
}

synthBtn.addEventListener('click', async ()=>{
  await ensureEmbedder();
  const rawItems=[];
  const lines=notesEl.value.split('\n').map(x=>x.trim()).filter(Boolean);
  lines.forEach((t,i)=> rawItems.push({id:`N${i+1}`, text:t, source:'Notes'}));

  window.current.nps = [];
  if(npsCsvEl.files[0]){
    const nps=await parseCsvFile(npsCsvEl.files[0]);
    const textCols=Object.keys(nps[0]||{}).filter(k=>/comment|feedback|text|note/i.test(k));
    const scoreCol=Object.keys(nps[0]||{}).find(k=>/^score$/i.test(k));
    nps.forEach((row,i)=>{
      const txt=textCols.map(c=>row[c]).filter(Boolean).join(' ');
      const sev=npsSeverity(row[scoreCol]);
      if(txt){
        const item = {id:`F${i+1}`, text:String(txt), source:'Feedback CSV', severity: sev || undefined, score: row[scoreCol] ?? undefined};
        rawItems.push(item);
        window.current.nps.push(item);
      }
    });
  }

  window.current.jira = [];
  let jiraIssues=[];
  if(jiraCsvEl.files[0]){
    const jira=await parseCsvFile(jiraCsvEl.files[0]);
    jiraIssues=jira.map((row,i)=>{
      const summary=row['Summary']||row['summary']||row['Title']||row['Issue summary']||'';
      const pts=Number(row['Story Points']||row['Story points']||row['story_points']||row['Points']||0);
      const it = { summary, points: isNaN(pts)?0:pts };
      window.current.jira.push(it);
      return it;
    });
  }

  if(rawItems.length===0){ alert('Please paste some notes or upload a CSV first.'); return; }
  window.current.rawItems=rawItems;

  embedStatus.textContent=`Embedding ${rawItems.length} items…`;
  const vecs=await embed(rawItems.map(r=>r.text));
  embedStatus.textContent=`Clustering…`;
  const themes=greedyCluster(vecs, rawItems, 0.72);
  window.current.themes=themes; renderThemes(themes);

  embedStatus.textContent=`Scoring…`;
  window.current.rice=buildRiceRows(themes, jiraIssues);
  renderRiceTable(window.current.rice);
  drawChart(window.current.rice);
  embedStatus.textContent=`Done.`;
});

downloadCsvBtn?.addEventListener('click', ()=>{
  if(!window.current.rice.length) return;
  const headers=['Rank','Theme','Reach','Impact','Confidence','Effort','RICE'];
  const sorted=structuredClone(window.current.rice).sort((a,b)=>b.rice-a.rice);
  const rows=sorted.map((r,i)=>[i+1,r.theme,r.reach,r.impact,r.confidence,r.effort,r.rice]);
  const csv=[headers.join(','), ...rows.map(r=>r.join(','))].join('\n');
  download('prioritization.csv', csv);
});

draftPrdBtn?.addEventListener('click', ()=>{
  if(!window.current.rice.length){ alert('Run analysis first.'); return; }
  prdEl.value = prdFromState();
});
copyPrdBtn?.addEventListener('click', async ()=>{
  if(!prdEl.value) draftPrdBtn?.click();
  await navigator.clipboard.writeText(prdEl.value||'');
  copyPrdBtn.textContent='Copied!';
  setTimeout(()=> copyPrdBtn.textContent='📋 Copy PRD', 1200);
});
downloadPrdBtn?.addEventListener('click', ()=>{
  if(!prdEl.value) draftPrdBtn?.click();
  download('PRD.md', prdEl.value||'');
});

// Insights: Copy/Download all
const copyAllBtn = document.getElementById('copyAllBtn');
const downloadAllBtn = document.getElementById('downloadAllBtn');
copyAllBtn?.addEventListener('click', async ()=>{
  const out = [
    document.getElementById('roadmapOut')?.textContent || '',
    document.getElementById('personasOut')?.textContent || '',
    document.getElementById('pitchOut')?.textContent || ''
  ].join('\n\n---\n\n');
  await navigator.clipboard.writeText(out);
  alert('Insights copied to clipboard.');
});
downloadAllBtn?.addEventListener('click', ()=>{
  const out = [
    '# Quinoa — Insights Bundle',
    '## Roadmap','',
    document.getElementById('roadmapOut')?.textContent || '',
    '',
    '## Personas / JTBD','',
    document.getElementById('personasOut')?.textContent || '',
    '',
    '## Pitch Bullets','',
    document.getElementById('pitchOut')?.textContent || ''
  ].join('\n');
  download('quinoa-insights.md', out);
});

window.addEventListener('DOMContentLoaded',()=>{
  const sample=[
    "Customers can’t find the bulk edit action for tasks",
    "Search is too slow for large projects",
    "Exporting to CSV doesn’t include story points",
    "We need SSO for enterprise customers",
    "Mobile app crashes when attaching images",
    "Board lanes can’t be reordered",
    "Need better onboarding checklists",
    "Filtering by label + assignee together is broken",
    "Public roadmap page should support voting",
    "On the pricing page, enterprise contact form is confusing"
  ];
  if(!notesEl.value.trim()) notesEl.value=sample.join('\n');
});