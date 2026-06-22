import { useState, useMemo } from "react";
import { Activity, AlertTriangle, HeartPulse, Gauge, Droplets, ChevronRight, Info } from "lucide-react";

// ---------- Clinical calculation helpers ----------

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function round(v, d = 1) {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  return Math.round(v * 10 ** d) / 10 ** d;
}

// BSA via Mosteller formula
function calcBSA(heightCm, weightKg) {
  if (!heightCm || !weightKg) return null;
  return Math.sqrt((heightCm * weightKg) / 3600);
}

function classify(value, bands) {
  // bands: array of {max, label, tone} evaluated low->high, or {min,...}
  for (const b of bands) {
    if (b.min !== undefined && b.max !== undefined) {
      if (value >= b.min && value < b.max) return b;
    } else if (b.max !== undefined) {
      if (value < b.max) return b;
    } else if (b.min !== undefined) {
      if (value >= b.min) return b;
    }
  }
  return bands[bands.length - 1];
}

const TONE = {
  good: { fg: "#0B6E4F", bg: "#E7F4EE", ring: "#0B6E4F" },
  warn: { fg: "#9A6700", bg: "#FBF1DD", ring: "#C8920B" },
  bad: { fg: "#9B1C1C", bg: "#FBE9E9", ring: "#C03A3A" },
  neutral: { fg: "#3A4047", bg: "#EEF0F1", ring: "#8A9099" },
};

