// WebLLM advanced: AI labels, PRD rewrite, RICE assistant, Roadmap, Personas, Pitch Deck, Framework chooser
let engine = null;
const llmStatus = document.getElementById('llmStatus');
const aiLabelBtn = document.getElementById('aiLabelBtn');
const rewritePrdBtn = document.getElementById('rewritePrdBtn');

const roadmapBtn = document.getElementById('roadmapBtn');
const personasBtn = document.getElementById('personasBtn');
const pitchBtn = document.getElementById('pitchBtn');
const roadmapOut = document.getElementById('roadmapOut');
const personasOut = document.getElementById('personasOut');
const pitchOut = document.getElementById('pitchOut');
const riceSuggestStatus = document.getElementById('riceSuggestStatus');

async function ensureEngine() {
  if (engine) return engine;
  if (llmStatus) llmStatus.textContent = 'Loading WebLLM model… (first time can take a bit)';
  try {
    const mod = await import('https://esm.run/@mlc-ai/web-llm');
    const model = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';
    engine = await mod.CreateMLCEngine(model, {
      initProgressCallback: (p) => { if (llmStatus) llmStatus.textContent = `Loading LLM: ${Math.round(p.progress*100)}%`; }
    });
    if (llmStatus) llmStatus.textContent = 'LLM ready.';
  } catch (e) {
    console.error(e);
    if (llmStatus) llmStatus.textContent = 'WebLLM not supported / failed to load (needs WebGPU).';
    throw e;
  }
  return engine;
}

async function llmJSON(prompt, schemaHint) {
  const eng = await ensureEngine();
  const sys = `Return ONLY valid JSON matching this structure: ${schemaHint}. Do not include explanations.`;
  const out = await eng.chat.completions.create({
    messages: [{ role: 'system', content: sys }, { role: 'user', content: prompt }],
    temperature: 0.2,
    max_tokens: 1200
  });
  let txt = out?.choices?.[0]?.message?.content?.trim() ?? '';
  const m = txt.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (m) txt = m[0];
  try {
    return JSON.parse(txt);
  } catch {
    throw new Error('LLM did not return JSON: ' + txt.slice(0, 400));
  }
}

async function llmText(prompt) {
  const eng = await ensureEngine();
  const out = await eng.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 1200
  });
  return out?.choices?.[0]?.message?.content ?? '';
}

// ---------- AI Theme Labels ----------
aiLabelBtn?.addEventListener('click', async () => {
  if (!window.current?.themes?.length) return;
  try {
    await ensureEngine();
    const clusters = window.current.themes.map((t) => {
      const examples = t.items.slice(0, 4).map(i => `- ${i.text}`).join('\n');
      return `Cluster:\n${examples}`;
    }).join('\n\n');
    const prompt = `Name each cluster with a short, punchy title (<=5 words). One title per cluster, newline-separated.\n${clusters}`;
    const resp = await llmText(prompt);
    const titles = resp.split('\n').map(s => s.trim()).filter(Boolean);
    const themeDivs = document.querySelectorAll('.theme');
    titles.forEach((title, idx) => {
      const t = window.current.themes[idx]; if (!t) return;
      t.label = title;
      const titleEl = themeDivs[idx]?.querySelector('.theme-title');
      if (titleEl) titleEl.textContent = title;
    });
    window.current.rice.forEach(r => {
      const match = window.current.themes.find(t => t.id === r.id);
      if (match) r.theme = match.label;
    });
    window.dispatchEvent(new Event('renderRice'));
    if (llmStatus) llmStatus.textContent = 'Theme labels updated via LLM.';
  } catch (e) {
    if (llmStatus) llmStatus.textContent = 'Failed to label themes (LLM not available).';
  }
});

// ---------- PRD Rewrite ----------
rewritePrdBtn?.addEventListener('click', async () => {
  const prdEl = document.getElementById('prd');
  if (!prdEl.value) return;
  if (llmStatus) llmStatus.textContent = 'Rewriting PRD with LLM…';
  try {
    const prompt = `Rewrite the following PRD into a concise executive brief. Keep headings, strengthen clarity, remove fluff, and ensure it stays grounded in the listed evidence. Do not invent facts.\n\n${prdEl.value}`;
    const resp = await llmText(prompt);
    prdEl.value = resp || prdEl.value;
    if (llmStatus) llmStatus.textContent = 'PRD rewritten.';
  } catch (e) {
    if (llmStatus) llmStatus.textContent = 'LLM rewrite failed or unsupported.';
  }
});

