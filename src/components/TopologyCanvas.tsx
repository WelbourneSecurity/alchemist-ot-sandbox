import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  ViewportPortal,
  applyNodeChanges,
  useNodesState,
  type Connection,
  type Node,
  type NodeChange,
  type NodeProps,
  type OnNodeDrag,
  useReactFlow
} from "@xyflow/react";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ASSET_NODE_HEIGHT,
  ASSET_NODE_WIDTH,
  CANVAS_GRID_X,
  DEFAULT_VIEWPORT,
  ZONE_BAND_HEIGHT,
  ZONE_BAND_Y_OFFSET,
  ZONE_ROW_HEIGHT,
  inferZoneFromY,
  projectPurduePositions,
  snapAssetPosition,
  snapToGrid,
  subnetBoundingBoxes,
  zoneIndex
} from "../data/canvasLayout";
import { assetTypes, getAssetType, getZone, zones } from "../data/catalog";
import { resolveProtocolFamily } from "../data/protocols";
import { routeOrthogonalConduit } from "../engine/conduitRouting";
import { conduitColor, conduitOpacity, conduitParallelOffsets, conduitSeverity } from "../engine/conduitVisuals";
import type {
  Asset,
  AssetTypeId,
  CanvasMode,
  Finding,
  LayoutMode,
  OtProject,
  Point,
  SecurityAssessment,
  ZoneId
} from "../models/types";
import { buildVerdict } from "../lib/verdict";
import { AssetGlyph } from "./AssetGlyph";
import { ScoreGauge } from "./ScoreGauge";

interface TopologyCanvasProps {
  project: OtProject;
  assessment: SecurityAssessment;
  selectedId: string | null;
  highlightedConduitIds: string[];
  canvasMode: CanvasMode;
  layoutMode: LayoutMode;
  connectMode: boolean;
  connectSourceId: string | null;
  canUndo: boolean;
  canRedo: boolean;
  onSelect: (id: string | null) => void;
  onAssetClick: (id: string) => void;
  onCreateAsset: (typeId: AssetTypeId, position: Point) => void;
  onCreateConduit: (source: string, target: string) => void;
  onProjectChange: (updater: OtProject | ((current: OtProject) => OtProject), recordHistory?: boolean) => void;
  onCanvasModeChange: (mode: CanvasMode) => void;
  onLayoutModeChange: (mode: LayoutMode) => void;
  onManageSubnets: () => void;
  onAutoArrange: () => void;
  fitSignal: number;
  onToggleConnectMode: () => void;
  onFindingSelect: (finding: Finding) => void;
  onRenameAsset: (id: string, name: string) => void;
  onSelectionChange: (ids: string[]) => void;
  onUndo: () => void;
  onRedo: () => void;
}

type AssetNodeData = {
  asset: Asset;
  selected: boolean;
  highlighted: boolean;
  connectMode: boolean;
  connectSource: boolean;
  onRename: (id: string, name: string) => void;
};

type AssetFlowNode = Node<AssetNodeData, "asset">;

function AssetNode({ data }: NodeProps<AssetFlowNode>) {
  const type = getAssetType(data.asset.type);
  const zone = getZone(data.asset.zone);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.asset.name);

  const commitRename = () => {
    const next = draft.trim();
    if (next && next !== data.asset.name) {
      data.onRename(data.asset.id, next);
    }
    setEditing(false);
  };

  return (
    <div
      className={`asset-node criticality-${data.asset.criticality} ${data.selected ? "is-selected" : ""} ${
        data.highlighted ? "is-highlighted" : ""
      } ${data.connectMode ? "is-connectable" : ""} ${data.connectSource ? "is-connect-source" : ""}`}
      style={{ "--zone-color": zone.color } as CSSProperties}
    >
      <Handle id="in" type="target" position={Position.Left} className="flow-handle" />
      <Handle id="out" type="source" position={Position.Right} className="flow-handle" />
      <div className="asset-node-icon">
        <AssetGlyph icon={type.icon} size={17} />
      </div>
      <div className="asset-node-body">
        {editing ? (
          <input
            className="nodrag asset-node-rename"
            value={draft}
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitRename}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitRename();
              } else if (event.key === "Escape") {
                event.preventDefault();
                setDraft(data.asset.name);
                setEditing(false);
              }
            }}
          />
        ) : (
          <strong
            title="Double-click to rename"
            onDoubleClick={(event) => {
              event.stopPropagation();
              setDraft(data.asset.name);
              setEditing(true);
            }}
          >
            {data.asset.name}
          </strong>
        )}
        <span>{type.label}</span>
        <small>{data.asset.ipAddress || data.asset.vlan || "metadata incomplete"}</small>
      </div>
    </div>
  );
}