export default function App() {
  // ---- Inputs ----
  const [heightCm, setHeightCm] = useState("170");
  const [weightKg, setWeightKg] = useState("70");

  const [sbp, setSbp] = useState("");
  const [dbp, setDbp] = useState("");
  const [hr, setHr] = useState("");

  const [co, setCo] = useState(""); // measured CO (thermodilution/Fick), optional direct entry

  const [ra, setRa] = useState(""); // RAP / CVP
  const [pas, setPas] = useState(""); // PA systolic
  const [pad, setPad] = useState(""); // PA diastolic
  const [pcwp, setPcwp] = useState("");
  const [svo2, setSvo2] = useState("");
  const [sao2, setSao2] = useState("98");
  const [hb, setHb] = useState("13");

  const [lactate, setLactate] = useState("");
  const [creat, setCreat] = useState("");
  const [urineLow, setUrineLow] = useState(false);
  const [alteredMentation, setAlteredMentation] = useState(false);
  const [coolExtremities, setCoolExtremities] = useState(false);
  const [onPressorInotrope, setOnPressorInotrope] = useState(false);
  const [onSecondPressor, setOnSecondPressor] = useState(false);
  const [onMCS, setOnMCS] = useState(false);
  const [refractoryArrest, setRefractoryArrest] = useState(false);
  const [cprOngoing, setCprOngoing] = useState(false);

  const [showAdvanced, setShowAdvanced] = useState(false);

  // ---- Derived calculations ----
  const calc = useMemo(() => {
    const BSA = calcBSA(num(heightCm), num(weightKg)) ?? 1.73;
    const SBP = num(sbp);
    const DBP = num(dbp);
    const HR = num(hr);
    const RA = num(ra);
    const PAS = num(pas);
    const PAD = num(pad);
    const PCWP = num(pcwp);
    const SvO2 = num(svo2);
    const SaO2 = num(sao2);
    const Hb = num(hb);
    const COdirect = num(co);

    const MAP = SBP !== null && DBP !== null ? (SBP + 2 * DBP) / 3 : null;
    const PP = SBP !== null && DBP !== null ? SBP - DBP : null;
    const mPAP = PAS !== null && PAD !== null ? (PAS + 2 * PAD) / 3 : null;

    // Fick CO estimate if direct CO not supplied and SvO2/SaO2/Hb available.
    // VO2 estimated at 125 mL/min/m^2 (standard resting assumption) — flagged as an estimate in the UI.
    // O2 capacity per liter of blood = Hb(g/dL) * 1.36 (mL O2/g Hb) * 10 (dL->L)
    // avO2diff (mL O2/L blood) = capacity * (SaO2 - SvO2)/100
    // CO (L/min) = VO2 (mL/min) / avO2diff (mL O2/L)
    let COFick = null;
    if (SvO2 !== null && SaO2 !== null && Hb !== null) {
      const VO2 = 125 * BSA; // mL/min
      const o2CapacityPerLiter = Hb * 1.36 * 10; // mL O2 per L blood at 100% saturation
      const avO2diff = o2CapacityPerLiter * ((SaO2 - SvO2) / 100); // mL O2 per L blood
      COFick = avO2diff > 0 ? VO2 / avO2diff : null;
    }

    const CO = COdirect !== null ? COdirect : COFick;
    const CI = CO !== null ? CO / BSA : null;

    const CPO = MAP !== null && CO !== null ? (MAP * CO) / 451 : null;

    const PAPi = PAS !== null && PAD !== null && RA !== null && RA !== 0 ? (PAS - PAD) / RA : null;

    // SVR (dyn·s·cm⁻5) = 80 * (MAP - RAP) / CO
    // SVRI (dyn·s·cm⁻5·m²) = 80 * (MAP - RAP) / CI  — indexed to body surface area
    const SVR = MAP !== null && RA !== null && CO !== null && CO !== 0 ? (80 * (MAP - RA)) / CO : null;
    const SVRI = MAP !== null && RA !== null && CI !== null && CI !== 0 ? (80 * (MAP - RA)) / CI : null;

    const TPG = mPAP !== null && PCWP !== null ? mPAP - PCWP : null;
    const PVR = TPG !== null && CO !== null && CO !== 0 ? TPG / CO : null; // Wood units

    return {
      BSA: round(BSA, 2),
      MAP: round(MAP, 0),
      PP: round(PP, 0),
      mPAP: round(mPAP, 0),
      CO: round(CO, 2),
      COFick: round(COFick, 2),
      CI: round(CI, 2),
      CPO: round(CPO, 2),
      PAPi: round(PAPi, 2),
      SVR: round(SVR, 0),
      SVRI: round(SVRI, 0),
      TPG: round(TPG, 1),
      PVR: round(PVR, 2),
      rawCOSource: COdirect !== null ? "measured" : COFick !== null ? "fick-estimate" : null,
    };
  }, [heightCm, weightKg, sbp, dbp, hr, co, ra, pas, pad, pcwp, svo2, sao2, hb]);

  // ---- Congestion phenotype (Zweck / CSWG) ----
  const congestion = useMemo(() => {
    const RA = num(ra);
    const PCWP = num(pcwp);
    if (RA === null && PCWP === null) return null;
    const lvCong = PCWP !== null ? PCWP >= 18 : null;
    const rvCong = RA !== null ? RA >= 12 : null;
    if (lvCong === null || rvCong === null) {
      // partial data
      if (lvCong === true) return { label: "LV congestion (partial data)", tone: "warn" };
      if (rvCong === true) return { label: "RV congestion (partial data)", tone: "warn" };
      return { label: "Incomplete data for phenotyping", tone: "neutral" };
    }
    if (lvCong && rvCong) return { label: "Biventricular (BiV) congestion", tone: "bad", detail: "PCWP ≥18 and RAP ≥12 — associated with the poorest outcomes of the congestion phenotypes." };
    if (rvCong && !lvCong) return { label: "RV-predominant congestion", tone: "bad", detail: "RAP ≥12 with PCWP <18 — RV involvement portends a worse prognosis than LV-only or euvolemic profiles." };
    if (lvCong && !rvCong) return { label: "LV-predominant congestion", tone: "warn", detail: "PCWP ≥18 with RAP <12." };
    return { label: "Euvolemic profile", tone: "good", detail: "Neither RAP nor PCWP elevated — best prognosis among congestion phenotypes." };
  }, [ra, pcwp]);

  // ---- SCAI Staging (clinical gestalt, A–E) ----
  const scai = useMemo(() => {
    if (refractoryArrest || cprOngoing) {
      return {
        stage: "E",
        title: "SCAI Stage E — Extremis",
        tone: "bad",
        detail: "Cardiac arrest with ongoing CPR and/or ECMO/refractory shock despite maximal support.",
      };
    }
    if (onMCS && onSecondPressor) {
      return {
        stage: "D",
        title: "SCAI Stage D — Deteriorating / Doom",
        tone: "bad",
        detail: "Despite multiple pressors/inotropes plus mechanical circulatory support, the patient continues to deteriorate (worsening hypoperfusion, rising lactate, escalating support).",
      };
    }

    const SBP = num(sbp);
    const HR = num(hr);
    const lac = num(lactate);
    const hypoperfusionSigns = urineLow || alteredMentation || coolExtremities || (lac !== null && lac > 2);
    const hypotensive = SBP !== null && SBP < 90;
    const CI = calc.CI;
    const lowCI = CI !== null && CI < 2.2;

    if ((onSecondPressor || (onMCS && onPressorInotrope)) ) {
      return {
        stage: "C",
        title: "SCAI Stage C — Classic cardiogenic shock",
        tone: "bad",
        detail: "Hypoperfusion requiring pharmacologic or mechanical support beyond volume resuscitation to restore perfusion.",
      };
    }
    if (hypotensive && hypoperfusionSigns) {
      return {
        stage: "C",
        title: "SCAI Stage C — Classic cardiogenic shock",
        tone: "bad",
        detail: "Hypotension with biochemical/clinical hypoperfusion (lactate, mentation, urine output, or perfusion exam) — needs prompt pharmacologic ± mechanical support.",
      };
    }
    if (onPressorInotrope || lowCI || (lac !== null && lac > 2 && !hypotensive)) {
      return {
        stage: "B",
        title: "SCAI Stage B — Beginning shock",
        tone: "warn",
        detail: "Relative hypotension or tachycardia without overt hypoperfusion, or early biochemical markers (mild lactate elevation, reduced CI) — \"pre-shock.\"",
      };
    }
    if (HR !== null && SBP !== null && HR > 100 && SBP < 100) {
      return {
        stage: "B",
        title: "SCAI Stage B — Beginning shock",
        tone: "warn",
        detail: "Tachycardia with relative hypotension but no end-organ hypoperfusion yet.",
      };
    }
    return {
      stage: "A",
      title: "SCAI Stage A — At risk",
      tone: "good",
      detail: "No current signs/symptoms of CS, but at risk due to underlying cardiac pathology. Continue close monitoring.",
    };
  }, [sbp, hr, lactate, urineLow, alteredMentation, coolExtremities, onPressorInotrope, onSecondPressor, onMCS, refractoryArrest, cprOngoing, calc.CI]);

  // ---- Ventricle-dominant phenotype for MCS guidance ----
  const ventriclePhenotype = useMemo(() => {
    const PAPiVal = calc.PAPi;
    const PCWPVal = num(pcwp);
    const RAVal = num(ra);
    let rvFailure = false;
    let lvFailure = false;
    if (PAPiVal !== null && PAPiVal < 1.0) rvFailure = true;
    if (PCWPVal !== null && PCWPVal >= 18) lvFailure = true;
    if (RAVal !== null && PCWPVal !== null && RAVal >= 12 && RAVal / Math.max(PCWPVal, 1) > 0.63) rvFailure = true;

    if (rvFailure && lvFailure) return { label: "Biventricular failure pattern", tone: "bad" };
    if (rvFailure) return { label: "RV-predominant failure pattern", tone: "warn" };
    if (lvFailure) return { label: "LV-predominant failure pattern", tone: "warn" };
    return null;
  }, [calc.PAPi, pcwp, ra]);

  const hasMinimalCalcInputs = num(sbp) !== null && num(dbp) !== null;
  const hasInvasiveInputs = num(ra) !== null || num(pas) !== null || num(pcwp) !== null;

  return (
    <div style={styles.page}>
      <style>{globalCss}</style>

      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.brandRow}>
            <HeartPulse size={22} strokeWidth={2.2} color="#C03A3A" />
            <div>
              <div style={styles.brandTitle}>SHOCK<span style={{ color: "#C03A3A" }}>LINE</span></div>
              <div style={styles.brandSub}>Cardiogenic Shock Hemodynamics &amp; Management</div>
            </div>
          </div>
          <div style={styles.headerNote}>
            Bedside / cath-lab decision support · not a substitute for clinical judgment
          </div>
        </div>
      </header>

      <main style={styles.main}>
        {/* ---------------- INPUT COLUMN ---------------- */}
        <section style={styles.col}>
          <Panel title="Patient" eyebrow="01">
            <Row>
              <Field label="Height" unit="cm">
                <input style={styles.input} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} inputMode="decimal" />
              </Field>
              <Field label="Weight" unit="kg">
                <input style={styles.input} value={weightKg} onChange={(e) => setWeightKg(e.target.value)} inputMode="decimal" />
              </Field>
              <Field label="BSA" unit="m²" readOnly>
                <div style={styles.readout}>{calc.BSA ?? "—"}</div>
              </Field>
            </Row>
          </Panel>

          <Panel title="Arterial &amp; Heart Rate" eyebrow="02">
            <Row>
              <Field label="SBP" unit="mmHg">
                <input style={styles.input} value={sbp} onChange={(e) => setSbp(e.target.value)} inputMode="decimal" placeholder="e.g. 82" />
              </Field>
              <Field label="DBP" unit="mmHg">
                <input style={styles.input} value={dbp} onChange={(e) => setDbp(e.target.value)} inputMode="decimal" placeholder="e.g. 54" />
              </Field>
              <Field label="HR" unit="bpm">
                <input style={styles.input} value={hr} onChange={(e) => setHr(e.target.value)} inputMode="decimal" placeholder="e.g. 110" />
              </Field>
            </Row>
          </Panel>

          <Panel title="Invasive Hemodynamics (PAC)" eyebrow="03" hint="Pulmonary artery catheter values — optional, but needed for CPO, PAPi, SVR, congestion phenotype.">
            <Row>
              <Field label="RAP / CVP" unit="mmHg">
                <input style={styles.input} value={ra} onChange={(e) => setRa(e.target.value)} inputMode="decimal" placeholder="e.g. 14" />
              </Field>
              <Field label="PA systolic" unit="mmHg">
                <input style={styles.input} value={pas} onChange={(e) => setPas(e.target.value)} inputMode="decimal" placeholder="e.g. 42" />
              </Field>
              <Field label="PA diastolic" unit="mmHg">
                <input style={styles.input} value={pad} onChange={(e) => setPad(e.target.value)} inputMode="decimal" placeholder="e.g. 22" />
              </Field>
            </Row>
            <Row>
              <Field label="PCWP" unit="mmHg">
                <input style={styles.input} value={pcwp} onChange={(e) => setPcwp(e.target.value)} inputMode="decimal" placeholder="e.g. 24" />
              </Field>
              <Field label="SvO₂" unit="%">
                <input style={styles.input} value={svo2} onChange={(e) => setSvo2(e.target.value)} inputMode="decimal" placeholder="e.g. 52" />
              </Field>
              <Field label="SaO₂" unit="%">
                <input style={styles.input} value={sao2} onChange={(e) => setSao2(e.target.value)} inputMode="decimal" />
              </Field>
            </Row>
          </Panel>

          <Panel title="Cardiac Output" eyebrow="04" hint="Enter a measured CO (thermodilution/direct Fick) if available — it overrides the estimated Fick calculation below.">
            <Row>
              <Field label="Hb" unit="g/dL">
                <input style={styles.input} value={hb} onChange={(e) => setHb(e.target.value)} inputMode="decimal" />
              </Field>
              <Field label="Measured CO" unit="L/min">
                <input
                  style={styles.input}
                  value={co}
                  onChange={(e) => setCo(e.target.value)}
                  inputMode="decimal"
                  placeholder="optional"
                />
              </Field>
              <Field label="Source" unit="">
                <div style={{ ...styles.readout, fontSize: 12 }}>
                  {calc.rawCOSource === "measured" ? "Measured" : calc.rawCOSource === "fick-estimate" ? "Fick (est.)" : "—"}
                </div>
              </Field>
            </Row>
            {calc.rawCOSource === "fick-estimate" && (
              <div style={styles.noteRow}>
                <Info size={13} color="#8A9099" />
                <span>Estimated via assumed VO₂ (125 mL/min/m²) — a true direct Fick or thermodilution CO is preferred when available.</span>
              </div>
            )}
          </Panel>

          <Panel title="End-Organ &amp; Perfusion Markers" eyebrow="05">
            <Row>
              <Field label="Lactate" unit="mmol/L">
                <input style={styles.input} value={lactate} onChange={(e) => setLactate(e.target.value)} inputMode="decimal" placeholder="e.g. 3.2" />
              </Field>
              <Field label="Creatinine" unit="mg/dL">
                <input style={styles.input} value={creat} onChange={(e) => setCreat(e.target.value)} inputMode="decimal" placeholder="e.g. 1.6" />
              </Field>
            </Row>
            <div style={styles.checkGrid}>
              <Check label="Urine output <30 mL/hr" checked={urineLow} onChange={setUrineLow} />
              <Check label="Altered mentation" checked={alteredMentation} onChange={setAlteredMentation} />
              <Check label="Cool / mottled extremities" checked={coolExtremities} onChange={setCoolExtremities} />
            </div>
          </Panel>

          <Panel title="Support Already In Place" eyebrow="06" hint="Used to refine SCAI staging.">
            <div style={styles.checkGrid}>
              <Check label="1 pressor or inotrope running" checked={onPressorInotrope} onChange={setOnPressorInotrope} />
              <Check label="≥2 pressors/inotropes" checked={onSecondPressor} onChange={setOnSecondPressor} />
              <Check label="On mechanical circulatory support (IABP/Impella/ECMO)" checked={onMCS} onChange={setOnMCS} />
              <Check label="Deteriorating despite above" checked={refractoryArrest} onChange={setRefractoryArrest} />
              <Check label="Cardiac arrest / ongoing CPR" checked={cprOngoing} onChange={setCprOngoing} />
            </div>
          </Panel>
        </section>

        {/* ---------------- RESULTS COLUMN ---------------- */}
        <section style={styles.col}>
          <Panel title="SCAI Shock Stage" eyebrow="RESULT" accent>
            <StagePill scai={scai} />
            <p style={styles.detailText}>{scai.detail}</p>
          </Panel>

          <Panel title="Hemodynamic Profile" eyebrow="RESULT" accent>
            {!hasMinimalCalcInputs ? (
              <Placeholder text="Enter SBP/DBP to begin computing hemodynamics." />
            ) : (
              <div style={styles.metricGrid}>
                <Metric
                  label="MAP"
                  value={calc.MAP}
                  unit="mmHg"
                  tone={calc.MAP !== null ? classify(calc.MAP, [{ max: 65, label: "low", tone: "bad" }, { max: 70, label: "borderline", tone: "warn" }, { min: 70, label: "ok", tone: "good" }]).tone : "neutral"}
                  sub="Target ≥65"
                />
                <Metric
                  label="CI"
                  value={calc.CI}
                  unit="L/min/m²"
                  tone={calc.CI !== null ? classify(calc.CI, [{ max: 1.8, tone: "bad" }, { max: 2.2, tone: "warn" }, { min: 2.2, tone: "good" }]).tone : "neutral"}
                  sub="Shock threshold <2.2"
                />
                <Metric
                  label="CPO"
                  value={calc.CPO}
                  unit="W"
                  tone={calc.CPO !== null ? classify(calc.CPO, [{ max: 0.6, tone: "bad" }, { max: 0.8, tone: "warn" }, { min: 0.8, tone: "good" }]).tone : "neutral"}
                  sub="Strongest single mortality predictor; <0.6 W high risk"
                />
                <Metric
                  label="PAPi"
                  value={calc.PAPi}
                  unit=""
                  tone={calc.PAPi !== null ? classify(calc.PAPi, [{ max: 1.0, tone: "bad" }, { max: 1.85, tone: "warn" }, { min: 1.85, tone: "good" }]).tone : "neutral"}
                  sub="<0.9–1.0 predicts RV failure"
                />
                <Metric label="SVRI" value={calc.SVRI} unit="dyn·s/cm⁵·m²" tone="neutral" sub="Normal ~1970–2390" />
                <Metric label="mPAP" value={calc.mPAP} unit="mmHg" tone="neutral" />
                {showAdvanced && (
                  <>
                    <Metric label="TPG" value={calc.TPG} unit="mmHg" tone="neutral" sub="mPAP − PCWP" />
                    <Metric label="PVR" value={calc.PVR} unit="WU" tone="neutral" />
                    <Metric label="Pulse pressure" value={calc.PP} unit="mmHg" tone="neutral" />
                    <Metric label="CO" value={calc.CO} unit="L/min" tone="neutral" />
                  </>
                )}
              </div>
            )}
            <button style={styles.linkButton} onClick={() => setShowAdvanced((s) => !s)}>
              {showAdvanced ? "Hide" : "Show"} additional derived values
              <ChevronRight size={14} style={{ transform: showAdvanced ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
            </button>
          </Panel>

          <Panel title="Congestion Phenotype" eyebrow="RESULT" accent>
            {!hasInvasiveInputs ? (
              <Placeholder text="Enter RAP and/or PCWP to determine congestion phenotype." />
            ) : (
              <>
                <TonePill label={congestion?.label ?? "—"} tone={congestion?.tone ?? "neutral"} />
                {congestion?.detail && <p style={styles.detailText}>{congestion.detail}</p>}
              </>
            )}
            {ventriclePhenotype && (
              <div style={{ marginTop: 10 }}>
                <TonePill label={ventriclePhenotype.label} tone={ventriclePhenotype.tone} small />
              </div>
            )}
          </Panel>

          <ManagementPanel scai={scai} congestion={congestion} ventriclePhenotype={ventriclePhenotype} calc={calc} lactate={num(lactate)} />
        </section>
      </main>

      <footer style={styles.footer}>
        Based on SCAI shock-stage criteria, CSWG/Zweck congestion phenotyping, and contemporary CS management
        statements (AHA 2025, ACC 2025 Concise Clinical Guidance, Lancet 2024 review). For clinician use as an
        adjunct to — not a replacement for — bedside assessment, imaging, and invasive hemodynamic monitoring.
      </footer>
    </div>
  );
}

