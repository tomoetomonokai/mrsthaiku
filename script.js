const container = document.getElementById('haiku-container');
const wrapper = document.getElementById('scroll-wrapper');
const dialog = document.getElementById('submission-dialog');
const openFormButton = document.getElementById('open-form');
const guidelinesDialog = document.getElementById('guidelines-dialog');
const openGuidelinesButton = document.getElementById('open-guidelines');
const closeDialogButtons = document.querySelectorAll('[data-close-dialog]');
const form = document.getElementById('haiku-form');
const formStatus = document.getElementById('form-status');

const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbx_0f17SqAvoXpDwEjCUmmvfNuIya84YMulZ5P6a1lECNe7neEt_T-0E2P15DAFIbQz/exec';
const NEW_DAYS = 1;
const scrollAmount = 160;

function formatPublishedDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
}

function isNewHaiku(publishedAt) {
  if (!publishedAt) return false;
  const publishedDate = new Date(publishedAt);
  if (Number.isNaN(publishedDate.getTime())) return false;

  const diff = Date.now() - publishedDate.getTime();
  const dayMs = 1000 * 60 * 60 * 24;
  return diff >= 0 && diff <= NEW_DAYS * dayMs;
}

function createHaikuCard(item) {
  const card = document.createElement('article');
  card.className = 'haiku-card';

  if (isNewHaiku(item.publishedAt)) {
    card.classList.add('is-new');

    const badge = document.createElement('span');
    badge.className = 'haiku-badge';
    badge.textContent = '新着';
    card.appendChild(badge);
  }

  const textDiv = document.createElement('div');
  textDiv.className = 'haiku-text';
  textDiv.textContent = (item.text || '').replaceAll('/', '\n');

  const authorDiv = document.createElement('div');
  authorDiv.className = 'haiku-author';
  authorDiv.textContent = item.author || '詠み人知らず';

  const dateDiv = document.createElement('div');
  dateDiv.className = 'haiku-date';
  dateDiv.textContent = formatPublishedDate(item.publishedAt);

  card.append(textDiv, authorDiv, dateDiv);
  container.appendChild(card);
}

function renderHaikuList(items) {
  container.innerHTML = '';

  items
    .filter(item => item && item.text && item.publishedAt)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .forEach(createHaikuCard);
}

async function loadHaiku() {
  try {
    const response = await fetch('haiku.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('作品データの取得に失敗しました。');

    const items = await response.json();
    renderHaikuList(Array.isArray(items) ? items : []);
  } catch (error) {
    console.error(error);
    container.innerHTML = '<p class="error">俳句を読み込めませんでした。</p>';
  }
}

let lastFocusedElement = null;

function openModal(targetDialog) {
  lastFocusedElement = document.activeElement;
  targetDialog.hidden = false;
  document.body.style.overflow = 'hidden';

  const closeButton = targetDialog.querySelector('.dialog-close');
  closeButton?.focus();
}

function closeModal(targetDialog) {
  targetDialog.hidden = true;

  const anyDialogOpen = [...document.querySelectorAll('.dialog')]
    .some(item => !item.hidden);

  if (!anyDialogOpen) {
    document.body.style.overflow = '';
  }

  lastFocusedElement?.focus();
}

function openDialog() {
  openModal(dialog);
}

function closeDialog() {
  closeModal(dialog);
}

function openGuidelines() {
  openModal(guidelinesDialog);
}

async function submitHaiku(event) {
  event.preventDefault();
  const formData = new FormData(form);
  const payload = {
    line1: formData.get('line1')?.trim() || '',
    line2: formData.get('line2')?.trim() || '',
    line3: formData.get('line3')?.trim() || '',
    author: formData.get('author')?.trim() || '詠み人知らず',
    xHandle: formData.get('xHandle')?.trim() || '',
    note: formData.get('note')?.trim() || '',
    website: formData.get('website')?.trim() || '',
    turnstileToken: formData.get('cf-turnstile-response') || '',
    formStartedAt: form.dataset.startedAt || ''
  };
  if (!payload.line1 || !payload.line2 || !payload.line3) {
    formStatus.textContent = '上五・中七・下五をすべて入力してください。';
    return;
  }
  if (!payload.turnstileToken) {
    formStatus.textContent = '人間であることの確認を完了してください。';
    return;
  }

  formStatus.textContent = '投稿を送信しています…';
  try {
    const response = await fetch(GAS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok || result.ok !== true) throw new Error(result.message || '投稿に失敗しました。');
    form.reset();
    formStatus.textContent = '受け付けました。管理者確認後に掲載を検討します。';
    if (window.turnstile) turnstile.reset();
  } catch (error) {
    console.error(error);
    formStatus.textContent = error.message || '送信できませんでした。時間をおいて再度お試しください。';
    if (window.turnstile) turnstile.reset();
  }
}

openFormButton.addEventListener('click', openDialog);
openGuidelinesButton.addEventListener('click', openGuidelines);

document.querySelectorAll('[data-close-dialog]').forEach(button => {
  button.addEventListener('click', () => {
    const targetDialog = button.closest('.dialog');
    if (targetDialog) closeModal(targetDialog);
  });
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const openedDialog = [...document.querySelectorAll('.dialog')]
    .find(item => !item.hidden);
  if (openedDialog) closeModal(openedDialog);
});

form.addEventListener('submit', submitHaiku);

document.getElementById('scroll-left').addEventListener('click', () => {
  wrapper.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
});

document.getElementById('scroll-right').addEventListener('click', () => {
  wrapper.scrollBy({ left: scrollAmount, behavior: 'smooth' });
});

function isDesktopLayout() {
  return window.matchMedia('(min-width: 821px)').matches;
}

function isDialogOpen() {
  return [...document.querySelectorAll('.dialog')]
    .some(item => !item.hidden);
}

function isTextInputTarget(target) {
  return target instanceof HTMLElement && (
    target.matches('input, textarea, select') ||
    target.isContentEditable
  );
}

wrapper.addEventListener('wheel', event => {
  if (!isDesktopLayout() || isDialogOpen()) return;

  const verticalWheel = Math.abs(event.deltaY) >= Math.abs(event.deltaX);
  if (!verticalWheel || event.deltaY === 0) return;

  event.preventDefault();

  const multiplier =
    event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 :
    event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? wrapper.clientWidth :
    0.5;

  wrapper.scrollBy({
    left: -event.deltaY * multiplier,
    behavior: 'auto'
  });
}, { passive: false });

document.addEventListener('keydown', event => {
  if (!isDesktopLayout() || isDialogOpen()) return;
  if (isTextInputTarget(event.target)) return;

  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    wrapper.scrollBy({
      left: -scrollAmount,
      behavior: 'smooth'
    });
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault();
    wrapper.scrollBy({
      left: scrollAmount,
      behavior: 'smooth'
    });
  }
});

loadHaiku();
