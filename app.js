/* ============================================================
   KobanInput PWA - app.js
   ============================================================ */

// -------------------- State --------------------
const STORAGE_KEYS = {
  rows: 'koban-rows',
  workDate: 'koban-work-date',
  history: 'koban-history',
  textDetailed: 'koban-text-detailed',
};

const state = {
  master: [],        // [{category, code, name, unit, price, note}, ...]
  lookup: {},        // { CODE: item }
  categories: [],    // unique categories in master order
  rows: [],          // [{id, code, quantity}, ...]
  workDate: todayISO(),
  history: [],       // [string, ...]
  textDetailed: false,
  pickerTargetRowId: null,
  pickerMode: 'select',          // 'select' | 'browse'
  pickerSelectedCategory: '',
  pickerQuery: '',
  pickerShowAll: false,
  pasteCursor: 0,
  pasteCopiedKey: null,
};

// -------------------- Helpers --------------------
function uid() {
  return 'r' + Math.random().toString(36).slice(2, 10);
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateSlash(iso) {
  // "2026-05-14" -> "2026/05/14"
  if (!iso || iso.length < 10) return iso;
  return iso.slice(0, 10).replace(/-/g, '/');
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function formatQuantity(q) {
  if (!isFinite(q)) return '0';
  if (q === Math.trunc(q)) return String(q);
  // 末尾0削った最大小数4桁
  return parseFloat(q.toFixed(4)).toString();
}

function formatYen(n) {
  return Math.round(n).toLocaleString('en-US');
}

function itemFor(code) {
  if (!code) return null;
  return state.lookup[code.toUpperCase()] || null;
}

function subtotal(row) {
  const it = itemFor(row.code);
  if (!it) return 0;
  return Math.round(it.price * (row.quantity || 0));
}

function totalAmount() {
  return state.rows.reduce((s, r) => s + subtotal(r), 0);
}

// 半角=1, 全角(非ASCII)=2
function visualWidth(s) {
  let w = 0;
  for (const ch of s) {
    w += ch.codePointAt(0) > 0x7F ? 2 : 1;
  }
  return w;
}

function padLeft(s, width) {
  const w = visualWidth(s);
  return w >= width ? s : ' '.repeat(width - w) + s;
}

function padRight(s, width) {
  const w = visualWidth(s);
  return w >= width ? s : s + ' '.repeat(width - w);
}

// 工番正規化: 大文字化＋数字部分の前ゼロ除去
function normalizeCode(s) {
  const upper = s.toUpperCase();
  let result = '';
  let i = 0;
  while (i < upper.length) {
    const ch = upper[i];
    if (ch >= '0' && ch <= '9') {
      let j = i;
      while (j < upper.length && upper[j] >= '0' && upper[j] <= '9') j++;
      let num = upper.slice(i, j);
      while (num.length > 1 && num[0] === '0') num = num.slice(1);
      result += num;
      i = j;
    } else {
      result += ch;
      i++;
    }
  }
  return result;
}

// -------------------- Plain text rendering --------------------
function plainText(detailed) {
  const lines = [formatDateSlash(state.workDate)];
  const validRows = state.rows.filter(r => (r.code || '').trim() !== '');
  const sp = '  ';
  const total = totalAmount();

  if (detailed) {
    // 詳細: NN(2)  Code(4)  Qty(3)  Unit(4)  UnitPrice(6)  Amount(6)  Name
    lines.push(total.toLocaleString('en-US'));
    validRows.forEach((row, idx) => {
      const code = (row.code || '').toUpperCase();
      const m = itemFor(code);
      const unitPrice = m ? m.price : 0;
      const unit = m ? m.unit : '-';
      const name = m ? m.name : '(該当なし)';
      const amount = subtotal(row);
      lines.push([
        padLeft(String(idx + 1), 2),
        padRight(code, 4),
        padLeft(formatQuantity(row.quantity), 3),
        padRight(unit, 4),
        padLeft(unitPrice.toLocaleString('en-US'), 6),
        padLeft(amount.toLocaleString('en-US'), 6),
        name,
      ].join(sp));
    });
  } else {
    // 簡易: NN(2)  Code(4)  Qty(3)  Amount(6)、合計を右寄せ21桁
    lines.push(padLeft(total.toLocaleString('en-US'), 21));
    validRows.forEach((row, idx) => {
      const code = (row.code || '').toUpperCase();
      const amount = subtotal(row);
      lines.push([
        padLeft(String(idx + 1), 2),
        padRight(code, 4),
        padLeft(formatQuantity(row.quantity), 3),
        padLeft(amount.toLocaleString('en-US'), 6),
      ].join(sp));
    });
  }
  return lines.join('\n');
}

// -------------------- Copy fields --------------------
function buildCopyFields() {
  const fields = [
    { key: 'date', label: '作業日', value: state.workDate },
    { key: 'total', label: '総額', value: String(totalAmount()) },
  ];
  let n = 0;
  for (const row of state.rows) {
    if (!(row.code || '').trim()) continue;
    n++;
    fields.push({ key: `code${n}`, label: `工番${n}`, value: (row.code || '').toUpperCase() });
    fields.push({ key: `qty${n}`, label: `数量${n}`, value: formatQuantity(row.quantity) });
    fields.push({ key: `amt${n}`, label: `金額${n}`, value: String(subtotal(row)) });
  }
  return fields;
}

// -------------------- Persistence --------------------
function persistRows() { saveJSON(STORAGE_KEYS.rows, state.rows); }
function persistWorkDate() { localStorage.setItem(STORAGE_KEYS.workDate, state.workDate); }
function persistHistory() { saveJSON(STORAGE_KEYS.history, state.history); }
function persistTextDetailed() { localStorage.setItem(STORAGE_KEYS.textDetailed, state.textDetailed ? '1' : '0'); }

function restoreFromStorage() {
  const rows = loadJSON(STORAGE_KEYS.rows, null);
  if (Array.isArray(rows) && rows.length > 0) {
    // sanitize
    state.rows = rows.map(r => ({
      id: r.id || uid(),
      code: typeof r.code === 'string' ? r.code : '',
      quantity: typeof r.quantity === 'number' ? r.quantity : 1,
    }));
  } else {
    state.rows = [{ id: uid(), code: '', quantity: 1 }];
  }
  const wd = localStorage.getItem(STORAGE_KEYS.workDate);
  if (wd) state.workDate = wd;
  state.history = loadJSON(STORAGE_KEYS.history, []);
  state.textDetailed = localStorage.getItem(STORAGE_KEYS.textDetailed) === '1';
}

function addHistory(query) {
  const q = (query || '').trim();
  if (!q) return;
  state.history = state.history.filter(x => x.toLowerCase() !== q.toLowerCase());
  state.history.unshift(q);
  if (state.history.length > 12) state.history = state.history.slice(0, 12);
  persistHistory();
}

function removeHistory(query) {
  state.history = state.history.filter(x => x !== query);
  persistHistory();
}

function clearHistory() {
  state.history = [];
  persistHistory();
}

// -------------------- Clipboard --------------------
async function copyToClipboard(text) {
  // Modern API (iOS Safari 13.4+)
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // fall through
    }
  }
  // Fallback: hidden textarea + execCommand
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// -------------------- Master loading --------------------
async function loadMaster() {
  const res = await fetch('koban_master.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('master fetch failed');
  const items = await res.json();
  state.master = items;
  state.lookup = {};
  const seen = new Set();
  state.categories = [];
  for (const it of items) {
    state.lookup[it.code.toUpperCase()] = it;
    if (!seen.has(it.category)) {
      seen.add(it.category);
      state.categories.push(it.category);
    }
  }
  state.pickerSelectedCategory = state.categories[0] || '';
}

// =================================================================
// RENDERING
// =================================================================

const $ = (id) => document.getElementById(id);

function renderAll() {
  renderHeader();
  renderRows();
}

function renderHeader() {
  $('work-date').value = state.workDate;
  $('total-value').textContent = '¥' + formatYen(totalAmount());
}

function renderRows() {
  // セーフティネット: 何らかの理由で行が空なら1行を復活
  if (!Array.isArray(state.rows) || state.rows.length === 0) {
    state.rows = [{ id: uid(), code: '', quantity: 1 }];
    persistRows();
  }
  const container = $('rows-container');
  container.innerHTML = '';
  state.rows.forEach((row, idx) => {
    container.appendChild(buildRowElement(row, idx));
  });
}

function buildRowElement(row, idx) {
  const wrap = document.createElement('div');
  wrap.className = 'row-item';
  wrap.dataset.rowId = row.id;

  const line1 = document.createElement('div');
  line1.className = 'row-line1';

  // 工番ボタン
  const codeBtn = document.createElement('button');
  codeBtn.type = 'button';
  codeBtn.className = 'code-btn' + (row.code ? '' : ' empty');
  if (row.code) {
    codeBtn.innerHTML = `<span>${escapeHTML(row.code.toUpperCase())}</span><span class="chevron">▼</span>`;
  } else {
    codeBtn.innerHTML = `<span>工番</span><span class="chevron">▼</span>`;
  }
  codeBtn.addEventListener('click', () => openPicker('select', row.id));
  line1.appendChild(codeBtn);

  const spacer = document.createElement('div');
  spacer.className = 'row-spacer';
  line1.appendChild(spacer);

  // 数量
  const qtyGroup = document.createElement('div');
  qtyGroup.className = 'qty-group';

  const minus = document.createElement('button');
  minus.type = 'button';
  minus.className = 'qty-btn minus';
  minus.textContent = '−';
  minus.addEventListener('click', () => {
    row.quantity = Math.max(0, (row.quantity || 0) - 1);
    persistRows();
    renderRows();
    renderHeader();
  });
  qtyGroup.appendChild(minus);

  const qtyInput = document.createElement('input');
  qtyInput.type = 'text';
  qtyInput.inputMode = 'decimal';
  qtyInput.className = 'qty-input';
  qtyInput.value = formatQuantity(row.quantity);
  qtyInput.addEventListener('focus', () => qtyInput.select());
  qtyInput.addEventListener('change', () => {
    const v = parseFloat(qtyInput.value);
    row.quantity = isFinite(v) ? v : 0;
    persistRows();
    renderRows();
    renderHeader();
  });
  qtyInput.addEventListener('blur', () => {
    qtyInput.value = formatQuantity(row.quantity);
  });
  qtyGroup.appendChild(qtyInput);

  const plus = document.createElement('button');
  plus.type = 'button';
  plus.className = 'qty-btn plus';
  plus.textContent = '＋';
  plus.addEventListener('click', () => {
    row.quantity = (row.quantity || 0) + 1;
    persistRows();
    renderRows();
    renderHeader();
  });
  qtyGroup.appendChild(plus);

  line1.appendChild(qtyGroup);

  // 行削除ボタン
  if (state.rows.length > 1) {
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'row-delete';
    del.setAttribute('aria-label', '行を削除');
    del.textContent = '×';
    del.addEventListener('click', () => {
      state.rows = state.rows.filter(r => r.id !== row.id);
      persistRows();
      renderRows();
      renderHeader();
    });
    line1.appendChild(del);
  }

  wrap.appendChild(line1);

  // 2行目: 名称・単価・小計 or エラー
  const matched = itemFor(row.code);
  const line2 = document.createElement('div');
  if (matched) {
    line2.className = 'row-line2';
    line2.innerHTML = `
      <span class="name">${escapeHTML(matched.name)}</span>
      <span class="meta">¥${formatYen(matched.price)}/${escapeHTML(matched.unit)} → 小計 <span class="subtotal">¥${formatYen(subtotal(row))}</span></span>
    `;
    wrap.appendChild(line2);
  } else if (row.code) {
    line2.className = 'row-line2 no-match';
    line2.textContent = '該当する工番がありません';
    wrap.appendChild(line2);
  }

  return wrap;
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// =================================================================
// PICKER MODAL
// =================================================================

function openPicker(mode, rowId) {
  state.pickerMode = mode;
  state.pickerTargetRowId = rowId || null;
  state.pickerQuery = '';
  state.pickerShowAll = false;
  // tabは最後に選んだままにする
  if (!state.pickerSelectedCategory) state.pickerSelectedCategory = state.categories[0] || '';
  $('picker-title').textContent = mode === 'browse' ? '工番一覧' : '工番を選択';
  $('search-input').value = '';
  $('search-clear').hidden = true;
  $('picker-modal').hidden = false;
  renderPicker();
}

function closePicker() {
  $('picker-modal').hidden = true;
}

function renderPicker() {
  renderCategoryTabs();
  renderPickerList();
  renderHistoryBar();
}

function renderCategoryTabs() {
  const nav = $('category-tabs');
  nav.innerHTML = '';
  for (const cat of state.categories) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'category-tab' + (cat === state.pickerSelectedCategory ? ' active' : '');
    btn.textContent = cat;
    btn.addEventListener('click', () => {
      state.pickerSelectedCategory = cat;
      state.pickerShowAll = false;
      renderCategoryTabs();
      renderPickerList();
    });
    nav.appendChild(btn);
  }
  // Scroll active tab into view
  const active = nav.querySelector('.category-tab.active');
  if (active) active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'auto' });
}

