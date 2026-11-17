// Browser port of the MIT search ranker. Codes are [code, description, pmb?].

const CONCEPTS = [
  { id: "t2dm", kind: "condition", triggers: ["type 2 diabetes", "type ii diabetes", "t2dm", "niddm", "non-insulin-dependent", "non insulin dependent"], terms: ["type 2 diabetes", "non-insulin"], weight: 8 },
  { id: "t1dm", kind: "condition", triggers: ["type 1 diabetes", "type i diabetes", "t1dm", "iddm", "insulin-dependent diabetes", "juvenile diabetes"], terms: ["type 1 diabetes", "insulin-dependent"], weight: 8 },
  { id: "diabetes", kind: "condition", triggers: ["diabetes", "diabetic"], terms: ["diabetes"], weight: 3 },
  { id: "renal", kind: "complication", triggers: ["kidney", "renal", "nephro", "ckd", "albuminuria", "proteinuria"], terms: ["renal", "kidney", "nephro"], weight: 7 },
  { id: "eye", kind: "complication", triggers: ["retinopathy", "cataract", "vision loss", "ophthalm"], terms: ["ophthalmic", "retinopathy", "cataract"], weight: 7 },
  { id: "neuro", kind: "complication", triggers: ["neuropathy", "nerve damage", "neurological complication"], terms: ["neurological", "neuropath"], weight: 7 },
  { id: "circ", kind: "complication", triggers: ["peripheral vascular", "gangrene", "claudication", "circulatory complication"], terms: ["circulatory", "peripheral angiopath"], weight: 7 },
  { id: "dka", kind: "complication", triggers: ["ketoacidosis", "dka"], terms: ["ketoacidosis"], weight: 7 },
  { id: "coma", kind: "complication", triggers: ["coma", "unconscious"], terms: ["coma"], weight: 6 },
  { id: "poor", kind: "control", triggers: ["poor control", "poorly controlled", "uncontrolled", "poorly-controlled"], terms: ["unspecified complications", "other specified"], weight: 2 },
  { id: "htn", kind: "condition", triggers: ["hypertension", "high blood pressure", "blood pressure", "htn"], terms: ["hypertension", "hypertensive"], weight: 8 },
  { id: "pneumonia", kind: "condition", triggers: ["pneumonia"], terms: ["pneumonia", "bronchopneumonia"], weight: 8 },
  { id: "pneumococcal", kind: "organism", triggers: ["pneumococcal", "streptococcus pneumoniae", "s. pneumoniae"], terms: ["streptococcus pneumoniae", "pneumococcal"], weight: 7 },
  { id: "bacterial", kind: "organism", triggers: ["bacterial"], terms: ["bacterial"], weight: 4 },
  { id: "asthma", kind: "condition", triggers: ["asthma", "wheeze", "wheezing"], terms: ["asthma"], weight: 8 },
  { id: "tb", kind: "condition", triggers: ["tuberculosis", " tb"], terms: ["tuberculosis"], weight: 8 },
  { id: "hiv", kind: "condition", triggers: ["hiv", "aids"], terms: ["human immunodeficiency", "hiv"], weight: 8 },
  { id: "heart_failure", kind: "condition", triggers: ["heart failure", "cardiac failure", "ccf"], terms: ["heart failure", "cardiac failure"], weight: 8 },
  { id: "mi", kind: "condition", triggers: ["heart attack", "myocardial infarction", "stemi", "nstemi"], terms: ["myocardial infarction"], weight: 8 },
];

const UNSUPPORTED = ["coma", "ketoacidosis", "sepsis", "septicaemia", "pregnancy", "childbirth", "puerperium", "klebsiella", "haemophilus", "pseudomonas", "staphylococcus", "streptococcus", "varicella", "measles", "mycoplasma", "escherichia", "malignant", "salmonella", "legionella", "influenza", "adenovir", "metapneumovirus", "parainfluenza", "rhinovirus", "renovascular", "maternal", "viral", "portal", "intracranial", "ophthalmic", "neurological", "circulatory", "pulmonary", "hypostatic", "aspiration", "burkitt", "lymphoma", "kaposi", "syncytial", "aerobic", "gram", "neonatal", "congenital", "alcohol", "chlamyd"];

