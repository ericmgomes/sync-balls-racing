import './styles/main.css';
import { Game } from './game/Game';
import { getRating, PHYSICS } from './game/config';
import { createSeed, generatePuzzle, parseSeed } from './generation/generatePuzzle';
import { InputManager } from './input/InputManager';
import { Renderer } from './rendering/Renderer';
import { BALL_LIFT, projectPoint } from './rendering/projection';
import { saveResult, startAttempt } from './storage/scores';

const icons = {
  reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 10a8 8 0 1 1 1 7M4 4v6h6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m17 3 4 4-4 4M3 7h3c5 0 7 10 12 10h3M17 13l4 4-4 4M3 17h3c2 0 3-2 4-4m4-4c1-1 2-2 4-2h3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m10 13 4-4m-6 6-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 4 1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" transform="translate(2 1) scale(.9)" stroke-linecap="round"/></svg>',
};

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="shell">
    <header class="masthead">
      <a class="brand" href="./" aria-label="Sync Balls Racing, início">
        <svg class="brand-mark" viewBox="0 0 40 40" fill="none" stroke-width="2.7" stroke-linecap="round" aria-hidden="true"><path d="M8 7v8c0 10 24 5 24 18" stroke="#d38d76"/><path d="M20 7c16 11-16 15 0 26" stroke="#bdad69"/><path d="M32 7v6c0 10-24 9-24 20" stroke="#6f9b84"/></svg>
        <span>Sync Balls Racing<span class="brand-period">.</span></span>
      </a>
      <span class="edition"><span></span> UM PEQUENO JOGO DE TEMPO</span>
    </header>

    <section class="intro" aria-labelledby="game-title">
      <div>
        <p class="eyebrow">CAMINHOS DIFERENTES. UM SÓ ENCONTRO.</p>
        <h1 id="game-title">Encontre o mesmo <em>instante.</em></h1>
        <p class="instructions">A primeira chegada fecha a faixa.<br class="mobile-break"> Cheguem juntas para passar: tolerância de ${PHYSICS.finishToleranceMs} ms.</p>
      </div>
      <div class="intro-dots" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
    </section>

    <section class="game-board" aria-label="Puzzle de sincronia">
      <div class="board-toolbar">
        <span class="board-caption"><span class="live-dot"></span><span id="phase">PRONTO QUANDO VOCÊ ESTIVER</span></span>
        <span class="elapsed" aria-label="Tempo da tentativa"><span id="timer">0.000</span><small>s</small></span>
      </div>
      <div class="track-stage">
        <canvas id="game-canvas" aria-label="Seis pistas coloridas com trajetórias diferentes. Libere cada bola pelos botões ou pelas teclas 1 a 6."></canvas>
        <div id="launchers" class="launchers" role="group" aria-label="Liberar bolas"></div>
      </div>
      <div class="board-bottom" id="board-bottom">
        <div class="result-mark" id="result-mark" aria-hidden="true">↘<span>↙</span></div>
        <div class="status-copy" role="status" aria-live="polite" aria-atomic="true">
          <h2 id="status-title">Tudo começa com a primeira bola.</h2>
          <p id="status-message">Observe os caminhos. Descubra o ritmo.</p>
        </div>
        <span class="status-tag" id="status-tag">SEM PRESSA</span>
      </div>
    </section>

    <section class="game-controls" aria-label="Controles e resultados">
      <div class="scoreboard">
        <div class="stat"><span>TENTATIVA</span><strong id="attempt">01</strong></div>
        <span class="stat-divider"></span>
        <div class="stat"><span>MELHOR RESULTADO</span><strong id="best">— <small>ms</small></strong></div>
      </div>
      <div class="actions">
        <button class="button button-secondary" id="new-puzzle">${icons.shuffle}<span>Novo puzzle</span></button>
        <button class="button button-primary" id="retry">${icons.reset}<span>Tentar novamente</span></button>
      </div>
    </section>

    <details id="arrival-details" class="arrival-details" hidden>
      <summary>Tempos de chegada <span>em relação à primeira liberação</span></summary>
      <div class="table-scroll"><table><thead><tr><th>Bola</th><th>Chegada</th><th>Após a primeira</th></tr></thead><tbody id="arrival-rows"></tbody></table></div>
    </details>

    <footer class="footer">
      <p class="keyboard-hint"><span class="desktop-hint">Use as teclas <kbd>1</kbd> – <kbd>6</kbd> ou clique nas bolas.</span><span class="touch-hint">Toque nas bolas para soltá-las.</span><span class="hint-second"> O segredo está no intervalo.</span></p>
      <button id="share" class="seed-button" title="Copiar link deste puzzle">${icons.link}<span id="seed-label"></span></button>
    </footer>
    <p id="share-feedback" class="share-feedback" role="status" aria-live="polite"></p>
    <input id="share-url" class="share-url" aria-label="Link para compartilhar este puzzle" readonly hidden />
    <section id="debug" class="debug" aria-label="Informações de depuração" hidden></section>
    <p class="closing-note">um pouco de observação. um pouco de intuição. mais uma tentativa.</p>
  </main>
