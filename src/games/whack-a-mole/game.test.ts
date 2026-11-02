import { describe, expect, it } from 'vitest';
import {
  POINTS_PER_WHACK,
  ROUND_SECONDS,
  createState,
  popUp,
  spawnGap,
  step,
  upTime,
  whack,
} from './game';

const first = () => 0;

describe('whack-a-mole', () => {
  it('starts with a full clock, no score and every mole down', () => {
    const state = createState();
    expect(state.holes).toHaveLength(9);
    expect(state.holes.every((h) => h.up === 0)).toBe(true);
    expect(state.timeLeft).toBe(ROUND_SECONDS);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('playing');
  });

  it('pops a mole up once the first gap has passed', () => {
    const state = createState();
    step(state, spawnGap(state) + 0.01, first);
    expect(state.holes.filter((h) => h.up > 0)).toHaveLength(1);
  });

  it('drops a mole back down when its time is up', () => {
    const state = createState();
    popUp(state, first);
    const hole = state.holes[0];
    state.nextMole = 100;
    step(state, hole.up + 0.01);
    expect(hole.up).toBe(0);
  });

  it('only pops moles into empty holes', () => {
    const state = createState();
    for (let i = 0; i < 9; i++) expect(popUp(state, first)).toBe(true);
    expect(popUp(state, first)).toBe(false);
  });

  it('scores a whack on a mole that is up, and drops it', () => {
    const state = createState();
    popUp(state, first);
    const hole = state.holes[0];
    expect(whack(state, hole.x + 5, hole.y - 5)).toBe(true);
    expect(state.score).toBe(POINTS_PER_WHACK);
    expect(hole.up).toBe(0);
  });

  it('scores a whack on the lower corner of a mole body', () => {
    const state = createState();
    popUp(state, first);
    const hole = state.holes[0];
    expect(whack(state, hole.x + 34, hole.y + 20)).toBe(true);
    expect(state.score).toBe(POINTS_PER_WHACK);
    expect(hole.up).toBe(0);
  });

  it('scores nothing just outside the drawn mole', () => {
    const state = createState();
    popUp(state, first);
    const hole = state.holes[0];
    expect(whack(state, hole.x + 40, hole.y + 20)).toBe(false);
    expect(whack(state, hole.x + 30, hole.y - 30)).toBe(false);
    expect(state.score).toBe(0);
    expect(hole.up).toBeGreaterThan(0);
  });

  it('scores nothing for whacking an empty hole or a mole twice', () => {
    const state = createState();
    const hole = state.holes[0];
    expect(whack(state, hole.x, hole.y)).toBe(false);
    popUp(state, first);
    whack(state, hole.x, hole.y);
    expect(whack(state, hole.x, hole.y)).toBe(false);
    expect(state.score).toBe(POINTS_PER_WHACK);
  });

  it('pops moles faster and for less time as the round goes on', () => {
    const state = createState();
    const early = { gap: spawnGap(state), up: upTime(state) };
    state.timeLeft = 1;
    expect(spawnGap(state)).toBeLessThan(early.gap);
    expect(upTime(state)).toBeLessThan(early.up);
  });

  it('ends the round when the clock runs out, and stops scoring', () => {
    const state = createState();
    popUp(state, first);
    state.timeLeft = 0.01;
    step(state, 0.05);
    expect(state.phase).toBe('over');
    expect(state.timeLeft).toBe(0);
    expect(state.holes.every((h) => h.up === 0)).toBe(true);
    state.holes[0].up = 1;
    expect(whack(state, state.holes[0].x, state.holes[0].y)).toBe(false);
    expect(state.score).toBe(0);
  });
});