function triggered(note, trigger) {
  if (trigger.includes(" ") || trigger.includes("-") || trigger.length > 4) return note.includes(trigger);
  return new RegExp(`\\b${trigger}\\b`).test(note);
}

function detect(note) {
  return CONCEPTS.filter((concept) => concept.triggers.some((trigger) => triggered(note, trigger)));
}

function termIn(text, term) {
  if (term.includes(" ") || term.includes("-")) return text.includes(term);
  return new RegExp(`\\b${term}`).test(text);
}

function descriptionHits(description, concept) {
  return concept.terms.some((term) => termIn(description, term));
}

function familyBonus(note, code, concepts) {
  const ids = new Set(concepts.map((concept) => concept.id));
  let bonus = 0;
  if (ids.has("t2dm")) {
    if (code.startsWith("E11")) bonus += 6;
    else if (code.startsWith("E10") || code.startsWith("E12") || code.startsWith("E13") || code.startsWith("E14")) bonus -= 6;
  }
  if (ids.has("t1dm") && code.startsWith("E10")) bonus += 6;
  if (code.startsWith("O") && !/pregnan|antenatal|maternal|obstetric/.test(note)) bonus -= 16;
  return bonus;
}

function namedDefaults(note, concepts, row) {
  const ids = new Set(concepts.map((concept) => concept.id));
  const desc = row[1].toLowerCase();
  const code = row[0];
  let bonus = 0;
  const plainHtn = ids.has("htn") && !["secondary", "renal", "kidney", "pregnan", "malignant", "pulmonary", "portal"].some((word) => note.includes(word));
  if (plainHtn) {
    if (code === "I10") bonus += 12;
    if (["secondary", "pulmonary", "portal", "intracranial", "renovascular"].some((word) => desc.includes(word))) bonus -= 14;
    else if (desc.includes("with (congestive)") || desc.includes("with renal failure") || desc.includes("with both")) bonus -= 12;
    else if (desc.includes("heart") || desc.includes("renal")) bonus -= 2;
  }
  if (ids.has("pneumonia") && !ids.has("pneumococcal") && !ids.has("bacterial")) {
    if (code === "J18.9") bonus += 8;
    else if (code === "J18.8" || code === "J18.0") bonus += 4;
    if (code.startsWith("J17")) bonus -= 10;
    if (desc.includes("hypostatic") && !note.includes("hypostatic")) bonus -= 6;
    if (desc.includes("lobar") && !note.includes("lobar")) bonus -= 4;
    const organisms = ["streptococ", "staphylococ", "chlamyd", "syncytial", "klebsiella", "mycoplasma", "haemophilus", "legionella", "adenovir", "influenza", "pseudomonas", "escherichia"];
    if (organisms.some((word) => desc.includes(word)) && !organisms.some((word) => note.includes(word))) bonus -= 8;
    if (["J12", "J13", "J14", "J15", "J16"].includes(code.slice(0, 3))) bonus -= 6;
  }
  if (ids.has("asthma") && !["allerg", "nonallerg", "non-allerg", "mixed"].some((word) => note.includes(word))) {
    if (code === "J45.9") bonus += 8;
    if (code === "J45.0" || code === "J45.1" || code === "J45.8") bonus -= 3;
  }
  if (ids.has("t2dm") && ids.has("renal") && (code === "E11.2" || code === "E11.21")) bonus += 10;
  if (plainHtn && desc.includes("encephalopathy") && !note.includes("encephalopathy")) bonus -= 8;
  return bonus;
}

