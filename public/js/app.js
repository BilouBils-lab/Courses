import { CATEGORIES, CATEGORY_BY_ID, guessCategory, normalize } from './categories.js';
import { LocalStore, FirebaseStore } from './store.js';
import { parseMany, capitalize } from './parse.js';
import { APP_VERSION, APP_DATE } from './version.js';
import { firebaseConfig } from '../firebase-config.js';

const $ = (sel) => document.querySelector(sel);
const els = {
  list: $('#list'), empty: $('#empty'), input: $('#input'), composer: $('#composer'), chips: $('#chips'),
  sync: $('#sync'), progressLabel: $('#progress-label'), greeting: $('#greeting'),
  hero: $('#hero'), ring: $('#ring'), ringPct: $('#ring-pct'), heroBig: $('#hero-big'),
  mic: $('#mic'), siriSheet: $('#siri-sheet'),
  editSheet: $('#edit-sheet'), editForm: $('#edit-form'), editCategory: $('#edit-category'),
  settingsSheet: $('#settings-sheet'), toast: $('#toast'), toastText: $('#toast-text'), toastAction: $('#toast-action'),
};

const prefs = {
  get(key, fallback = null) {
    try { return JSON.parse(localStorage.getItem(`courses.${key}`)) ?? fallback; } catch { return fallback; }
  },
  set(key, value) { localStorage.setItem(`courses.${key}`, JSON.stringify(value)); },
};

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);
const escapeHtml = (s = '') => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let store;
let items = [];
let itemsLoaded = false;
let inbox = [];
const highlight = new Set(); // articles à mettre en évidence au prochain affichage
const handledInbox = new Set();
let doneOpen = prefs.get('doneOpen', false);

/* ---------------------------------------------------------------- Liste partagée */

function newListCode() {
  // 4 groupes de 4 caractères sans ambiguïté (pas de 0/O, 1/l…) ≈ 80 bits.
  const alphabet = '23456789abcdefghjkmnpqrstuvwxyz';
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]);
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join('')).join('-');
}

function parseListCode(text) {
  const m = String(text).trim().toLowerCase().match(/([a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4})/);
  return m ? m[1] : null;
}

function resolveListId() {
  const fromUrl = parseListCode(new URLSearchParams(location.search).get('liste') || '');
  if (fromUrl) {
    prefs.set('listId', fromUrl);
    history.replaceState(null, '', location.pathname);
    return { id: fromUrl, joined: true };
  }
  let id = prefs.get('listId');
  if (!id) {
    id = newListCode();
    prefs.set('listId', id);
  }
  return { id, joined: false };
}

function shareUrl() {
  const url = new URL(location.href);
  url.search = `?liste=${prefs.get('listId')}`;
  url.hash = '';
  return url.toString();
}

/* ---------------------------------------------------------------- Historique */

function history_() { return prefs.get('history', {}); }

function remember(item) {
  const h = history_();
  const key = normalize(item.name);
  const prev = h[key] || { count: 0 };
  h[key] = { name: item.name, category: item.category, count: prev.count + 1, last: Date.now() };
  prefs.set('history', h);
}

function suggestions(query) {
  const inList = new Set(items.filter((i) => !i.checked).map((i) => normalize(i.name)));
  const q = normalize(query);
  return Object.entries(history_())
    .filter(([key]) => !inList.has(key) && (!q || key.includes(q)) && key !== q)
    .sort(([, a], [, b]) => {
      // Fréquence pondérée par la récence.
      const score = (e) => e.count / (1 + (Date.now() - e.last) / (1000 * 3600 * 24 * 30));
      return score(b) - score(a);
    })
    .slice(0, 12)
    .map(([, e]) => e);
}

function renderChips() {
  const list = suggestions(els.input.value);
  els.chips.innerHTML = list
    .map((e, i) => `<button type="button" class="chip" data-i="${i}">${CATEGORY_BY_ID[e.category]?.emoji || '🛒'} ${escapeHtml(e.name)}</button>`)
    .join('');
  els.chips.querySelectorAll('.chip').forEach((btn) => {
    // Garde le clavier ouvert : les suggestions ne s'affichent que pendant la saisie.
    btn.addEventListener('pointerdown', (e) => e.preventDefault());
    btn.addEventListener('click', () => {
      const e = list[Number(btn.dataset.i)];
      addItem({ name: e.name, qty: '', category: e.category });
      els.input.value = '';
      renderChips();
    });
  });
}

