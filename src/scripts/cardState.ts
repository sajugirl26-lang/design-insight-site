/**
 * Card state management — Firebase Realtime DB + localStorage fallback
 * Pattern from nano-banana-agent: Optimistic Update + 3-layer sync
 */

declare const firebase: any;

const STORAGE_KEY = 'dih-card-state';
const pendingWrites = new Map<string, string>(); // videoId → field being written

interface CardState {
  bookmarked?: boolean;
  read?: boolean;
}
interface CardStates {
  [videoId: string]: CardState;
}

// Firebase refs (initialized lazily)
let bookmarksRef: any = null;
let readsRef: any = null;
let firebaseOk = false;

function initFirebase() {
  if (typeof firebase === 'undefined') return;
  try {
    if (!firebase.apps?.length) {
      firebase.initializeApp({
        apiKey: "AIzaSyBviHK_QiJIAUWI2VmzwEGgi2ioOMbQgLM",
        authDomain: "claudecode-eb187.firebaseapp.com",
        databaseURL: "https://claudecode-eb187-default-rtdb.firebaseio.com",
        projectId: "claudecode-eb187"
      });
    }
    const db = firebase.database();
    bookmarksRef = db.ref('dih-bookmarks');
    readsRef = db.ref('dih-reads');
  } catch (e) {
    console.warn('[Firebase] init failed:', e);
  }
}

// === localStorage layer ===
function getLocalStates(): CardStates {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveLocalStates(states: CardStates) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
}

export function getAllStates(): CardStates {
  return getLocalStates();
}

// === Toggle functions with Firebase sync ===
export function toggleBookmark(videoId: string): boolean {
  const states = getLocalStates();
  if (!states[videoId]) states[videoId] = {};
  states[videoId].bookmarked = !states[videoId].bookmarked;
  const nowBookmarked = !!states[videoId].bookmarked;

  if (!states[videoId].bookmarked && !states[videoId].read) delete states[videoId];
  saveLocalStates(states);

  // Firebase sync
  if (bookmarksRef) {
    pendingWrites.set(videoId, 'bookmarked');
    bookmarksRef.child(videoId).set(nowBookmarked ? true : null)
      .then(() => pendingWrites.delete(videoId))
      .catch(() => pendingWrites.delete(videoId));
  }

  return nowBookmarked;
}

export function toggleRead(videoId: string): boolean {
  const states = getLocalStates();
  if (!states[videoId]) states[videoId] = {};
  states[videoId].read = !states[videoId].read;
  const nowRead = !!states[videoId].read;

  if (!states[videoId].bookmarked && !states[videoId].read) delete states[videoId];
  saveLocalStates(states);

  // Firebase sync
  if (readsRef) {
    pendingWrites.set(videoId, 'read');
    readsRef.child(videoId).set(nowRead ? true : null)
      .then(() => pendingWrites.delete(videoId))
      .catch(() => pendingWrites.delete(videoId));
  }

  return nowRead;
}

// === Apply data from Firebase to UI ===
function applyStatesFromFirebase(
  bookmarks: Record<string, boolean>,
  reads: Record<string, boolean>,
  options?: { hideReadOnIndex?: boolean }
) {
  // Merge into localStorage
  const states = getLocalStates();
  const allVids = new Set([...Object.keys(bookmarks), ...Object.keys(reads), ...Object.keys(states)]);
  for (const vid of allVids) {
    if (pendingWrites.has(vid)) continue; // Don't overwrite pending writes
    const b = bookmarks[vid] || false;
    const r = reads[vid] || false;
    if (b || r) {
      states[vid] = { bookmarked: b || undefined, read: r || undefined };
    } else {
      delete states[vid];
    }
  }
  saveLocalStates(states);

  // Update UI
  document.querySelectorAll('.timeline-card').forEach(card => {
    const videoId = (card as HTMLElement).dataset.videoId;
    if (!videoId || pendingWrites.has(videoId)) return;
    const state = states[videoId];
    const bookmarkBtn = card.querySelector('.btn-bookmark');
    const readBtn = card.querySelector('.btn-read-check');

    if (state?.bookmarked) {
      bookmarkBtn?.classList.add('active');
    } else {
      bookmarkBtn?.classList.remove('active');
    }
    if (state?.read) {
      readBtn?.classList.add('active');
      card.classList.add('is-read');
      if (options?.hideReadOnIndex) {
        (card as HTMLElement).style.display = 'none';
      }
    } else {
      readBtn?.classList.remove('active');
      card.classList.remove('is-read');
      if (options?.hideReadOnIndex) {
        (card as HTMLElement).style.display = '';
      }
    }
  });
}

/** Initialize card buttons + Firebase real-time sync */
export function initCardStateButtons(options?: { hideReadOnIndex?: boolean }) {
  // 1. Restore from localStorage first (instant)
  const states = getLocalStates();
  document.querySelectorAll('.timeline-card').forEach(card => {
    const videoId = (card as HTMLElement).dataset.videoId;
    if (!videoId) return;
    const state = states[videoId];
    if (state?.bookmarked) {
      card.querySelector('.btn-bookmark')?.classList.add('active');
    }
    if (state?.read) {
      card.querySelector('.btn-read-check')?.classList.add('active');
      card.classList.add('is-read');
      if (options?.hideReadOnIndex) {
        (card as HTMLElement).style.display = 'none';
      }
    }
  });

  // 2. Attach click handlers
  document.querySelectorAll('.btn-bookmark').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const videoId = (btn as HTMLElement).dataset.videoId;
      if (!videoId || pendingWrites.has(videoId)) return;
      const nowBookmarked = toggleBookmark(videoId);
      btn.classList.toggle('active', nowBookmarked);
    });
  });

  document.querySelectorAll('.btn-read-check').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const videoId = (btn as HTMLElement).dataset.videoId;
      if (!videoId || pendingWrites.has(videoId)) return;
      const nowRead = toggleRead(videoId);
      btn.classList.toggle('active', nowRead);
      const card = btn.closest('.timeline-card');
      card?.classList.toggle('is-read', nowRead);
      if (options?.hideReadOnIndex && nowRead) {
        (card as HTMLElement).style.display = 'none';
      }
      if (options?.hideReadOnIndex && !nowRead) {
        (card as HTMLElement).style.display = '';
      }
    });
  });

  // 3. Init Firebase + real-time listeners
  initFirebase();

  if (bookmarksRef && readsRef) {
    // Anonymous auth
    firebase.auth().signInAnonymously()
      .then(() => setupListeners(options))
      .catch(() => setupListeners(options)); // Try without auth too

    // 3-second timeout fallback
    setTimeout(() => {
      if (!firebaseOk) {
        console.warn('[Firebase] timeout – using localStorage only');
      }
    }, 3000);
  }
}

function setupListeners(options?: { hideReadOnIndex?: boolean }) {
  let bookmarksData: Record<string, boolean> = {};
  let readsData: Record<string, boolean> = {};
  let gotBookmarks = false;
  let gotReads = false;

  function tryApply() {
    if (gotBookmarks && gotReads) {
      firebaseOk = true;
      applyStatesFromFirebase(bookmarksData, readsData, options);
    }
  }

  bookmarksRef.on('value', (snap: any) => {
    bookmarksData = snap.val() || {};
    gotBookmarks = true;
    tryApply();
  }, () => { gotBookmarks = true; tryApply(); });

  readsRef.on('value', (snap: any) => {
    readsData = snap.val() || {};
    gotReads = true;
    tryApply();
  }, () => { gotReads = true; tryApply(); });
}
