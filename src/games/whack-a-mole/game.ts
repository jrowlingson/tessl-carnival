import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const ROUND_SECONDS = 30;
export const POINTS_PER_WHACK = 10;
export const MOLE_RADIUS = 36;
const COLUMNS = 3;
const ROWS = 3;
/** Seconds between moles at the start and at the end of a round. */
const SPAWN_GAP = { start: 1.1, end: 0.4 };
/** Seconds a mole stays up at the start and at the end of a round. */
const UP_TIME = { start: 1.4, end: 0.6 };

export interface Hole {
  x: number;
  y: number;
  /** Seconds the mole has left above ground; 0 when it is down. */
  up: number;
  /** Seconds since the mole here was whacked, for the bonk; null when not shown. */
  bonk: number | null;
}

export interface WhackAMoleState {
  holes: Hole[];
  timeLeft: number;
  /** Seconds until the next mole pops up. */
  nextMole: number;
  score: number;
  phase: 'playing' | 'over';
}

export function createState(): WhackAMoleState {
  const holes: Hole[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLUMNS; col++) {
      holes.push({
        x: (WIDTH / COLUMNS) * (col + 0.5),
        y: 140 + row * 120,
        up: 0,
        bonk: null,
      });
    }
  }
  return { holes, timeLeft: ROUND_SECONDS, nextMole: SPAWN_GAP.start, score: 0, phase: 'playing' };
}

/** How far through the round we are, from 0 at the start to 1 at the end. */
function progress(state: WhackAMoleState): number {
  return 1 - state.timeLeft / ROUND_SECONDS;
}

/** Seconds between moles: shrinks as the round goes on. */
export function spawnGap(state: WhackAMoleState): number {
  return SPAWN_GAP.start + (SPAWN_GAP.end - SPAWN_GAP.start) * progress(state);
}

/** Seconds a new mole stays up: shrinks as the round goes on. */
export function upTime(state: WhackAMoleState): number {
  return UP_TIME.start + (UP_TIME.end - UP_TIME.start) * progress(state);
}

/** Pops a mole up in a random empty hole. Returns false if every hole is taken. */
export function popUp(state: WhackAMoleState, random: () => number = Math.random): boolean {
  const empty = state.holes.filter((h) => h.up === 0);
  if (empty.length === 0) return false;
  const hole = empty[Math.floor(random() * empty.length)];
  hole.up = upTime(state);
  hole.bonk = null;
  return true;
}

/** Whacks at a point. Scores and drops the mole if one is up there. */
export function whack(state: WhackAMoleState, x: number, y: number): boolean {
  if (state.phase !== 'playing') return false;
  const hole = state.holes.find((h) => h.up > 0 && Math.hypot(x - h.x, y - h.y) <= MOLE_RADIUS);
  if (!hole) return false;
  hole.up = 0;
  hole.bonk = 0;
  state.score += POINTS_PER_WHACK;
  return true;
}

/** Advances the game by `dt` seconds. */
export function step(state: WhackAMoleState, dt: number, random: () => number = Math.random): void {
  for (const hole of state.holes) {
    hole.up = Math.max(0, hole.up - dt);
    if (hole.bonk !== null) {
      hole.bonk += dt;
      if (hole.bonk >= 0.3) hole.bonk = null;
    }
  }
  if (state.phase !== 'playing') return;

  state.timeLeft = Math.max(0, state.timeLeft - dt);
  if (state.timeLeft === 0) {
    state.phase = 'over';
    for (const hole of state.holes) hole.up = 0;
    return;
  }

  state.nextMole -= dt;
  if (state.nextMole <= 0) {
    popUp(state, random);
    state.nextMole += spawnGap(state);
  }
}

function draw(ctx: CanvasRenderingContext2D, state: WhackAMoleState) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  for (const hole of state.holes) {
    ctx.fillStyle = colors.wood;
    ctx.beginPath();
    ctx.ellipse(hole.x, hole.y + 24, MOLE_RADIUS + 14, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.surface;
    ctx.beginPath();
    ctx.ellipse(hole.x, hole.y + 24, MOLE_RADIUS + 4, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    if (hole.up > 0) {
      ctx.fillStyle = colors.muted;
      ctx.beginPath();
      ctx.arc(hole.x, hole.y, MOLE_RADIUS, Math.PI, 0);
      ctx.lineTo(hole.x + MOLE_RADIUS, hole.y + 24);
      ctx.lineTo(hole.x - MOLE_RADIUS, hole.y + 24);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = colors.background;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(hole.x + side * 12, hole.y - 8, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = colors.stripeA;
      ctx.beginPath();
      ctx.arc(hole.x, hole.y + 4, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    if (hole.bonk !== null) {
      ctx.globalAlpha = 1 - hole.bonk / 0.3;
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(hole.x, hole.y, 16 + hole.bonk * 120, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  ctx.textAlign = 'right';
  ctx.fillText(`Time ${Math.ceil(state.timeLeft)}s`, WIDTH - 16, HEIGHT - 20);

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Time's up! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const whackAMole: CarnivalGame = {
  id: 'whack-a-mole',
  name: 'Whack-a-Mole',
  description:
    'Whack the moles before they duck back down. They get quicker as the clock runs out.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;

    const onDown = (event: PointerEvent) => {
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
        return;
      }
      const rect = canvas.getBoundingClientRect();
      whack(
        state,
        ((event.clientX - rect.left) / rect.width) * WIDTH,
        ((event.clientY - rect.top) / rect.height) * HEIGHT,
      );
    };
    canvas.addEventListener('pointerdown', onDown);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't skip the round.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(whackAMole.id, state.score);
        scoreRecorded = true;
      }
      draw(ctx, state);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointerdown', onDown);
    };
  },
};

export default whackAMole;
