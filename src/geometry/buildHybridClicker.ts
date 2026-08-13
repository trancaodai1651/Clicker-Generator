import type {
  BlocksBuildParams,
  BuildParams,
  BuildRegion,
  ClickerPart,
  PartGroup,
  RGB,
  Ring,
  SwitchPlacement,
} from '../types';
import { BuildContext } from './buildContext';
import { buildBlocks, type KeycapAsset, type PreparedBlockAssets } from './buildBlocks';
import { getRingArea, sectionIsEmpty } from './geometry/sectionUtils';
import { roundedRect } from './geometry/shapeFactory';

const DEFAULT_BODY: RGB = [238, 238, 240];

function ringBounds(rings: Ring[]) {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const ring of rings) for (const [x, y] of ring) {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function toPart(
  solid: any,
  kind: 'cap' | 'body',
  group: PartGroup,
  colorRgb: RGB,
  name: string,
): ClickerPart {
  const mesh = solid.getMesh();
  return {
    kind,
    group,
    colorRgb,
    name,
    numProp: mesh.numProp,
    vertProperties: new Float32Array(mesh.vertProperties),
    triVerts: new Uint32Array(mesh.triVerts),
  };
}

function solidFromPart(wasm: any, part: ClickerPart): any {
  const mesh = new wasm.Mesh({
    numProp: part.numProp,
    vertProperties: new Float32Array(part.vertProperties),
    triVerts: new Uint32Array(part.triVerts),
  });
  mesh.merge();
  return wasm.Manifold.ofMesh(mesh);
}

function shiftPart(part: ClickerPart, dx: number, dy: number) {
  for (let i = 0; i < part.vertProperties.length; i += part.numProp) {
    part.vertProperties[i] += dx;
    part.vertProperties[i + 1] += dy;
  }
}

function taperedImageTransition(
  ctx: BuildContext,
  moduleWidth: number,
  moduleDepth: number,
  badgeWidth: number,
  badgeDepth: number,
  vertical: boolean,
  moduleHeight: number,
  moduleBottom: number,
  baseJoin: number,
): any {
  const bodyHalf = (vertical ? moduleWidth : moduleDepth) / 2 + 2.2;
  // Keep the neck fixed in the physical keychain dimensions. Previously this
  // was derived from badgeWidth/badgeDepth, so changing image size stretched
  // the neck and produced sharp side shoulders.
  const imageHalf = Math.min(bodyHalf * 0.7, 6.2);
  let points: [number, number][];
  const smoothStep = (t: number) => t * t * (3 - 2 * t);

  if (vertical) {
    const imageY = -badgeDepth / 2 + 3.5;
    // The base begins below the image's tangent. Let the transition overlap
    // the base by 1.5 mm so the union is unambiguous and the outline is not a
    // rectangle abruptly touching the badge.
    const baseY = baseJoin - 1.5;
    const samples = 18;
    points = [];
    // Curved side walls (rather than straight diagonal edges) create the
    // soft, moulded shoulder visible on the reference keychain.
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const y = imageY + (baseY - imageY) * t;
      const half = imageHalf + (bodyHalf - imageHalf) * smoothStep(t);
      points.push([-half, y]);
    }
    for (let i = samples; i >= 0; i--) {
      const t = i / samples;
      const y = imageY + (baseY - imageY) * t;
      const half = imageHalf + (bodyHalf - imageHalf) * smoothStep(t);
      points.push([half, y]);
    }
  } else {
    const imageX = badgeWidth / 2 - 3.5;
    const baseX = baseJoin + 1.5;
    const samples = 18;
    points = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const x = imageX + (baseX - imageX) * t;
      const half = imageHalf + (bodyHalf - imageHalf) * smoothStep(t);
      points.push([x, -half]);
    }
    for (let i = samples; i >= 0; i--) {
      const t = i / samples;
      const x = imageX + (baseX - imageX) * t;
      const half = imageHalf + (bodyHalf - imageHalf) * smoothStep(t);
      points.push([x, half]);
    }
  }

  const profile = ctx.track(new ctx.wasm.CrossSection([points], 'NonZero'));
  const solid = ctx.track(ctx.wasm.Manifold.extrude(profile, Math.max(0.2, moduleHeight))
    .translate([0, 0, moduleBottom]));
  return { profile, solid };
}

/**
 * Builds the image + blocks variant inside the normal Clicker worker path.
 * The block row stays made from the official connector modules; the uploaded
 * image becomes a larger badge attached to the first module.
 */