// ---------------- Sub-components ----------------

function Panel({ title, eyebrow, hint, accent, children }) {
  return (
    <div style={{ ...styles.panel, ...(accent ? styles.panelAccent : {}) }}>
      <div style={styles.panelHead}>
        <span style={styles.eyebrow}>{eyebrow}</span>
        <h2 style={styles.panelTitle}>{title}</h2>
      </div>
      {hint && <p style={styles.hint}>{hint}</p>}
      {children}
    </div>
  );
}

function Row({ children }) {
  return <div style={styles.row}>{children}</div>;
}

function Field({ label, unit, readOnly, children }) {
  return (
    <div style={styles.field}>
      <label style={styles.fieldLabel}>
        {label} {unit && <span style={styles.fieldUnit}>{unit}</span>}
      </label>
      {children}
    </div>
  );
}

function Check({ label, checked, onChange }) {
  return (
    <label style={styles.checkRow}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={styles.checkbox} />
      <span>{label}</span>
    </label>
  );
}

function Metric({ label, value, unit, tone, sub }) {
  const t = TONE[tone] || TONE.neutral;
  return (
    <div style={{ ...styles.metricCard, borderColor: t.ring + "33", background: t.bg }}>
      <div style={styles.metricLabel}>{label}</div>
      <div style={{ ...styles.metricValue, color: t.fg }}>
        {value !== null && value !== undefined ? value : "—"}
        {unit && value !== null ? <span style={styles.metricUnit}>{unit}</span> : null}
      </div>
      {sub && <div style={styles.metricSub}>{sub}</div>}
    </div>
  );
}