`;

function element<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

const currentUrl = new URL(window.location.href);
const initialSeed = parseSeed(currentUrl.searchParams.get('puzzle')) ?? createSeed();
let game = new Game(generatePuzzle(initialSeed));
let score = startAttempt(initialSeed);
let resultSaved = false;
let lastSignature = '';
let animationId = 0;
let lastDebugUpdate = 0;
let feedbackTimeout = 0;
const renderer = new Renderer(element<HTMLCanvasElement>('game-canvas'), game.puzzle);
const debugEnabled = currentUrl.searchParams.get('debug') === '1';
const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const buttons: HTMLButtonElement[] = [];

function updateUrl(seed: number, replace = false) {
  const url = new URL(window.location.href);
  url.searchParams.set('puzzle', String(seed));
  window.history[replace ? 'replaceState' : 'pushState']({}, '', url);
}

function release(trackId: number) {
  if (game.release(trackId, performance.now())) syncInterface();
}

const input = new InputManager(release, game.puzzle.tracks.length);

function makeLaunchers() {
  const launchers = element('launchers');
  launchers.replaceChildren();
  buttons.length = 0;
  for (const track of game.puzzle.tracks) {
    const button = document.createElement('button');
    const start = projectPoint(track.path[0], BALL_LIFT);
    button.className = 'launch-button';
    button.style.left = `${start.x * 100}%`;
    button.style.top = `${start.y * 100}%`;
    button.style.setProperty('--track-color', track.color);
    button.setAttribute('aria-label', `Liberar bola ${track.name}`);
    button.setAttribute('aria-keyshortcuts', String(track.id + 1));
    button.title = `${track.name} · tecla ${track.id + 1}`;
    button.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'touch' && (!event.isPrimary || event.button !== 0)) return;
      event.preventDefault();
      release(track.id);
    });
    button.addEventListener('click', () => release(track.id));
    buttons.push(button);
    launchers.append(button);
  }
}

function updateScores() {
  element('attempt').textContent = String(score.attempts).padStart(2, '0');
  element('best').innerHTML = `${score.bestSpread === null ? '—' : integer.format(score.bestSpread)} <small>ms</small>`;
}

function syncInterface() {
  const finished = game.balls.filter((ball) => ball.state === 'finished').length;
  const released = game.balls.filter((ball) => ball.state !== 'idle').length;
  const signature = `${game.state}:${finished}:${released}`;
  if (signature === lastSignature) return;
  lastSignature = signature;
  for (const [index, button] of buttons.entries()) button.disabled = game.balls[index].state !== 'idle' || game.firstArrivalAt !== null;
  element('board-bottom').classList.toggle('has-result', game.state === 'FINISHED');
  element('arrival-details').hidden = game.state !== 'FINISHED';
  element('phase').textContent = game.state === 'READY' ? 'PRONTO QUANDO VOCÊ ESTIVER' : game.state === 'RUNNING' ? `${finished} DE ${game.balls.length} NA CHEGADA` : 'CADA TENTATIVA ENSINA UM POUCO';

  if (game.result && !resultSaved) {
    resultSaved = true;
    const failure = game.result.outcome === 'failure';
    element('board-bottom').classList.toggle('has-failure', failure);
    element('phase').textContent = failure ? 'A CHEGADA FECHOU' : 'TODAS JUNTAS. PROVA CONCLUÍDA.';
    const previousBest = score.bestSpread;
    if (game.result.spread !== null) score = saveResult(game.puzzle.seed, game.result.spread);
    updateScores();
    const rating = getRating(game.result.spread ?? Infinity);
    element('status-title').innerHTML = failure ? 'Uma bola chegou antes. A faixa fechou.' : `<span class="spread-value">${integer.format(game.result.spread!)}</span> <span class="spread-unit">ms</span><span class="rating">${rating.label}</span>`;
    element('status-message').textContent = failure ? 'As outras ficam retidas na faixa. Solte antes as que ficaram para trás.' : rating.message;
    const newBest = game.result.spread !== null && (previousBest === null || game.result.spread < previousBest);
    element('status-tag').textContent = newBest ? 'MELHOR MARCA' : 'MAIS UMA?';
    element('status-tag').classList.toggle('is-best', newBest);
    element('result-mark').innerHTML = failure ? '<span class="finish-symbol">×</span>' : '<span class="finish-symbol">≋</span>';
    element('arrival-rows').innerHTML = game.puzzle.tracks.map((track) => {
      const arrival = game.result!.arrivals.find((item) => item.trackId === track.id);
      return `<tr><th><span class="color-dot" style="background:${track.color}"></span>${track.id + 1} · ${track.name}</th><td>${arrival ? `${((arrival.arrivedAt - game.startedAt!) / 1000).toFixed(3)} s` : 'Não concluiu'}</td><td>${arrival ? `+${arrival.offset.toFixed(1)} ms` : 'Bloqueada'}</td></tr>`;
    }).join('');
  } else if (game.state === 'RUNNING') {
    element('status-title').textContent = released === game.balls.length ? 'Agora, observe o encontro.' : 'Cada caminho tem seu próprio tempo.';
    element('status-message').textContent = released === game.balls.length ? 'Quem chega primeiro? Quem precisa sair antes?' : `${game.balls.length - released} ${game.balls.length - released === 1 ? 'bola esperando seu toque.' : 'bolas esperando seu toque.'}`;
    element('status-tag').textContent = 'EM MOVIMENTO';
  } else if (game.state === 'READY') {
    element('board-bottom').classList.remove('has-failure');
    element('status-title').textContent = 'Tudo começa com a primeira bola.';
    element('status-message').textContent = 'Cheguem juntas. A primeira bola aciona a faixa antes da chegada.';
    element('status-tag').textContent = 'SEM PRESSA';
    element('status-tag').classList.remove('is-best');
    element('result-mark').innerHTML = '↘<span>↙</span>';
  }
}

function updateDebug() {
  if (!debugEnabled) return;
  const longest = Math.max(...game.puzzle.tracks.map((track) => track.travelDuration));
  const debug = element('debug');
  debug.hidden = false;
  debug.innerHTML = `<h2>Debug · Seed #${game.puzzle.seed} · ${game.state}</h2><p>Relógio: performance.now(), em ms. Atraso ideal relativo à liberação da pista mais lenta.</p><div class="table-scroll"><table><thead><tr><th>Pista</th><th>Duração</th><th>Liberação</th><th>Chegada</th><th>Atraso ideal</th></tr></thead><tbody>${game.puzzle.tracks.map((track, index) => {
    const ball = game.balls[index];
    return `<tr><th>${track.id + 1} · ${track.name}</th><td>${track.travelDuration.toFixed(2)}</td><td>${ball.releasedAt?.toFixed(2) ?? '—'}</td><td>${ball.arrivedAt?.toFixed(2) ?? '—'}</td><td>${(longest - track.travelDuration).toFixed(2)}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function prepareAttempt() {
  resultSaved = false;
  lastSignature = '';
  score = startAttempt(game.puzzle.seed);
  element('seed-label').textContent = `Seed #${game.puzzle.seed}`;
  element('share-feedback').textContent = '';
  element('share-url').hidden = true;
  (element('arrival-details') as HTMLDetailsElement).open = false;
  makeLaunchers();
  updateScores();
  syncInterface();
  updateDebug();
}