export function buildHybridClicker(
  wasm: any,
  assets: PreparedBlockAssets,
  keycap: KeycapAsset,
  imageRegions: BuildRegion[],
  imageOutline: Ring[],
  params: BuildParams,
  blockParams: BlocksBuildParams,
): { parts: ClickerPart[]; switchPlacements: SwitchPlacement[]; warnings: string[] } {
  const blockResult = buildBlocks(wasm, assets, keycap, blockParams);
  const warnings = [...blockResult.warnings];
  if (!imageOutline.length) {
    warnings.push('Upload an image to create the image badge.');
    return blockResult;
  }

  const ctx = new BuildContext(wasm);
  const outlineBounds = ringBounds(imageOutline);
  if (!(outlineBounds.width > 0.01 && outlineBounds.height > 0.01)) {
    ctx.cleanup();
    warnings.push('The image has no printable outline.');
    return blockResult;
  }

  const moduleSource = assets.byMask.get(0)?.solid;
  const moduleBox = moduleSource?.boundingBox?.();
  if (!moduleBox) {
    ctx.cleanup();
    warnings.push('Block assets are not ready for the image + blocks model.');
    return blockResult;
  }

  const moduleWidth = moduleBox.max[0] - moduleBox.min[0];
  const moduleDepth = moduleBox.max[1] - moduleBox.min[1];
  const moduleHeight = (moduleBox.max[2] - moduleBox.min[2]) * Math.max(
    0.25,
    Math.min(4, (blockParams.baseHeightMm ?? 14) / 14),
  );
  const moduleBottom = moduleBox.min[2];
  const moduleTop = moduleBottom + moduleHeight;
  const pitch = Math.max(1, assets.pitch || moduleWidth);
  const count = Math.max(1, blockParams.glyphs.length);

  // Keep the image as a compact head/badge. The block row is shifted away
  // from it so the two solids overlap slightly and print as one object.
  const badgeMax = Math.max(20, Math.min(100, params.hybridImageSizeMm ?? 35));
  const imageScale = badgeMax / Math.max(outlineBounds.width, outlineBounds.height);
  const centerX = (outlineBounds.minX + outlineBounds.maxX) / 2;
  const centerY = (outlineBounds.minY + outlineBounds.maxY) / 2;
  const scaledOutline = imageOutline
    .filter((ring) => ring.length >= 3 && Math.abs(getRingArea(ring)) > 0.0001)
    .map((ring) => ring.map(([x, y]) => [
      (x - centerX) * imageScale,
      (y - centerY) * imageScale,
    ] as [number, number]));
  if (!scaledOutline.length) {
    ctx.cleanup();
    warnings.push('The image outline could not be converted into a badge.');
    return blockResult;
  }

  let imageSection = ctx.track(new wasm.CrossSection(scaledOutline, 'NonZero'));
  const badgeMargin = Math.max(1.4, Math.min(3.2, params.borderWidth || 2));
  const badgeSection = ctx.track(imageSection.offset(badgeMargin, 'Round', 2.0, 32));
  const badgeWidth = badgeSection.bounds().max[0] - badgeSection.bounds().min[0];
  const badgeDepth = badgeSection.bounds().max[1] - badgeSection.bounds().min[1];
  // Keep the block row anchored to the normal 35 mm image position. Changing
  // image size then changes only the neck span, rather than moving the whole
  // base along with the image.
  const referenceBadgeScale = 35 / Math.max(0.01, badgeMax);
  const referenceBadgeWidth = badgeWidth * referenceBadgeScale;
  const referenceBadgeDepth = badgeDepth * referenceBadgeScale;
  const badgeBody = ctx.track(wasm.Manifold.extrude(badgeSection, Math.max(0.2, moduleHeight))
    .translate([0, 0, moduleBottom]));
  const deckHeight = Math.max(0.8, Math.min(1.6, params.imageDepth + 0.35));
  const badgeDeck = ctx.track(wasm.Manifold.extrude(badgeSection, deckHeight)
    .translate([0, 0, moduleTop]));

  const bodyColor = blockParams.bodyColorRgb ?? params.bodyColorRgb ?? DEFAULT_BODY;
  // Hybrid must keep the official connector modules. The previous custom
  // square carrier replaced their stepped MX sockets with shallow rectangular
  // pockets and also caused the image badge to be cut by the base cutter.
  // Square/rounded appearance is supplied by the connector assets themselves.
  const firstBlockPart = blockResult.parts.find((part) => part.name === 'block-0');
  const blockParts = blockResult.parts.filter((part) => part !== firstBlockPart);
  const parts: ClickerPart[] = [
    ...blockParts,
    toPart(badgeBody, 'body', 'base', bodyColor, 'hybrid-image-base'),
    toPart(badgeDeck, 'body', 'base', bodyColor, 'hybrid-image-deck'),
  ];

  const imageTop = moduleTop + deckHeight;
  for (let index = 0; index < imageRegions.length; index++) {
    const region = imageRegions[index];
    const rings = region.rings
      .filter((ring) => ring.length >= 3 && Math.abs(getRingArea(ring)) > 0.0001)
      .map((ring) => ring.map(([x, y]) => [
        (x - centerX) * imageScale,
        (y - centerY) * imageScale,
      ] as [number, number]));
    if (!rings.length) continue;
    try {
      const section = ctx.track(new wasm.CrossSection(rings, 'NonZero'));
      const layer = ctx.track(wasm.Manifold.extrude(section, 0.9).translate([0, 0, imageTop - 0.05]));
      if (!sectionIsEmpty(section) && !layer.isEmpty()) {
        // The image is part of the badge/base assembly. Keep it in the base
        // group so Exploded view lifts only the keycaps, not the artwork.
        parts.push(toPart(layer, 'body', 'base', region.filamentRgb, `hybrid-image-${index}`));
      }
    } catch {
      warnings.push(`Image region ${index + 1} could not be printed.`);
    }
  }

  // Shift the official block assembly so its first module meets the badge.
  const firstOffset = ((count - 1) / 2) * pitch;
  // Deliberate overlap: the connector neck below hides the seam and makes the
  // image badge and the first block print as one continuous body.
  const desiredGap = -1.5;
  let shiftX = 0;
  let shiftY = 0;
  if (blockParams.vertical) {
    const firstY = firstOffset;
    const desiredFirstY = -(referenceBadgeDepth / 2 + moduleDepth / 2) - desiredGap;
    shiftY = desiredFirstY - firstY;
  } else {
    const firstX = -firstOffset;
    const desiredFirstX = referenceBadgeWidth / 2 + moduleWidth / 2 + desiredGap;
    shiftX = desiredFirstX - firstX;
  }

  const shiftedPlacements = blockResult.switchPlacements.map((placement) => ({
    ...placement,
    x: placement.x + shiftX,
    y: placement.y + shiftY,
  }));
  const firstBlockSolid = firstBlockPart
    ? ctx.track(solidFromPart(wasm, firstBlockPart).translate([shiftX, shiftY, 0]))
    : null;
  // Keep the image badge and its neck as one solid. The overlap is deliberate:
  // it removes a weak seam at the image/block junction in both preview and STL.
  const mergeImageAssembly = (...solids: any[]) => {
    let merged = badgeBody;
    for (const solid of solids) merged = ctx.track(merged.add(solid));
    const baseIndex = parts.findIndex((part) => part.name === 'hybrid-image-base');
    if (baseIndex >= 0) parts[baseIndex] = toPart(merged, 'body', 'base', bodyColor, 'hybrid-image-base');
  };
  if (blockParams.squareModuleBase !== false) {
    // Replace the square neck with a tapered transition that matches the
    // circular image badge into the straight-sided base.
    const transition = taperedImageTransition(
      ctx,
      moduleWidth,
      moduleDepth,
      badgeWidth,
      badgeDepth,
      blockParams.vertical,
      moduleHeight,
      moduleBottom,
      blockParams.vertical
        ? Math.max(...shiftedPlacements.map((placement) => placement.y)) + moduleDepth / 2 + 0.8
        : Math.min(...shiftedPlacements.map((placement) => placement.x)) - moduleWidth / 2 - 0.8,
    );
    // The official block module remains a separate connector-aware solid.
    // Only the neck is unioned into the image badge, so no module socket or
    // underside geometry can be accidentally removed.
    mergeImageAssembly(transition.solid, ...(firstBlockSolid ? [firstBlockSolid] : []));
  } else {
    const firstCenterX = -firstOffset + shiftX;
    const firstCenterY = firstOffset + shiftY;
    const neckWidth = Math.max(5, Math.min(moduleWidth * 0.78, badgeWidth * 0.72));
    const neckDepth = Math.max(5, Math.min(moduleDepth * 0.78, badgeDepth * 0.72));
    let bridge: any;
    if (blockParams.vertical) {
      const yMin = firstCenterY + moduleDepth / 2 - 0.8;
      const yMax = -badgeDepth / 2 + 1.2;
      const span = Math.max(3, yMax - yMin);
      const bridgeProfile = ctx.track(roundedRect(ctx, neckWidth, span, Math.min(2.4, neckWidth / 4)));
      bridge = ctx.track(wasm.Manifold.extrude(bridgeProfile, moduleHeight)
        .translate([0, (yMin + yMax) / 2, moduleBottom]));
    } else {
      const xMin = badgeWidth / 2 - 1.2;
      const xMax = firstCenterX - moduleWidth / 2 + 0.8;
      const span = Math.max(3, xMax - xMin);
      const bridgeProfile = ctx.track(roundedRect(ctx, span, neckDepth, Math.min(2.4, neckDepth / 4)));
      bridge = ctx.track(wasm.Manifold.extrude(bridgeProfile, moduleHeight)
        .translate([(xMin + xMax) / 2, 0, moduleBottom]));
    }
    mergeImageAssembly(bridge, ...(firstBlockSolid ? [firstBlockSolid] : []));
  }

  for (const part of blockParts) shiftPart(part, shiftX, shiftY);
  blockResult.switchPlacements.splice(0, blockResult.switchPlacements.length, ...shiftedPlacements);

  ctx.cleanup();
  return { parts, switchPlacements: blockResult.switchPlacements, warnings };
}
