// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Dashboard } from "./Dashboard";

vi.mock("../lib/heroDither", () => ({ initHeroDither: () => {} }));

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

const noop = () => {};

describe("Dashboard (desktop)", () => {
  it("renders the posture overview and model-size stats", () => {
    render(<Dashboard onEnter={noop} theme="dark" onToggleTheme={noop} isMobile={false} />);
    expect(screen.getByText(/current assessment/i)).toBeInTheDocument();
    // Model-size aside lists Assets / Conduits / Findings.
    expect(screen.getByText("Assets")).toBeInTheDocument();
    expect(screen.getByText("Findings")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /saved assessments/i })).toBeInTheDocument();
    // The workbench CTA is available on desktop (hero + command list).
    expect(screen.getAllByRole("button", { name: /open workbench/i }).length).toBeGreaterThan(0);
  });

  it("shows the desktop-only note on mobile instead of the workbench CTA", () => {
    render(<Dashboard onEnter={noop} theme="dark" onToggleTheme={noop} isMobile />);
    expect(screen.getByText(/desktop workbench/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /open workbench/i })).not.toBeInTheDocument();
  });
});
