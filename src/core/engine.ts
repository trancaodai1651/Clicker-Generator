import { store, appData } from '../store/appState';
import { processImage } from '../image/pipeline';
import { parseSvg } from '../image/logo';
import { parseLetter } from '../image/letter';
import { buildSvg, LUCIDE_ICONS } from '../image/lucideIcons';
import { setPendingHistoryReset } from '../store/historyManager';
import { rgbToHex, firstLine, debounce } from '../utils/helpers';
import type { BuildParams, BuildRegion, GeometryResponse, PaletteEntry, RGB, ColorTarget, ClickerPart } from '../types';

export const worker = new Worker(new URL('../workers/geometry.worker.ts', import.meta.url), { type: 'module' });

const LIGHT_FRAME: RGB = [240, 240, 240];
const DARK_FRAME: RGB = [38, 38, 42];

// ---- Khởi tạo Engine & Worker ----
export function setupEngine(viewer: any, initAssetsFn: () => void, loadDefaultClickerFn: () => void) {
  worker.onmessage = (e: MessageEvent<GeometryResponse>) => {
    const msg = e.data;
    switch (msg.type) {
      case 'ready':
        initAssetsFn();
        break;
      case 'initDone':
        appData.assetsReady = true;
        viewer.setSwitch(msg.switchMesh);
        viewer.showSwitch(store.get().showSwitch);
        store.set({ status: 'Ready. Import an image, SVG, icon, or text.' });

        if (store.get().importMode === 'icon' && !appData.currentIconText) {
          const first = LUCIDE_ICONS.find((ic) => ic.name === 'circle') || LUCIDE_ICONS[0];
          if (first) {
            appData.currentIconText = buildSvg(first.node);
            appData.currentIconName = first.name;
            store.set({ currentIconName: first.name });
          }
        }
        if (appData.isInitialLoad) {
          loadDefaultClickerFn();
        } else {
          reprocess();
        }
        break;
      case 'parts':
        appData.latestParts = msg.parts;
        viewer.setParts(msg.parts, !appData.isInitialLoad);
        viewer.setView(store.get().view);
        viewer.setSwitchPlacements(msg.switchPlacements ?? []);
        store.set({
          building: false,
          hasParts: msg.parts.length > 0,
          status: msg.warnings && msg.warnings.length ? msg.warnings[0] : '',
        });
        appData.isInitialLoad = false;
        
        import('../store/historyManager').then(m => {
          if (m.pendingHistoryReset) {
            m.setPendingHistoryReset(false);
            m.resetHistory();
          }
        });
        break;
      case 'error':
        store.set({ building: false, status: 'Error: ' + firstLine(msg.message) });
        appData.isInitialLoad = false;
        break;
    }
  };

  worker.onerror = (e: ErrorEvent) => {
    store.set({ building: false, status: 'Worker failed: ' + e.message });
  };

  viewer.onPartPick((index: number | null, clientX: number, clientY: number, shiftKey: boolean) => {
    const s = store.get();
    if (index === null) {
      store.set({ selectedParts: [] });
      return;
    }
    const partName = appData.latestParts[index]?.name;
    if (!partName) return;

    if (s.editMode === 'color') {
      store.set({ selectedParts: [partName] });
      const part = appData.latestParts[index];
      if (!part) return;
      const target = partColorTarget(part.name);
      if (!target) return;
      
      const options = getAvailableColorOptions(s);
      document.dispatchEvent(new CustomEvent('show-color-popover', { 
        detail: { clientX, clientY, hex: rgbToHex(part.colorRgb), options, target, index }
      }));
      return;
    }

    let nextSelected = s.selectedParts.slice();
    if (shiftKey) {
      // Sửa lỗi any cho biến p tại đây
      nextSelected = nextSelected.includes(partName) ? nextSelected.filter((p: string) => p !== partName) : [...nextSelected, partName];
    } else {
      nextSelected = [partName];
    }
    store.set({ selectedParts: nextSelected });
  });
}

