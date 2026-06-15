import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { sampleProject, blankProject } from "./data/sampleProject";
import { getAssetType } from "./data/catalog";
import {
  assetYForZone,
  inferZoneFromY,
  resolveAssetX,
  snapAssetPosition,
  snapPointToZone
} from "./data/canvasLayout";
import { findReachability } from "./engine/reachability";
import { assessProject } from "./engine/scoring";
import { parseProjectJson, serializeProject } from "./engine/serialization";
import { downloadJson, downloadTopologySvg } from "./lib/exporters";
import type { Asset, AssetTypeId, CanvasMode, Conduit, Finding, OtProject, Point, ZoneId } from "./models/types";
import { AnalysisPanel } from "./components/AnalysisPanel";
import { AppHeader } from "./components/AppHeader";
import { AssetPalette } from "./components/AssetPalette";
import { CollapsedRail } from "./components/CollapsedRail";
import { CommandPalette, type Command } from "./components/CommandPalette";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { InspectorPanel } from "./components/InspectorPanel";
import { PrintableReport } from "./components/PrintableReport";
import { ShortcutsOverlay } from "./components/ShortcutsOverlay";
import { ToastViewport } from "./components/ToastViewport";
import { TopologyCanvas } from "./components/TopologyCanvas";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { usePanelLayout } from "./hooks/usePanelLayout";
import { useToasts } from "./hooks/useToasts";

const STORAGE_KEY = "alchemist-ot-sandbox-project";
const HISTORY_LIMIT = 30;

function cloneProject(project: OtProject): OtProject {
  return JSON.parse(JSON.stringify(project)) as OtProject;
}

