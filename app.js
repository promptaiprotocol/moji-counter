\
const $ = (id) => document.getElementById(id);

const els = {
  input: $("textInput"),
  all: $("countAll"),
  noBreaks: $("countNoBreaks"),
  noWhitespace: $("countNoWhitespace"),
  lines: $("countLines"),
  manuscript: $("countManuscript"),
  b6: $("countB6"),
  a5: $("countA5"),
  variationSelectors: $("variationSelectors"),
  utf8: $("bytesUtf8"),
  utf16: $("bytesUtf16"),
  paste: $("pasteButton"),
  copy: $("copyButton"),
  clear: $("clearButton"),
  toast: $("toast"),
  saveStatus: $("saveStatus"),
  themeToggle: $("themeToggle"),
  b6PerPage: $("b6PerPage"),
  a5PerPage: $("a5PerPage"),
  manuscriptPerPage: $("manuscriptPerPage"),
};

const STORAGE_KEY = "sakappe-char-counter-text-v1";
const SETTINGS_KEY = "sakappe-char-counter-settings-v1";
const THEME_KEY = "sakappe-char-counter-theme-v1";

const formatter = new Intl.NumberFormat("ja-JP");

function codePointLength(text) {
  return Array.from(text).length;
}

function normalizeLineBreaks(text) {
  return text.replace(/\r\n?/g, "\n");
}

function countLines(text) {
  if (text.length === 0) return 0;
  return normalizeLineBreaks(text).split("\n").length;
}

function countVariationSelectors(text) {
  // Variation Selectors: FE00–FE0F and E0100–E01EF
  const matches = text.match(/[\uFE00-\uFE0F]|\uDB40[\uDD00-\uDDEF]/g);
  return matches ? matches.length : 0;
}

function utf8Bytes(text) {
  return new TextEncoder().encode(text).length;
}

function utf16Bytes(text) {
  // JavaScript strings are UTF-16 code units; byte count without BOM.
  return text.length * 2;
}

function safePositiveInt(input, fallback) {
  const n = Number.parseInt(input.value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function ceilPages(charCount, charsPerPage) {
  if (!charCount) return 0;
  return Math.ceil(charCount / charsPerPage);
}

function update() {
  const text = els.input.value;
  const normalized = normalizeLineBreaks(text);

  // "文字数" is counted by Unicode code points.
  // This avoids emoji being counted as two UTF-16 code units.
  const allCount = codePointLength(normalized);
  const noBreaksText = normalized.replace(/\n/g, "");
  const noBreaksCount = codePointLength(noBreaksText);

  // Remove common Japanese/ASCII whitespace:
  // line breaks, spaces, tabs, ideographic space and other Unicode whitespace.
  const noWhitespaceText = normalized.replace(/\s/gu, "");
  const noWhitespaceCount = codePointLength(noWhitespaceText);

  const b6PerPage = safePositiveInt(els.b6PerPage, 570);
  const a5PerPage = safePositiveInt(els.a5PerPage, 680);
  const manuscriptPerPage = safePositiveInt(els.manuscriptPerPage, 400);

  els.all.textContent = formatter.format(allCount);
  els.noBreaks.textContent = formatter.format(noBreaksCount);
  els.noWhitespace.textContent = formatter.format(noWhitespaceCount);
  els.lines.textContent = formatter.format(countLines(normalized));

  // Page estimates are intentionally based on "改行除く" count.
  els.manuscript.textContent = formatter.format(ceilPages(noBreaksCount, manuscriptPerPage));
  els.b6.textContent = formatter.format(ceilPages(noBreaksCount, b6PerPage));
  els.a5.textContent = formatter.format(ceilPages(noBreaksCount, a5PerPage));

  els.variationSelectors.textContent = formatter.format(countVariationSelectors(text));
  els.utf8.textContent = formatter.format(utf8Bytes(text));
  els.utf16.textContent = formatter.format(utf16Bytes(text));

  localStorage.setItem(STORAGE_KEY, text);
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({ b6PerPage, a5PerPage, manuscriptPerPage })
  );

  els.saveStatus.textContent = text ? "端末内に保存済み" : "端末内で自動保存";
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("show");
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 1600);
}

async function pasteFromClipboard() {
  try {
    const clip = await navigator.clipboard.readText();
    if (!clip) {
      showToast("クリップボードは空です");
      return;
    }

    const start = els.input.selectionStart ?? els.input.value.length;
    const end = els.input.selectionEnd ?? els.input.value.length;
    const before = els.input.value.slice(0, start);
    const after = els.input.value.slice(end);

    els.input.value = before + clip + after;
    const nextPos = start + clip.length;
    els.input.setSelectionRange(nextPos, nextPos);
    els.input.focus();
    update();
    showToast("貼り付けました");
  } catch {
    showToast("Safariの許可後にもう一度お試しください");
  }
}

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(els.input.value);
    showToast("コピーしました");
  } catch {
    els.input.select();
    document.execCommand("copy");
    els.input.setSelectionRange(0, 0);
    showToast("コピーしました");
  }
}

function clearText() {
  if (!els.input.value) return;
  const ok = window.confirm("入力した本文をすべて消去しますか？");
  if (!ok) return;

  els.input.value = "";
  update();
  els.input.focus();
  showToast("消去しました");
}

function load() {
  const savedText = localStorage.getItem(STORAGE_KEY);
  if (savedText !== null) els.input.value = savedText;

  try {
    const savedSettings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    if (savedSettings.b6PerPage) els.b6PerPage.value = savedSettings.b6PerPage;
    if (savedSettings.a5PerPage) els.a5PerPage.value = savedSettings.a5PerPage;
    if (savedSettings.manuscriptPerPage) {
      els.manuscriptPerPage.value = savedSettings.manuscriptPerPage;
    }
  } catch {}

  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme === "dark") {
    document.documentElement.dataset.theme = "dark";
  }

  update();
}

function toggleTheme() {
  const dark = document.documentElement.dataset.theme === "dark";
  if (dark) {
    delete document.documentElement.dataset.theme;
    localStorage.setItem(THEME_KEY, "light");
  } else {
    document.documentElement.dataset.theme = "dark";
    localStorage.setItem(THEME_KEY, "dark");
  }
}

els.input.addEventListener("input", update);
els.paste.addEventListener("click", pasteFromClipboard);
els.copy.addEventListener("click", copyToClipboard);
els.clear.addEventListener("click", clearText);
els.themeToggle.addEventListener("click", toggleTheme);

[els.b6PerPage, els.a5PerPage, els.manuscriptPerPage].forEach((input) => {
  input.addEventListener("input", update);
});

load();
