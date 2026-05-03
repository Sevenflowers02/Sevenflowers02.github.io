const els = {
  totalCount: document.querySelector('#totalCount'),
  chapterFilter: document.querySelector('#chapterFilter'),
  modeSelect: document.querySelector('#modeSelect'),
  searchInput: document.querySelector('#searchInput'),
  answeredStat: document.querySelector('#answeredStat'),
  correctStat: document.querySelector('#correctStat'),
  accuracyStat: document.querySelector('#accuracyStat'),
  bookmarkStat: document.querySelector('#bookmarkStat'),
  position: document.querySelector('#questionPosition'),
  chapter: document.querySelector('#questionChapter'),
  difficulty: document.querySelector('#questionDifficulty'),
  prompt: document.querySelector('#questionPrompt'),
  tagList: document.querySelector('#tagList'),
  choices: document.querySelector('#choices'),
  feedback: document.querySelector('#feedback'),
  flashcardAnswer: document.querySelector('#flashcardAnswer'),
  prevBtn: document.querySelector('#prevBtn'),
  nextBtn: document.querySelector('#nextBtn'),
  showAnswerBtn: document.querySelector('#showAnswerBtn'),
  bookmarkBtn: document.querySelector('#bookmarkBtn'),
  shuffleBtn: document.querySelector('#shuffleBtn'),
  resetBtn: document.querySelector('#resetBtn'),
  reviewMap: document.querySelector('#reviewMap'),
  studyFocus: document.querySelector('#studyFocus')
};