// ---- Core Logic ----
export function reprocess() {
  setPendingHistoryReset(true);
  store.set({ baseColorOverride: null });
  const s = store.get();

  if (s.importMode === 'image') {
    if (!appData.originalImage) return;
    store.set({ building: true, status: 'Removing background & tracing…' });
    const imgClone = { data: new Uint8ClampedArray(appData.originalImage.data), width: appData.originalImage.width, height: appData.originalImage.height };
    appData.regionSet = processImage(imgClone, s.colorCount, {
      removeBg: s.removeBg, smoothing: s.smoothing, customColors: s.colorMode === 'limited' ? s.limitedColors : undefined,
    });
  } else if (s.importMode === 'svg') {
    if (!appData.currentSvgText) { store.set({ status: 'Upload an SVG file first.' }); return; }
    try {
      store.set({ building: true, status: 'Parsing SVG…' });
      appData.regionSet = parseSvg(appData.currentSvgText, { removeBg: s.removeBg });
    } catch (e: any) { store.set({ building: false, status: 'Error: ' + e.message }); return; }
  } else if (s.importMode === 'icon') {
    if (!appData.currentIconText) { store.set({ status: 'Select an icon first.' }); return; }
    try {
      store.set({ building: true, status: 'Parsing Icon…' });
      appData.regionSet = parseSvg(appData.currentIconText);
    } catch (e: any) { store.set({ building: false, status: 'Error: ' + e.message }); return; }
  } else if (s.importMode === 'text') {
    try {
      store.set({ building: true, status: 'Generating Text…' });
      appData.regionSet = parseLetter(appData.currentText, appData.currentFontId, 15, s.separateLetters);
    } catch (e: any) { store.set({ building: false, status: 'Error: ' + e.message }); return; }
  }

  if (!appData.regionSet) return;
  const palette: PaletteEntry[] = appData.regionSet.regions.map((r, i) => ({
    quantRgb: r.quantRgb, filamentRgb: s.paletteOverrides[i] ?? r.quantRgb, coverage: r.coverage,
  }));
  store.set({ palette });

  if (palette.length === 0) {
    store.set({ building: false, status: 'No outline found.' });
    return;
  }
  rebuild();
}

