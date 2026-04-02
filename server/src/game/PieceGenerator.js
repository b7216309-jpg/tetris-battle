import { PIECE_TYPES } from '@tetris/shared';

export class PieceGenerator {
  constructor(seed) {
    this.seed = seed | 0;
    this.rngState = this.seed;
    this.bag = [];
    this.nextBag = [];
    this._fillBag();
    this._fillNextBag();
  }

  _nextRandom() {
    this.rngState = (this.rngState + 0x6D2B79F5) | 0;
    let t = Math.imul(this.rngState ^ (this.rngState >>> 15), 1 | this.rngState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  _shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this._nextRandom() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  _fillBag() {
    this.bag = this._shuffleArray([...PIECE_TYPES]);
  }

  _fillNextBag() {
    this.nextBag = this._shuffleArray([...PIECE_TYPES]);
  }

  next() {
    if (this.bag.length === 0) {
      this.bag = this.nextBag;
      this._fillNextBag();
    }
    return this.bag.shift();
  }

  peek(count) {
    const result = [];
    const combined = [...this.bag, ...this.nextBag];
    for (let i = 0; i < count && i < combined.length; i++) {
      result.push(combined[i]);
    }
    return result;
  }

  getState() {
    return {
      seed: this.seed,
      rngState: this.rngState,
      bag: [...this.bag],
      nextBag: [...this.nextBag]
    };
  }

  loadState(state = null) {
    if (!state || !Array.isArray(state.bag) || !Array.isArray(state.nextBag)) {
      this.seed = this.seed | 0;
      this.rngState = this.seed;
      this.bag = [];
      this.nextBag = [];
      this._fillBag();
      this._fillNextBag();
      return;
    }

    this.seed = (state.seed ?? this.seed) | 0;
    this.rngState = (state.rngState ?? this.seed) | 0;
    this.bag = [...state.bag];
    this.nextBag = [...state.nextBag];
  }
}
