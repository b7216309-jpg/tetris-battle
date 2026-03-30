import { GARBAGE_DELAY, BOARD_WIDTH } from '@tetris/shared';
import { mulberry32 } from '@tetris/shared';

export class GarbageSystem {
  constructor(seed) {
    this.rng = mulberry32(seed + 9999); // Different seed offset for garbage
    this.pendingGarbage = []; // { lines, timestamp, gapColumn, delayMs }
  }

  queueGarbage(lines, timestamp, options = {}) {
    if (lines <= 0) return;

    // Same gap column for all rows in one attack batch
    const gapColumn = options.gapColumn ?? Math.floor(this.rng() * BOARD_WIDTH);
    const delayMs = options.delayMs ?? GARBAGE_DELAY;

    this.pendingGarbage.push({
      lines,
      timestamp,
      gapColumn,
      delayMs
    });
  }

  processGarbage(currentTime) {
    const ready = [];
    const remaining = [];

    for (const g of this.pendingGarbage) {
      if (currentTime - g.timestamp >= g.delayMs) {
        ready.push(g);
      } else {
        remaining.push(g);
      }
    }

    this.pendingGarbage = remaining;
    return ready;
  }

  offsetGarbage(attackLines) {
    let remaining = attackLines;

    while (remaining > 0 && this.pendingGarbage.length > 0) {
      const oldest = this.pendingGarbage[0];
      if (oldest.lines <= remaining) {
        remaining -= oldest.lines;
        this.pendingGarbage.shift();
      } else {
        oldest.lines -= remaining;
        remaining = 0;
      }
    }

    return remaining; // Lines that should be sent to opponent
  }

  getPendingLines() {
    return this.pendingGarbage.reduce((sum, g) => sum + g.lines, 0);
  }

  clear() {
    this.pendingGarbage = [];
  }
}
