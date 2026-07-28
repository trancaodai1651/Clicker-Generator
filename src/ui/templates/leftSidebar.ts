import { ASSET_BASE } from '../constants';
import { tip } from '../helpers';

export const renderLeftSidebar = () => `
  <div class="app-header">
    <button id="btnBackHome" class="btn-back-home">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      Dashboard
    </button>
    <h1>Clicker Generator</h1>
    <p class="app-subtitle">Generate printable 3D model of a clicker from an image</p>
    <p class="app-credit">Made by
      <a class="app-credit-link" href="https://makerworld.com/en/@Vostok_Labs" target="_blank" rel="noopener noreferrer">
        <img class="credit-logo only-dark" src="${ASSET_BASE}assets/favicon/vostokfaviconwhite.png" alt="" aria-hidden="true" />
        <img class="credit-logo only-light" src="${ASSET_BASE}assets/favicon/Vostokfaviconblack.png" alt="" aria-hidden="true" />
        Vostok Labs
      </a>
    </p>
  </div>

  <div class="section" id="previewViewSection">
    <span class="label">Preview &amp; View</span>
    <div class="tabs" id="viewTabs" role="tablist" style="margin-bottom: 12px;">
      <button class="tab active" data-view="assembled" type="button">Assembled</button>
      <button class="tab" data-view="exploded" type="button">Exploded</button>
    </div>
    <div class="switch-row">
      <span class="switch-label">Show MX switch ${tip('Shows a reference MX switch in the preview so you can check the fit. It is not part of the exported model.')}</span>
      <label class="toggle"><input id="showswitch" type="checkbox" /><span class="slider"></span></label>
    </div>
  </div>

  <div class="section" id="baseStyleSection">
    <span class="label">Base style ${tip('Outline follows your image silhouette. Shape places the image on a preset base such as a circle or square.')}</span>
    <div class="field">
      <div class="tabs" id="shapeTypeTabs" role="tablist" style="margin-bottom: 12px;">
        <button class="tab" data-style="outline" type="button">Outline</button>
        <button class="tab" data-style="shape" type="button">Shape</button>
      </div>
    </div>
    <div class="field" id="shapeSelectField" style="margin-bottom: 12px;">
      <label for="shapeSelect">Shape geometry ${tip('The preset base shape used when the Shape base style is selected.')}</label>
      <select id="shapeSelect">
        <option value="circle">Circle</option>
        <option value="square">Square</option>
        <option value="hexagon">Hexagon</option>
        <option value="heart">Heart</option>
        <option value="star">Star</option>
        <option value="egg">Egg</option>
      </select>
    </div>
    <div class="prow-stacked">
      <div class="prow-header">
        <label for="width">Size ${tip('Overall size of the clicker (its longest side, in mm). This scales the whole model proportionally, not just the width.')}</label>
        <input type="text" class="val" id="widthVal" />
      </div>
      <input type="range" id="width" min="20" max="200" step="1" />
    </div>
    <div class="prow-stacked">
      <div class="prow-header">
        <label for="margin">Padding ${tip('Khoảng đệm từ mép hình ảnh đến chân của khung viền ngoài.')}</label>
        <input type="text" class="val" id="marginVal" />
      </div>
      <input type="range" id="margin" min="0" max="15" step="0.1" />
    </div>
    <div class="prow-stacked">
      <div class="prow-header">
        <label for="borderwidth">Border thickness ${tip('Độ dày của viền ngoài bao quanh hình ảnh, tính bằng mm.')}</label>
        <input type="text" class="val" id="borderwidthVal" />
      </div>
      <input type="range" id="borderwidth" min="0" max="15" step="0.1" />
    </div>
    <div class="switch-row" style="margin-top: 12px; margin-bottom: 12px;">
      <span class="switch-label">Merge base & image ${tip('Hợp nhất phần nền viền (Top Base) và hình ảnh (Image) thành một khối đồng nhất, hoặc tách rời chúng.')}</span>
      <label class="toggle"><input id="mergeTopFrame" type="checkbox" /><span class="slider"></span></label>
    </div>
    <div class="switch-row" id="keepMeshesRow" style="margin-bottom: 12px; padding-left: 24px; border-left: 2px solid var(--border); display: none;">
      <span class="switch-label" style="font-size: 0.85em; color: var(--muted);">Giữ ranh giới khối (Keep meshes separate) <br/><i>Giữ nguyên cấu trúc lưới 3D riêng biệt của hình ảnh, không hòa tan phẳng lỳ vào nền.</i></span>
      <label class="toggle" style="transform: scale(0.8);"><input id="keepMeshesSeparate" type="checkbox" /><span class="slider"></span></label>
    </div>
  </div>
`;