function visibleItems() {
  const q = state.pickerQuery.trim();
  if (!q) {
    if (state.pickerShowAll) return state.master;
    return state.master.filter(it => it.category === state.pickerSelectedCategory);
  }
  const nq = normalizeCode(q);
  const lq = q.toLowerCase();
  return state.master.filter(it =>
    normalizeCode(it.code).includes(nq) ||
    it.name.toLowerCase().includes(lq) ||
    it.category.toLowerCase().includes(lq)
  );
}

function renderPickerList() {
  const list = $('picker-list');
  list.innerHTML = '';
  const items = visibleItems();
  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'picker-empty';
    empty.textContent = '該当する項目がありません';
    list.appendChild(empty);
    return;
  }

  // group by category
  const groups = [];
  for (const it of items) {
    const last = groups[groups.length - 1];
    if (last && last.category === it.category) {
      last.items.push(it);
    } else {
      groups.push({ category: it.category, items: [it] });
    }
  }

  for (const g of groups) {
    const h = document.createElement('div');
    h.className = 'picker-group-header';
    h.textContent = '─ ' + g.category;
    list.appendChild(h);
    for (const it of g.items) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'picker-row';
      const noteClean = (it.note || '').replace(/_x000D_/g, '');
      row.innerHTML = `
        <div class="picker-row-top">
          <span class="code">${escapeHTML(it.code)}</span>
          <span class="name-block">
            <span class="name">${escapeHTML(it.name)}</span>
          </span>
          <span class="price-block">
            <span class="price">¥${formatYen(it.price)}</span>
            <span class="unit">/${escapeHTML(it.unit)}</span>
          </span>
        </div>
        ${noteClean ? `<div class="picker-row-note"><span class="note-text">${escapeHTML(noteClean)}</span></div>` : ''}
      `;
      row.addEventListener('click', () => handlePickerTap(it));
      list.appendChild(row);
    }
  }
}