function TonePill({ label, tone, small }) {
  const t = TONE[tone] || TONE.neutral;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: small ? "5px 10px" : "8px 14px",
        borderRadius: 999,
        background: t.bg,
        color: t.fg,
        fontWeight: 600,
        fontSize: small ? 12.5 : 14,
        border: `1px solid ${t.ring}44`,
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: 99, background: t.fg, display: "inline-block" }} />
      {label}
    </div>
  );
}

function StagePill({ scai }) {
  const t = TONE[scai.tone] || TONE.neutral;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div
        style={{
          width: 54,
          height: 54,
          borderRadius: 14,
          background: t.bg,
          border: `2px solid ${t.ring}`,
          color: t.fg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 26,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {scai.stage}
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 15.5, color: "#1C2024" }}>{scai.title}</div>
      </div>
    </div>
  );
}

function Placeholder({ text }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "#8A9099", fontSize: 13.5, padding: "6px 0" }}>
      <Info size={15} style={{ marginTop: 1, flexShrink: 0 }} />
      <span>{text}</span>
    </div>
  );
}

function ManagementPanel({ scai, congestion, ventriclePhenotype, calc, lactate }) {
  const items = [];

  // SCAI-stage driven guidance
  if (scai.stage === "A") {
    items.push({ tone: "good", text: "Optimize the underlying cardiac condition; continue close hemodynamic monitoring. No CS-specific therapy indicated yet." });
  }
  if (scai.stage === "B") {
    items.push({ tone: "warn", text: "Pre-shock: address the precipitant (ischemia, arrhythmia, volume status) early. Consider low-dose inotrope/vasopressor if trend worsens — earlier intervention may break the shock spiral faster than a 'watch and wait' approach." });
  }
  if (scai.stage === "C" || scai.stage === "D" || scai.stage === "E") {
    items.push({ tone: "bad", text: "Established cardiogenic shock: secure airway/oxygenation, treat the underlying cause (e.g., urgent revascularization for AMI-CS), and initiate hemodynamic support without delay." });
  }
  if (scai.stage === "D") {
    items.push({ tone: "bad", text: "Deteriorating despite pharmacologic + mechanical support — reassess device function/positioning, consider escalation (e.g., Impella→ECMO, or biventricular support if BiV failure), and engage a shock team / advanced-HF or transplant center." });
  }
  if (scai.stage === "E") {
    items.push({ tone: "bad", text: "Extremis: emergent ECMO cannulation if not already in place; involve the full shock/code team." });
  }

  // Vasoactive choice
  if (scai.stage === "B" || scai.stage === "C" || scai.stage === "D" || scai.stage === "E") {
    items.push({ tone: "neutral", text: "First-line vasoactive: norepinephrine for MAP support; add/consider dobutamine or milrinone for inotropy depending on heart rate, arrhythmia burden, and renal/hepatic function (milrinone vasodilates and is renally cleared; dobutamine is more arrhythmogenic and tachycardic)." });
  }

  // CPO / mortality
  if (calc.CPO !== null && calc.CPO < 0.6) {
    items.push({ tone: "bad", text: `CPO ${calc.CPO} W is below the high-risk threshold (<0.6 W) — this is the single strongest hemodynamic predictor of in-hospital mortality. Favor earlier mechanical circulatory support over escalating inotropes/pressors alone.` });
  }

  // Congestion-guided decongestion
  if (congestion?.label?.includes("BiV")) {
    items.push({ tone: "bad", text: "Biventricular congestion: decongest cautiously with diuretics/ultrafiltration once perfusion is stabilized; biventricular elevation is associated with the worst outcomes — consider early biventricular MCS (e.g., ECMO) over LV-only support if escalating." });
  } else if (congestion?.label?.includes("RV-predominant")) {
    items.push({ tone: "warn", text: "RV-predominant congestion: avoid excessive fluid restriction-induced preload loss but treat volume overload; avoid pulmonary vasoconstrictors/high PEEP where possible; if MCS is needed, an RV-unloading strategy (e.g., RVAD/ECMO) may be preferred over LV-only devices (e.g., isolated Impella LV, IABP)." });
  } else if (congestion?.label?.includes("LV-predominant")) {
    items.push({ tone: "warn", text: "LV-predominant congestion: diurese once perfusion allows; LV-unloading MCS (Impella, IABP) targets this phenotype directly." });
  } else if (congestion?.label?.includes("Euvolemic")) {
    items.push({ tone: "good", text: "Euvolemic hemodynamic profile carries the best prognosis among congestion phenotypes — avoid unnecessary diuresis; focus on perfusion and treating the underlying cause." });
  }

  // PAPi-driven RV note
  if (calc.PAPi !== null && calc.PAPi < 1.0) {
    items.push({ tone: "bad", text: `PAPi ${calc.PAPi} suggests RV failure — this should steer device selection toward RV-unloading or biventricular support rather than LV-only MCS, and prompts caution with volume loading and pulmonary vasoconstriction.` });
  }

  // Lactate trend note
  if (lactate !== null && lactate > 2) {
    items.push({ tone: "warn", text: `Lactate ${lactate} mmol/L — trend serially; failure to clear lactate over hours is a marker of persistent shock and should prompt re-evaluation of the support strategy rather than waiting for further deterioration.` });
  }

  return (
    <Panel title="Management Pointers" eyebrow="GUIDANCE" accent>
      <div style={styles.mgmtList}>
        {items.map((it, i) => (
          <div key={i} style={styles.mgmtItem}>
            <span style={{ ...styles.mgmtDot, background: TONE[it.tone]?.fg || TONE.neutral.fg }} />
            <span style={styles.mgmtText}>{it.text}</span>
          </div>
        ))}
      </div>
      <p style={styles.disclaimer}>
        <AlertTriangle size={12} style={{ marginRight: 5, verticalAlign: "-2px" }} />
        Generated from entered values using SCAI/CSWG framework logic. Always correlate with full clinical context,
        imaging, and unit protocols before acting.
      </p>
    </Panel>
  );
}

