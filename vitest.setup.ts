import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Runs for every test file, including the node-environment engine tests, so
// everything that touches the DOM is guarded behind a window check.
if (typeof window !== "undefined") {
  // jsdom has no layout engine; matchMedia is undefined. Stub it so components
  // that read viewport size (the mobile gate) render in tests.
  if (!window.matchMedia) {
    window.matchMedia = (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList;
  }
  afterEach(() => cleanup());
}
