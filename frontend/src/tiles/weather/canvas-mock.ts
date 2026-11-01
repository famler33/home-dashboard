import { vi } from 'vitest';

export interface CanvasMock {
  context: Record<string, ReturnType<typeof vi.fn>>;
  images: { src: string; fail: boolean }[];
  /** Make every following tile image fail to load. */
  failTiles(): void;
  restore(): void;
}

/** jsdom has no canvas: provide a recording 2D context and an Image that loads (or fails) asynchronously. */
export function installCanvasMock(): CanvasMock {
  const context = {
    createImageData: vi.fn((width: number, height: number) => ({
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4),
    })),
    putImageData: vi.fn(),
    drawImage: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
  } as Record<string, ReturnType<typeof vi.fn>>;

  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => context,
  ) as unknown as typeof originalGetContext;

  const originalImage = globalThis.Image;
  const images: { src: string; fail: boolean }[] = [];
  let failing = false;
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    width = 256;
    height = 256;
    private source = '';
    get src(): string {
      return this.source;
    }
    set src(value: string) {
      this.source = value;
      const fail = failing;
      images.push({ src: value, fail });
      queueMicrotask(() => (fail ? this.onerror?.() : this.onload?.()));
    }
  }
  globalThis.Image = FakeImage as unknown as typeof Image;

  return {
    context,
    images,
    failTiles() {
      failing = true;
    },
    restore() {
      HTMLCanvasElement.prototype.getContext = originalGetContext;
      globalThis.Image = originalImage;
    },
  };
}