function unsupported(note, description, concepts) {
  const covered = new Set();
  for (const concept of concepts) {
    if (descriptionHits(description, concept)) {
      for (const term of concept.terms) {
        term.toLowerCase().split(/[^a-z0-9]+/).forEach((token) => covered.add(token));
      }
    }
  }
  let penalty = 0;
  for (const word of UNSUPPORTED) {
    if (description.includes(word) && !note.includes(word) && !covered.has(word)) penalty += 7;
  }
  if (note.includes("hypertension") && description.includes("without diagnosis of hypertension")) penalty += 20;
  if (note.includes("hypertension") && (description.includes("low blood-pressure") || description.includes("hypotension"))) penalty += 15;
  if (description.includes("family history") && !note.includes("family")) penalty += 20;
  if ((description.includes("hiv") || description.includes("pneumocystis")) && !note.includes("hiv")) penalty += 20;
  if (["fetus", "newborn", "neonatal", "maternal", "perinatal"].some((word) => description.includes(word)) && !["baby", "newborn", "neonat", "pregnan", "maternal", "birth"].some((word) => note.includes(word))) penalty += 18;
  if (description.includes("classified elsewhere") || description.includes("in mycoses")) penalty += 10;
  if (description.includes("bacterial") && !note.includes("bacterial")) penalty += 6;
  return penalty;
}

function isResidual(code, description) {
  return code.endsWith(".9") || description.toLowerCase().includes("unspecified");
}

export function suggestCodes(note, codes) {
  const text = String(note || "").toLowerCase();
  const concepts = detect(text);
  const ranked = [];
  for (const row of codes) {
    const description = row[1].toLowerCase();
    let score = 0;
    const matched = [];
    for (const concept of concepts) {
      if (descriptionHits(description, concept)) {
        score += concept.weight;
        matched.push(concept.id);
      }
    }
    const complications = concepts.filter((concept) => concept.kind === "complication");
    if (complications.length && (description.includes("without complications") || description.includes("without complication"))) score -= 8;
    else if (concepts.some((concept) => concept.id === "poor")) {
      if (description.includes("without complications")) score -= 4;
      if (description.includes("unspecified complications") || description.includes("other specified")) score += 3;
    }
    score += familyBonus(text, row[0], concepts);
    score += namedDefaults(text, concepts, row);
    score -= unsupported(text, description, concepts);
    if (score <= 0) continue;
    ranked.push({
      code: row[0],
      description: row[1],
      pmb: row[2] || "",
      score,
      matched,
      residual: isResidual(row[0], row[1]),
    });
  }
  for (const residual of ranked) {
    if (!residual.residual) continue;
    const better = ranked.some((other) => other !== residual && !other.residual && other.score > residual.score && (other.code.slice(0, 3) === residual.code.slice(0, 3) || other.matched.some((id) => residual.matched.includes(id))));
    if (better) residual.score -= 8;
  }
  ranked.sort((a, b) => b.score - a.score || a.code.localeCompare(b.code));
  const chosen = [];
  const used = new Set();
  for (const row of ranked) {
    if (used.has(row.code)) continue;
    chosen.push(row);
    used.add(row.code);
    if (chosen.length === 3) break;
  }
  if (chosen.length < 3) {
    for (const row of codes) {
      if (used.has(row[0])) continue;
      chosen.push({ code: row[0], description: row[1], pmb: row[2] || "", score: 0, matched: [], residual: false });
      used.add(row[0]);
      if (chosen.length === 3) break;
    }
  }
  return chosen.slice(0, 3).map((row) => ({
    code: row.code,
    description: row.description,
    reason: reasonFor(row),
    pmb: row.pmb,
  }));
}

function reasonFor(row) {
  const labels = CONCEPTS.filter((concept) => row.matched.includes(concept.id)).map((concept) => concept.id.replaceAll("_", " "));
  if (labels.length === 1) return `Matches ${labels[0]} in the note to this Master Industry Table description.`;
  if (labels.length > 1) return `Matches ${labels.slice(0, -1).join(", ")} and ${labels.at(-1)} in the note.`;
  return "Closest Master Industry Table description for the wording in the note.";
}
