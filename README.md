# SHOCKLINE

Bedside / cath-lab decision-support calculator for cardiogenic shock hemodynamics —
SCAI shock staging, CSWG/Zweck congestion phenotyping, and phenotype-guided management
pointers.

**Not a substitute for clinical judgment.** Intended as an adjunct to bedside assessment,
imaging, and invasive hemodynamic monitoring.

## Stack

- React 18 + Vite 5
- lucide-react for icons
- No backend, no persistence — single-point calculator, nothing is stored between sessions

## Local development

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`.

## Build

```bash
npm run build
npm run preview   # serve the production build locally to sanity-check it
```

Output goes to `dist/`.

## Deploying to Vercel

1. Push this repo to GitHub.
2. In Vercel: **New Project** → import the GitHub repo.
3. Framework Preset: Vercel auto-detects **Vite**. If it doesn't, set manually:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
4. No environment variables are required.
5. Deploy.

Every push to the connected branch redeploys automatically.

## Project structure

```
.
├── index.html                          # Vite entry HTML
├── src/
│   ├── main.jsx                        # React mount point
│   └── CardiogenicShockHemodynamics.jsx # The calculator (single component)
├── package.json
└── vite.config.js
```

## Clinical basis

SCAI shock-stage criteria (A–E), CSWG/Zweck congestion phenotyping (RAP/PCWP-based),
and hemodynamic calculations (MAP, CI, CPO, PAPi, SVR/SVRI, TPG, PVR) drawn from
contemporary cardiogenic shock guidance and review literature.
