// Key rotation manager for Gemma and Gemini GenAI requests.
// Rotates across configured keys whenever rate limits (429), quota limits,
// or transient errors occur, avoiding user-facing disruption.

export class KeyPool {
  private keys: string[] = [];
  private currentIndex: number = 0;

  constructor(envKeys?: string[]) {
    if (envKeys && envKeys.length > 0) {
      this.keys = envKeys.filter((k) => k && k.trim().length > 0);
    } else {
      const single = process.env.GEMMA_API_KEY || process.env.GEMINI_API_KEY;
      const multi = process.env.GEMMA_API_KEYS || process.env.GEMINI_API_KEYS;
      const list: string[] = [];
      if (multi) {
        list.push(...multi.split(",").map((s) => s.trim()));
      }
      if (single && !list.includes(single.trim())) {
        list.unshift(single.trim());
      }
      this.keys = list.filter((k) => k.length > 0);
    }
  }

  public get size(): number {
    return this.keys.length;
  }

  public current(): string | null {
    if (this.keys.length === 0) return null;
    return this.keys[this.currentIndex % this.keys.length];
  }

  public rotate(): string | null {
    if (this.keys.length <= 1) return this.current();
    const prev = this.currentIndex;
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    console.warn(`[KeyPool] Rotated API key from index ${prev} to ${this.currentIndex} (pool size: ${this.keys.length})`);
    return this.current();
  }

  public getAll(): string[] {
    return [...this.keys];
  }
}

export const globalKeyPool = new KeyPool();
