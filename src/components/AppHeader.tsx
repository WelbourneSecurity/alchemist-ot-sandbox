import { BookOpen, Download, ImageDown, LayoutGrid, Moon, Printer, Radar, Redo2, RotateCcw, ScrollText, Sun, Upload, Undo2 } from "lucide-react";
import { useRef } from "react";
import type { OtProject } from "../models/types";
import { ScoreGauge } from "./ScoreGauge";

interface AppHeaderProps {
  project: OtProject;
  score: number;
  theme: "dark" | "light";
  canUndo: boolean;
  canRedo: boolean;
  onProjectNameChange: (name: string) => void;
  onImport: (file: File) => void;
  onImportScan: () => void;
  onExportJson: () => void;
  onExportSvg: () => void;
  onPrintReport: () => void;
  onBrowseScenarios: () => void;
  onOpenKnowledgeBase: () => void;
  onOpenMethodology: () => void;
  onNewBlank: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleTheme: () => void;
}

function scoreBand(score: number) {
  if (score >= 82) {
    return "strong";
  }
  if (score >= 64) {
    return "fair";
  }
  if (score >= 45) {
    return "weak";
  }
  return "critical";
}

export function AppHeader({
  project,
  score,
  theme,
  canUndo,
  canRedo,
  onProjectNameChange,
  onImport,
  onImportScan,
  onExportJson,
  onExportSvg,
  onPrintReport,
  onBrowseScenarios,
  onOpenKnowledgeBase,
  onOpenMethodology,
  onNewBlank,
  onUndo,
  onRedo,
  onToggleTheme
}: AppHeaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <header className="app-header">
      <a
        className="brand-block"
        href="https://welbournesecurity.com"
        title="Back to welbournesecurity.com"
        aria-label="Welbourne Security: back to main site"
      >
        <div className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 48 48" focusable="false">
            <circle cx="24" cy="24" r="18" className="brand-mark-ring" />
            <circle cx="24" cy="24" r="11" className="brand-mark-ring" />
            <path d="M24 6 V42" className="brand-mark-grid" />
            <path d="M6 24 H42" className="brand-mark-grid" />
            <circle cx="24" cy="24" r="3.2" className="brand-mark-core" />
            <path d="M24 6 A18 18 0 0 1 42 24" className="brand-mark-sweep" />
          </svg>
        </div>
        <div>
          <h1>Welbourne Security</h1>
          <p>Alchemist OT Sandbox</p>
        </div>
      </a>

      <div className="project-controls">
        <label className="project-name-field">
          <span>Project</span>
          <input value={project.name} onChange={(event) => onProjectNameChange(event.target.value)} />
        </label>

        <div className="header-score" title={`Advisory security rating ${score} / 100`}>
          <ScoreGauge score={score} band={scoreBand(score)} size={40} thickness={9} />
        </div>
      </div>

      <nav className="toolbar" aria-label="Project actions">
        <button type="button" className="icon-button" title="Undo" onClick={onUndo} disabled={!canUndo}>
          <Undo2 size={18} />
        </button>
        <button type="button" className="icon-button" title="Redo" onClick={onRedo} disabled={!canRedo}>
          <Redo2 size={18} />
        </button>
        <button type="button" className="text-button" onClick={onNewBlank}>
          <RotateCcw size={16} />
          Blank
        </button>
        <button type="button" className="text-button" onClick={onBrowseScenarios} title="Browse sector scenarios">
          <LayoutGrid size={16} />
          Scenarios
        </button>
        <button type="button" className="text-button" onClick={onOpenKnowledgeBase} title="OT knowledge base & reference">
          <BookOpen size={16} />
          Reference
        </button>
        <button type="button" className="text-button" onClick={onOpenMethodology} title="How Alchemist scores and assesses">
          <ScrollText size={16} />
          Method
        </button>
        <button type="button" className="text-button" onClick={() => inputRef.current?.click()}>
          <Upload size={16} />
          Import
        </button>
        <button type="button" className="text-button" onClick={onImportScan} title="Import an Nmap, Zeek, GraphML or CSV scan">
          <Radar size={16} />
          Scan
        </button>
        <button type="button" className="text-button" onClick={onExportJson}>
          <Download size={16} />
          JSON
        </button>
        <button type="button" className="text-button" onClick={onExportSvg}>
          <ImageDown size={16} />
          SVG
        </button>
        <button type="button" className="text-button primary" onClick={onPrintReport}>
          <Printer size={16} />
          Report
        </button>
        <button
          type="button"
          className="theme-toggle"
          onClick={onToggleTheme}
          aria-label="Toggle light and dark mode"
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </nav>

      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept="application/json,.json"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onImport(file);
            event.target.value = "";
          }
        }}
      />
    </header>
  );
}
