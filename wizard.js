// Simplified wizard controller: auto-run AI & minimal buttons
// Requires app.js and webllm-advanced.js loaded.
const panels=[...document.querySelectorAll('[data-panel]')];
const steps=[...document.querySelectorAll('.stepper .step')];
const bar=document.querySelector('.stepper .bar');
let cur=1;
function toast(msg){const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 2000);}
function show(n){
  cur=Math.max(1,Math.min(5,n));
  panels.forEach(p=>p.classList.toggle('active', Number(p.dataset.panel)===cur));
  steps.forEach(s=>{const i=Number(s.dataset.step); s.classList.toggle('active', i===cur)});
  bar.style.setProperty('--progress',(cur-1)/4);
}
show(1);

// Elements
const analyzeBtn=document.getElementById('analyzeBtn');
const startBtn=document.getElementById('startBtn');
const prdEl=document.getElementById('prd');
const copyPrdBtn=document.getElementById('copyPrdBtn');
const downloadPrdBtn=document.getElementById('downloadPrdBtn');
const roadmapOut=document.getElementById('roadmapOut');
const personasOut=document.getElementById('personasOut');
const pitchOut=document.getElementById('pitchOut');
const tabs=[...document.querySelectorAll('.tab')];
const panes=[...document.querySelectorAll('.tabpanes .pre')];
const riceNote=document.getElementById('riceNote');

startBtn.addEventListener('click', ()=> show(1));

// Hook into app.js controls
const synthBtn = document.getElementById('synthesizeBtn');
const draftBtn = document.getElementById('draftPrdBtn');

// Step 1 → Analyze
analyzeBtn.addEventListener('click', async () => {
  synthBtn.click(); // triggers embeddings+cluster+RICE initial render
  toast('Analyzing…');
  // Wait until themes exist
  let tries=0;
  const ok=()=> window.current && window.current.themes && window.current.themes.length>0;
  while(!ok() && tries<200){ await new Promise(r=>setTimeout(r,150)); tries++; }
  // Auto label themes with LLM
  document.getElementById('aiLabelBtn')?.click();
  show(2);
});

// Explicit next buttons in DOM move to later steps
document.querySelectorAll('.next').forEach(b=> b.addEventListener('click', async e=>{
  const next=Number(b.dataset.next);
  show(next);
  if (next===3){
    // Auto AI Suggest RICE
    window.dispatchEvent(new Event('quinoa:assist-rice'));
    riceNote.textContent = 'Applied AI RICE suggestions (you can still tweak values).';
  }
  if (next===4){
    // Auto PRD draft and rewrite
    draftBtn.click();
    setTimeout(()=> document.getElementById('rewritePrdBtn')?.click(), 300);
  }
  if (next===5){
    // Auto insights
    document.getElementById('roadmapBtn')?.click();
    document.getElementById('personasBtn')?.click();
    document.getElementById('pitchBtn')?.click();
    toast('Generating insights…');
  }
}));

// Tabs
tabs.forEach(t=> t.addEventListener('click', ()=>{
  tabs.forEach(x=>x.classList.remove('active'));
  panes.forEach(x=>x.classList.remove('show'));
  t.classList.add('active');
  document.getElementById(t.dataset.tab+'Out').classList.add('show');
}));

// PRD actions (duplicated for UX speed)
copyPrdBtn.addEventListener('click', async ()=>{
  if(!prdEl.value) return;
  await navigator.clipboard.writeText(prdEl.value);
  toast('PRD copied');
});
downloadPrdBtn.addEventListener('click', ()=>{
  if(!prdEl.value) return;
  const blob=new Blob([prdEl.value],{type:'text/markdown'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='PRD.md'; a.click(); URL.revokeObjectURL(a.href);
});

// Copy/Download all insights
document.getElementById('copyAllBtn').addEventListener('click', async ()=>{
  const text = [
    '# Roadmap', (roadmapOut.textContent||'').trim(),
    '\\n\\n# Personas/JTBD', (personasOut.textContent||'').trim(),
    '\\n\\n# Pitch Deck Bullets', (pitchOut.textContent||'').trim(),
  ].join('\\n');
  await navigator.clipboard.writeText(text);
  toast('Insights copied');
});
document.getElementById('downloadAllBtn').addEventListener('click', async ()=>{
  const { default: JSZip } = await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
  const zip = new JSZip();
  zip.file('roadmap.md', roadmapOut.textContent||'');
  zip.file('personas.md', personasOut.textContent||'');
  zip.file('pitch.md',    pitchOut.textContent||'');
  const blob = await zip.generateAsync({type:'blob'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='quinoa-insights.zip'; a.click(); URL.revokeObjectURL(a.href);
});
