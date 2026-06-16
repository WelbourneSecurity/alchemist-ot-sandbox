import { zones } from "./catalog";
import type { Point, Subnet, ZoneId } from "../models/types";

export const ZONE_ROW_HEIGHT = 118;
export const ZONE_BAND_Y_OFFSET = -18;
export const ZONE_BAND_HEIGHT = 104;
export const ASSET_NODE_WIDTH = 184;
export const ASSET_NODE_HEIGHT = 74;
export const DEFAULT_VIEWPORT = { x: 210, y: 58, zoom: 0.74 };
export const CANVAS_GRID_X = 48;
export const CANVAS_GRID_Y = ZONE_ROW_HEIGHT;
// Left edge for assets — keeps them clear of the Purdue zone-label gutter.
export const ASSET_MIN_X = 48;

export function zoneIndex(zoneId: ZoneId) {
  return Math.max(
    0,
    zones.findIndex((zone) => zone.id === zoneId)
  );
}

export function assetYForZone(zoneId: ZoneId) {
  return zoneIndex(zoneId) * ZONE_ROW_HEIGHT + ZONE_BAND_Y_OFFSET + (ZONE_BAND_HEIGHT - ASSET_NODE_HEIGHT) / 2;
}

export function inferZoneFromY(y: number): ZoneId {
  const index = Math.min(zones.length - 1, Math.max(0, Math.round((y - ZONE_BAND_Y_OFFSET) / ZONE_ROW_HEIGHT)));
  return zones[index].id;
}

export function snapPointToZone(point: Point, zoneId: ZoneId): Point {
  return {
    x: snapX(Math.max(ASSET_MIN_X, point.x - ASSET_NODE_WIDTH / 2)),
    y: assetYForZone(zoneId)
  };
}

export function snapX(x: number) {
  return Math.max(ASSET_MIN_X, Math.round(x / CANVAS_GRID_X) * CANVAS_GRID_X);
}

export function snapAssetPosition(point: Point): Point {
  const zone = inferZoneFromY(point.y + ASSET_NODE_HEIGHT / 2);
  return {
    x: snapX(point.x),
    y: assetYForZone(zone)
  };
}

export const ASSET_MIN_GAP = 24;

// Horizontal step used when packing a Purdue lane left-to-right.
const PURDUE_PACK_STEP = ASSET_NODE_WIDTH + ASSET_MIN_GAP;

/** Snaps a free (network-layout) point to the canvas grid on both axes — no zone lanes. */
export function snapToGrid(point: Point): Point {
  return {
    x: snapX(point.x),
    y: Math.round(point.y / CANVAS_GRID_X) * CANVAS_GRID_X
  };
}

/**
 * Projects assets into Purdue lanes: every asset gets `y = assetYForZone(zone)` and is
 * packed left-to-right within its lane (ordered by current free x, then id, for stability).
 * Returns a map of assetId -> projected position. The free `position` is never mutated —
 * this is a pure view transform so toggling back to the network layout is lossless.
 */
export function projectPurduePositions(
  assets: Array<{ id: string; zone: ZoneId; position: Point }>
): Map<string, Point> {
  const byZone = new Map<ZoneId, Array<{ id: string; x: number }>>();
  for (const asset of assets) {
    const lane = byZone.get(asset.zone) ?? [];
    lane.push({ id: asset.id, x: asset.position.x });
    byZone.set(asset.zone, lane);
  }

  const projected = new Map<string, Point>();
  for (const [zoneId, lane] of byZone) {
    lane.sort((a, b) => a.x - b.x || (a.id < b.id ? -1 : 1));
    const y = assetYForZone(zoneId);
    lane.forEach((entry, index) => {
      projected.set(entry.id, { x: ASSET_MIN_X + index * PURDUE_PACK_STEP, y });
    });
  }
  return projected;
}

/**
 * Returns a grid-snapped point near `desired` that does not 2D-overlap any other asset.
 * Used when adding/dropping in the free network layout so a new node never spawns on top
 * of an existing one; it nudges right by one column at a time until clear.
 */
export function resolveFreePosition(
  desired: Point,
  movingId: string | null,
  assets: Array<{ id: string; position: Point }>
): Point {
  const others = assets.filter((asset) => asset.id !== movingId).map((asset) => asset.position);
  const collides = (point: Point) =>
    others.some(
      (other) =>
        Math.abs(other.x - point.x) < ASSET_NODE_WIDTH + ASSET_MIN_GAP &&
        Math.abs(other.y - point.y) < ASSET_NODE_HEIGHT + ASSET_MIN_GAP
    );

  let point = snapToGrid(desired);
  for (let step = 0; step < 400 && collides(point); step += 1) {
    point = { x: snapX(point.x + CANVAS_GRID_X), y: point.y };
  }
  return point;
}

export const SUBNET_BOX_PAD = 22;
export const SUBNET_LABEL_HEIGHT = 26;

export interface SubnetBox {
  id: string;
  name: string;
  cidr: string;
  vlan: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Computes a labelled bounding box around each subnet's member assets for the network
 * layout. Subnets with no members are skipped. The box is padded and reserves a label
 * strip above the assets.
 */
export function subnetBoundingBoxes(
  assets: Array<{ subnetId?: string; position: Point }>,
  subnets: Subnet[],
  pad = SUBNET_BOX_PAD
): SubnetBox[] {
  return subnets.flatMap((subnet) => {
    const members = assets.filter((asset) => asset.subnetId === subnet.id);
    if (members.length === 0) {
      return [];
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const member of members) {
      minX = Math.min(minX, member.position.x);
      minY = Math.min(minY, member.position.y);
      maxX = Math.max(maxX, member.position.x + ASSET_NODE_WIDTH);
      maxY = Math.max(maxY, member.position.y + ASSET_NODE_HEIGHT);
    }

    return [
      {
        id: subnet.id,
        name: subnet.name,
        cidr: subnet.cidr,
        vlan: subnet.vlan,
        x: minX - pad,
        y: minY - pad - SUBNET_LABEL_HEIGHT,
        width: maxX - minX + pad * 2,
        height: maxY - minY + pad * 2 + SUBNET_LABEL_HEIGHT
      }
    ];
  });
}

/**
 * Returns a grid-snapped x near `desiredX` that does not overlap any other asset in the
 * same zone (assets share a y per zone, so overlap is purely horizontal). Searches outward
 * from the desired column, preferring the nearest free slot. Used on add and on drop so
 * assets can never sit on top of each other.
 */
export function resolveAssetX(
  desiredX: number,
  zoneId: ZoneId,
  movingId: string | null,
  assets: Array<{ id: string; zone: ZoneId; position: Point }>
): number {
  const others = assets
    .filter((asset) => asset.id !== movingId && asset.zone === zoneId)
    .map((asset) => asset.position.x);
  const minSeparation = ASSET_NODE_WIDTH + ASSET_MIN_GAP;
  const overlaps = (x: number) => others.some((otherX) => Math.abs(x - otherX) < minSeparation);

  const start = snapX(desiredX);
  if (!overlaps(start)) {
    return start;
  }
  for (let delta = CANVAS_GRID_X; delta <= 8000; delta += CANVAS_GRID_X) {
    const right = snapX(start + delta);
    if (!overlaps(right)) {
      return right;
    }
    const left = snapX(start - delta);
    if (left >= ASSET_MIN_X && !overlaps(left)) {
      return left;
    }
  }
  return start;
}