const nodeTypes = {
  asset: AssetNode
};

interface ConduitOverlayItem {
  id: string;
  path: string;
  labelX: number;
  labelY: number;
  boundaryX: number;
  boundaryY: number;
  label: string;
  color: string;
  opacity: number;
  trustBoundary: boolean;
  selected: boolean;
  highlighted: boolean;
  labelVisible: boolean;
  boundaryMarkers: Point[];
  dash?: string;
}

function assetWithLivePosition(asset: Asset, position: Point, layoutMode: LayoutMode): Asset {
  // In the Purdue projection a node's lane (y) defines its zone, so derive it live while
  // dragging. In the free network layout the zone is an explicit attribute, untouched by y.
  if (layoutMode === "purdue") {
    return { ...asset, position, zone: inferZoneFromY(position.y + ASSET_NODE_HEIGHT / 2) };
  }
  return { ...asset, position };
}

function boundaryYsBetweenZones(sourceZone: ZoneId, targetZone: ZoneId) {
  const start = Math.min(zoneIndex(sourceZone), zoneIndex(targetZone));
  const end = Math.max(zoneIndex(sourceZone), zoneIndex(targetZone));
  const laneGap = (ZONE_ROW_HEIGHT - ZONE_BAND_HEIGHT) / 2;

  return Array.from({ length: Math.max(0, end - start) }, (_, index) => {
    const boundaryIndex = start + index + 1;
    return boundaryIndex * ZONE_ROW_HEIGHT + ZONE_BAND_Y_OFFSET - laneGap;
  });
}

function routeBoundaryMarkers(points: Point[], sourceZone: ZoneId, targetZone: ZoneId) {
  if (sourceZone === targetZone) {
    return [];
  }

  const markers: Point[] = [];
  for (const boundaryY of boundaryYsBetweenZones(sourceZone, targetZone)) {
    for (let index = 0; index < points.length - 1; index += 1) {
      const from = points[index];
      const to = points[index + 1];
      const vertical = from.x === to.x;
      const minY = Math.min(from.y, to.y);
      const maxY = Math.max(from.y, to.y);

      if (vertical && boundaryY >= minY && boundaryY <= maxY) {
        markers.push({ x: from.x, y: boundaryY });
        break;
      }
    }
  }

  return markers;
}

