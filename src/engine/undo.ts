/**
 * Remembers what the viewer added, newest last, so Undo can take it back.
 * Entries that have since left the data (a new preset, Clear, an upload) are skipped by `pop` and dropped by `prune`.
 */
export class UndoStack<T> {
  private items: T[] = [];

  constructor(private limit = 200) {}

  push(item: T): void {
    this.items.push(item);
    if (this.items.length > this.limit) this.items.shift();
  }

  /** The newest entry that is still `alive`, removed from the stack. Dead entries on top are thrown away. */
  pop(alive: (item: T) => boolean = () => true): T | undefined {
    while (this.items.length) {
      const item = this.items.pop()!;
      if (alive(item)) return item;
    }
    return undefined;
  }

  /** Drop every entry that is no longer `alive`; returns how many are left. */
  prune(alive: (item: T) => boolean): number {
    this.items = this.items.filter(alive);
    return this.items.length;
  }

  clear(): void { this.items = []; }
  get size(): number { return this.items.length; }
}
