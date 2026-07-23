// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Root } from "./Root";

// The hero uses WebGL, which jsdom has no context for; stub it out.
vi.mock("../lib/heroDither", () => ({ initHeroDither: () => {} }));

function setViewport(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  window.localStorage.clear();
  window.location.hash = "";
});
afterEach(() => vi.restoreAllMocks());

describe("Root mobile gate", () => {
  it("renders the desktop-only dashboard gate below the breakpoint", () => {
    setViewport(true);
    render(<Root />);
    expect(screen.getByText(/desktop workbench/i)).toBeInTheDocument();
  });

  it("does not show the desktop-only note on a wide viewport at home", () => {
    setViewport(false);
    render(<Root />);
    // Home dashboard renders its posture overview, not the mobile gate note.
    expect(screen.queryByText(/Open it on a larger screen/i)).not.toBeInTheDocument();
  });
});