function retry() {
  game.reset();
  prepareAttempt();
}

function loadPuzzle(seed: number) {
  game = new Game(generatePuzzle(seed));
  renderer.setPuzzle(game.puzzle);
  prepareAttempt();
}

function newPuzzle() {
  let seed = createSeed();
  while (seed === game.puzzle.seed) seed = createSeed();
  updateUrl(seed);
  loadPuzzle(seed);
}

function onPopState() {
  const seed = parseSeed(new URL(window.location.href).searchParams.get('puzzle')) ?? createSeed();
  updateUrl(seed, true);
  loadPuzzle(seed);
}

async function sharePuzzle() {
  window.clearTimeout(feedbackTimeout);
  try {
    await navigator.clipboard.writeText(window.location.href);
    element('share-feedback').textContent = 'Link copiado. Convide alguém para encontrar o mesmo instante.';
  } catch {
    const field = element<HTMLInputElement>('share-url');
    field.hidden = false;
    field.value = window.location.href;
    field.select();
    element('share-feedback').textContent = 'Copie o link abaixo para compartilhar este puzzle.';
  }
  feedbackTimeout = window.setTimeout(() => { element('share-feedback').textContent = ''; }, 5000);
}

element('retry').addEventListener('click', retry);
element('new-puzzle').addEventListener('click', newPuzzle);
element('share').addEventListener('click', sharePuzzle);
window.addEventListener('popstate', onPopState);
updateUrl(initialSeed, true);
element('seed-label').textContent = `Seed #${initialSeed}`;
makeLaunchers();
updateScores();
syncInterface();
updateDebug();

function frame(now: number) {
  game.update(now);
  renderer.draw(game, now);
  element('timer').textContent = (game.elapsed(now) / 1000).toFixed(3);
  syncInterface();
  if (debugEnabled && now - lastDebugUpdate > 100) {
    updateDebug();
    lastDebugUpdate = now;
  }
  animationId = requestAnimationFrame(frame);
}

animationId = requestAnimationFrame(frame);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cancelAnimationFrame(animationId);
    window.clearTimeout(feedbackTimeout);
    input.destroy();
    renderer.destroy();
    window.removeEventListener('popstate', onPopState);
  });
}