export function rebuild(quiet = false) {
  if (!appData.regionSet || appData.regionSet.regions.length === 0) return;
  if (!appData.assetsReady) { store.set({ status: 'Waiting for switch assets…' }); return; }
  
  const s = store.get();
  const regions: BuildRegion[] = [];
  appData.regionSet.regions.forEach((r, i) => {
    const baseColor = s.palette[i]?.filamentRgb ?? r.quantRgb;
    r.components.forEach((comp, j) => {
      const partName = `top-color-${i}-${j}`;
      regions.push({ filamentRgb: s.partOverrides?.[partName] ?? baseColor, coverage: r.coverage, rings: comp.rings, partName });
    });
  });

  // 🟢 1. BÓC TÁCH CÁC VÙNG MÀU CHO CẢ PHẦN ĐẾ
  const bottomRegions: BuildRegion[] = [];
  if (s.bottomBaseMode === 'custom' && appData.bottomRegionSet && !(s as any).bottomSolidOnly) {
    appData.bottomRegionSet.regions.forEach((r, i) => {
      r.components.forEach((comp, j) => {
        const partName = `bottom-color-${i}-${j}`;
        bottomRegions.push({ filamentRgb: s.partOverrides?.[partName] ?? r.quantRgb, coverage: r.coverage, rings: comp.rings, partName });
      });
    });
  }

  const isIcon = s.importMode === 'icon';
  const effectiveBaseShape = isIcon && s.baseShape === 'outline' ? 'circle' : s.baseShape;
  const capBaseColor: RGB = s.baseColorOverride ?? deriveFrameColor(s);

  const params: BuildParams = {
    baseShape: effectiveBaseShape, capWidthMm: s.capWidthMm, topThickness: Math.max(1, s.topThickness),
    imageDepth: s.imageDepth, imageMargin: s.imageMargin, borderWidth: s.borderWidth, mergeTopFrame: s.mergeTopFrame,
    keepMeshesSeparate: s.keepMeshesSeparate, isFlatKeychain: s.isFlatKeychain, capProud: 4.0, tolerance: s.tolerance,
    stemTolerance: s.stemTolerance, colorBleed: 0.12, stepHeight: 0.6, travel: 4.0, floorThickness: 1.6,
    switches: s.switches, keychain: s.keychain, baseFilamentRgb: capBaseColor, bodyColorRgb: s.bodyColorRgb ?? [120, 124, 130],
    edgeSettings: s.edgeSettings, extrudeChamfer: s.extrudeChamfer, componentHeights: s.componentHeights,
    
    // 🟢 2. TRUYỀN THÔNG SỐ CĂN CHỈNH & DANH SÁCH MÀU ĐẾ SANG WORKER
    bottomOffsetX: (s as any).bottomOffsetX ?? 0,
    bottomOffsetY: (s as any).bottomOffsetY ?? 0,
    bottomRotation: (s as any).bottomRotation ?? 0,
    bottomExpandPercent: (s as any).bottomExpandPercent ?? 22, // 🟢 Mặc định 22%
    bottomRegions,
  };

  const bottomOutline = appData.bottomRegionSet ? appData.bottomRegionSet.outline : undefined;

  if (!quiet) store.set({ building: !appData.isInitialLoad, status: 'Building clicker…' });
  worker.postMessage({ type: 'buildClicker', regions, outline: appData.regionSet.outline, params, bottomOutline });
}

export function applyModelRecolor(target: ColorTarget, rgb: RGB, partIndex: number, viewer: any) {
  const s = store.get();
  if (target.kind === 'region') {
    const i = target.index;
    const overrides = s.partOverrides ? { ...s.partOverrides } : {};

    if (partIndex >= 0 && appData.latestParts[partIndex]) {
      const part = appData.latestParts[partIndex];
      viewer.setPartColor(partIndex, rgb);
      appData.latestParts[partIndex] = { ...appData.latestParts[partIndex], colorRgb: rgb };
      overrides[part.name] = rgb;
    } else {
      const prefix = `top-color-${i}-`;
      appData.latestParts.forEach((p: ClickerPart, idx: number) => {
        if (p.name.startsWith(prefix)) {
          viewer.setPartColor(idx, rgb);
          appData.latestParts[idx] = { ...appData.latestParts[idx], colorRgb: rgb };
          overrides[p.name] = rgb;
        }
      });
      const palette = s.palette.slice();
      if (palette[i]) palette[i] = { ...palette[i], filamentRgb: rgb };
      const paletteOverrides = s.paletteOverrides.slice();
      paletteOverrides[i] = rgb;
      store.set({ palette, paletteOverrides });
    }
    store.set({ partOverrides: overrides });
    syncBaseColor(viewer);
  } else if (target.kind === 'body') {
    viewer.setPartColor(partIndex, rgb);
    if (appData.latestParts[partIndex]) appData.latestParts[partIndex] = { ...appData.latestParts[partIndex], colorRgb: rgb };
    store.set({ bodyColorRgb: rgb });
  } else {
    viewer.setPartColor(partIndex, rgb);
    if (appData.latestParts[partIndex]) appData.latestParts[partIndex] = { ...appData.latestParts[partIndex], colorRgb: rgb };
    store.set({ baseColorOverride: rgb });
  }
}

export const debouncedRebuild = debounce(rebuild, 130);
export const debouncedQuietRebuild = debounce(() => rebuild(true), 160);
export const debouncedReprocess = debounce(reprocess, 220);

