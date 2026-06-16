import { zones } from "./catalog";
import type { Point, ZoneId } from "../models/types";

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

const ASSET_MIN_GAP = 24;

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
