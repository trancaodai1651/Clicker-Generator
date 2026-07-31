// 🟢 Re-export các type từ root src/types.ts ra ngoài
export type { 
  BaseShapeKind, EditMode, EdgeSetting, EdgeStyle, 
  KeychainParams, PaletteEntry, SwitchPlacement, ViewMode, RGB 
} from '../types';

import type { BaseShapeKind, EditMode, EdgeSetting, EdgeStyle, KeychainParams, PaletteEntry, SwitchPlacement, ViewMode, RGB } from '../types';
import type { RgbaImage } from '../image/decode';
import type { SectionAxis } from '../viewer/viewer';

export interface UiState {
  status: string; building: boolean; hasParts: boolean; colorCount: number; palette: PaletteEntry[];
  baseShape: BaseShapeKind; bottomBaseMode?: 'match' | 'custom';
  capWidthMm: number; topThickness: number; imageDepth: number; imageMargin: number; borderWidth: number; baseHeight: number;
  mergeTopFrame: boolean; isFlatKeychain: boolean; keepMeshesSeparate: boolean;
  tolerance: number; stemTolerance: number; switches: SwitchPlacement[]; activeSwitchIndex: number;
  smoothing: number; photoFlatten: boolean; keychain: KeychainParams; removeBg: boolean; view: ViewMode; showSwitch: boolean;
  importMode: 'image' | 'svg' | 'icon' | 'text'; currentIconName: string; colorMode: 'normal' | 'limited';
  limitedColors: RGB[]; bodyColorRgb: RGB; paletteOverrides: RGB[]; baseColorOverride: RGB | null;
  partOverrides: Record<string, RGB>; editMode: EditMode; edgeSettings: EdgeSetting[]; extrudeChamfer: boolean;
  separateLetters: boolean; extrudeHeight: number | null; componentHeights: Record<string, number>;
  selectedParts: string[]; canUndo: boolean; canRedo: boolean; canRefresh: boolean;
}

export interface UiCallbacks {
  onBottomModeChange(mode: 'match' | 'custom'): void;
  onBottomUpload(file: File): void;
  onUpload(file: File): void; onSample(load: () => Promise<RgbaImage>): void;
  onColorCount(n: number): void; onSmoothing(v: number): void;
  onFilament(index: number, hex: string): void; onShape(kind: BaseShapeKind): void;
  onWidth(mm: number): void; onTopThickness(mm: number): void; onImageDepth(mm: number): void;
  onBaseHeight(mm: number): void; onImageMargin(mm: number): void; onBorderWidth(mm: number): void;
  onMergeTopFrame(merge: boolean): void; onKeepMeshesSeparate(keep: boolean): void;
  onIsFlatKeychain(isFlat: boolean): void; onSocketTolStep(delta: number): void; onStemTolStep(delta: number): void;
  onSwitchNudge(dx: number, dy: number): void; onSwitchRotate(deltaDeg: number): void;
  onSwitchReset(): void; onSwitchCount(n: number): void; onActiveSwitch(i: number): void;
  onSwitchResetAll(): void; onKeychainToggle(on: boolean): void; onKeychainRotate(deltaDeg: number): void;
  onKeychainSize(deltaMm: number): void; onKeychainOffset(deltaMm: number): void;
  onRemoveBg(on: boolean): void; onPhotoFlatten(on: boolean): void; onView(mode: ViewMode): void; onShowSwitch(on: boolean): void;
  onSection(axis: SectionAxis, pos: number): void; onExport(): void; onExportSTL(): void;
  onRenderPng(): void; onAiPrompt(): void; onSaveProject(): void; onLoadProject(file: File): void;
  onBodyColor(hex: string): void; onImportMode(mode: 'image' | 'svg' | 'icon' | 'text'): void;
  onSvgUpload(file: File): void; onSelectSvg(svgText: string, name: string): void;
  onSelectIcon(svgText: string, name: string): void; onTextChange(text: string): void;
  onFontSelect(fontId: string): void; onImportFont(file: File): void; onThemeChange(theme: string): void;
  onEditMode(mode: EditMode): void; onEdgeStyle(target: string, style: EdgeStyle): void;
  onEdgeStep(target: string, delta: number): void; onExtrudeStep(delta: number): void;
  onExtrudeChamfer(on: boolean): void; onSeparateLetters(on: boolean): void;
  onGenerate(): void; onUndo(): void; onRedo(): void; onRefresh(): void; onBackToHome(): void;
}