function renderHistoryBar() {
  const bar = $('history-bar');
  if (state.pickerQuery.trim() !== '' || state.history.length === 0) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  const chips = $('history-chips');
  chips.innerHTML = '';
  for (const q of state.history) {
    const chip = document.createElement('span');
    chip.className = 'history-chip';
    chip.innerHTML = `<button type="button" class="text">${escapeHTML(q)}</button><button type="button" class="del">✕</button>`;
    chip.querySelector('.text').addEventListener('click', () => {
      $('search-input').value = q;
      state.pickerQuery = q;
      state.pickerShowAll = false;
      $('search-clear').hidden = false;
      renderPickerList();
      renderHistoryBar();
    });
    chip.querySelector('.del').addEventListener('click', (e) => {
      e.stopPropagation();
      removeHistory(q);
      renderHistoryBar();
    });
    chips.appendChild(chip);
  }
}

function handlePickerTap(item) {
  addHistory(state.pickerQuery);
  if (state.pickerMode === 'browse') {
    // 新規行として追加
    state.rows.push({ id: uid(), code: item.code, quantity: 1 });
    persistRows();
    renderRows();
    renderHeader();
    showPickerToast(`${item.code} を明細に追加`);
  } else {
    // 行に書き戻し
    const row = state.rows.find(r => r.id === state.pickerTargetRowId);
    if (row) {
      const wasEmpty = row.code === '';
      row.code = item.code;
      // 空だった最終行を初めて埋めたら、次の入力用に空行を自動追加
      if (wasEmpty) {
        const idx = state.rows.findIndex(r => r.id === row.id);
        if (idx === state.rows.length - 1) {
          state.rows.push({ id: uid(), code: '', quantity: 1 });
        }
      }
      persistRows();
      renderRows();
      renderHeader();
    }
    closePicker();
  }
}