// ---------------- Styles ----------------

const globalCss = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,500;8..60,600;8..60,700&family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; }
  input:focus { outline: 2px solid #C03A3A55; outline-offset: 1px; }
  button:focus-visible { outline: 2px solid #C03A3A; outline-offset: 2px; }
`;

const styles = {
  page: {
    minHeight: "100vh",
    background: "#F6F4F0",
    fontFamily: "'Inter', system-ui, sans-serif",
    color: "#1C2024",
  },
  header: {
    borderBottom: "2px solid #1C2024",
    background: "#FBFAF7",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  headerInner: {
    maxWidth: 1180,
    margin: "0 auto",
    padding: "16px 20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  brandRow: { display: "flex", alignItems: "center", gap: 10 },
  brandTitle: {
    fontFamily: "'Source Serif 4', serif",
    fontWeight: 700,
    fontSize: 21,
    letterSpacing: "0.01em",
    lineHeight: 1,
  },
  brandSub: { fontSize: 11.5, color: "#6B7280", marginTop: 2, letterSpacing: "0.02em" },
  headerNote: {
    fontSize: 11.5,
    color: "#8A9099",
    fontFamily: "'JetBrains Mono', monospace",
  },
  main: {
    maxWidth: 1180,
    margin: "0 auto",
    padding: "24px 20px 60px",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 20,
  },
  col: { display: "flex", flexDirection: "column", gap: 16, minWidth: 0 },
  panel: {
    background: "#FBFAF7",
    border: "1px solid #1C2024",
    borderRadius: 4,
    padding: "16px 18px 18px",
  },
  panelAccent: {
    background: "#FFFFFF",
  },
  panelHead: { display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 },
  eyebrow: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    color: "#C03A3A",
    fontWeight: 700,
    letterSpacing: "0.06em",
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: 700,
    margin: 0,
    fontFamily: "'Source Serif 4', serif",
  },
  hint: { fontSize: 12, color: "#8A9099", margin: "2px 0 12px", lineHeight: 1.4 },
  row: { display: "flex", gap: 10, marginBottom: 10 },
  field: { flex: 1, minWidth: 0 },
  fieldLabel: {
    display: "block",
    fontSize: 11.5,
    fontWeight: 600,
    color: "#3A4047",
    marginBottom: 4,
  },
  fieldUnit: { color: "#9CA3AF", fontWeight: 400 },
  input: {
    width: "100%",
    padding: "9px 10px",
    fontSize: 14,
    border: "1px solid #D5D2C9",
    borderRadius: 3,
    fontFamily: "'JetBrains Mono', monospace",
    background: "#FFFFFF",
  },
  readout: {
    width: "100%",
    padding: "9px 10px",
    fontSize: 14,
    fontFamily: "'JetBrains Mono', monospace",
    color: "#3A4047",
    background: "#F0EEE8",
    borderRadius: 3,
    border: "1px solid #E5E2D9",
  },
  noteRow: {
    display: "flex",
    gap: 6,
    alignItems: "flex-start",
    fontSize: 11.5,
    color: "#8A9099",
    marginTop: 4,
    lineHeight: 1.4,
  },
  checkGrid: { display: "flex", flexDirection: "column", gap: 8, marginTop: 6 },
  checkRow: { display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "#2E3338", cursor: "pointer" },
  checkbox: { width: 15, height: 15, accentColor: "#C03A3A", cursor: "pointer" },
  metricGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  metricCard: {
    border: "1px solid",
    borderRadius: 4,
    padding: "10px 12px",
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.04em",
    color: "#6B7280",
    textTransform: "uppercase",
  },
  metricValue: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 22,
    fontWeight: 700,
    marginTop: 2,
  },
  metricUnit: { fontSize: 12, fontWeight: 500, marginLeft: 5 },
  metricSub: { fontSize: 10.5, color: "#8A9099", marginTop: 3, lineHeight: 1.3 },
  detailText: { fontSize: 13, color: "#4B5157", lineHeight: 1.5, margin: "10px 0 0" },
  linkButton: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    marginTop: 12,
    background: "none",
    border: "none",
    color: "#C03A3A",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
    padding: 0,
  },
  mgmtList: { display: "flex", flexDirection: "column", gap: 11 },
  mgmtItem: { display: "flex", gap: 9, alignItems: "flex-start" },
  mgmtDot: { width: 7, height: 7, borderRadius: 99, marginTop: 6, flexShrink: 0 },
  mgmtText: { fontSize: 13.5, lineHeight: 1.5, color: "#2E3338" },
  disclaimer: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 14,
    paddingTop: 12,
    borderTop: "1px solid #E5E2D9",
    lineHeight: 1.5,
  },
  footer: {
    maxWidth: 1180,
    margin: "0 auto",
    padding: "0 20px 40px",
    fontSize: 11.5,
    color: "#9CA3AF",
    lineHeight: 1.6,
    borderTop: "1px solid #E5E2D9",
    paddingTop: 18,
  },
};