/* ---------------------------------------------------------------- Actions */

// Ajoute un article. `id` permet un identifiant déterministe (phrases Siri traitées
// par deux téléphones en même temps : pas de doublon). `silent` évite les messages.
function addItem({ name, qty, category, id, addedBy }, { silent = false } = {}) {
  name = capitalize(name.trim());
  if (!name) return;
  // Si l'article est déjà dans la liste (non coché), on met à jour au lieu de dupliquer.
  const existing = items.find((i) => !i.checked && normalize(i.name) === normalize(name));
  if (existing) {
    if (qty && qty !== existing.qty) store.update(existing.id, { qty, updatedAt: Date.now() });
    if (!silent) toast(`« ${name} » est déjà dans la liste`);
    highlight.add(existing.id);
    return { name, status: 'exists' };
  }
  const checkedTwin = items.find((i) => i.checked && normalize(i.name) === normalize(name));
  if (checkedTwin) {
    store.update(checkedTwin.id, { checked: false, qty: qty || checkedTwin.qty, updatedAt: Date.now() });
    remember(checkedTwin);
    highlight.add(checkedTwin.id);
    return { name, status: 'added' };
  }
  const knownCategory = history_()[normalize(name)]?.category;
  const item = {
    id: id || uid(),
    name,
    qty: qty || '',
    note: '',
    category: category || knownCategory || guessCategory(name),
    checked: false,
    addedBy: addedBy ?? prefs.get('me', ''),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  highlight.add(item.id);
  store.add(item);
  remember(item);
  return { name, status: 'added' };
}

// Ajoute plusieurs articles et confirme toujours ce qui s'est passé.
function addEntries(entries, prefix = '✓') {
  const results = entries.map((e) => addItem(e, { silent: true })).filter(Boolean);
  const added = results.filter((r) => r.status === 'added').map((r) => r.name);
  const already = results.filter((r) => r.status === 'exists').map((r) => r.name);
  const parts = [];
  if (added.length) parts.push(`${prefix} Ajouté : ${added.join(', ')}`);
  if (already.length) parts.push(`Déjà dans la liste : ${already.join(', ')}`);
  if (parts.length) toast(parts.join(' · '), '', null, 5000);
  else toast('Je n\'ai reconnu aucun article');
  renderChips();
  return results;
}

function toggle(item) {
  store.update(item.id, {
    checked: !item.checked,
    checkedBy: !item.checked ? prefs.get('me', '') : '',
    updatedAt: Date.now(),
  });
  navigator.vibrate?.(10);
}

function removeItem(item) {
  store.remove(item.id);
  toast(`« ${item.name} » supprimé`, 'Annuler', () => store.add(item));
}

function clearChecked() {
  const done = items.filter((i) => i.checked);
  if (!done.length) return;
  store.removeMany(done.map((i) => i.id));
  toast(`${done.length} article${done.length > 1 ? 's' : ''} retiré${done.length > 1 ? 's' : ''}`, 'Annuler',
    () => done.forEach((i) => store.add(i)));
}

/* ---------------------------------------------------------------- Rendu */

const checkSvg = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

function itemHtml(item) {
  const meta = [item.note, item.addedBy && item.addedBy !== prefs.get('me', '') ? `ajouté par ${item.addedBy}` : '']
    .filter(Boolean).map(escapeHtml).join(' · ');
  return `
    <div class="item${item.checked ? ' checked' : ''}" data-id="${escapeHtml(item.id)}">
      <div class="item-del">Supprimer</div>
      <div class="item-inner" role="button" tabindex="0" aria-pressed="${item.checked}">
        <span class="check">${checkSvg}</span>
        <span class="item-text">
          <div class="item-name">${escapeHtml(item.name)}</div>
          ${meta ? `<div class="item-meta">${meta}</div>` : ''}
        </span>
        ${item.qty ? `<span class="qty">${escapeHtml(item.qty)}</span>` : ''}
      </div>
    </div>`;
}

function render() {
  const todo = items.filter((i) => !i.checked);
  const done = items.filter((i) => i.checked).sort((a, b) => b.updatedAt - a.updatedAt);
  const byName = (a, b) => a.createdAt - b.createdAt;

  let html = '';
  for (const cat of CATEGORIES) {
    const group = todo.filter((i) => (CATEGORY_BY_ID[i.category] ? i.category : 'autre') === cat.id).sort(byName);
    if (!group.length) continue;
    html += `<section class="group" style="--cat: ${cat.color}">
      <div class="group-head"><span class="emoji">${cat.emoji}</span><span class="group-label">${cat.label}</span><span class="count">${group.length}</span></div>
      ${group.map(itemHtml).join('')}
    </section>`;
  }
  if (done.length) {
    html += `<section class="group done-group${doneOpen ? ' open' : ''}">
      <div class="group-head" style="padding-bottom:0">
        <button type="button" class="done-toggle" data-action="toggle-done" style="padding:0">
          <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg> Dans le caddie (${done.length})
        </button>
        <button type="button" data-action="clear">Tout retirer</button>
      </div>
      <div style="height:6px"></div>
      ${done.map(itemHtml).join('')}
    </section>`;
  }
  els.list.innerHTML = html;
  // Met en évidence les articles qui viennent d'être ajoutés et fait défiler jusqu'à eux.
  let first = null;
  for (const id of highlight) {
    const node = els.list.querySelector(`.item[data-id="${CSS.escape(id)}"]`);
    if (!node) continue;
    node.classList.add('flash');
    first = first || node;
    highlight.delete(id);
  }
  first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  els.empty.hidden = items.length > 0;

  const total = items.length;
  const pct = total ? Math.round((done.length / total) * 100) : 0;
  if (els.hero) {
    els.hero.hidden = total === 0;
    els.ring.style.setProperty('--pct', pct);
    els.ringPct.textContent = `${pct}%`;
    els.hero.classList.toggle('complete', total > 0 && todo.length === 0);
    els.heroBig.textContent = todo.length === 0 ? 'Tout est pris 🎉' : `${todo.length} à prendre`;
  }
  els.progressLabel.textContent = !total ? ''
    : todo.length === 0 ? `${total} article${total > 1 ? 's' : ''} dans le caddie`
    : `${done.length} dans le caddie sur ${total}`;
  els.composer.classList.toggle('list-empty', total === 0);
}

/* ---------------------------------------------------------------- Gestes */

function setupGestures() {
  let start = null;
  let pressTimer = null;
  let swiped = false;

  const getItem = (el) => {
    const node = el.closest('.item');
    return node && { node, item: items.find((i) => i.id === node.dataset.id) };
  };

  els.list.addEventListener('pointerdown', (e) => {
    const hit = getItem(e.target);
    if (!hit || !e.target.closest('.item-inner')) return;
    start = { x: e.clientX, y: e.clientY, ...hit, dx: 0, longPressed: false };
    swiped = false;
    pressTimer = setTimeout(() => {
      if (!start) return;
      start.longPressed = true;
      navigator.vibrate?.(20);
      openEdit(start.item);
    }, 500);
  });

  els.list.addEventListener('pointermove', (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) clearTimeout(pressTimer);
    if (!swiped && Math.abs(dy) > Math.abs(dx)) return;
    if (dx < -10) {
      swiped = true;
      start.dx = Math.max(dx, -window.innerWidth);
      start.node.classList.add('dragging');
      start.node.querySelector('.item-inner').style.transform = `translateX(${start.dx}px)`;
    }
  });

  const end = () => {
    clearTimeout(pressTimer);
    if (!start) return;
    const { node, item, dx, longPressed } = start;
    start = null;
    node.classList.remove('dragging');
    const inner = node.querySelector('.item-inner');
    if (swiped) {
      if (dx < -100) {
        inner.style.transform = 'translateX(-100%)';
        node.classList.add('leaving');
        setTimeout(() => removeItem(item), 220);
      } else {
        inner.style.transform = '';
      }
      return;
    }
    if (!longPressed && item) {
      node.classList.toggle('checked');
      setTimeout(() => toggle(item), item.checked ? 0 : 280);
    }
  };
  els.list.addEventListener('pointerup', end);
  els.list.addEventListener('pointercancel', () => {
    clearTimeout(pressTimer);
    if (start) start.node.querySelector('.item-inner').style.transform = '';
    start = null;
  });
  els.list.addEventListener('contextmenu', (e) => { if (e.target.closest('.item')) e.preventDefault(); });

  // Clavier : Entrée/Espace coche, Suppr supprime, E modifie.
  els.list.addEventListener('keydown', (e) => {
    const hit = getItem(e.target);
    if (!hit?.item) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(hit.item); }
    if (e.key === 'Delete' || e.key === 'Backspace') removeItem(hit.item);
    if (e.key === 'e') openEdit(hit.item);
  });

  els.list.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'toggle-done') {
      doneOpen = !doneOpen;
      prefs.set('doneOpen', doneOpen);
      render();
    } else if (action === 'clear') {
      clearChecked();
    }
  });
}