// ---- Helpers Nhỏ Nội Bộ Engine ----
function relLuminance(rgb: RGB): number { return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]; }
function contrastingFrame(ink: RGB): RGB { return relLuminance(ink) > 150 ? DARK_FRAME : LIGHT_FRAME; }
function dominantInk(s: ReturnType<typeof store.get>): RGB {
  if (s.palette.length === 0) return [180, 180, 185];
  let domIdx = 0;
  for (let i = 1; i < s.palette.length; i++) if (s.palette[i].coverage > s.palette[domIdx].coverage) domIdx = i;
  return s.palette[domIdx]?.filamentRgb ?? [180, 180, 185];
}
function deriveFrameColor(s: ReturnType<typeof store.get>): RGB { const ink = dominantInk(s); return s.importMode === 'image' ? ink : contrastingFrame(ink); }

function syncBaseColor(viewer: any) {
  const s = store.get();
  if (s.baseColorOverride || s.palette.length === 0) return;
  const baseRgb = deriveFrameColor(s);
  const bi = appData.latestParts.findIndex((p: ClickerPart) => p.name === 'top-base');
  if (bi >= 0) {
    appData.latestParts[bi] = { ...appData.latestParts[bi], colorRgb: baseRgb };
    viewer.setPartColor(bi, baseRgb);
  }
}
function partColorTarget(name: string): ColorTarget | null {
  if (name === 'base-body') return { kind: 'body' };
  if (name === 'top-base') return { kind: 'base' };
  const m = /^top-color-(\d+)(?:-(\d+))?$/.exec(name);
  if (m) return { kind: 'region', index: +m[1], compIndex: m[2] ? +m[2] : 0 };
  
  // 🟢 NHẬN DẠNG MẢNH MÀU PHẦN ĐẾ
  const mBot = /^bottom-color-(\d+)(?:-(\d+))?$/.exec(name);
  if (mBot) return { kind: 'region', index: +mBot[1], compIndex: mBot[2] ? +mBot[2] : 0 };
  
  return null;
}
function getAvailableColorOptions(s: ReturnType<typeof store.get>): RGB[] {
  const barColors: RGB[] = [];
  if (s.bodyColorRgb) barColors.push(s.bodyColorRgb);
  if (s.palette) s.palette.forEach((p: PaletteEntry) => { if (p.filamentRgb) barColors.push(p.filamentRgb); });
  const uniqueColors: RGB[] = []; const seen = new Set<string>();
  for (const rgb of barColors) { const key = rgb.join(','); if (!seen.has(key)) { seen.add(key); uniqueColors.push(rgb); } }
  return uniqueColors;
}

// Hàm hỗ trợ thu nhỏ ảnh về kích thước tối ưu để dò viền tức thì
function downscaleImage(img: { data: Uint8ClampedArray; width: number; height: number }, maxDim = 512) {
  if (img.width <= maxDim && img.height <= maxDim) return img;

  const scale = maxDim / Math.max(img.width, img.height);
  const newW = Math.round(img.width * scale);
  const newH = Math.round(img.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return img;

  const imgData = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
  ctx.putImageData(imgData, 0, 0);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = newW;
  outCanvas.height = newH;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) return img;

  outCtx.drawImage(canvas, 0, 0, newW, newH);
  const scaledData = outCtx.getImageData(0, 0, newW, newH);

  return {
    data: scaledData.data,
    width: newW,
    height: newH
  };
}

export function processBottomImage() {
  if (!appData.bottomImage) return;
  store.set({ building: true, status: 'Tracing bottom base…' });
  
  // Tự động nén ảnh về tối đa 512px giúp dò viền siêu tốc
  const scaledImg = downscaleImage(appData.bottomImage, 512);

  const imgClone = { 
    data: new Uint8ClampedArray(scaledImg.data), 
    width: scaledImg.width, 
    height: scaledImg.height 
  };
  
  appData.bottomRegionSet = processImage(imgClone, 2, { 
    removeBg: true, 
    smoothing: store.get().smoothing 
  });
  
  rebuild();
}