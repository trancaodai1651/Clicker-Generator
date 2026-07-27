import { store, appData } from '../store/appState';
import { processImage } from '../image/pipeline';
import { parseSvg } from '../image/logo';
import { parseLetter } from '../image/letter';
import { buildSvg, LUCIDE_ICONS } from '../image/lucideIcons';
import { resetHistory, setPendingHistoryReset } from '../store/historyManager';
import { hexToRgb, rgbToHex, firstLine, debounce } from '../utils/helpers';
import type { BuildParams, BuildRegion, GeometryResponse, PaletteEntry, RGB, ColorTarget } from '../types';

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
        viewer.setParts(msg.parts, !appData.isInitialLoad); // fix history reset block
        viewer.setView(store.get().view);
        viewer.setSwitchPlacements(msg.switchPlacements ?? []);
        store.set({
          building: false,
          hasParts: msg.parts.length > 0,
          status: msg.warnings && msg.warnings.length ? msg.warnings[0] : '',
        });
        appData.isInitialLoad = false;
        
        // Cập nhật Undo baseline
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

  worker.onerror = (e) => {
    store.set({ building: false, status: 'Worker failed: ' + e.message });
  };

  // ---- Logic click chọn part trên mô hình ----
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
      // Gọi giao diện Color Popover (cần truyền callback từ UI hoặc emit event)
      document.dispatchEvent(new CustomEvent('show-color-popover', { 
        detail: { clientX, clientY, hex: rgbToHex(part.colorRgb), options, target, index }
      }));
      return;
    }

    let nextSelected = s.selectedParts.slice();
    if (shiftKey) {
      nextSelected = nextSelected.includes(partName) ? nextSelected.filter((p) => p !== partName) : [...nextSelected, partName];
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
  };

  if (!quiet) store.set({ building: !appData.isInitialLoad, status: 'Building clicker…' });
  worker.postMessage({ type: 'buildClicker', regions, outline: appData.regionSet.outline, params });
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
      appData.latestParts.forEach((p, idx) => {
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
function dominantInk(s: any): RGB {
  if (s.palette.length === 0) return [180, 180, 185];
  let domIdx = 0;
  for (let i = 1; i < s.palette.length; i++) if (s.palette[i].coverage > s.palette[domIdx].coverage) domIdx = i;
  return s.palette[domIdx]?.filamentRgb ?? [180, 180, 185];
}
function deriveFrameColor(s: any): RGB { const ink = dominantInk(s); return s.importMode === 'image' ? ink : contrastingFrame(ink); }

function syncBaseColor(viewer: any) {
  const s = store.get();
  if (s.baseColorOverride || s.palette.length === 0) return;
  const baseRgb = deriveFrameColor(s);
  const bi = appData.latestParts.findIndex((p) => p.name === 'top-base');
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
  return null;
}
function getAvailableColorOptions(s: any): RGB[] {
  const barColors: RGB[] = [];
  if (s.bodyColorRgb) barColors.push(s.bodyColorRgb);
  if (s.palette) s.palette.forEach((p: any) => { if (p.filamentRgb) barColors.push(p.filamentRgb); });
  const uniqueColors: RGB[] = []; const seen = new Set<string>();
  for (const rgb of barColors) { const key = rgb.join(','); if (!seen.has(key)) { seen.add(key); uniqueColors.push(rgb); } }
  return uniqueColors;
}