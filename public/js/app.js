import { CATEGORIES, CATEGORY_BY_ID, guessCategory, normalize } from './categories.js';
import { LocalStore, FirebaseStore } from './store.js';
import { parseMany, capitalize } from './parse.js';
import { APP_VERSION, APP_DATE } from './version.js';
import { firebaseConfig } from '../firebase-config.js';

const $ = (sel) => document.querySelector(sel);
const els = {
  list: $('#list'), empty: $('#empty'), input: $('#input'), composer: $('#composer'), chips: $('#chips'),
  sync: $('#sync'), progressBar: $('#progress-bar'), progressLabel: $('#progress-label'), greeting: $('#greeting'),
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
    return;
  }
  const checkedTwin = items.find((i) => i.checked && normalize(i.name) === normalize(name));
  if (checkedTwin) {
    store.update(checkedTwin.id, { checked: false, qty: qty || checkedTwin.qty, updatedAt: Date.now() });
    remember(checkedTwin);
    return;
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
  store.add(item);
  remember(item);
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
    html += `<section class="group">
      <div class="group-head"><span class="emoji">${cat.emoji}</span>${cat.label}<span class="count">${group.length}</span></div>
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
  els.empty.hidden = items.length > 0;

  const total = items.length;
  const pct = total ? Math.round((done.length / total) * 100) : 0;
  els.progressBar.style.width = `${pct}%`;
  els.progressLabel.textContent = !total ? ''
    : todo.length === 0 ? 'Tout est dans le caddie 🎉'
    : `${todo.length} article${todo.length > 1 ? 's' : ''} à prendre · ${done.length}/${total}`;
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

function setupMic() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!els.mic) return;
  if (!SR) { els.mic.hidden = true; return; }

  const placeholder = els.input.placeholder;
  const SILENCE_MS = 1800;   // fin automatique après ce silence (Safari ne signale pas toujours la fin)
  const START_MS = 4000;     // le micro doit démarrer dans ce délai
  const NOTHING_MS = 7000;   // rien entendu dans ce délai : on arrête
  const MAX_MS = 20000;      // durée maximale d'une écoute
  const ERRORS = {
    'not-allowed': 'Autorisez le micro pour cette app dans les réglages',
    'service-not-allowed': 'Reconnaissance vocale non autorisée sur cet appareil',
    network: 'La reconnaissance vocale a besoin du réseau',
    'no-speech': 'Je n\'ai rien entendu',
    'audio-capture': 'Micro introuvable',
  };

  // Journal de diagnostic (appui long sur 🎤 pour l'afficher).
  const journal = [];
  const t0 = Date.now();
  const log = (msg) => {
    journal.push(`${((Date.now() - t0) / 1000).toFixed(1)}s ${msg}`);
    if (journal.length > 60) journal.shift();
  };
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;
  log(`prêt (${standalone ? 'app installée' : 'navigateur'}, ${window.SpeechRecognition ? 'SpeechRecognition' : 'webkitSpeechRecognition'})`);

  // Un seul moteur, réutilisé : sur iPhone, en créer un nouveau à chaque fois
  // peut empêcher les écoutes suivantes de recevoir le son.
  let rec = null;
  let current = null;
  let successes = 0;
  let failuresSinceSuccess = 0;

  function createRec() {
    const r = new SR();
    r.lang = 'fr-FR';
    r.interimResults = true;
    r.continuous = false;
    // Les événements d'un ancien moteur (remplacé entre-temps) sont ignorés.
    const mine = () => r === rec;
    r.onstart = () => { log('onstart'); if (mine()) current?.onstart(); };
    r.onaudiostart = () => log('onaudiostart');
    r.onspeechstart = () => log('onspeechstart');
    r.onspeechend = () => { log('onspeechend'); if (mine()) current?.armSilence(); };
    r.onresult = (e) => { if (mine()) current?.onresult(e); };
    r.onerror = (e) => { log(`onerror ${e.error}`); if (mine()) current?.onerror(e); };
    r.onend = () => { log('onend'); if (mine() && current?.started) current.finish(); };
    log('moteur créé');
    return r;
  }

  function begin() {
    const session = { finalText: '', interim: '', done: false, started: false, heard: false, timers: [] };
    const later = (ms, fn) => session.timers.push(setTimeout(fn, ms));
    let silenceTimer;

    session.armSilence = () => {
      clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => session.finish(), SILENCE_MS);
    };
    session.onstart = () => {
      session.started = true;
      els.mic.classList.add('listening');
      els.input.placeholder = 'Je vous écoute… « du lait et des œufs »';
      navigator.vibrate?.(15);
    };
    session.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        // Chaque segment final correspond en général à une pause : un article à part.
        if (r.isFinal) session.finalText += (session.finalText ? ', ' : '') + r[0].transcript.trim();
        else interim += r[0].transcript;
      }
      session.interim = interim.trim();
      session.heard = true;
      log(`onresult « ${[session.finalText, session.interim].filter(Boolean).join(', ')} »`);
      els.input.value = [session.finalText, session.interim].filter(Boolean).join(', ');
      session.armSilence();
    };
    session.onerror = (e) => {
      if (e.error === 'aborted') return;
      session.finish({ message: ERRORS[e.error] || `Reconnaissance vocale indisponible (${e.error})` });
    };
    session.finish = ({ keep = true, message = '' } = {}) => {
      if (session.done) return;
      session.done = true;
      clearTimeout(silenceTimer);
      session.timers.forEach(clearTimeout);
      if (current === session) current = null;
      // abort() libère le micro tout de suite.
      try { rec?.abort(); } catch { /* déjà terminé */ }
      els.mic.classList.remove('listening');
      els.input.placeholder = placeholder;

      const text = keep ? [session.finalText, session.interim].filter(Boolean).join(', ').trim() : '';
      els.input.value = '';
      log(`fin (${text ? 'texte reçu' : 'rien reçu'})`);
      if (text) {
        successes++;
        failuresSinceSuccess = 0;
        const entries = parseMany(text, { voice: true });
        entries.forEach((entry) => addItem(entry, { silent: true }));
        renderChips();
        if (entries.length) { toast(`🎙️ Ajouté : ${entries.map((x) => x.name).join(', ')}`); return; }
      }
      failuresSinceSuccess++;
      // Le micro a marché puis n'entend plus rien : bug de Safari, qu'une relance débloque.
      const permission = message === ERRORS['not-allowed'] || message === ERRORS['service-not-allowed'];
      if (successes > 0 && keep && !permission) {
        rec = null; // prochaine fois : repartir d'un moteur neuf
        toast('Rien entendu. Si le micro reste bloqué :', 'Relancer l\'app', () => location.reload(), 10000);
        return;
      }
      if (message) toast(message);
    };

    current = session;
    later(START_MS, () => {
      if (!session.started) {
        rec = null;
        session.finish({ keep: false, message: 'Le micro ne répond pas, touchez 🎤 pour réessayer' });
      }
    });
    later(NOTHING_MS, () => { if (!session.heard) session.finish({ message: 'Je n\'ai rien entendu' }); });
    later(MAX_MS, () => session.finish());

    try {
      rec = rec || createRec();
      log('start()');
      rec.start();
    } catch (err) {
      // Moteur dans un état incohérent : on en crée un neuf.
      log(`start() refusé : ${err.name}`);
      try {
        rec = createRec();
        log('start() (nouveau moteur)');
        rec.start();
      } catch (err2) {
        log(`start() refusé : ${err2.name}`);
        rec = null;
        session.finish({ keep: false, message: 'Reconnaissance vocale indisponible' });
      }
    }
  }

  // Appui long : afficher le journal de diagnostic.
  let pressTimer = null;
  let longPressed = false;
  els.mic.addEventListener('pointerdown', () => {
    longPressed = false;
    pressTimer = setTimeout(() => {
      longPressed = true;
      alert(`Diagnostic du micro (version ${APP_VERSION})\n\n${journal.join('\n')}`);
    }, 700);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => els.mic.addEventListener(ev, () => clearTimeout(pressTimer)));
  els.mic.addEventListener('contextmenu', (e) => e.preventDefault());

  els.mic.addEventListener('click', () => {
    if (longPressed) { longPressed = false; return; }
    if (current?.started) {
      // Appui pendant l'écoute : on termine et on ajoute ce qui a été entendu.
      current.finish();
      return;
    }
    // Écoute bloquée sans avoir démarré : on l'abandonne et on repart à zéro.
    if (current) current.finish({ keep: false });
    begin();
  });
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

  els.composer.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = els.input.value.trim();
    if (!value) return;
    const entries = parseMany(value);
    entries.forEach((e) => addItem(e, { silent: entries.length > 1 }));
    if (entries.length > 1) toast(`${entries.length} articles ajoutés`);
    els.input.value = '';
    renderChips();
  });
  els.input.addEventListener('input', renderChips);

  render();
  renderChips();
  store.subscribe(
    (next) => { items = next; itemsLoaded = true; render(); renderChips(); processInbox(); },
    setSync,
  );
  store.subscribeInbox((messages) => { inbox = messages; processInbox(); });
  setupMic();
  setupSiri();

  if (joined) toast('Vous avez rejoint la liste partagée 🎉');

}

main();
