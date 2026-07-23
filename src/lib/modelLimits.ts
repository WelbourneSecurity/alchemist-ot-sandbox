/**
 * Soft ceilings on model size. The topology canvas renders every asset and
 * conduit as a React Flow node/edge with no virtualization, so very large
 * models degrade interaction. These are advisory only — nothing is blocked;
 * the user is warned so an oversized import is a considered choice.
 */
export const SOFT_ASSET_LIMIT = 150;
export const SOFT_CONDUIT_LIMIT = 300;

/** A warning string when a model is large enough to hurt canvas performance, else null. */
export function oversizeWarning(assetCount: number, conduitCount: number): string | null {
  const parts: string[] = [];
  if (assetCount > SOFT_ASSET_LIMIT) parts.push(`${assetCount} assets (recommended under ${SOFT_ASSET_LIMIT})`);
  if (conduitCount > SOFT_CONDUIT_LIMIT) parts.push(`${conduitCount} conduits (recommended under ${SOFT_CONDUIT_LIMIT})`);
  if (!parts.length) return null;
  return `Large model: ${parts.join(" and ")}. The canvas may feel sluggish; assessment is unaffected.`;
}
