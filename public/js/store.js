// Deux implémentations avec la même interface :
//  - LocalStore : liste enregistrée sur l'appareil uniquement (localStorage).
//  - FirebaseStore : liste partagée via Firestore, avec cache hors ligne
//    (IndexedDB) et file d'attente des modifications faites sans réseau.
//
// Interface : subscribe(onItems, onStatus), add(item), update(id, patch),
//             remove(id), removeMany(ids), mode,
//             subscribeInbox(onMessages), removeInbox(id)  (phrases envoyées par Siri),
//             subscribeMeta(onMeta), setMeta(patch)        (réglages partagés : ordre des rayons),
//             subscribeHistory(onHistory), recordHistory(key, entry, by), removeHistory(key), restoreHistory(key, entry)
//             (historique des articles, partagé : alimente « Fréquents » et suggestions)

// Identifiant de document sûr à partir d'une clé d'article (« pommes de terre » → « pommes-de-terre »).
export const historyId = (key) => key.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'article';

import { normalize } from './categories.js';

const FIREBASE_VERSION = '11.0.2';
const FB = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

export class LocalStore {
  mode = 'local';

  constructor(key = 'courses.items') {
    this.key = key;
    this.items = this.#load();
    // Synchronise les onglets ouverts sur le même appareil.
    window.addEventListener('storage', (e) => {
      if (e.key === this.key) {
        this.items = this.#load();
        this.#emit();
      }
    });
  }

