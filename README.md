# Quinoa — Simplified Wizard (FULL)

Judge‑friendly wizard with auto‑run AI and minimal buttons.
- **Embeddings + clustering** (Transformers.js)
- **AI Labels, RICE Assistant, PRD Rewrite, Roadmap, Personas, Deck bullets** (WebLLM, on‑device)
- 100% client‑side (no keys, no servers)

## Run locally (optional)
```bash
python -m http.server 8080
# open http://localhost:8080
```

## Deploy (GitHub Pages)
1) Place these files at the **repo root** (same level as index.html).
2) Add a `.nojekyll` file (included).
3) Repo → Settings → Pages → **Deploy from a branch** → Branch `main` / **/(root)**.
4) Check Actions → "pages build and deployment" turns green.
5) Your site: `https://<you>.github.io/<repo>/`.

## Input tips
- No strict format. **One thought per line** works best.
- NPS CSV: optional `score` column → severity weighting.
- Jira CSV: optional `Summary` / `Story Points` → effort hints.