function TopologyCanvasInner({
  project,
  assessment,
  selectedId,
  highlightedConduitIds,
  canvasMode,
  layoutMode,
  connectMode,
  connectSourceId,
  canUndo,
  canRedo,
  onSelect,
  onAssetClick,
  onCreateAsset,
  onCreateConduit,
  onProjectChange,
  onCanvasModeChange,
  onLayoutModeChange,
  onManageSubnets,
  onAutoArrange,
  fitSignal,
  onToggleConnectMode,
  onFindingSelect,
  onUndo,
  onRenameAsset,
  onSelectionChange,
  onRedo
}: TopologyCanvasProps) {
  const isPurdue = layoutMode === "purdue";
  const reactFlow = useReactFlow();
  const [isDragging, setIsDragging] = useState(false);
  const [hudOpen, setHudOpen] = useState(false);
  const verdict = buildVerdict(assessment);
  const topFinding = assessment.findings[0];
  const highlightedSet = useMemo(() => new Set(highlightedConduitIds), [highlightedConduitIds]);
  const focusedConduitIds = useMemo(
    () => (canvasMode === "reachability" || canvasMode === "risk" ? highlightedSet : new Set<string>()),
    [canvasMode, highlightedSet]
  );

  const highlightedAssets = useMemo(() => {
    const ids = new Set<string>();
    for (const conduit of project.conduits) {
      if (focusedConduitIds.has(conduit.id) || selectedId === conduit.id) {
        ids.add(conduit.source);
        ids.add(conduit.target);
      }
    }
    if (connectSourceId) {
      ids.add(connectSourceId);
    }
    return ids;
  }, [connectSourceId, focusedConduitIds, project.conduits, selectedId]);

  // In Purdue mode the node positions are a pure projection of `zone`; the stored free
  // `position` is never read for layout, so toggling back to the network view is lossless.
  const purduePositions = useMemo(
    () => (isPurdue ? projectPurduePositions(project.assets) : null),
    [isPurdue, project.assets]
  );

  const projectNodes = useMemo<AssetFlowNode[]>(
    () =>
      project.assets.map((asset) => ({
        id: asset.id,
        type: "asset",
        position: purduePositions?.get(asset.id) ?? asset.position,
        width: ASSET_NODE_WIDTH,
        height: ASSET_NODE_HEIGHT,
        style: {
          width: ASSET_NODE_WIDTH,
          minHeight: ASSET_NODE_HEIGHT
        },
        data: {
          asset,
          selected: selectedId === asset.id,
          highlighted: highlightedAssets.has(asset.id),
          connectMode,
          connectSource: connectSourceId === asset.id,
          onRename: onRenameAsset
        },
        zIndex: highlightedAssets.has(asset.id) ? 10 : 5
      })),
    [connectMode, connectSourceId, highlightedAssets, onRenameAsset, project.assets, purduePositions, selectedId]
  );

  const [flowNodes, setFlowNodes] = useNodesState<AssetFlowNode>(projectNodes);

  useEffect(() => {
    setFlowNodes(projectNodes);
  }, [projectNodes, setFlowNodes]);

  // Switching layout reflows every node (free positions <-> packed Purdue lanes), so refit the
  // view to the new arrangement. Skip the first run to preserve the default viewport on load.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    const frame = window.requestAnimationFrame(() => void reactFlow.fitView({ padding: 0.16, duration: 320 }));
    return () => window.cancelAnimationFrame(frame);
  }, [layoutMode, reactFlow]);

  // Explicit refit requests from the app (load a scenario, import, or auto-arrange) frame the
  // freshly positioned topology. Skips 0 so the initial render keeps the default viewport.
  useEffect(() => {
    if (fitSignal === 0) {
      return;
    }
    const frame = window.requestAnimationFrame(() => void reactFlow.fitView({ padding: 0.16, duration: 320 }));
    return () => window.cancelAnimationFrame(frame);
  }, [fitSignal, reactFlow]);

  const liveAssets = useMemo(() => {
    const livePositions = new Map(flowNodes.map((node) => [node.id, node.position]));
    return project.assets.map((asset) => {
      const position = livePositions.get(asset.id);
      return position ? assetWithLivePosition(asset, position, layoutMode) : asset;
    });
  }, [flowNodes, layoutMode, project.assets]);

  const subnetBoxes = useMemo(
    () => (isPurdue ? [] : subnetBoundingBoxes(liveAssets, project.subnets ?? [])),
    [isPurdue, liveAssets, project.subnets]
  );

  const conduitOverlayItems = useMemo<ConduitOverlayItem[]>(() => {
    const assets = new Map(liveAssets.map((asset) => [asset.id, asset]));
    const offsets = conduitParallelOffsets(project.conduits);

    return project.conduits.flatMap((conduit) => {
      const source = assets.get(conduit.source);
      const target = assets.get(conduit.target);
      if (!source || !target) {
        return [];
      }

      const highlighted = focusedConduitIds.has(conduit.id);
      const selected = selectedId === conduit.id;
      const severity = conduitSeverity(conduit.id, assessment.findings);
      const family = resolveProtocolFamily(conduit);
      const color = conduitColor(conduit, canvasMode, assessment.findings, highlighted);
      const showLabel = selected || highlighted || canvasMode === "protocol" || canvasMode === "reachability";
      const route = routeOrthogonalConduit(
        {
          x: source.position.x,
          y: source.position.y,
          width: ASSET_NODE_WIDTH,
          height: ASSET_NODE_HEIGHT
        },
        {
          x: target.position.x,
          y: target.position.y,
          width: ASSET_NODE_WIDTH,
          height: ASSET_NODE_HEIGHT
        },
        offsets.get(conduit.id) ?? 0
      );

      return [
        {
          id: conduit.id,
          path: route.path,
          labelX: route.labelX,
          labelY: route.labelY,
          boundaryX: route.boundaryX,
          boundaryY: route.boundaryY,
          label: showLabel ? family.shortLabel : "",
          color,
          opacity: conduitOpacity(conduit, canvasMode, highlighted),
          trustBoundary: conduit.trustBoundary,
          selected,
          highlighted: highlighted || (canvasMode === "risk" && Boolean(severity)),
          labelVisible: showLabel,
          boundaryMarkers: conduit.trustBoundary ? routeBoundaryMarkers(route.points, source.zone, target.zone) : [],
          dash: conduit.firewallRule === "unknown" ? "10 8" : conduit.firewallRule === "any-any" ? "2 7" : undefined
        }
      ];
    });
  }, [assessment.findings, canvasMode, focusedConduitIds, liveAssets, project.conduits, selectedId]);

  const contentExtent = useMemo(() => {
    let maxX = 0;
    let maxY = 0;
    for (const asset of liveAssets) {
      maxX = Math.max(maxX, asset.position.x);
      maxY = Math.max(maxY, asset.position.y);
    }
    return {
      bandWidth: Math.max(1900, maxX + ASSET_NODE_WIDTH + 600),
      overlayWidth: Math.max(2600, maxX + ASSET_NODE_WIDTH + 400),
      overlayHeight: Math.max(1450, maxY + ASSET_NODE_HEIGHT + 400)
    };
  }, [liveAssets]);

  const handleNodesChange = useCallback(
    (changes: NodeChange<AssetFlowNode>[]) => {
      setFlowNodes((currentNodes) =>
        applyNodeChanges(changes, currentNodes).map((node) => {
          const snapped = isPurdue ? snapAssetPosition(node.position) : snapToGrid(node.position);
          return {
            ...node,
            position: snapped,
            data: {
              ...node.data,
              asset: assetWithLivePosition(node.data.asset, snapped, layoutMode)
            }
          };
        })
      );
    },
    [isPurdue, layoutMode, setFlowNodes]
  );

  const commitNodePosition = useCallback<OnNodeDrag<AssetFlowNode>>(
    (_, node) => {
      setIsDragging(false);
      if (isPurdue) {
        // Dragging between lanes reassigns the zone; the free position is preserved so the
        // network layout survives a round-trip through the Purdue view.
        const zone = inferZoneFromY(snapAssetPosition(node.position).y + ASSET_NODE_HEIGHT / 2);
        onProjectChange((current) => ({
          ...current,
          assets: current.assets.map((asset) => (asset.id === node.id ? { ...asset, zone } : asset))
        }));
        return;
      }
      const position = snapToGrid(node.position);
      onProjectChange((current) => ({
        ...current,
        assets: current.assets.map((asset) => (asset.id === node.id ? { ...asset, position } : asset))
      }));
    },
    [isPurdue, onProjectChange]
  );

  const fitPurdueView = useCallback(() => {
    void reactFlow.fitView({ padding: 0.16 });
  }, [reactFlow]);

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        onCreateConduit(connection.source, connection.target);
      }
    },
    [onCreateConduit]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const typeId = event.dataTransfer.getData("application/alchemist-asset-type") as AssetTypeId;
      if (!assetTypes.some((type) => type.id === typeId)) {
        return;
      }
      onCreateAsset(typeId, reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
    },
    [onCreateAsset, reactFlow]
  );

  // Stable identity is required: React Flow re-invokes onSelectionChange whenever the
  // handler reference changes, so an inline arrow here causes an infinite render loop.
  const handleSelectionChange = useCallback(
    ({ nodes }: { nodes: Node[] }) => onSelectionChange(nodes.map((node) => node.id)),
    [onSelectionChange]
  );

  return (
    <section
      className="canvas-shell"
      aria-label="Topology canvas"
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDrop={handleDrop}
    >
      <div className="canvas-titlebar">
        <div>
          <h2>{isPurdue ? "Purdue Zones" : "Network Layout"}</h2>
          <p>
            {connectMode
              ? connectSourceId
                ? "Select the destination asset for the new conduit."
                : "Select the source asset for the new conduit."
              : isPurdue
                ? "Assets projected into Purdue levels — drag between lanes to set a zone."
                : "Lay the network out freely and group assets into subnets."}
          </p>
        </div>
        <div className="canvas-actions" aria-label="Canvas controls">
          <div className="segmented-control" aria-label="Canvas layout mode">
            {[
              ["network", "Network"],
              ["purdue", "Purdue"]
            ].map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={layoutMode === mode ? "active" : ""}
                onClick={() => onLayoutModeChange(mode as LayoutMode)}
                title={mode === "purdue" ? "Project assets into Purdue levels" : "Free network layout grouped by subnet"}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="segmented-control" aria-label="Canvas view mode">
            {[
              ["clean", "Clean"],
              ["protocol", "Protocol"],
              ["risk", "Risk"],
              ["boundary", "Boundary"],
              ["reachability", "Path"]
            ].map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={canvasMode === mode ? "active" : ""}
                onClick={() => onCanvasModeChange(mode as CanvasMode)}
              >
                {label}
              </button>
            ))}
          </div>
          {!isPurdue ? (
            <button type="button" className="text-button compact" title="Create and edit subnets" onClick={onManageSubnets}>
              Subnets
            </button>
          ) : null}
          {!isPurdue ? (
            <button
              type="button"
              className="text-button compact"
              title="Tidy the layout into separated subnet columns"
              onClick={onAutoArrange}
            >
              Arrange
            </button>
          ) : null}
          <button type="button" className={`text-button ${connectMode ? "primary" : ""}`} onClick={onToggleConnectMode}>
            {connectMode ? "Cancel connect" : "Connect"}
          </button>
          <button type="button" className="text-button compact" title="Fit topology in view" onClick={fitPurdueView}>
            Fit
          </button>
          <button type="button" className="text-button compact" title="Undo last change" onClick={onUndo} disabled={!canUndo}>
            Undo
          </button>
          <button type="button" className="text-button compact" title="Redo last undone change" onClick={onRedo} disabled={!canRedo}>
            Redo
          </button>
        </div>
      </div>

      <div className={`react-flow-frame mode-${canvasMode} ${isDragging ? "is-dragging" : ""}`}>
        {connectMode ? (
          <div className="canvas-connect-banner" role="status">
            {connectSourceId ? "Click a target asset to wire the conduit" : "Click a source asset to start a conduit"}
            <span>· Esc to stop</span>
          </div>
        ) : null}
        <aside className={`canvas-hud${hudOpen ? "" : " is-collapsed"}`} aria-label="Advisory rating summary">
          <button
            type="button"
            className="canvas-hud-head"
            onClick={() => setHudOpen((open) => !open)}
            aria-expanded={hudOpen}
            title={hudOpen ? "Collapse rating summary" : "Expand rating summary"}
          >
            <ScoreGauge score={assessment.overallScore} band={assessment.band} size={34} thickness={11} />
            <span className="canvas-hud-headline">{verdict.headline}</span>
            {hudOpen ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
          </button>
          {hudOpen ? (
            <div className="canvas-hud-body">
              <span className="canvas-hud-detail">{verdict.detail}</span>
              {topFinding ? (
                <button
                  type="button"
                  className={`canvas-hud-finding severity-${topFinding.severity}`}
                  onClick={() => onFindingSelect(topFinding)}
                  title="Highlight affected conduits"
                >
                  <AlertTriangle size={13} aria-hidden="true" />
                  <span>{topFinding.title}</span>
                </button>
              ) : null}
            </div>
          ) : null}
        </aside>
        {project.assets.length === 0 ? (
          <div className="canvas-empty">
            <strong>Empty topology</strong>
            <p>
              Drag an asset from the palette onto the canvas to begin. Press <kbd>Ctrl / ⌘ K</kbd> for commands, or load
              the Sample project from the header.
            </p>
          </div>
        ) : null}
        <ReactFlow
          nodes={flowNodes}
          edges={[]}
          nodeTypes={nodeTypes}
          onNodesChange={handleNodesChange}
          onNodeDragStart={() => setIsDragging(true)}
          onNodeDragStop={commitNodePosition}
          onConnect={handleConnect}
          onNodeClick={(_, node) => onAssetClick(node.id)}
          onPaneClick={() => {
            if (!connectMode) {
              onSelect(null);
            }
          }}
          onSelectionChange={handleSelectionChange}
          defaultViewport={DEFAULT_VIEWPORT}
          minZoom={0.45}
          maxZoom={1.5}
          deleteKeyCode={null}
          connectionRadius={38}
          snapGrid={isPurdue ? [CANVAS_GRID_X, ZONE_ROW_HEIGHT] : [CANVAS_GRID_X, CANVAS_GRID_X]}
          autoPanOnNodeDrag={false}
          proOptions={{ hideAttribution: true }}
        >
          <ViewportPortal>
            {isPurdue ? (
              <div
                className="zone-band-layer"
                aria-hidden="true"
                style={{ "--zone-band-width": `${contentExtent.bandWidth}px` } as CSSProperties}
              >
                {zones.map((zone, index) => (
                  <div
                    className="zone-band-node"
                    key={zone.id}
                    style={
                      {
                        "--zone-band-y": `${index * ZONE_ROW_HEIGHT + ZONE_BAND_Y_OFFSET}px`,
                        "--zone-band-height": `${ZONE_BAND_HEIGHT}px`,
                        "--zone-band-color": zone.color
                      } as CSSProperties
                    }
                  >
                    <strong>
                      {zone.levelLabel} - {zone.shortName}
                    </strong>
                    <span>{zone.name}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {!isPurdue && subnetBoxes.length > 0 ? (
              <div className="subnet-layer" aria-hidden="true">
                {subnetBoxes.map((box) => (
                  <div
                    className="subnet-box"
                    key={box.id}
                    style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
                  >
                    <span className="subnet-box-label">
                      <strong>{box.name}</strong>
                      {box.cidr || box.vlan ? (
                        <small>{[box.cidr, box.vlan ? `VLAN ${box.vlan}` : ""].filter(Boolean).join(" · ")}</small>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
            <svg
              className="conduit-overlay"
              aria-hidden="true"
              style={{ width: contentExtent.overlayWidth, height: contentExtent.overlayHeight }}
            >
              {conduitOverlayItems.map((item) => (
                <g
                  className={`conduit-overlay-edge ${item.labelVisible ? "label-visible" : ""} ${
                    item.selected ? "is-selected" : ""
                  } ${item.highlighted ? "is-highlighted" : ""}`}
                  key={item.id}
                >
                  {item.highlighted || item.selected ? (
                    <path
                      className="conduit-overlay-underlay"
                      d={item.path}
                      style={{ stroke: item.highlighted ? "#e5484d" : "var(--accent)" }}
                    />
                  ) : null}
                  <path
                    className="conduit-overlay-path"
                    d={item.path}
                    style={{
                      stroke: item.color,
                      opacity: item.opacity,
                      strokeDasharray: item.dash
                    }}
                  />
                  <path
                    className="conduit-overlay-hitbox"
                    d={item.path}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(item.id);
                    }}
                  />
                  {item.trustBoundary && item.boundaryMarkers.length === 0 ? (
                    <circle
                      className="conduit-overlay-boundary"
                      cx={item.boundaryX}
                      cy={item.boundaryY}
                      r="5"
                      style={{ stroke: item.color }}
                    />
                  ) : null}
                  {item.boundaryMarkers.map((marker, index) => (
                    <circle
                      className="conduit-overlay-boundary"
                      cx={marker.x}
                      cy={marker.y}
                      key={`${item.id}-boundary-${index}`}
                      r="5"
                      style={{ stroke: item.color }}
                    />
                  ))}
                  {item.label ? (
                    <text className="conduit-overlay-label" x={item.labelX + 8} y={item.labelY - 8} style={{ fill: item.color }}>
                      {item.label}
                    </text>
                  ) : null}
                </g>
              ))}
            </svg>
          </ViewportPortal>
          <Background
            className="snap-grid-background"
            color="#64717d"
            gap={CANVAS_GRID_X}
            lineWidth={0.48}
            variant={BackgroundVariant.Lines}
          />
          <MiniMap
            className="canvas-minimap"
            pannable
            zoomable
            nodeColor={() => "#0f766e"}
            maskColor="rgba(15, 23, 42, 0.08)"
          />
          <Controls position="bottom-left" />
        </ReactFlow>
      </div>
    </section>
  );
}

export function TopologyCanvas(props: TopologyCanvasProps) {
  return (
    <ReactFlowProvider>
      <TopologyCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
