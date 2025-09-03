// Presentation controller: full-screen slides + auto-AI wiring
function qs(a){return document.querySelector(a)}
function qsa(a){return [...document.querySelectorAll(a)]}
const slides = qsa('.slide')
const dotsBySlide = slides.map(s=>[...s.querySelectorAll('.progress .dot')])
let cur = 0
function show(n){
  cur = Math.max(0, Math.min(slides.length-1, n))
  slides.forEach((s,i)=> s.classList.toggle('active', i===cur))
  dotsBySlide.forEach((dots,i)=> dots.forEach((d,j)=> d.classList.toggle('active', i===cur && j===i)))
}
// keyboard nav
window.addEventListener('keydown', (e)=>{
  if(e.key==='ArrowRight' || e.key==='PageDown') next()
  if(e.key==='ArrowLeft' || e.key==='PageUp') prev()
})
function next(){ show(cur+1); onEnterSlide(cur) }
function prev(){ show(cur-1) }

function toast(m){ const t=qs('#toast'); t.textContent=m; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 2000) }

const synthBtn = qs('#synthesizeBtn')
const aiLabelBtn = qs('#aiLabelBtn')
const draftBtn = qs('#draftPrdBtn')
const rewriteBtn = qs('#rewritePrdBtn')
const roadmapBtn = qs('#roadmapBtn')
const personasBtn = qs('#personasBtn')
const pitchBtn = qs('#pitchBtn')

qs('#startBtn').addEventListener('click', ()=> { show(1); })

qs('#analyzeBtn').addEventListener('click', async ()=>{
  synthBtn.click()
  toast('Analyzing…')
  let tries=0
  const ok=()=> window.current && window.current.themes && window.current.themes.length>0
  while(!ok() && tries<200){ await new Promise(r=>setTimeout(r,150)); tries++ }
  aiLabelBtn?.click()
  next()
})

qsa('.next').forEach(b=> b.addEventListener('click', ()=> { next() }))

function onEnterSlide(idx){
  if(idx===3){
    draftBtn?.click()
    setTimeout(()=> rewriteBtn?.click(), 300)
  }
  if(idx===2){
    window.dispatchEvent(new Event('quinoa:assist-prioritization')) // AI chooses best framework
    const note = qs('#riceNote'); if (note) note.textContent='AI applied framework (editable).'
  }
  if(idx===5){
    roadmapBtn?.click(); personasBtn?.click(); pitchBtn?.click(); toast('Generating insights…')
  }
}

const tabs=[...document.querySelectorAll('.tab')]
const panes=[...document.querySelectorAll('.tabpanes .pre')]
tabs.forEach(t=> t.addEventListener('click', ()=>{
  tabs.forEach(x=>x.classList.remove('active'))
  panes.forEach(x=>x.classList.remove('show'))
  t.classList.add('active')
  document.getElementById(t.dataset.tab+'Out').classList.add('show')
}))

show(0)