/* ---------------------------------------------------------------- Feuilles */

// Bloque le défilement de la page du dessous pendant qu'un écran est ouvert.
let lockedScrollY = 0;
function openSheet(sheet) {
  if (!document.body.classList.contains('locked')) {
    lockedScrollY = window.scrollY;
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.classList.add('locked');
  }
  sheet.showModal();
  sheet.scrollTop = 0;
}

function unlockIfNoSheet() {
  // Laisse le temps à un éventuel écran suivant de s'ouvrir (Partage › Siri).
  setTimeout(() => {
    if (document.querySelector('dialog[open]') || !document.body.classList.contains('locked')) return;
    document.body.classList.remove('locked');
    document.body.style.top = '';
    window.scrollTo(0, lockedScrollY);
  }, 0);
}
document.querySelectorAll('dialog.sheet').forEach((d) => d.addEventListener('close', unlockIfNoSheet));

let editing = null;

function openEdit(item) {
  editing = item;
  const f = els.editForm.elements;
  f.name.value = item.name;
  f.qty.value = item.qty || '';
  f.note.value = item.note || '';
  f.category.value = CATEGORY_BY_ID[item.category] ? item.category : 'autre';
  openSheet(els.editSheet);
}

function setupSheets() {
  els.editCategory.innerHTML = CATEGORIES.map((c) => `<option value="${c.id}">${c.emoji} ${c.label}</option>`).join('');

  els.editForm.addEventListener('submit', () => {
    if (!editing) return;
    const f = els.editForm.elements;
    const patch = {
      name: capitalize(f.name.value.trim()) || editing.name,
      qty: f.qty.value.trim(),
      note: f.note.value.trim(),
      category: f.category.value,
      updatedAt: Date.now(),
    };
    store.update(editing.id, patch);
    // Mémorise le rayon choisi pour les prochaines fois.
    remember({ ...editing, ...patch });
    editing = null;
  });
  $('#edit-delete').addEventListener('click', () => {
    if (editing) removeItem(editing);
    editing = null;
    els.editSheet.close();
  });

  // Fermer en touchant le fond.
  for (const sheet of [els.editSheet, els.settingsSheet]) {
    sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.close(); });
  }

  $('#btn-settings').addEventListener('click', () => {
    const shared = store.mode === 'shared';
    $('#share-on').hidden = !shared;
    $('#share-off').hidden = shared;
    $('#share-code').textContent = prefs.get('listId');
    $('#me-input').value = prefs.get('me', '');
    openSheet(els.settingsSheet);
  });

  $('#me-input').addEventListener('change', (e) => {
    prefs.set('me', e.target.value.trim());
    updateGreeting();
    render();
  });

  $('#btn-share').addEventListener('click', async () => {
    const url = shareUrl();
    if (navigator.share) {
      try { await navigator.share({ title: 'Notre liste de courses', text: 'Rejoins notre liste de courses :', url }); } catch { /* annulé */ }
    } else {
      await navigator.clipboard?.writeText(url);
      toast('Lien copié');
    }
  });

  $('#btn-join').addEventListener('click', () => {
    const code = parseListCode($('#join-input').value);
    if (!code) { toast('Code invalide'); return; }
    if (code === prefs.get('listId')) { els.settingsSheet.close(); return; }
    prefs.set('listId', code);
    location.reload();
  });
}

