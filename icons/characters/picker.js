// 1TO1 character picker (R70). Pure helpers plus a small DOM renderer.
// No network calls: every picture is a local SVG in ./set/.
// Layout: one grid, three across. Tap a cell to see it large with "Use this one".
// "Shuffle" jumps to a random character. "Skip" is shown only when onSkip is given (sign-up).

export const CHARACTER_IDS = Array.from({ length: 50 }, (_, i) => 'a' + String(i + 1).padStart(2, '0'));
export const CHARACTER_DIR = 'icons/characters/set/';
// Credit line for About (Personas licence, CC BY 4.0). Shown on the About page; see HOOKS.md.
export const AVATAR_CREDIT = 'Avatars: Personas by Draftbit (CC BY 4.0), via DiceBear.';

const ID_RE = /^[ia]\d{2,3}$/;

// Accepts any id of the shape i or a followed by two or three digits (R70), so new batches need no code change.
export function isIconId(id) {
  return typeof id === 'string' && ID_RE.test(id);
}

export function characterSrc(id) {
  if (!isIconId(id)) throw new Error('bad character id');
  return CHARACTER_DIR + id + '.svg';
}

// Random index in [0, n). rng returns a number in [0, 1).
export function randomIndex(n, rng = Math.random) {
  return Math.min(n - 1, Math.floor(rng() * n));
}

// Random id from ids, never the current one when there is a choice.
export function shuffledPick(ids, current, rng = Math.random) {
  const list = (ids || []).filter(isIconId);
  if (list.length === 0) return null;
  if (list.length === 1) return list[0];
  let id;
  do {
    id = list[randomIndex(list.length, rng)];
  } while (id === current);
  return id;
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

// Renders the picker into container. opts: { ids, current, rng, onUse(id), onSkip() }
export function renderCharacterPicker(container, opts = {}) {
  const ids = (opts.ids || CHARACTER_IDS).filter(isIconId);
  const rng = opts.rng || Math.random;
  let current = ids.includes(opts.current) ? opts.current : null;
  const cells = new Map();

  const root = el('div', 'cp');

  const grid = el('div', 'cp-grid');
  grid.setAttribute('role', 'group');
  grid.setAttribute('aria-label', 'Pick a character');

  const stage = el('div', 'cp-stage');
  stage.hidden = true;
  const big = document.createElement('img');
  big.className = 'cp-big';
  big.alt = '';
  const actions = el('div', 'cp-actions');
  const useBtn = el('button', 'cp-btn cp-use', 'Use this one');
  useBtn.type = 'button';
  useBtn.disabled = true;
  const shuffleBtn = el('button', 'cp-btn', 'Shuffle');
  shuffleBtn.type = 'button';
  actions.append(useBtn, shuffleBtn);
  if (typeof opts.onSkip === 'function') {
    const skipBtn = el('button', 'cp-btn cp-skip', 'Skip');
    skipBtn.type = 'button';
    skipBtn.addEventListener('click', () => opts.onSkip());
    actions.append(skipBtn);
  }
  stage.append(big, actions);

  function mark() {
    cells.forEach((btn, id) => {
      const on = id === current;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function select(id) {
    current = id;
    big.src = characterSrc(id);
    stage.hidden = false;
    useBtn.disabled = false;
    mark();
  }

  ids.forEach((id) => {
    const btn = el('button', 'cp-cell');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Character ' + id);
    btn.setAttribute('aria-pressed', 'false');
    const img = document.createElement('img');
    img.src = characterSrc(id);
    img.alt = '';
    img.loading = 'lazy';
    btn.append(img);
    btn.addEventListener('click', () => select(id));
    grid.append(btn);
    cells.set(id, btn);
  });

  useBtn.addEventListener('click', () => {
    if (current && typeof opts.onUse === 'function') opts.onUse(current);
  });
  shuffleBtn.addEventListener('click', () => {
    const next = shuffledPick(ids, current, rng);
    if (next) select(next);
  });

  root.append(grid, stage);
  container.replaceChildren(root);
  if (current) select(current);
  return { select, getCurrent: () => current };
}