// ---------- Prioritization Assistant (classic RICE fallback) ----------
window.addEventListener('quinoa:assist-rice', async () => {
  if (!window.current?.themes?.length) return;
  try {
    const status = document.getElementById('riceSuggestStatus') || {textContent:''};
    status.textContent = 'LLM analyzing severity & suggesting RICE…';
    const themes = window.current.themes.map(t => {
      const ex = t.items.slice(0, 3).map(i => `- ${i.text}${i.severity ? ' (sev:' + i.severity + ')' : ''}`).join('\n');
      const sevCounts = { Detractor:0, Passive:0, Promoter:0 };
      t.items.forEach(i => { if (i.severity && sevCounts[i.severity] !== undefined) sevCounts[i.severity]++; });
      return { id: t.id, label: t.label, reach: t.items.length, examples: ex, severity: sevCounts };
    });
    const jira = window.current.jira || [];
    const schema = `[{"id":"T1","impact":2.4,"confidence":0.7,"effort":5,"rationale":"why impact/confidence/effort"}]`;
    const prompt = `Suggest RICE fields for each theme using severity counts and any Jira points: ${JSON.stringify(jira).slice(0,1800)}\nThemes:\n${JSON.stringify(themes).slice(0,5000)}\nReturn JSON array as ${schema}`;
    const json = await llmJSON(prompt, schema);
    const byId = Object.fromEntries(json.map(x => [x.id, x]));
    window.current.rice.forEach(r => {
      const s = byId[r.id]; if (!s) return;
      r.impact = typeof s.impact === 'number' ? s.impact : r.impact;
      r.confidence = typeof s.confidence === 'number' ? s.confidence : r.confidence;
      r.effort = typeof s.effort === 'number' ? s.effort : r.effort;
      r.rice = Math.round((r.reach*r.impact*r.confidence)/Math.max(1,r.effort)*100)/100;
    });
    status.textContent = 'Applied LLM RICE suggestions.';
    const firstInput = document.querySelector('#prioritization input');
    if (firstInput) firstInput.dispatchEvent(new Event('change'));
  } catch (e) {
    const status = document.getElementById('riceSuggestStatus') || {textContent:''};
    status.textContent = 'LLM RICE suggestion failed: ' + e.message;
  }
});

// ---------- Auto-select Best Prioritization Framework ----------
window.addEventListener('quinoa:assist-prioritization', async () => {
  if (!window.current?.themes?.length) return;
  const frameworkBadge = document.getElementById('frameworkBadge');
  const say = (t)=>{ if(frameworkBadge) frameworkBadge.textContent = t; };
  try {
    say('Analyzing data to choose the best framework…');

    const themes = window.current.themes.map(t => {
      const sev = { Detractor:0, Passive:0, Promoter:0 };
      t.items.forEach(i => { if (i.severity && sev[i.severity] !== undefined) sev[i.severity]++; });
      return { id:t.id, title:t.label, reach:t.items.length, severity:sev, hasJira:!!(window.current.jira?.length), keywords:t.keywords?.slice(0,6) || [] };
    });

    const schema = `{
      "framework":"RICE|ICE|WSJF|MoSCoW|ValueEffort|Kano",
      "rationale":"short why this fits the data",
      "per_theme":[{"id":"T1","score":7.2,"category":"Must|Should|Could|Won't"}]
    }`;

    const prompt = `Choose the best prioritization framework for the data (RICE, ICE, WSJF, MoSCoW, ValueEffort, Kano). Justify briefly and return JSON as ${schema}. Data: ${JSON.stringify(themes).slice(0,7000)}`;
    const decision = await llmJSON(prompt, schema);

    window.current.framework = {
      name: decision.framework || 'RICE',
      rationale: decision.rationale || '',
      perTheme: Array.isArray(decision.per_theme) ? decision.per_theme : []
    };

    const scoreById = {};
    window.current.framework.perTheme.forEach(x => { if (typeof x.score === 'number') scoreById[x.id] = x.score; });
    if (Object.keys(scoreById).length && window.current.rice?.length) {
      window.current.rice.forEach(r => { r.alt_score = scoreById[r.id] ?? null; });
      window.current.rice.sort((a,b)=>{
        const sa = (b.alt_score ?? -Infinity) - (a.alt_score ?? -Infinity);
        if (sa !== 0) return sa;
        return b.rice - a.rice;
      });
    } else {
      const catById = {};
      window.current.framework.perTheme.forEach(x => { if (x.category) catById[x.id] = x.category; });
      window.current.rice.forEach(r => { r.moscow = catById[r.id] || null; });
      window.current.rice.sort((a,b)=> b.rice - a.rice);
    }

    say(`Framework: ${window.current.framework.name} — ${window.current.framework.rationale}`);
    const firstInput = document.querySelector('#prioritization input');
    if (firstInput) firstInput.dispatchEvent(new Event('change'));
  } catch (e) {
    say('Framework selection failed; using RICE defaults.');
    window.dispatchEvent(new Event('quinoa:assist-rice'));
  }
});