/* ---------------------------------------------------------------- Siri (boîte de réception) */

// Le raccourci Siri dépose la phrase dictée dans lists/{code}/inbox.
// Le premier téléphone qui la voit la transforme en articles puis la supprime.
function processInbox() {
  if (!itemsLoaded) return;
  const added = [];
  for (const msg of inbox) {
    if (handledInbox.has(msg.id)) continue;
    handledInbox.add(msg.id);
    parseMany(msg.text, { voice: true }).forEach((e, i) => {
      addItem({ ...e, id: `${msg.id}-${i}`, addedBy: 'Siri' }, { silent: true });
      added.push(e.name);
    });
    store.removeInbox(msg.id);
  }
  if (added.length) toast(`🎙️ Siri a ajouté : ${added.join(', ')}`);
}

function siriUrl() {
  const { projectId, apiKey } = firebaseConfig;
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/lists/${prefs.get('listId')}/inbox?key=${apiKey}`;
}

const SIRI_BODY = '{"fields":{"text":{"stringValue":"TEXTE"}}}';

function setupSiri() {
  const btn = $('#btn-siri');
  if (!btn || !els.siriSheet) return;
  if (store.mode !== 'shared') { btn.hidden = true; return; }
  btn.addEventListener('click', () => {
    $('#siri-url').textContent = siriUrl();
    $('#siri-body').textContent = SIRI_BODY;
    els.settingsSheet.close();
    openSheet(els.siriSheet);
  });
  els.siriSheet.addEventListener('click', async (e) => {
    if (e.target === els.siriSheet) { els.siriSheet.close(); return; }
    const target = e.target.closest('[data-copy]');
    if (!target) return;
    const text = $(`#${target.dataset.copy}`).textContent;
    try {
      await navigator.clipboard.writeText(text);
      toast('Copié ✔');
    } catch {
      // Repli : sélection du texte pour copie manuelle.
      const range = document.createRange();
      range.selectNodeContents($(`#${target.dataset.copy}`));
      getSelection().removeAllRanges();
      getSelection().addRange(range);
      toast('Sélectionné : utilisez « Copier »');
    }
  });
}

