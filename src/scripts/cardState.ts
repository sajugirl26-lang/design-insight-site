/**
 * Card state management — localStorage-based bookmark & read tracking
 */

const STORAGE_KEY = 'dih-card-state';

interface CardStates {
  [videoId: string]: { bookmarked?: boolean; read?: boolean };
}

function getStates(): CardStates {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveStates(states: CardStates) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
}

export function isBookmarked(videoId: string): boolean {
  return !!getStates()[videoId]?.bookmarked;
}

export function isRead(videoId: string): boolean {
  return !!getStates()[videoId]?.read;
}

export function toggleBookmark(videoId: string): boolean {
  const states = getStates();
  if (!states[videoId]) states[videoId] = {};
  states[videoId].bookmarked = !states[videoId].bookmarked;
  if (!states[videoId].bookmarked && !states[videoId].read) delete states[videoId];
  saveStates(states);
  return !!states[videoId]?.bookmarked;
}

export function toggleRead(videoId: string): boolean {
  const states = getStates();
  if (!states[videoId]) states[videoId] = {};
  states[videoId].read = !states[videoId].read;
  if (!states[videoId].bookmarked && !states[videoId].read) delete states[videoId];
  saveStates(states);
  return !!states[videoId]?.read;
}

export function getAllStates(): CardStates {
  return getStates();
}

/** Initialize all card buttons on the current page */
export function initCardStateButtons() {
  const states = getStates();

  // Restore saved states
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
    }
  });

  // Bookmark buttons
  document.querySelectorAll('.btn-bookmark').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const videoId = (btn as HTMLElement).dataset.videoId;
      if (!videoId) return;
      const nowBookmarked = toggleBookmark(videoId);
      btn.classList.toggle('active', nowBookmarked);
    });
  });

  // Read buttons
  document.querySelectorAll('.btn-read-check').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const videoId = (btn as HTMLElement).dataset.videoId;
      if (!videoId) return;
      const nowRead = toggleRead(videoId);
      btn.classList.toggle('active', nowRead);
      const card = btn.closest('.timeline-card');
      card?.classList.toggle('is-read', nowRead);
    });
  });
}
