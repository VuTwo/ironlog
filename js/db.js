/* db.js — IndexedDB key-value persistence with localStorage fallback.
   Whole collections are stored as single values; data volume for one user is tiny. */
(function () {
  'use strict';
  const FT = (window.FT = window.FT || {});
  const DB_NAME = 'ironlog';
  const STORE = 'kv';
  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      if (!window.indexedDB) return resolve(null);
      // Some environments (private browsing, sandboxed iframes) hang or block
      // the open request — fall back to localStorage rather than stalling boot.
      const bail = setTimeout(() => resolve(null), 1500);
      let req;
      try { req = indexedDB.open(DB_NAME, 1); }
      catch (e) { clearTimeout(bail); return resolve(null); }
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => { clearTimeout(bail); resolve(req.result); };
      req.onerror = () => { clearTimeout(bail); resolve(null); };
    });
    return dbPromise;
  }

  async function idbGet(key) {
    const db = await openDb();
    if (!db) return lsGet(key);
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    });
  }

  async function idbSet(key, value) {
    const db = await openDb();
    if (!db) return lsSet(key, value);
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => { lsSet(key, value); resolve(false); };
    });
  }

  function lsGet(key) {
    try { const raw = localStorage.getItem('ironlog:' + key); return raw == null ? undefined : JSON.parse(raw); }
    catch (e) { return undefined; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem('ironlog:' + key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }

  FT.db = { get: idbGet, set: idbSet };
})();