/* ---------------------------------------------------------------- Micro */

// Le bouton 🎤 ouvre la dictée du clavier de l'iPhone (fiable, même hors ligne).
// Appui long : reconnaissance vocale de Safari, en option expérimentale.
let dictating = false; // la saisie en cours vient de la dictée : découpage « voix »

function setupMic() {
  if (!els.mic) return;
  const placeholder = els.input.placeholder;

  const addBtn = els.composer.querySelector('.add-btn');
  const AUTO_MS = 2000; // pause après la dictée avant l'ajout automatique
  let autoTimer = null;

  const cancelAuto = () => {
    clearTimeout(autoTimer);
    autoTimer = null;
    addBtn?.classList.remove('auto');
  };
  const stopDictation = () => {
    dictating = false;
    cancelAuto();
    els.input.placeholder = placeholder;
    els.mic.classList.remove('active');
  };
  els.input.addEventListener('blur', () => { if (!els.input.value.trim()) stopDictation(); });

  // Ajout automatique après une dictée : plus besoin de toucher « OK ».
  // Pendant la dictée, l'iPhone insère un caractère provisoire (U+FFFC) : il
  // signale une dictée même sans passer par le bouton 🎤, et tant qu'il est
  // présent la reconnaissance n'est pas terminée.
  els.input.addEventListener('input', () => {
    const value = els.input.value;
    const inProgress = value.includes('\uFFFC');
    if (inProgress) dictating = true;
    if (!dictating) return;
    cancelAuto();
    if (inProgress || !value.trim()) return;
    // Relance l'animation du bouton ✚ (remplissage pendant le délai).
    void addBtn?.offsetWidth;
    addBtn?.classList.add('auto');
    autoTimer = setTimeout(() => {
      autoTimer = null;
      if (els.input.value.trim()) {
        if (els.composer.requestSubmit) els.composer.requestSubmit();
        else els.composer.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    }, AUTO_MS);
  });

  // Appui long : écran expérimental.
  let pressTimer = null;
  let longPressed = false;
  els.mic.addEventListener('pointerdown', () => {
    longPressed = false;
    pressTimer = setTimeout(() => { longPressed = true; navigator.vibrate?.(20); openVoiceLab(); }, 600);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => els.mic.addEventListener(ev, () => clearTimeout(pressTimer)));
  els.mic.addEventListener('contextmenu', (e) => e.preventDefault());

  els.mic.addEventListener('click', () => {
    if (longPressed) { longPressed = false; return; }
    dictating = true;
    els.mic.classList.add('active');
    els.input.placeholder = 'Touchez 🎙 sur le clavier et dictez…';
    els.input.focus();
    if (!prefs.get('dictationHintSeen', false)) {
      prefs.set('dictationHintSeen', true);
      toast('Touchez le micro 🎙 du clavier et dictez : les articles s\'ajoutent tout seuls', '', null, 7000);
    }
  });

  return stopDictation;
}

/* ---------------------------------------------------------------- Micro Safari (expérimental) */

const voiceLab = { journal: [], t0: Date.now(), rec: null, current: null, ready: false };

function voiceLog(msg) {
  voiceLab.journal.push(`${((Date.now() - voiceLab.t0) / 1000).toFixed(1)}s ${msg}`);
  if (voiceLab.journal.length > 80) voiceLab.journal.shift();
  const el = $('#voice-log');
  if (el) { el.textContent = voiceLab.journal.join('\n'); el.scrollTop = el.scrollHeight; }
}

function openVoiceLab() {
  const sheet = $('#voice-sheet');
  if (!sheet) { toast('Fermez et rouvrez l\'app pour terminer la mise à jour'); return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const status = $('#voice-status');
  const startBtn = $('#voice-start');
  const continuous = $('#voice-continuous');
  const interim = $('#voice-interim');

  if (!voiceLab.ready) {
    voiceLab.ready = true;
    continuous.checked = prefs.get('voiceContinuous', false);
    interim.checked = prefs.get('voiceInterim', true);
    continuous.addEventListener('change', () => { prefs.set('voiceContinuous', continuous.checked); voiceLab.rec = null; });
    interim.addEventListener('change', () => { prefs.set('voiceInterim', interim.checked); voiceLab.rec = null; });
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;
    voiceLog(`version ${APP_VERSION}, ${standalone ? 'app installée' : 'navigateur'}, ${SR ? (window.SpeechRecognition ? 'SpeechRecognition' : 'webkitSpeechRecognition') : 'non disponible'}`);
    startBtn.addEventListener('click', () => {
      if (voiceLab.current?.started) { voiceLab.current.finish(); return; }
      if (voiceLab.current) voiceLab.current.finish({ keep: false });
      startListening();
    });
    sheet.addEventListener('close', () => voiceLab.current?.finish());
  }

  if (!SR) {
    startBtn.disabled = true;
    status.textContent = 'La reconnaissance vocale de Safari n\'est pas disponible sur cet appareil.';
  }
  voiceLog('écran ouvert');
  openSheet(sheet);

  function setListening(on) {
    startBtn.classList.toggle('listening', on);
    startBtn.textContent = on ? '⏹ Arrêter et ajouter' : '🎤 Démarrer l\'écoute';
  }

  function createRec() {
    const r = new SR();
    r.lang = 'fr-FR';
    r.interimResults = interim.checked;
    r.continuous = continuous.checked;
    const mine = () => r === voiceLab.rec;
    r.onstart = () => { voiceLog('onstart'); if (mine()) voiceLab.current?.onstart(); };
    r.onaudiostart = () => voiceLog('onaudiostart');
    r.onsoundstart = () => voiceLog('onsoundstart');
    r.onspeechstart = () => voiceLog('onspeechstart');
    r.onspeechend = () => { voiceLog('onspeechend'); if (mine()) voiceLab.current?.armSilence(); };
    r.onnomatch = () => voiceLog('onnomatch');
    r.onresult = (e) => { if (mine()) voiceLab.current?.onresult(e); };
    r.onerror = (e) => { voiceLog(`onerror ${e.error}`); if (mine()) voiceLab.current?.onerror(e); };
    r.onend = () => { voiceLog('onend'); if (mine() && voiceLab.current?.started) voiceLab.current.finish(); };
    voiceLog(`moteur créé (continu: ${r.continuous ? 'oui' : 'non'}, partiels: ${r.interimResults ? 'oui' : 'non'})`);
    return r;
  }

  function startListening() {
    const session = { finalText: '', interim: '', done: false, started: false, heard: false, timers: [] };
    voiceLab.current = session;
    let silenceTimer;
    const text = () => [session.finalText, session.interim].filter(Boolean).join(', ').trim();

    session.armSilence = () => {
      clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => session.finish(), continuous.checked ? 2500 : 1800);
    };
    session.onstart = () => {
      session.started = true;
      setListening(true);
      status.textContent = 'Je vous écoute…';
    };
    session.onresult = (e) => {
      let partial = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) session.finalText += (session.finalText ? ', ' : '') + r[0].transcript.trim();
        else partial += r[0].transcript;
      }
      session.interim = partial.trim();
      session.heard = true;
      voiceLog(`onresult « ${text()} »`);
      status.textContent = `« ${text()} »`;
      session.armSilence();
    };
    session.onerror = (e) => {
      if (e.error === 'aborted') return;
      session.finish({ message: `Erreur : ${e.error}` });
    };
    session.finish = ({ keep = true, message = '' } = {}) => {
      if (session.done) return;
      session.done = true;
      clearTimeout(silenceTimer);
      session.timers.forEach(clearTimeout);
      if (voiceLab.current === session) voiceLab.current = null;
      try { voiceLab.rec?.abort(); } catch { /* déjà terminé */ }
      setListening(false);
      const result = keep ? text() : '';
      voiceLog(`fin (${result ? 'texte reçu' : 'rien reçu'})`);
      if (result) {
        const entries = parseMany(result, { voice: true });
        entries.forEach((entry) => addItem(entry, { silent: true }));
        renderChips();
        status.textContent = `✅ Ajouté : ${entries.map((x) => x.name).join(', ')}`;
        return;
      }
      status.textContent = message || 'Rien entendu. Ouvrez le journal ci-dessous pour voir ce qui s\'est passé.';
    };

    session.timers.push(setTimeout(() => {
      if (!session.started) { voiceLab.rec = null; session.finish({ keep: false, message: 'Le micro ne répond pas.' }); }
    }, 4000));
    session.timers.push(setTimeout(() => { if (!session.heard) session.finish({ message: 'Rien entendu en 8 secondes.' }); }, 8000));
    session.timers.push(setTimeout(() => session.finish(), 30000));

    try {
      voiceLab.rec = voiceLab.rec || createRec();
      voiceLog('start()');
      voiceLab.rec.start();
    } catch (err) {
      voiceLog(`start() refusé : ${err.name}`);
      try {
        voiceLab.rec = createRec();
        voiceLog('start() (nouveau moteur)');
        voiceLab.rec.start();
      } catch (err2) {
        voiceLog(`start() refusé : ${err2.name}`);
        voiceLab.rec = null;
        session.finish({ keep: false, message: 'Reconnaissance vocale indisponible.' });
      }
    }
  }
}