  #load() {
    try { return JSON.parse(localStorage.getItem(this.key)) || []; } catch { return []; }
  }

  #save() {
    localStorage.setItem(this.key, JSON.stringify(this.items));
    this.#emit();
  }

  #emit() {
    this.onItems?.([...this.items]);
  }

  subscribe(onItems, onStatus) {
    this.onItems = onItems;
    onStatus?.('local');
    this.#emit();
  }

  add(item) {
    this.items.push(item);
    this.#save();
  }

  update(id, patch) {
    this.items = this.items.map((it) => (it.id === id ? { ...it, ...patch } : it));
    this.#save();
  }

  remove(id) {
    this.items = this.items.filter((it) => it.id !== id);
    this.#save();
  }

  subscribeInbox() { /* pas de boîte de réception sans Firebase */ }

  async reconnect() { /* rien à synchroniser en mode local */ }

  // Historique local (même format que les versions précédentes : courses.history).
  #loadHistory() {
    try { return JSON.parse(localStorage.getItem('courses.history')) || {}; } catch { return {}; }
  }

  #saveHistory(h) {
    localStorage.setItem('courses.history', JSON.stringify(h));
    this.onHistory?.(h);
  }

  subscribeHistory(onHistory) {
    this.onHistory = onHistory;
    onHistory(this.#loadHistory());
  }

  recordHistory(key, { name, category }, by = 1) {
    const h = this.#loadHistory();
    const prev = h[key] || { count: 0 };
    h[key] = { name, category, count: prev.count + by, last: Date.now() };
    this.#saveHistory(h);
  }

  removeHistory(key) {
    const h = this.#loadHistory();
    delete h[key];
    this.#saveHistory(h);
  }

  restoreHistory(key, entry) {
    this.#saveHistory({ ...this.#loadHistory(), [key]: entry });
  }

  subscribeMeta(onMeta) {
    this.onMeta = onMeta;
    onMeta(this.#loadMeta());
  }

  setMeta(patch) {
    const meta = { ...this.#loadMeta(), ...patch };
    localStorage.setItem(`${this.key}.meta`, JSON.stringify(meta));
    this.onMeta?.(meta);
  }

  #loadMeta() {
    try { return JSON.parse(localStorage.getItem(`${this.key}.meta`)) || {}; } catch { return {}; }
  }

  removeInbox() {}

  removeMany(ids) {
    const set = new Set(ids);
    this.items = this.items.filter((it) => !set.has(it.id));
    this.#save();
  }
}

export class FirebaseStore {
  mode = 'shared';

  static async create(config, listId) {
    const [appMod, authMod, fsMod] = await Promise.all([
      import(`${FB}/firebase-app.js`),
      import(`${FB}/firebase-auth.js`),
      import(`${FB}/firebase-firestore.js`),
    ]);
    return new FirebaseStore(config, listId, appMod, authMod, fsMod);
  }

  constructor(config, listId, appMod, authMod, fsMod) {
    this.fs = fsMod;
    this.listId = listId;
    const app = appMod.initializeApp(config);

    // Cache persistant : la liste reste lisible et modifiable hors ligne.
    this.db = fsMod.initializeFirestore(app, {
      localCache: fsMod.persistentLocalCache({ tabManager: fsMod.persistentMultipleTabManager() }),
    });
    this.col = fsMod.collection(this.db, 'lists', listId, 'items');
    // Boîte de réception : phrases envoyées par le raccourci Siri, à transformer en articles.
    this.inbox = fsMod.collection(this.db, 'lists', listId, 'inbox');
    // Réglages partagés de la liste (ordre des rayons…).
    this.metaRef = fsMod.doc(this.db, 'lists', listId, 'meta', 'settings');
    // Historique partagé des articles (un document par article).
    this.historyCol = fsMod.collection(this.db, 'lists', listId, 'history');

    // Authentification anonyme (exigée par les règles de sécurité).
    // La session est conservée sur l'appareil, donc pas besoin de réseau ensuite.
    const auth = authMod.getAuth(app);
    this.authReady = new Promise((resolve) => {
      const stop = authMod.onAuthStateChanged(auth, (user) => {
        if (user) { stop(); resolve(user); }
      });
      // Hors ligne au tout premier lancement : on n'attend pas indéfiniment.
      setTimeout(resolve, 2500);
    });
    authMod.signInAnonymously(auth).catch(() => { /* hors ligne : réessayé au prochain lancement */ });
  }

  async subscribe(onItems, onStatus) {
    await this.authReady;
    let pending = false;
    let fromCache = true;
    const report = () => {
      if (!navigator.onLine) onStatus('offline');
      else if (pending) onStatus('pending');
      else if (fromCache) onStatus('offline');
      else { this.lastSyncedAt = Date.now(); onStatus('synced'); }
    };
    window.addEventListener('online', report);
    window.addEventListener('offline', report);

    this.fs.onSnapshot(
      this.col,
      { includeMetadataChanges: true },
      (snap) => {
        pending = snap.metadata.hasPendingWrites;
        fromCache = snap.metadata.fromCache;
        onItems(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
        report();
      },
      (err) => {
        console.error(err);
        onStatus('error', err);
      },
    );
  }

  async subscribeInbox(onMessages) {
    await this.authReady;
    this.fs.onSnapshot(
      this.inbox,
      (snap) => onMessages(snap.docs.map((d) => ({ id: d.id, text: String(d.data().text || '') }))),
      (err) => console.error('Boîte de réception', err),
    );
  }

  async subscribeMeta(onMeta) {
    await this.authReady;
    this.fs.onSnapshot(
      this.metaRef,
      (snap) => onMeta(snap.exists() ? snap.data() : {}),
      (err) => console.error('Réglages', err),
    );
  }

  setMeta(patch) {
    this.#write(() => this.fs.setDoc(this.metaRef, { ...patch, updatedAt: Date.now() }, { merge: true }));
  }

  async subscribeHistory(onHistory) {
    await this.authReady;
    this.fs.onSnapshot(
      this.historyCol,
      (snap) => {
        const h = {};
        snap.docs.forEach((d) => {
          const e = d.data();
          if (e?.name) h[normalize(e.name)] = { name: e.name, category: e.category || 'autre', count: e.count || 0, last: e.last || 0 };
        });
        onHistory(h, { fromServer: !snap.metadata.fromCache });
      },
      (err) => console.error('Historique', err),
    );
  }

  // Compteur incrémenté côté serveur : pas de perte si les deux téléphones ajoutent en même temps.
  recordHistory(key, { name, category }, by = 1) {
    this.#write(() => this.fs.setDoc(this.fs.doc(this.historyCol, historyId(key)), {
      name, category, count: this.fs.increment(by), last: Date.now(),
    }, { merge: true }));
  }

  removeHistory(key) {
    this.#write(() => this.fs.deleteDoc(this.fs.doc(this.historyCol, historyId(key))));
  }

  restoreHistory(key, entry) {
    this.#write(() => this.fs.setDoc(this.fs.doc(this.historyCol, historyId(key)), entry));
  }

  // Coupe puis rétablit la connexion : force une synchronisation immédiate.
  async reconnect() {
    await this.fs.disableNetwork(this.db);
    await this.fs.enableNetwork(this.db);
  }

  removeInbox(id) {
    this.#write(() => this.fs.deleteDoc(this.fs.doc(this.inbox, id)));
  }

  // Les promesses Firestore ne se résolvent qu'après accusé de réception du
  // serveur : on ne les attend pas, l'interface est mise à jour immédiatement
  // depuis le cache local.
  // Écriture après la connexion anonyme : sinon la base la refuse (règles de sécurité).
  // Hors ligne au premier lancement, authReady se résout quand même au bout de 2,5 s :
  // l'écriture est alors mise en file d'attente par Firestore.
  #write(op) {
    this.authReady
      .then(op)
      .catch((err) => console.error('Firestore', err));
  }

  add(item) {
    const { id, ...data } = item;
    this.#write(() => this.fs.setDoc(this.fs.doc(this.col, id), data));
  }

  update(id, patch) {
    this.#write(() => this.fs.updateDoc(this.fs.doc(this.col, id), patch));
  }

  remove(id) {
    this.#write(() => this.fs.deleteDoc(this.fs.doc(this.col, id)));
  }

  removeMany(ids) {
    const batch = this.fs.writeBatch(this.db);
    ids.forEach((id) => batch.delete(this.fs.doc(this.col, id)));
    this.#write(() => batch.commit());
  }
}
