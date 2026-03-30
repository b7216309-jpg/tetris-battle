import { mulberry32 } from '@tetris/shared';
import { PIECE_TYPES } from '@tetris/shared';

export class PieceGenerator {
  constructor(seed) {
    this.rng = mulberry32(seed);
    this.bag = [];
    this.nextBag = [];
    this._fillBag();
    this._fillNextBag();
  }

  _shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
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
}