/* ---------------------------------------------------------------- Divers */

let toastTimer;
function toast(text, actionLabel = '', action = null, duration = 4000) {
  els.toastText.textContent = text;
  els.toastAction.textContent = actionLabel;
  els.toastAction.onclick = () => { action?.(); els.toast.hidden = true; };
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { els.toast.hidden = true; }, duration);
}

const SYNC_LABELS = {
  local: 'Local', synced: 'Synchronisé', pending: 'Envoi…', offline: 'Hors ligne', error: 'Erreur',
};
function setSync(state) {
  els.sync.dataset.state = state;
  els.sync.querySelector('.sync-label').textContent = SYNC_LABELS[state] || state;
  els.sync.title = {
    local: 'Liste enregistrée sur cet appareil uniquement',
    synced: 'Liste à jour avec les autres appareils',
    pending: 'Modifications en cours d\'envoi',
    offline: 'Hors ligne : vos modifications seront envoyées au retour du réseau',
    error: 'Erreur de synchronisation (vérifiez la configuration Firebase)',
  }[state] || '';
}

function updateGreeting() {
  const h = new Date().getHours();
  const hello = h < 5 || h >= 18 ? 'Bonsoir' : 'Bonjour';
  const me = prefs.get('me', '');
  els.greeting.textContent = me ? `${hello} ${me}` : hello;
}