function makeId(prefix: string) {
  if ("crypto" in window && typeof window.crypto.randomUUID === "function") {
    return `${prefix}-${window.crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function loadStoredProject(): OtProject {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return cloneProject(sampleProject);
  }
  const parsed = parseProjectJson(stored);
  return parsed.ok ? parsed.project : cloneProject(sampleProject);
}

function createAsset(typeId: AssetTypeId, position: Point, zone?: ZoneId): Asset {
  const type = getAssetType(typeId);
  return {
    id: makeId("asset"),
    name: type.label,
    type: type.id,
    zone: zone ?? type.defaultZone,
    ipAddress: "",
    vlan: "",
    protocols: [...type.baseProtocols],
    criticality: type.id === "plc-rtu" || type.id === "safety-system" ? "critical" : "medium",
    owner: "",
    notes: "",
    position,
    controls: {
      mfa: false,
      allowListing: false,
      endpointProtection: false,
      patchingProgram: false,
      backups: false,
      defaultCredentialsDisabled: false,
      networkMonitoring: false,
      centralLogging: false,
      remoteAccessApproved: false,
      safetyValidated: type.id === "safety-system"
    },
    manufacturer: "",
    model: "",
    firmwareVersion: "",
    lifecycleStatus: "unknown",
    siteArea: "",
    patchWindow: "",
    backupStatus: "unknown",
    criticalProcessTag: ""
  };
}

function createConduit(source: string, target: string): Conduit {
  return {
    id: makeId("conduit"),
    source,
    target,
    name: "New conduit",
    protocol: "HTTPS",
    port: "443",
    protocolFamily: "auto",
    direction: "source-to-target",
    control: "firewalled",
    firewallRule: "explicit",
    trustBoundary: true,
    inspected: false,
    logged: false,
    encrypted: true,
    jumpHostRequired: false,
    ruleOwner: "",
    businessJustification: "",
    reviewDate: "",
    expiryDate: "",
    monitoringSource: "",
    inspectionPoint: "",
    temporaryAccess: false,
    businessCritical: false,
    notes: ""
  };
}

export function App() {
  const [project, setProject] = useState<OtProject>(() => loadStoredProject());
  const [history, setHistory] = useState<OtProject[]>([]);
  const [future, setFuture] = useState<OtProject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reachSourceId, setReachSourceId] = useState(project.assets[2]?.id ?? project.assets[0]?.id ?? "");
  const [reachTargetId, setReachTargetId] = useState(project.assets.find((asset) => asset.type === "plc-rtu")?.id ?? "");
  const [canvasMode, setCanvasMode] = useState<CanvasMode>("clean");
  const [connectMode, setConnectMode] = useState(false);
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const [activeFindingId, setActiveFindingId] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const stored = window.localStorage.getItem("ot-sandbox-theme");
    if (stored === "dark" || stored === "light") {
      return stored;
    }
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  });
  const [pendingDelete, setPendingDelete] = useState<{ ids: string[]; label: string } | null>(null);
  const [multiSelectedIds, setMultiSelectedIds] = useState<string[]>([]);
  const [commandOpen, setCommandOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts();
  const { layout, togglePalette, toggleDock, setDockHeight } = usePanelLayout();

  const assessment = useMemo(() => assessProject(project), [project]);
  const reachability = useMemo(
    () => findReachability(project, reachSourceId, reachTargetId),
    [project, reachSourceId, reachTargetId]
  );

  const selectedAsset = selectedId ? project.assets.find((asset) => asset.id === selectedId) : undefined;
  const selectedConduit = selectedId ? project.conduits.find((conduit) => conduit.id === selectedId) : undefined;
  const activeFinding = activeFindingId ? assessment.findings.find((finding) => finding.id === activeFindingId) : undefined;
  const highlightedConduitIds = activeFinding?.affectedConduitIds.length ? activeFinding.affectedConduitIds : reachability.pathConduitIds;

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, serializeProject(project));
  }, [project]);

  useEffect(() => {
    document.body.classList.toggle("light-mode", theme === "light");
    window.localStorage.setItem("ot-sandbox-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!project.assets.some((asset) => asset.id === reachSourceId)) {
      setReachSourceId(project.assets[0]?.id ?? "");
    }
    if (!project.assets.some((asset) => asset.id === reachTargetId)) {
      setReachTargetId(project.assets.find((asset) => asset.type === "plc-rtu")?.id ?? project.assets[1]?.id ?? "");
    }
  }, [project.assets, reachSourceId, reachTargetId]);

  const commitProject = useCallback((updater: OtProject | ((current: OtProject) => OtProject), recordHistory = true) => {
    setProject((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      const touched = { ...next, updatedAt: new Date().toISOString() };
      if (recordHistory) {
        setHistory((items) => [...items.slice(-(HISTORY_LIMIT - 1)), cloneProject(current)]);
        setFuture([]);
      }
      return touched;
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((items) => {
      const previous = items.at(-1);
      if (!previous) {
        return items;
      }
      setProject((current) => {
        setFuture((futureItems) => [cloneProject(current), ...futureItems].slice(0, HISTORY_LIMIT));
        return cloneProject(previous);
      });
      return items.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((items) => {
      const next = items[0];
      if (!next) {
        return items;
      }
      setProject((current) => {
        setHistory((historyItems) => [...historyItems.slice(-(HISTORY_LIMIT - 1)), cloneProject(current)]);
        return cloneProject(next);
      });
      return items.slice(1);
    });
  }, []);

  const updateAsset = useCallback(
    (assetId: string, patch: Partial<Asset>) => {
      commitProject((current) => ({
        ...current,
        assets: current.assets.map((asset) => (asset.id === assetId ? { ...asset, ...patch } : asset))
      }));
    },
    [commitProject]
  );

  const updateConduit = useCallback(
    (conduitId: string, patch: Partial<Conduit>) => {
      commitProject((current) => ({
        ...current,
        conduits: current.conduits.map((conduit) => (conduit.id === conduitId ? { ...conduit, ...patch } : conduit))
      }));
    },
    [commitProject]
  );

  const addAsset = useCallback(
    (typeId: AssetTypeId, position?: Point) => {
      const type = getAssetType(typeId);
      const zone = position ? inferZoneFromY(position.y) : type.defaultZone;
      const desiredX = position ? snapPointToZone(position, zone).x : 96;
      const x = resolveAssetX(desiredX, zone, null, project.assets);
      const asset = createAsset(typeId, { x, y: assetYForZone(zone) }, zone);
      commitProject((current) => ({ ...current, assets: [...current.assets, asset] }));
      setSelectedId(asset.id);
    },
    [commitProject, project.assets]
  );

  const addConduit = useCallback(
    (source: string, target: string) => {
      if (source === target) {
        return null;
      }
      const conduit = createConduit(source, target);
      commitProject((current) => ({ ...current, conduits: [...current.conduits, conduit] }));
      setSelectedId(conduit.id);
      return conduit.id;
    },
    [commitProject]
  );

  const handleAssetClick = useCallback(
    (assetId: string) => {
      if (!connectMode) {
        setSelectedId(assetId);
        return;
      }

      if (!connectSourceId) {
        setConnectSourceId(assetId);
        setSelectedId(assetId);
        return;
      }

      if (connectSourceId === assetId) {
        setConnectSourceId(null);
        return;
      }

      addConduit(connectSourceId, assetId);
      // Stay in connect mode so several conduits can be wired in a row; clear
      // the source so the next click picks a fresh one. Esc or toggling Connect
      // off exits (see the keydown handler / toolbar).
      setConnectSourceId(null);
    },
    [addConduit, connectMode, connectSourceId]
  );

  const handleToggleConnectMode = useCallback(() => {
    setConnectMode((current) => {
      if (current) {
        setConnectSourceId(null);
      }
      return !current;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setConnectSourceId(null);
        setConnectMode(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const renameAsset = useCallback((id: string, name: string) => updateAsset(id, { name }), [updateAsset]);

  const confirmSelection = useCallback(() => {
    setSelectedId(null);
    setConnectSourceId(null);
    setConnectMode(false);
  }, []);

  const handleFindingSelect = useCallback((finding: Finding) => {
    setActiveFindingId(finding.id);
    setCanvasMode("risk");
    setSelectedId(finding.affectedConduitIds[0] ?? finding.affectedAssetIds[0] ?? null);
  }, []);

  const importProject = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = parseProjectJson(String(reader.result ?? ""));
        if (!result.ok) {
          pushToast(`Import failed: ${result.errors.join("; ")}`, "danger");
          return;
        }
        commitProject(result.project);
        setSelectedId(null);
        pushToast("Project imported", "success");
      };
      reader.onerror = () => pushToast("Could not read that file", "danger");
      reader.readAsText(file);
    },
    [commitProject, pushToast]
  );

  const handleExportJson = useCallback(() => {
    downloadJson(project.name, serializeProject(project));
    pushToast("Exported project JSON", "success");
  }, [project, pushToast]);

  const handleExportSvg = useCallback(() => {
    downloadTopologySvg(project, assessment);
    pushToast("Exported topology SVG", "success");
  }, [project, assessment, pushToast]);

  const handleLoadSample = useCallback(() => {
    commitProject(cloneProject(sampleProject));
    setSelectedId(null);
    pushToast("Sample project loaded", "info");
  }, [commitProject, pushToast]);

  const handleNewBlank = useCallback(() => {
    commitProject(cloneProject(blankProject));
    setSelectedId(null);
    pushToast("Blank project created", "info");
  }, [commitProject, pushToast]);

  const confirmDelete = useCallback(() => {
    if (!pendingDelete) {
      return;
    }
    const ids = new Set(pendingDelete.ids);
    commitProject((current) => ({
      ...current,
      assets: current.assets.filter((asset) => !ids.has(asset.id)),
      conduits: current.conduits.filter(
        (conduit) => !ids.has(conduit.id) && !ids.has(conduit.source) && !ids.has(conduit.target)
      )
    }));
    pushToast(`Deleted ${pendingDelete.label}`, "info");
    setSelectedId(null);
    setMultiSelectedIds([]);
    setPendingDelete(null);
  }, [pendingDelete, commitProject, pushToast]);

  const requestDelete = useCallback(() => {
    if (multiSelectedIds.length > 1) {
      setPendingDelete({ ids: multiSelectedIds, label: `${multiSelectedIds.length} assets` });
      return;
    }
    if (!selectedId) {
      return;
    }
    setPendingDelete({ ids: [selectedId], label: selectedAsset?.name || selectedConduit?.name || "this item" });
  }, [multiSelectedIds, selectedId, selectedAsset, selectedConduit]);

  const duplicateSelected = useCallback(() => {
    if (!selectedAsset) {
      return;
    }
    const clone: Asset = {
      ...selectedAsset,
      id: makeId("asset"),
      name: `${selectedAsset.name} copy`,
      position: snapAssetPosition({ x: selectedAsset.position.x + 96, y: selectedAsset.position.y }),
      protocols: [...selectedAsset.protocols],
      controls: { ...selectedAsset.controls }
    };
    commitProject((current) => ({ ...current, assets: [...current.assets, clone] }));
    setSelectedId(clone.id);
    pushToast("Asset duplicated", "info");
  }, [selectedAsset, commitProject, pushToast]);

  useKeyboardShortcuts({
    onCommandPalette: () => setCommandOpen(true),
    onUndo: undo,
    onRedo: redo,
    onDelete: requestDelete,
    onToggleConnect: handleToggleConnectMode,
    onShowShortcuts: () => setShortcutsOpen((open) => !open),
    onDuplicate: duplicateSelected
  });

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [
      { id: "sample", label: "Load sample project", run: handleLoadSample },
      { id: "blank", label: "New blank project", run: handleNewBlank },
      { id: "import", label: "Import project…", hint: "JSON", run: () => importInputRef.current?.click() },
      { id: "export-json", label: "Export project JSON", run: handleExportJson },
      { id: "export-svg", label: "Export topology SVG", run: handleExportSvg },
      { id: "print", label: "Print / save PDF report", run: () => window.print() },
      { id: "connect", label: "Toggle connect mode", hint: "C", run: handleToggleConnectMode },
      { id: "theme", label: "Toggle light / dark theme", run: () => setTheme((current) => (current === "dark" ? "light" : "dark")) },
      { id: "palette", label: layout.paletteOpen ? "Collapse asset palette" : "Expand asset palette", run: togglePalette },
      { id: "dock", label: layout.dockOpen ? "Collapse analysis dock" : "Expand analysis dock", run: toggleDock },
      { id: "shortcuts", label: "Show keyboard shortcuts", hint: "?", run: () => setShortcutsOpen(true) },
      { id: "mode-clean", label: "Canvas: clean view", run: () => setCanvasMode("clean") },
      { id: "mode-protocol", label: "Canvas: protocol view", run: () => setCanvasMode("protocol") },
      { id: "mode-risk", label: "Canvas: risk view", run: () => setCanvasMode("risk") },
      { id: "mode-boundary", label: "Canvas: boundary view", run: () => setCanvasMode("boundary") },
      { id: "mode-path", label: "Canvas: attacker path view", run: () => setCanvasMode("reachability") }
    ];
    if (selectedAsset) {
      list.push({ id: "duplicate", label: "Duplicate selected asset", hint: "Ctrl+D", run: duplicateSelected });
    }
    if (assessment.findings.length > 0) {
      list.push({
        id: "top-finding",
        label: "Go to top finding",
        hint: assessment.findings[0].severity,
        run: () => handleFindingSelect(assessment.findings[0])
      });
    }
    if (history.length > 0) {
      list.push({ id: "undo", label: "Undo", hint: "Ctrl+Z", run: undo });
    }
    if (future.length > 0) {
      list.push({ id: "redo", label: "Redo", hint: "Ctrl+Shift+Z", run: redo });
    }
    return list;
  }, [
    handleLoadSample,
    handleNewBlank,
    handleExportJson,
    handleExportSvg,
    handleToggleConnectMode,
    togglePalette,
    toggleDock,
    layout.paletteOpen,
    layout.dockOpen,
    assessment.findings,
    handleFindingSelect,
    history.length,
    future.length,
    undo,
    redo,
    duplicateSelected,
    selectedAsset
  ]);

  return (
    <>
      <a className="skip-link" href="#workspace">
        Skip to workspace
      </a>
      <main className="app-shell">
        <AppHeader
          project={project}
          score={assessment.overallScore}
          theme={theme}
          canUndo={history.length > 0}
          canRedo={future.length > 0}
          onProjectNameChange={(name) => commitProject((current) => ({ ...current, name }))}
          onImport={importProject}
          onExportJson={handleExportJson}
          onExportSvg={handleExportSvg}
          onPrintReport={() => window.print()}
          onLoadSample={handleLoadSample}
          onNewBlank={handleNewBlank}
          onUndo={undo}
          onRedo={redo}
          onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        />

        <section
          id="workspace"
          tabIndex={-1}
          className={`workspace-grid${layout.paletteOpen ? "" : " palette-collapsed"}${
            selectedAsset || selectedConduit ? "" : " inspector-hidden"
          }`}
          style={{ "--dock-height": layout.dockOpen ? `${layout.dockHeight}rem` : "auto" } as CSSProperties}
          aria-label="OT network sandbox workspace"
        >
          {layout.paletteOpen ? (
            <AssetPalette onAddAsset={addAsset} onCollapse={togglePalette} />
          ) : (
            <CollapsedRail panelClassName="asset-palette" label="Assets" side="left" onExpand={togglePalette} />
          )}
          <TopologyCanvas
            project={project}
            assessment={assessment}
            selectedId={selectedId}
            highlightedConduitIds={highlightedConduitIds}
            canvasMode={canvasMode}
            connectMode={connectMode}
            connectSourceId={connectSourceId}
            canUndo={history.length > 0}
            canRedo={future.length > 0}
            onSelect={setSelectedId}
            onAssetClick={handleAssetClick}
            onCreateAsset={addAsset}
            onCreateConduit={addConduit}
            onProjectChange={commitProject}
            onCanvasModeChange={(mode) => {
              setCanvasMode(mode);
              if (mode !== "risk") {
                setActiveFindingId(null);
              }
            }}
            onToggleConnectMode={handleToggleConnectMode}
            onFindingSelect={handleFindingSelect}
            onRenameAsset={renameAsset}
            onSelectionChange={setMultiSelectedIds}
            onUndo={undo}
            onRedo={redo}
          />
          {selectedAsset || selectedConduit ? (
            <InspectorPanel
              project={project}
              asset={selectedAsset}
              conduit={selectedConduit}
              onAssetChange={updateAsset}
              onConduitChange={updateConduit}
              onDeleteSelected={requestDelete}
              onConfirmSelected={confirmSelection}
              onCollapse={() => setSelectedId(null)}
            />
          ) : null}
          <AnalysisPanel
            project={project}
            assessment={assessment}
            reachability={reachability}
            sourceId={reachSourceId}
            targetId={reachTargetId}
            canvasMode={canvasMode}
            activeFindingId={activeFindingId}
            onSourceChange={setReachSourceId}
            onTargetChange={setReachTargetId}
            onCanvasModeChange={setCanvasMode}
            onFindingSelect={handleFindingSelect}
            onPrintReport={() => window.print()}
            dockHeight={layout.dockHeight}
            onDockResize={setDockHeight}
            dockOpen={layout.dockOpen}
            onToggleDock={toggleDock}
          />
        </section>
      </main>

      <PrintableReport project={project} assessment={assessment} reachability={reachability} />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete from topology"
        message={
          pendingDelete
            ? `Remove ${pendingDelete.label}? Any connected conduits are removed too. You can undo this.`
            : ""
        }
        confirmLabel="Delete"
        tone="danger"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
      <CommandPalette open={commandOpen} commands={commands} onClose={() => setCommandOpen(false)} />
      <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />

      <input
        ref={importInputRef}
        className="visually-hidden"
        type="file"
        accept="application/json,.json"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            importProject(file);
            event.target.value = "";
          }
        }}
      />
    </>
  );
}