let pickerToastTimer = null;
function showPickerToast(msg) {
  const t = $('picker-toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(pickerToastTimer);
  pickerToastTimer = setTimeout(() => { t.hidden = true; }, 1200);
}

// =================================================================
// TEXT PREVIEW MODAL
// =================================================================

function openTextPreview() {
  $('text-detailed').checked = state.textDetailed;
  renderTextPreview();
  $('text-modal').hidden = false;
}

function closeTextPreview() {
  $('text-modal').hidden = true;
}

function renderTextPreview() {
  $('text-preview').textContent = plainText(state.textDetailed);
}

let textToastTimer = null;
async function copyTextPreview() {
  const text = plainText(state.textDetailed);
  const ok = await copyToClipboard(text);
  const t = $('text-toast');
  t.textContent = ok ? 'コピーしました' : 'コピーに失敗しました';
  t.hidden = false;
  clearTimeout(textToastTimer);
  textToastTimer = setTimeout(() => { t.hidden = true; }, 1200);
}

// =================================================================
// PASTE MODAL
// =================================================================

function openPaste() {
  state.pasteCursor = 0;
  state.pasteCopiedKey = null;
  renderPaste();
  $('paste-modal').hidden = false;
}

function closePaste() {
  $('paste-modal').hidden = true;
}

function renderPaste() {
  const fields = buildCopyFields();
  const list = $('paste-list');
  list.innerHTML = '';
  $('paste-progress').textContent =
    fields.length ? `${Math.min(state.pasteCursor + 1, fields.length)} / ${fields.length}` : '0 / 0';

  fields.forEach((f, idx) => {
    const row = document.createElement('button');
    row.type = 'button';
    let cls = 'paste-row';
    if (idx === state.pasteCursor) cls += ' is-next';
    else if (idx < state.pasteCursor) cls += ' is-done';
    if (state.pasteCopiedKey === f.key) cls += ' just-copied';
    row.className = cls;

    let statusIcon = '○';
    if (idx === state.pasteCursor) statusIcon = '➤';
    else if (idx < state.pasteCursor) statusIcon = '✓';

    row.innerHTML = `
      <span class="status">${statusIcon}</span>
      <span class="field-label">${escapeHTML(f.label)}</span>
      <span class="field-value">${escapeHTML(f.value)}</span>
      <span class="copy-icon">${state.pasteCopiedKey === f.key ? '✓' : '📋'}</span>
    `;
    row.addEventListener('click', async () => {
      const ok = await copyToClipboard(f.value);
      if (ok) {
        state.pasteCopiedKey = f.key;
        if (idx === state.pasteCursor) {
          state.pasteCursor = Math.min(state.pasteCursor + 1, fields.length);
        }
        renderPaste();
        showPasteToast(`「${f.label}」をコピー`);
      } else {
        showPasteToast('コピーに失敗しました');
      }
    });
    list.appendChild(row);
  });
}

let pasteToastTimer = null;
function showPasteToast(msg) {
  const t = $('paste-toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(pasteToastTimer);
  pasteToastTimer = setTimeout(() => { t.hidden = true; }, 1000);
}

// =================================================================
// EVENT WIRING
// =================================================================

function wireUI() {
  // top bar
  $('btn-paste').addEventListener('click', openPaste);
  $('btn-master').addEventListener('click', () => openPicker('browse'));
  $('btn-text').addEventListener('click', openTextPreview);

  // header
  $('work-date').addEventListener('change', (e) => {
    state.workDate = e.target.value || todayISO();
    persistWorkDate();
  });

  // clear rows
  $('btn-clear-rows').addEventListener('click', () => {
    // 既に空1行ならスキップ
    const hasContent = state.rows.length > 1 ||
      (state.rows[0] && (state.rows[0].code !== '' || state.rows[0].quantity !== 1));
    if (!hasContent) return;
    if (!confirm('明細をクリアします。\n（作業日と検索履歴は残ります）')) return;
    state.rows = [{ id: uid(), code: '', quantity: 1 }];
    persistRows();
    renderRows();
    renderHeader();
  });

  // picker modal
  $('picker-close').addEventListener('click', closePicker);

  const searchInput = $('search-input');
  searchInput.addEventListener('input', (e) => {
    state.pickerQuery = e.target.value;
    $('search-clear').hidden = !state.pickerQuery;
    if (state.pickerQuery.trim() !== '') state.pickerShowAll = false;
    renderPickerList();
    renderHistoryBar();
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (state.pickerQuery.trim() === '') {
        state.pickerShowAll = true;
        renderPickerList();
      } else {
        addHistory(state.pickerQuery);
      }
      searchInput.blur();
    }
  });
  $('search-clear').addEventListener('click', () => {
    searchInput.value = '';
    state.pickerQuery = '';
    state.pickerShowAll = false;
    $('search-clear').hidden = true;
    renderPickerList();
    renderHistoryBar();
  });
  $('history-clear').addEventListener('click', () => {
    clearHistory();
    renderHistoryBar();
  });

  // text preview modal
  $('text-close').addEventListener('click', closeTextPreview);
  $('text-detailed').addEventListener('change', (e) => {
    state.textDetailed = e.target.checked;
    persistTextDetailed();
    renderTextPreview();
  });
  $('text-copy').addEventListener('click', copyTextPreview);

  // paste modal
  $('paste-close').addEventListener('click', closePaste);
  $('paste-reset').addEventListener('click', () => {
    state.pasteCursor = 0;
    state.pasteCopiedKey = null;
    renderPaste();
  });

  // Tap modal backdrop to close
  for (const modalId of ['picker-modal', 'text-modal', 'paste-modal']) {
    const m = $(modalId);
    m.addEventListener('click', (e) => {
      if (e.target === m) m.hidden = true;
    });
  }
}

// =================================================================
// BOOT
// =================================================================

(async function boot() {
  restoreFromStorage();
  try {
    await loadMaster();
  } catch (e) {
    console.error('Master load failed:', e);
    alert('koban_master.json の読み込みに失敗しました。');
  }
  wireUI();
  renderAll();

  // Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW reg failed', err));
    });
  }
})();