/* ---------------------------------------------------------------- Thème */

const THEME_COLORS = { dark: '#0a0d0c', light: '#f3f6f4' };

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const dark = theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  $('#theme-color')?.setAttribute('content', THEME_COLORS[dark ? 'dark' : 'light']);
  document.querySelectorAll('[data-theme-value]').forEach((b) => {
    b.setAttribute('aria-checked', String(b.dataset.themeValue === theme));
  });
}

function setupTheme() {
  applyTheme(prefs.get('theme', 'dark'));
  document.querySelectorAll('[data-theme-value]').forEach((b) => b.addEventListener('click', () => {
    prefs.set('theme', b.dataset.themeValue);
    applyTheme(b.dataset.themeValue);
  }));
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme(prefs.get('theme', 'dark')));
}

/* ---------------------------------------------------------------- Mises à jour */

// Enregistré dès le démarrage, avant tout le reste : même si une autre partie de
// l'app plantait, les mises à jour continueraient d'arriver.
function setupUpdates() {
  if ('serviceWorker' in navigator) {
    // Une nouvelle version a été installée en arrière-plan : proposer de recharger.
    // (Pas de message lors de la toute première installation.)
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) toast('✨ Nouvelle version disponible', 'Recharger', () => location.reload(), 20000);
    });
    navigator.serviceWorker.register('sw.js')
      .then((reg) => {
        // Sur iPhone, l'app installée reste souvent ouverte en arrière-plan :
        // on vérifie les mises à jour à chaque retour au premier plan.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reg.update().catch(() => {});
        });
      })
      .catch((err) => console.warn('Service worker', err));
  }
}

