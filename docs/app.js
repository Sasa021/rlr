import { suggestCodes } from "./search.js";

const EXAMPLES = [
  ["Type 2 diabetes, kidney damage", "patient has type 2 diabetes with poor control and early kidney damage"],
  ["Hypertension", "known hypertension, blood pressure 168/100, no other diagnosis today"],
  ["Community-acquired pneumonia", "adult with fever, productive cough and community acquired pneumonia"],
  ["Asthma exacerbation", "asthma exacerbation with wheeze and shortness of breath"],
];

const noteEl = document.querySelector("#note");
const resultsEl = document.querySelector("#results");
const errorEl = document.querySelector("#error");
const statusEl = document.querySelector("#status");
const historyEl = document.querySelector("#history");
const suggestBtn = document.querySelector("#suggest");
const examplesEl = document.querySelector("#examples");
const STORE = "rlr-confirmations";

let codesPromise = null;

function loadCodes() {
  if (!codesPromise) {
    statusEl.textContent = "Loading the MIT…";
    codesPromise = fetch("./codes.json")
      .then((response) => {
        if (!response.ok) throw new Error("codes");
        return response.json();
      })
      .then((payload) => payload.codes)
      .catch((error) => {
        codesPromise = null;
        throw error;
      });
  }
  return codesPromise;
}

function readHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORE) || "[]");
  } catch {
    return [];
  }
}

function renderHistory() {
  const items = readHistory();
  historyEl.innerHTML = items.length
    ? items
        .slice(0, 20)
        .map(
          (item) =>
            `<li><span><strong>${item.code}</strong> · ${item.description}${item.pmb ? ` · PMB ${item.pmb}` : ""}</span><time>${new Date(item.at).toLocaleString("en-ZA", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}</time></li>`,
        )
        .join("")
    : `<li class="quiet">Nothing confirmed yet. A confirmed code stays in this browser.</li>`;
}

function card(item, index) {
  const article = document.createElement("article");
  article.className = "card suggest";
  article.dataset.code = item.code;
  const pmb = item.pmb ? `<span class="chip pmb" title="CMS guidance. A listing does not automatically make the claim a PMB.">PMB ${item.pmb}</span>` : "";
  article.innerHTML = `
    <p class="kicker">Match ${index + 1}</p>
    <h3 class="code">${item.code}</h3>
    <p class="desc">${item.description}</p>
    <p class="reason">${item.reason}</p>
    <div class="chips">
      <span class="chip mint">Valid for clinical use</span>
      ${pmb}
    </div>
    <button class="primary" type="button" data-confirm="${item.code}">Confirm</button>
  `;
  article.querySelector("button").addEventListener("click", () => confirm(item, article));
  return article;
}

function confirm(item, article) {
  const items = readHistory();
  items.unshift({ code: item.code, description: item.description, pmb: item.pmb, at: new Date().toISOString() });
  localStorage.setItem(STORE, JSON.stringify(items.slice(0, 50)));
  const button = article.querySelector("button");
  const saved = document.createElement("div");
  saved.className = "saved";
  saved.textContent = `${item.code} confirmed for this claim.`;
  button.replaceWith(saved);
  renderHistory();
}

async function suggest(text = noteEl.value) {
  const note = text.trim();
  errorEl.hidden = true;
  if (!note) {
    errorEl.hidden = false;
    errorEl.textContent = "Write a clinical note first.";
    return;
  }
  suggestBtn.disabled = true;
  try {
    const codes = await loadCodes();
    const suggestions = suggestCodes(note, codes);
    resultsEl.replaceChildren(...suggestions.map(card));
    document.body.dataset.ready = "1";
    statusEl.textContent = `${codes.length.toLocaleString("en-ZA")} MIT codes · search mode`;
  } catch {
    errorEl.hidden = false;
    errorEl.textContent = "Could not load the coding table.";
  } finally {
    suggestBtn.disabled = false;
  }
}

EXAMPLES.forEach(([label, note]) => {
  const button = document.createElement("button");
  button.className = "ghost";
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", () => {
    noteEl.value = note;
    suggest(note);
  });
  examplesEl.append(button);
});

suggestBtn.addEventListener("click", () => suggest());
noteEl.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    suggest();
  }
});
renderHistory();

const preset = new URLSearchParams(location.search).get("note");
if (preset) {
  noteEl.value = preset;
  suggest(preset);
}
