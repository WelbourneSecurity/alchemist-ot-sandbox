import { useCallback, useEffect, useState } from "react";
import { App } from "../App";
import { Dashboard, type DashboardIntent } from "./Dashboard";
import { initialView, LAST_VIEW_STORAGE_KEY, type AppView } from "../lib/appView";

const THEME_KEY = "ot-sandbox-theme";

function initialTheme(): "dark" | "light" {
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === "dark" || stored === "light") {
    return stored;
  }
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function readLastView(): AppView | null {
  const stored = window.localStorage.getItem(LAST_VIEW_STORAGE_KEY);
  return stored === "home" || stored === "app" ? stored : null;
}

/**
 * Top-level shell: the home dashboard or the workbench. The hash deep-links each (`#home` / `#app`),
 * a reload returns to the last view, and the dashboard is the default front door. Owns the theme so
 * both views match before the heavy workbench mounts.
 */
export function Root() {
  const [view, setView] = useState<AppView>(() => initialView(window.location.hash, readLastView()));
  const [intent, setIntent] = useState<DashboardIntent | undefined>(undefined);
  const [theme, setTheme] = useState<"dark" | "light">(() => initialTheme());

  useEffect(() => {
    document.body.classList.toggle("light-mode", theme === "light");
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem(LAST_VIEW_STORAGE_KEY, view);
  }, [view]);

  useEffect(() => {
    const onHashChange = () => setView(initialView(window.location.hash, readLastView()));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const toggleTheme = useCallback(() => setTheme((current) => (current === "dark" ? "light" : "dark")), []);

  const enter = useCallback((nextIntent?: DashboardIntent) => {
    setIntent(nextIntent);
    if (window.location.hash === "#app") {
      setView("app");
    } else {
      window.location.hash = "app";
    }
  }, []);

  const goHome = useCallback(() => {
    setIntent(undefined);
    if (window.location.hash === "#home") {
      setView("home");
    } else {
      window.location.hash = "home";
    }
  }, []);

  if (view === "home") {
    return <Dashboard onEnter={enter} theme={theme} onToggleTheme={toggleTheme} />;
  }

  return <App onGoHome={goHome} initialIntent={intent} theme={theme} onToggleTheme={toggleTheme} />;
}