// Affiche à l'écran les erreurs inattendues : utile pour diagnostiquer sur le téléphone.
function reportErrors() {
  const show = (msg) => toast(`⚠️ Erreur (v${APP_VERSION}) : ${String(msg).slice(0, 140)}`, '', null, 12000);
  window.addEventListener('error', (e) => show(e.message || e.error));
  window.addEventListener('unhandledrejection', (e) => show(e.reason?.message || e.reason));
}

function showVersion() {
  let el = $('#version');
  if (!el) {
    // Page plus ancienne que les scripts (cache) : on crée l'emplacement.
    el = document.createElement('p');
    el.id = 'version';
    el.className = 'version';
    els.settingsSheet?.querySelector('.sheet-body')?.prepend(el);
  }
  if (el) el.textContent = `Version ${APP_VERSION} · ${APP_DATE}`;
}

/* ---------------------------------------------------------------- Démarrage */

async function main() {
  setupUpdates();
  showVersion();
  reportErrors();
  const { joined } = resolveListId();

  if (firebaseConfig) {
    try {
      store = await FirebaseStore.create(firebaseConfig, prefs.get('listId'));
    } catch (err) {
      console.error('Firebase indisponible, passage en mode local', err);
      store = new LocalStore();
      toast('Synchronisation indisponible, liste locale utilisée');
    }
  } else {
    store = new LocalStore();
  }

  updateGreeting();
  setupGestures();
  setupSheets();

  const stopDictation = setupMic();
  els.composer.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = els.input.value.replace(/\uFFFC/g, '').trim();
    if (!value) return;
    const voice = dictating;
    els.input.value = '';
    stopDictation?.();
    addEntries(parseMany(value, { voice }), voice ? '🎙️' : '✓');
  });
  els.input.addEventListener('input', renderChips);
  // Suggestions visibles uniquement pendant la saisie (ou quand la liste est vide).
  let blurTimer;
  els.input.addEventListener('focus', () => { clearTimeout(blurTimer); els.composer.classList.add('focused'); });
  els.input.addEventListener('blur', () => {
    blurTimer = setTimeout(() => els.composer.classList.remove('focused'), 150);
  });
  setupTheme();

  render();
  renderChips();
  store.subscribe(
    (next) => { items = next; itemsLoaded = true; render(); renderChips(); processInbox(); },
    setSync,
  );
  store.subscribeInbox((messages) => { inbox = messages; processInbox(); });
  setupSiri();

  if (joined) toast('Vous avez rejoint la liste partagée 🎉');

}

main();
