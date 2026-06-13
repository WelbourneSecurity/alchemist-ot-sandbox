import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { sampleProject, blankProject } from "./data/sampleProject";
import { getAssetType } from "./data/catalog";
import { assetYForZone, inferZoneFromY, snapAssetPosition, snapPointToZone } from "./data/canvasLayout";
import { findReachability } from "./engine/reachability";
import { assessProject } from "./engine/scoring";
import { parseProjectJson, serializeProject } from "./engine/serialization";
import { downloadJson, downloadTopologySvg } from "./lib/exporters";
import type { Asset, AssetTypeId, CanvasMode, Conduit, Finding, OtProject, Point, ZoneId } from "./models/types";
import { AnalysisPanel } from "./components/AnalysisPanel";
import { AppHeader } from "./components/AppHeader";
import { AssetPalette } from "./components/AssetPalette";
import { CollapsedRail } from "./components/CollapsedRail";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { InspectorPanel } from "./components/InspectorPanel";
import { PrintableReport } from "./components/PrintableReport";
import { ToastViewport } from "./components/ToastViewport";
import { TopologyCanvas } from "./components/TopologyCanvas";
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
  const [pendingDelete, setPendingDelete] = useState<{ id: string; label: string } | null>(null);
  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts();
  const { layout, togglePalette, toggleInspector, setDockHeight } = usePanelLayout();

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
      const sameZoneCount = project.assets.filter((asset) => asset.zone === zone).length;
      const fallbackPosition = snapAssetPosition({
        x: 96 + sameZoneCount * 240,
        y: assetYForZone(zone)
      });
      const asset = createAsset(typeId, position ? snapPointToZone(position, zone) : fallbackPosition, zone);
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
      setConnectSourceId(null);
      setConnectMode(false);
      setCanvasMode("clean");
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

  const removeSelected = useCallback(() => {
    if (!selectedId) {
      return;
    }
    commitProject((current) => ({
      ...current,
      assets: current.assets.filter((asset) => asset.id !== selectedId),
      conduits: current.conduits.filter(
        (conduit) => conduit.id !== selectedId && conduit.source !== selectedId && conduit.target !== selectedId
      )
    }));
    setSelectedId(null);
  }, [commitProject, selectedId]);

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
    removeSelected();
    pushToast(`Deleted ${pendingDelete.label}`, "info");
    setPendingDelete(null);
  }, [pendingDelete, removeSelected, pushToast]);

  return (
    <>
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
          className={`workspace-grid${layout.paletteOpen ? "" : " palette-collapsed"}${
            layout.inspectorOpen ? "" : " inspector-collapsed"
          }`}
          style={{ "--dock-height": `${layout.dockHeight}rem` } as CSSProperties}
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
            onUndo={undo}
            onRedo={redo}
          />
          {layout.inspectorOpen ? (
            <InspectorPanel
              project={project}
              asset={selectedAsset}
              conduit={selectedConduit}
              onAssetChange={updateAsset}
              onConduitChange={updateConduit}
              onDeleteSelected={() => {
                if (!selectedId) {
                  return;
                }
                setPendingDelete({ id: selectedId, label: selectedAsset?.name || selectedConduit?.name || "this item" });
              }}
              onConfirmSelected={confirmSelection}
              onCollapse={toggleInspector}
            />
          ) : (
            <CollapsedRail panelClassName="inspector-panel" label="Inspector" side="right" onExpand={toggleInspector} />
          )}
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
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
