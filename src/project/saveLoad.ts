import { store, appData } from '../store/appState';
import { downloadBlob } from '../utils/helpers';
import type { RgbaImage } from '../image/decode';

export function imageToDataUrl(img: RgbaImage): string {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  return c.toDataURL('image/png');
}

export function dataUrlToImage(url: string): Promise<RgbaImage> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas');
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(im, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height);
      resolve({ data: d.data, width: c.width, height: c.height });
    };
    im.onerror = () => reject(new Error('bad image data'));
    im.src = url;
  });
}

export function saveProject() {
  const s = store.get();
  const proj = {
    version: 3,
    settings: {
      colorCount: s.colorCount, baseShape: s.baseShape, capWidthMm: s.capWidthMm,
      topThickness: s.topThickness, imageDepth: s.imageDepth, imageMargin: s.imageMargin, 
      borderWidth: s.borderWidth, baseHeight: s.baseHeight, mergeTopFrame: s.mergeTopFrame, keepMeshesSeparate: s.keepMeshesSeparate, 
      tolerance: s.tolerance, stemTolerance: s.stemTolerance, switches: s.switches, keychain: s.keychain, 
      smoothing: s.smoothing, photoFlatten: s.photoFlatten, removeBg: s.removeBg, importMode: s.importMode, 
      currentText: appData.currentText, currentFontId: appData.currentFontId, 
      currentSvgText: appData.currentSvgText, currentSvgName: appData.currentSvgName, 
      currentIconText: appData.currentIconText, currentIconName: appData.currentIconName, 
      colorMode: s.colorMode, limitedColors: s.limitedColors, bodyColorRgb: s.bodyColorRgb, 
      paletteOverrides: s.paletteOverrides, baseColorOverride: s.baseColorOverride, 
      partOverrides: s.partOverrides, edgeSettings: s.edgeSettings, extrudeChamfer: s.extrudeChamfer, 
      separateLetters: s.separateLetters, componentHeights: s.componentHeights,
    },
    palette: s.palette,
    image: appData.originalImage ? imageToDataUrl(appData.originalImage) : null,
  };
  downloadBlob(new Blob([JSON.stringify(proj)], { type: 'application/json' }), 'clicker-project.json');
  store.set({ status: 'Project saved ✓' });
}

export async function loadProject(file: File, reprocessFn: () => void, rebuildFn: () => void, uiHandler: any) {
  try {
    store.set({ building: true, status: 'Loading project…' });
    const proj = JSON.parse(await file.text());
    const set = proj.settings ?? {};

    appData.currentText = set.currentText ?? 'Custom\nText';
    appData.currentFontId = set.currentFontId ?? 'helvetiker-regular';
    appData.currentSvgText = set.currentSvgText ?? '';
    appData.currentSvgName = set.currentSvgName ?? '';
    appData.currentIconText = set.currentIconText ?? '';
    appData.currentIconName = set.currentIconName ?? '';

    if (appData.currentSvgText && appData.currentSvgName) {
      uiHandler.addUploadedSvg(appData.currentSvgText, appData.currentSvgName);
    }

    store.set({
      importMode: set.importMode ?? 'image', colorCount: set.colorCount ?? store.get().colorCount,
      baseShape: set.baseShape ?? store.get().baseShape, capWidthMm: set.capWidthMm ?? store.get().capWidthMm,
      topThickness: set.topThickness ?? store.get().topThickness, imageDepth: set.imageDepth ?? store.get().imageDepth,
      imageMargin: set.imageMargin ?? store.get().imageMargin, borderWidth: set.borderWidth ?? store.get().borderWidth,
      mergeTopFrame: set.mergeTopFrame ?? false, keepMeshesSeparate: set.keepMeshesSeparate ?? true,
      tolerance: set.tolerance ?? store.get().tolerance, stemTolerance: set.stemTolerance ?? 0,
      switches: Array.isArray(set.switches) && set.switches.length ? set.switches : [{ x: set.switchOffsetX ?? 0, y: set.switchOffsetY ?? 0, rotation: set.switchRotation ?? 0 }],
      activeSwitchIndex: 0, keychain: set.keychain && typeof set.keychain === 'object' ? { offsetMm: 0, ...set.keychain } : { enabled: set.keychain === true, style: 'loop', angleDeg: 90, holeDiameterMm: 5.2, offsetMm: 0 },
      smoothing: set.smoothing ?? store.get().smoothing, photoFlatten: set.photoFlatten ?? store.get().photoFlatten, removeBg: set.removeBg ?? store.get().removeBg,
      currentIconName: appData.currentIconName || 'circle', colorMode: set.colorMode ?? 'normal',
      limitedColors: set.limitedColors ?? [], bodyColorRgb: set.bodyColorRgb ?? [120, 124, 130],
      paletteOverrides: set.paletteOverrides ?? [], partOverrides: set.partOverrides ?? {},
      edgeSettings: set.edgeSettings ?? store.get().edgeSettings, extrudeChamfer: set.extrudeChamfer ?? false,
      separateLetters: set.separateLetters ?? false, componentHeights: set.componentHeights ?? {},
    });

    if (set.importMode === 'image' && proj.image) appData.originalImage = await dataUrlToImage(proj.image);

    reprocessFn();

    if (Array.isArray(proj.palette)) {
      // Sửa thành:
    const pal = store.get().palette.map((p: any, i: number) => ({ ...p, filamentRgb: proj.palette[i]?.filamentRgb ?? p.filamentRgb }));
      store.set({ palette: pal, baseColorOverride: set.baseColorOverride ?? null });
      rebuildFn();
    }
  } catch (err) {
    store.set({ building: false, status: 'Could not load project: ' + String(err) });
  }
}