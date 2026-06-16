import { describe, expect, it } from "vitest";
import type { Point, ZoneId } from "../models/types";
import { ASSET_NODE_WIDTH, resolveAssetX, snapX } from "./canvasLayout";

type LayoutAsset = { id: string; zone: ZoneId; position: Point };

describe("resolveAssetX", () => {
  it("snaps the desired x when the zone is empty", () => {
    expect(resolveAssetX(300, "level1", null, [])).toBe(snapX(300));
  });

  it("moves a new asset clear of one already in the zone", () => {
    const assets: LayoutAsset[] = [{ id: "a", zone: "level1", position: { x: 300, y: 0 } }];
    const x = resolveAssetX(300, "level1", null, assets);
    expect(Math.abs(x - 300)).toBeGreaterThanOrEqual(ASSET_NODE_WIDTH);
  });

  it("ignores assets in other zones", () => {
    const assets: LayoutAsset[] = [{ id: "a", zone: "level0", position: { x: 300, y: 0 } }];
    expect(resolveAssetX(300, "level1", null, assets)).toBe(snapX(300));
  });

  it("ignores the asset being moved", () => {
    const assets: LayoutAsset[] = [{ id: "a", zone: "level1", position: { x: 300, y: 0 } }];
    expect(resolveAssetX(300, "level1", "a", assets)).toBe(snapX(300));
  });
});
