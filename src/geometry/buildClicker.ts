import type { BuildParams, BuildRegion, ClickerPart, PartGroup, Ring, RGB, SwitchPlacement } from '../types';
import { BuildContext } from './buildContext';
import { sectionIsEmpty, getRingArea, removeHoles, edgePointAt } from './geometry/sectionUtils';
import { roundedRect, makeHexagon, makeStar, makeHeart, makeEgg } from './geometry/shapeFactory';
import { resolveSwitches } from './sizing/switchPlacement';
import { createEdgeBevelBlock, applyEdges } from './modifiers/edgeBuilder';

export function buildClicker(
  wasm: any, socket: any, stem: any, regions: BuildRegion[], outline: Ring[], params: BuildParams, bottomOutline?: Ring[]
): { parts: ClickerPart[]; switchPlacements: SwitchPlacement[]; warnings: string[] } {
  const ctx = new BuildContext(wasm);
  const isFlatKeychain = (params as any).isFlatKeychain ?? false;

  const socketBB = socket.boundingBox(); const stemBB = stem.boundingBox();
  const socketDim = Math.max(socketBB.max[0] - socketBB.min[0], socketBB.max[1] - socketBB.min[1]);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const ring of outline) for (const [x, y] of ring) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  if (!isFinite(minX)) { minX = -0.5; maxX = 0.5; minY = -0.5; maxY = 0.5; }

  const border = Math.max(0, params.imageMargin);
  const switchClear = socketDim + 3.0, minCap = switchClear + 1.0;

  let imageScale = Math.max(2, params.capWidthMm - 2 * border);
  let imgW = (maxX - minX || 1) * imageScale, imgH = (maxY - minY || 1) * imageScale;
  if (params.baseShape === 'outline' && Math.min(imgW, imgH) + 2 * border < minCap) {
    imageScale *= (minCap - 2 * border) / Math.min(imgW, imgH);
    imgW = (maxX - minX || 1) * imageScale; imgH = (maxY - minY || 1) * imageScale;
  }
  const scaleRings = (rings: Ring[]) => rings.map(r => r.map(([x, y]) => [x * imageScale, y * imageScale] as [number, number]));

  const filledOutline = (rings: Ring[]): any => {
    const validRings = scaleRings(rings).filter(r => r.length >= 3 && getRingArea(r) > 0.001);
    return validRings.length === 0 ? ctx.track(ctx.wasm.CrossSection.square([imageScale, imageScale], true)) : ctx.simp(ctx.track(new ctx.wasm.CrossSection(validRings, 'NonZero')));
  };

  // --- 1. Tạo Nắp Phím Trên (Cap) ---
  let plate: any;
  if (params.baseShape === 'outline') {
    const solidPlate = removeHoles(ctx, ctx.track(filledOutline(outline).offset(border, 'Round', 2.0, 32)));
    const sRad = Math.min(4.0, border * 1.5);
    plate = sRad > 0.05 ? ctx.simp(ctx.track(solidPlate.offset(sRad, 'Round', 2.0, 24).offset(-sRad, 'Round', 2.0, 24))) : ctx.simp(solidPlate);
  } else {
    const genShape = (rr: number) => {
      switch (params.baseShape) {
        case 'square': return roundedRect(ctx, 2 * rr, 2 * rr, 2 * rr * 0.22);
        case 'hexagon': return makeHexagon(ctx, rr);
        case 'heart': return makeHeart(ctx, rr);
        case 'star': return makeStar(ctx, rr);
        case 'egg': return makeEgg(ctx, rr);
        default: return ctx.track(ctx.wasm.CrossSection.circle(rr, 160));
      }
    };
    let hi = Math.max(1, Math.hypot(Math.max(imgW / 2 + border, minCap / 2), Math.max(imgH / 2 + border, minCap / 2)));
    const unit = genShape(1);
    const fits = (k: number) => sectionIsEmpty(ctx.track(ctx.track(ctx.wasm.CrossSection.square([(2 * Math.max(imgW / 2 + border, minCap / 2)) / k, (2 * Math.max(imgH / 2 + border, minCap / 2)) / k], true)).subtract(unit)));
    for (let i = 0; i < 40 && !fits(hi); i++) hi *= 2;
    let lo = 1e-3; for (let i = 0; i < 26; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
    plate = genShape(hi);
  }

  const imageArea = ctx.shrink(plate, border, plate, sectionIsEmpty);
  const { applied, pinched } = resolveSwitches((params.switches?.length ? params.switches : [{ x: 0, y: 0, rotation: 0 }]).slice(0, 3), plate.bounds(), switchClear, socketDim);

  let stemSized = stem;
  if (Math.abs(params.stemTolerance ?? 0) > 0.001) {
    const stemDim = Math.max(stemBB.max[0] - stemBB.min[0], stemBB.max[1] - stemBB.min[1]);
    if (stemDim > 0.1) stemSized = ctx.track(stem.scale([Math.max(0.5, (stemDim + params.stemTolerance) / stemDim), Math.max(0.5, (stemDim + params.stemTolerance) / stemDim), 1]));
  }

  // --- 2. Hộc Chứa Nắp & Switch (Well Footprint) ---
  const socketColumnBase = roundedRect(ctx, switchClear, switchClear, 2.5);
  let wellFp: any = ctx.grow(plate, Math.max(0.05, params.tolerance));
  for (const sw of applied) wellFp = ctx.track(wellFp.add(ctx.track((Math.abs(sw.rotation) > 0.001 ? ctx.track(socketColumnBase.rotate(sw.rotation)) : socketColumnBase).translate([sw.x, sw.y]))));
  
  const wellFootprint = ctx.simp(wellFp);

  // --- 3. Khuôn Đế Hạt Cà Phê + Tự Động Tạo Lề Rộng Rãi ---
  let customBasePlate: any = null;
  let bottomScaleFactor = 1.0;

  if (bottomOutline && bottomOutline.length > 0) {
    const rawBase = removeHoles(ctx, ctx.track(filledOutline(bottomOutline)));

    const bRot = params.bottomRotation ?? 0;
    const bX = params.bottomOffsetX ?? 0;
    const bY = params.bottomOffsetY ?? 0;

    let unitBase = rawBase;
    if (Math.abs(bRot) > 0.001) unitBase = ctx.track(unitBase.rotate(bRot));
    if (Math.abs(bX) > 0.001 || Math.abs(bY) > 0.001) unitBase = ctx.track(unitBase.translate([bX, bY]));

    let scaledBase = unitBase;
    for (let i = 0; i < 30; i++) {
      const outside = ctx.track(wellFootprint.subtract(scaledBase));
      if (sectionIsEmpty(outside)) break;
      bottomScaleFactor += 0.04;
      scaledBase = ctx.track(unitBase.scale([bottomScaleFactor, bottomScaleFactor]));
    }

    // 🟢 Sử dụng hệ số tùy chỉnh từ UI (Mặc định 22%)
    const expandPercent = params.bottomExpandPercent ?? 22;
    bottomScaleFactor *= (1.0 + expandPercent / 100);
    scaledBase = ctx.track(unitBase.scale([bottomScaleFactor, bottomScaleFactor]));

    customBasePlate = scaledBase;
  }

  const bodyFootprint = customBasePlate 
    ? ctx.simp(customBasePlate) 
    : ctx.simp(ctx.grow(wellFootprint, Math.max(0.4, params.borderWidth)));

  const cavityFloorZ = socketBB.max[2], slabBottomZ = stemBB.max[2], backing = Math.max(0.8, params.topThickness), imageDepth = Math.max(0.2, params.imageDepth);
  const slabTopZ = slabBottomZ + backing + imageDepth, imageBottomZ = slabBottomZ + backing;
  const bodyBottomZ = socketBB.min[2] - params.floorThickness;
  const bodyTopZ = slabTopZ - Math.max(0.4, Math.min(params.capProud, Math.max(0.4, slabTopZ - cavityFloorZ - 1.0)));
  const wellFloorZ = Math.min(cavityFloorZ, slabBottomZ - Math.max(0, params.travel));

  const parts: ClickerPart[] = [];
  const toPart = (solid: any, kind: 'cap'|'body', group: PartGroup, colorRgb: RGB, name: string): ClickerPart => {
    const mesh = solid.getMesh();
    return { kind, group, colorRgb, name, numProp: mesh.numProp, vertProperties: new Float32Array(mesh.vertProperties), triVerts: new Uint32Array(mesh.triVerts) };
  };

  // --- 4. Tạo Nắp ĐẮK LẮK ---
  const cap = ctx.extrudeAt(plate, backing + imageDepth, slabBottomZ, sectionIsEmpty);
  let placed2D: any = null; const holesByLevel = new Map<number, any>();

  for (const { r } of regions.map(r => ({ r })).sort((a, b) => (a.r.coverage ?? 1) - (b.r.coverage ?? 1))) {
    const validRings = scaleRings(r.rings).filter(ring => ring.length >= 3 && getRingArea(ring) > 0.001);
    if (validRings.length === 0) continue;
    let cs = ctx.simp(ctx.track(new ctx.wasm.CrossSection(validRings, 'NonZero')));
    if (params.colorBleed > 0.001) cs = ctx.grow(cs, params.colorBleed);
    let fp = ctx.track(cs.intersect(imageArea));
    if (sectionIsEmpty(fp)) continue;
    if (placed2D) fp = ctx.track(fp.subtract(placed2D));
    if (sectionIsEmpty(fp)) continue;
    placed2D = placed2D ? ctx.track(placed2D.add(fp)) : fp;

    const level = params.componentHeights?.[r.partName] ?? 0, heightShift = level * params.stepHeight;
    const topZ = slabTopZ + Math.max(0, heightShift), bottomZ = imageBottomZ + Math.min(0, heightShift);
    let inlay = ctx.extrudeAt(fp, topZ - bottomZ, bottomZ, sectionIsEmpty);
    if (inlay.isEmpty()) continue;

    const es = params.edgeSettings?.find(s => s.target === r.partName);
    const eStyle = es && es.style !== 'none' && es.radius >= 0.05 ? es.style : (params.extrudeChamfer && heightShift > 0 ? 'chamfer' : null);
    if (eStyle) {
      const radius = Math.min(es ? es.radius : 0.5, (topZ - bottomZ) * 0.49, 3.0);
      if (radius >= 0.05) { const modBlock = createEdgeBevelBlock(ctx, fp, radius, eStyle, topZ, false); if (modBlock) inlay = ctx.track(inlay.subtract(modBlock)); }
    }
    parts.push(toPart(inlay, 'cap', 'top', r.filamentRgb, r.partName));
    holesByLevel.set(level, holesByLevel.get(level) ? ctx.track(holesByLevel.get(level).add(fp)) : fp);
  }

  let base = cap;
  if (!(params as any).mergeTopFrame) {
    for (const [level, hole2D] of holesByLevel.entries()) base = ctx.track(base.subtract(ctx.extrudeAt(hole2D, slabTopZ - (imageBottomZ + Math.min(0, level * params.stepHeight)) + 0.02, (imageBottomZ + Math.min(0, level * params.stepHeight)) - 0.01, sectionIsEmpty)));
  }

  if (!isFlatKeychain) {
    for (const sw of applied) base = ctx.track(base.add(Math.abs(sw.rotation) > 0.001 || Math.abs(sw.x) > 0.001 || Math.abs(sw.y) > 0.001 ? ctx.track(ctx.track(stemSized.rotate([0, 0, sw.rotation])).translate([sw.x, sw.y, 0])) : stemSized));
    if (slabBottomZ - stemBB.min[2] > 0.4) {
      let skirtBasePlate = plate;
      for (const sw of applied) skirtBasePlate = ctx.track(skirtBasePlate.add(ctx.track(ctx.track(ctx.wasm.CrossSection.square([14.8, 14.8], true)).translate([sw.x, sw.y]))));
      const skirtInner = ctx.track(skirtBasePlate.offset(-1.4, 'Miter', 2.0));
      if (!sectionIsEmpty(skirtInner)) {
        base = ctx.track(base.add(ctx.extrudeAt(ctx.track(skirtBasePlate.subtract(skirtInner)), (slabBottomZ - stemBB.min[2]) + 0.3, stemBB.min[2], sectionIsEmpty)));
        const skirtExt = ctx.track(skirtBasePlate.subtract(plate));
        if (!sectionIsEmpty(skirtExt)) base = ctx.track(base.add(ctx.extrudeAt(skirtExt, slabTopZ - stemBB.min[2], stemBB.min[2], sectionIsEmpty)));
      }
    }
  }
  parts.unshift(toPart(base, 'cap', 'top', params.baseFilamentRgb, 'top-base'));

  // --- 5. Khung Đế Hạt Cà Phê (Body) ---
  let body = applyEdges(ctx, ctx.extrudeAt(bodyFootprint, bodyTopZ - bodyBottomZ, bodyBottomZ, sectionIsEmpty), params.edgeSettings, bodyFootprint, bodyBottomZ, bodyTopZ);

  // Đục thủng hộc switch
  body = ctx.track(body.subtract(ctx.extrudeAt(wellFootprint, bodyTopZ - wellFloorZ + 1, wellFloorZ, sectionIsEmpty)));

  // --- 6. Đúc Mảng Màu Hạt Cà Phê Phủ Trọn Mặt Trên Của Đế ---
  if (params.bottomRegions && params.bottomRegions.length > 0 && customBasePlate) {
    for (const r of params.bottomRegions) {
      const validRings = scaleRings(r.rings).filter(ring => ring.length >= 3 && getRingArea(ring) > 0.001);
      if (validRings.length === 0) continue;
      let cs = ctx.simp(ctx.track(new ctx.wasm.CrossSection(validRings, 'NonZero')));

      const bRot = params.bottomRotation ?? 0;
      const bX = params.bottomOffsetX ?? 0;
      const bY = params.bottomOffsetY ?? 0;

      if (Math.abs(bRot) > 0.001) cs = ctx.track(cs.rotate(bRot));
      if (Math.abs(bX) > 0.001 || Math.abs(bY) > 0.001) cs = ctx.track(cs.translate([bX, bY]));

      if (bottomScaleFactor > 1.001) {
        cs = ctx.track(cs.scale([bottomScaleFactor, bottomScaleFactor]));
      }

      // Trừ hộc switch chính giữa
      cs = ctx.track(cs.subtract(wellFootprint));
      if (sectionIsEmpty(cs)) continue;

      const level = params.componentHeights?.[r.partName] ?? 0;
      const heightShift = level * params.stepHeight;
      const topZ = bodyTopZ + Math.max(0, heightShift);
      const bottomZ = bodyTopZ - Math.max(0.2, params.imageDepth) + Math.min(0, heightShift);
      
      let inlay = ctx.extrudeAt(cs, topZ - bottomZ, bottomZ, sectionIsEmpty);
      if (!inlay.isEmpty()) {
        parts.push(toPart(inlay, 'body', 'base', r.filamentRgb, r.partName));
        body = ctx.track(body.subtract(ctx.extrudeAt(cs, topZ - bottomZ + 0.01, bottomZ - 0.01, sectionIsEmpty)));
      }
    }
  }

  // --- 7. Móc Khóa & Lỗ Switch Socket ---
  if (params.keychain?.enabled) {
    const { p, dir } = edgePointAt(isFlatKeychain ? plate : bodyFootprint, params.keychain.angleDeg ?? 90);
    const px = p[0] + -dir[1] * (params.keychain.offsetMm ?? 0), py = p[1] + dir[0] * (params.keychain.offsetMm ?? 0);
    const loopR = Math.max(3.2, Math.max(1.5, (params.keychain.holeDiameterMm ?? 5.2) / 2) + 1.8);
    const localLoop = ctx.track(ctx.wasm.CrossSection.circle(loopR, 64).translate([0, loopR]));
    const localBridge = ctx.track(ctx.wasm.CrossSection.square([loopR * 2, loopR + loopR * 3.5], true).translate([0, loopR - (loopR + loopR * 3.5) / 2]));
    let loopFootprint = ctx.track(localLoop.add(localBridge));
    if (Math.abs((params.keychain.angleDeg ?? 90) - 90) > 0.001) loopFootprint = ctx.track(loopFootprint.rotate((params.keychain.angleDeg ?? 90) - 90));
    loopFootprint = ctx.track(loopFootprint.translate([px, py]));
    if (isFlatKeychain) loopFootprint = ctx.track(loopFootprint.subtract(imageArea));
    const loopTh = isFlatKeychain ? (backing + imageDepth) : Math.max(2.5, Math.min(4.0, (bodyTopZ - bodyBottomZ) * 0.35));
    const loopZb = isFlatKeychain ? slabBottomZ : bodyBottomZ;
    const hole = ctx.extrudeAt(ctx.track(ctx.wasm.CrossSection.circle(Math.max(1.5, (params.keychain.holeDiameterMm ?? 5.2) / 2), 48).translate([-loopR * Math.sin(((params.keychain.angleDeg ?? 90) - 90) * Math.PI / 180) + px, loopR * Math.cos(((params.keychain.angleDeg ?? 90) - 90) * Math.PI / 180) + py])), loopTh + 2, loopZb - 1, sectionIsEmpty);
    if (isFlatKeychain) { base = ctx.track(base.add(ctx.extrudeAt(loopFootprint, loopTh, loopZb, sectionIsEmpty))); base = ctx.track(base.subtract(hole)); } 
    else { body = ctx.track(body.add(ctx.extrudeAt(loopFootprint, loopTh, loopZb, sectionIsEmpty))); body = ctx.track(body.subtract(hole)); }
  }

  for (const sw of applied) body = ctx.track(body.subtract(Math.abs(sw.rotation) > 0.001 || Math.abs(sw.x) > 0.001 || Math.abs(sw.y) > 0.001 ? ctx.track(ctx.track(socket.rotate([0, 0, sw.rotation])).translate([sw.x, sw.y, 0])) : socket));

  if (!isFlatKeychain && !body.isEmpty()) parts.push(toPart(body, 'body', 'base', params.bodyColorRgb, 'base-body'));

  for (const es of params.edgeSettings) {
    if ((es.target === 'capTop' || es.target === 'top-base') && es.style !== 'none') {
      const r = Math.min(es.radius, (backing + imageDepth) * 0.4, 2.5);
      if (r > 0.05) {
        const modBlock = createEdgeBevelBlock(ctx, plate, r, es.style, slabTopZ, false);
        if (modBlock) { base = ctx.track(base.subtract(modBlock)); const idx = parts.findIndex(p => p.name === 'top-base'); if (idx >= 0) parts[idx] = toPart(base, 'cap', 'top', params.baseFilamentRgb, 'top-base'); }
      }
    }
  }

  ctx.cleanup();
  return { parts, switchPlacements: applied, warnings: pinched ? ['Switches pulled together to fit the cap.'] : [] };
}