// ---------- Roadmap ----------
roadmapBtn?.addEventListener('click', async () => {
  if (!window.current?.rice?.length) return;
  try {
    if (llmStatus) llmStatus.textContent = 'Generating roadmap with LLM…';
    const top = structuredClone(window.current.rice).sort((a,b)=>b.rice-a.rice).slice(0,5);
    const schema = `{"Q1":[{"id":"T1","title":"SSO for Enterprise","why":"reason","deps":"dependencies or null"}],"Q2":[{"id":"T5","title":"Faster Search","why":"reason","deps":null}]}`;
    const prompt = `Group these top opportunities into Q1 and Q2 with brief justifications. Consider impact, confidence, and effort. Return JSON as ${schema}. Items: ${JSON.stringify(top)}`;
    const json = await llmJSON(prompt, schema);
    const md = ['# Roadmap','## Q1',...(json.Q1||[]).map(x=>`- **${x.title}** (${x.id}) — ${x.why}${x.deps?` _(deps: ${x.deps})_`:''}`),'## Q2',...(json.Q2||[]).map(x=>`- **${x.title}** (${x.id}) — ${x.why}${x.deps?` _(deps: ${x.deps})_`:''}`)].join('\n');
    roadmapOut.textContent = md;
    if (llmStatus) llmStatus.textContent = 'Roadmap ready.';
  } catch (e) {
    if (llmStatus) llmStatus.textContent = 'Roadmap generation failed: ' + e.message;
  }
});

// ---------- Personas / JTBD ----------
personasBtn?.addEventListener('click', async () => {
  if (!window.current?.themes?.length) return;
  try {
    if (llmStatus) llmStatus.textContent = 'Inferring personas & JTBD…';
    const themes = window.current.themes.map(t => ({ id:t.id, title:t.label, examples:t.items.slice(0,3).map(i=>i.text) }));
    const schema = `[{"themeId":"T1","persona":"Enterprise Admin","jtbd":"When..., I want to..., so I can...","pain":"main pain point"}]`;
    const prompt = `For each theme, infer a likely persona and a Jobs-to-be-Done statement. Return JSON array as ${schema}. Themes: ${JSON.stringify(themes)}`;
    const json = await llmJSON(prompt, schema);
    const md = ['# Personas & JTBD'].concat(json.map(p => `- **${p.themeId}** — **${p.persona}**\n  - JTBD: ${p.jtbd}\n  - Pain: ${p.pain}`)).join('\n');
    personasOut.textContent = md;
    if (llmStatus) llmStatus.textContent = 'Personas ready.';
  } catch (e) {
    if (llmStatus) llmStatus.textContent = 'Persona extraction failed: ' + e.message;
  }
});

// ---------- Pitch Deck Bullets ----------
pitchBtn?.addEventListener('click', async () => {
  if (!window.current?.themes?.length) return;
  try {
    if (llmStatus) llmStatus.textContent = 'Generating deck bullets…';
    const themes = window.current.themes.map(t => ({ title:t.label, count:t.items.length, quotes:t.items.slice(0,2).map(i=>i.text) }));
    const top = structuredClone(window.current.rice).sort((a,b)=>b.rice-a.rice).slice(0,5);
    const prompt = `Create slide-ready bullets for a 5-minute pitch deck with these sections: Problem, Insights, Solution (Quinoa), AI Approach, Demo Flow, Roadmap (based on these top items), Metrics. Use concise bullets (<=8 words each). Keep grounded in input data.\nThemes:${JSON.stringify(themes)}\nTop:${JSON.stringify(top)}`;
    const resp = await llmText(prompt);
    pitchOut.textContent = resp.trim();
    if (llmStatus) llmStatus.textContent = 'Deck bullets ready.';
  } catch (e) {
    if (llmStatus) llmStatus.textContent = 'Deck bullets failed: ' + e.message;
  }
});

// keep helper to refresh RICE table labels
window.addEventListener('renderRice', () => {
  const prioEl = document.getElementById('prioritization');
  const rows = prioEl.querySelectorAll('tbody tr');
  rows.forEach((tr) => {
    const idInput = tr.querySelector('input')?.dataset?.id;
    if (!idInput) return;
    const match = window.current?.themes?.find(t => t.id === idInput);
    if (match) tr.children[1].textContent = match.label;
  });
});