const STORAGE_KEY = 'ink-ledger-progress-v1';
let allQuestions = [];
let filteredQuestions = [];
let currentIndex = 0;
let progress = loadProgress();

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { answers: {}, bookmarks: [] };
  } catch {
    return { answers: {}, bookmarks: [] };
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

async function loadQuestions() {
  try {
    const response = await fetch('questions.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not load questions.json (${response.status})`);
    allQuestions = await response.json();
    filteredQuestions = [...allQuestions];
    setupFilters();
    render();
  } catch (error) {
    els.prompt.textContent = 'Unable to load questions.json';
    els.studyFocus.innerHTML = 'Make sure <code>questions.json</code> is in the same folder as <code>index.html</code>. If you are testing locally, run a small local server instead of opening the file directly.';
    console.error(error);
  }
}

function setupFilters() {
  const chapters = ['All Chapters', ...new Set(allQuestions.map(q => q.chapter))];
  els.chapterFilter.innerHTML = chapters.map(ch => `<option value="${escapeHtml(ch)}">${escapeHtml(ch)}</option>`).join('');
  els.totalCount.textContent = allQuestions.length;
}

function applyFilters() {
  const chapter = els.chapterFilter.value;
  const query = els.searchInput.value.trim().toLowerCase();
  filteredQuestions = allQuestions.filter(q => {
    const chapterMatch = chapter === 'All Chapters' || q.chapter === chapter;
    const searchable = [q.prompt, q.explanation, q.unit, q.chapter, q.difficulty, ...(q.tags || []), ...(q.choices || [])].join(' ').toLowerCase();
    return chapterMatch && (!query || searchable.includes(query));
  });
  currentIndex = Math.min(currentIndex, Math.max(filteredQuestions.length - 1, 0));
  render();
}

function render() {
  renderStats();
  renderQuestion();
  renderReviewMap();
}

function renderStats() {
  const answerValues = Object.values(progress.answers);
  const answered = answerValues.length;
  const correct = answerValues.filter(a => a.correct).length;
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;
  els.answeredStat.textContent = answered;
  els.correctStat.textContent = correct;
  els.accuracyStat.textContent = `${accuracy}%`;
  els.bookmarkStat.textContent = progress.bookmarks.length;
}

function renderQuestion() {
  if (!filteredQuestions.length) {
    els.position.textContent = 'No questions';
    els.chapter.textContent = 'Try another filter';
    els.difficulty.textContent = '—';
    els.prompt.textContent = 'No matching questions found.';
    els.tagList.innerHTML = '';
    els.choices.innerHTML = '';
    els.feedback.classList.add('hidden');
    els.flashcardAnswer.classList.add('hidden');
    els.showAnswerBtn.classList.add('hidden');
    els.bookmarkBtn.disabled = true;
    els.prevBtn.disabled = true;
    els.nextBtn.disabled = true;
    return;
  }

  const q = filteredQuestions[currentIndex];
  const saved = progress.answers[q.id];
  const mode = els.modeSelect.value;
  const bookmarked = progress.bookmarks.includes(q.id);

  els.position.textContent = `Question ${currentIndex + 1} of ${filteredQuestions.length}`;
  els.chapter.textContent = `${q.chapter} · ${q.unit}`;
  els.difficulty.textContent = q.difficulty;
  els.prompt.textContent = q.prompt;
  els.tagList.innerHTML = (q.tags || []).map(tag => `<span>${escapeHtml(tag)}</span>`).join('');
  els.bookmarkBtn.textContent = bookmarked ? 'Bookmarked' : 'Bookmark';
  els.bookmarkBtn.classList.toggle('bookmarked', bookmarked);
  els.bookmarkBtn.disabled = false;
  els.prevBtn.disabled = currentIndex === 0;
  els.nextBtn.disabled = currentIndex === filteredQuestions.length - 1;
  els.feedback.classList.add('hidden');
  els.flashcardAnswer.classList.add('hidden');
  els.feedback.innerHTML = '';
  els.flashcardAnswer.innerHTML = '';
  els.studyFocus.textContent = saved ? q.explanation : 'Answer the question to unlock the explanation. Use the review map to jump around.';

  if (mode === 'flashcard') {
    renderFlashcard(q);
  } else {
    renderQuiz(q, saved);
  }
}

function renderQuiz(q, saved) {
  els.showAnswerBtn.classList.add('hidden');
  els.choices.innerHTML = q.choices.map((choice, idx) => {
    const stateClass = saved
      ? idx === q.answerIndex
        ? 'correct'
        : idx === saved.selectedIndex
          ? 'incorrect'
          : ''
      : '';
    return `<button class="choice ${stateClass}" type="button" data-index="${idx}" ${saved ? 'disabled' : ''}>
      <strong>${String.fromCharCode(65 + idx)}.</strong> ${escapeHtml(choice)}
    </button>`;
  }).join('');

  els.choices.querySelectorAll('.choice').forEach(button => {
    button.addEventListener('click', () => chooseAnswer(Number(button.dataset.index)));
  });

  if (saved) showFeedback(q, saved.correct, saved.selectedIndex);
}

function renderFlashcard(q) {
  els.choices.innerHTML = q.choices.map((choice, idx) => `<div class="choice"><strong>${String.fromCharCode(65 + idx)}.</strong> ${escapeHtml(choice)}</div>`).join('');
  els.showAnswerBtn.classList.remove('hidden');
  els.showAnswerBtn.textContent = 'Show Answer';
}

function chooseAnswer(selectedIndex) {
  const q = filteredQuestions[currentIndex];
  const correct = selectedIndex === q.answerIndex;
  progress.answers[q.id] = { selectedIndex, correct, answeredAt: new Date().toISOString() };
  saveProgress();
  render();
}

function showFeedback(q, correct, selectedIndex) {
  els.feedback.classList.remove('hidden');
  const answerLabel = `${String.fromCharCode(65 + q.answerIndex)}. ${escapeHtml(q.choices[q.answerIndex])}`;
  const selectedLabel = `${String.fromCharCode(65 + selectedIndex)}. ${escapeHtml(q.choices[selectedIndex])}`;
  els.feedback.innerHTML = `
    <strong>${correct ? 'Correct.' : 'Not quite.'}</strong><br>
    Your answer: ${selectedLabel}<br>
    Correct answer: ${answerLabel}<br>
    <span>${escapeHtml(q.explanation)}</span>
  `;
  els.studyFocus.textContent = q.explanation;
}

function showFlashcardAnswer() {
  const q = filteredQuestions[currentIndex];
  if (!q) return;
  const answerLabel = `${String.fromCharCode(65 + q.answerIndex)}. ${escapeHtml(q.choices[q.answerIndex])}`;
  els.flashcardAnswer.classList.toggle('hidden');
  els.flashcardAnswer.innerHTML = `<strong>Answer:</strong> ${answerLabel}<br>${escapeHtml(q.explanation)}`;
  els.showAnswerBtn.textContent = els.flashcardAnswer.classList.contains('hidden') ? 'Show Answer' : 'Hide Answer';
  els.studyFocus.textContent = q.explanation;
}

function renderReviewMap() {
  els.reviewMap.innerHTML = filteredQuestions.map((q, idx) => {
    const saved = progress.answers[q.id];
    const state = saved ? (saved.correct ? 'done' : 'missed') : '';
    return `<button class="jump ${idx === currentIndex ? 'active' : ''} ${state}" type="button" data-index="${idx}" title="${escapeHtml(q.unit)}">${idx + 1}</button>`;
  }).join('');
  els.reviewMap.querySelectorAll('.jump').forEach(button => {
    button.addEventListener('click', () => {
      currentIndex = Number(button.dataset.index);
      render();
    });
  });
}

function toggleBookmark() {
  const q = filteredQuestions[currentIndex];
  if (!q) return;
  const set = new Set(progress.bookmarks);
  set.has(q.id) ? set.delete(q.id) : set.add(q.id);
  progress.bookmarks = [...set];
  saveProgress();
  render();
}

function shuffleQuestions() {
  for (let i = filteredQuestions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [filteredQuestions[i], filteredQuestions[j]] = [filteredQuestions[j], filteredQuestions[i]];
  }
  currentIndex = 0;
  render();
}

function resetProgress() {
  const ok = confirm('Reset all answers and bookmarks for this app?');
  if (!ok) return;
  progress = { answers: {}, bookmarks: [] };
  saveProgress();
  render();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

els.chapterFilter.addEventListener('change', applyFilters);
els.modeSelect.addEventListener('change', render);
els.searchInput.addEventListener('input', applyFilters);
els.prevBtn.addEventListener('click', () => { currentIndex = Math.max(0, currentIndex - 1); render(); });
els.nextBtn.addEventListener('click', () => { currentIndex = Math.min(filteredQuestions.length - 1, currentIndex + 1); render(); });
els.showAnswerBtn.addEventListener('click', showFlashcardAnswer);
els.bookmarkBtn.addEventListener('click', toggleBookmark);
els.shuffleBtn.addEventListener('click', shuffleQuestions);
els.resetBtn.addEventListener('click', resetProgress);

loadQuestions();
