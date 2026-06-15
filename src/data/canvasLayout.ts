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
