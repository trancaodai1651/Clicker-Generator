import { tip } from '../helpers';
import { SAMPLES } from '../../image/sample';

export const renderRightImport = () => `
  <div class="section legend-section">
    <span class="label">Import Source</span>
    <div class="import-grid" id="importTabs" role="tablist">
      <button class="import-card active" data-mode="image" type="button"><span class="card-label">Image</span></button>
      <button class="import-card" data-mode="svg" type="button"><span class="card-label">SVG</span></button>
      <button class="import-card" data-mode="icon" type="button"><span class="card-label">Icon</span></button>
      <button class="import-card" data-mode="text" type="button"><span class="card-label">Text</span></button>
    </div>

    <!-- Image Panel -->
    <div id="imagePanel" class="mode-panel">
      <div class="drop" id="drop">
        <div class="drop-title">Upload image</div>
        <div class="drop-text">Drop an image, or <u>click to browse</u></div>
        <span style="font-size:10px; opacity:0.8; display:block; margin-top:4px;">PNG with transparency works best</span>
      </div>
      <input type="file" id="file" accept="image/*" hidden />
      <div class="switch-row">
        <span class="switch-label">Remove background ${tip('Automatically removes a solid background.')}</span>
        <label class="toggle"><input id="removebg" type="checkbox" /><span class="slider"></span></label>
      </div>
      <div class="switch-row">
        <span class="switch-label">Chibi style ${tip('Flatten noisy phone photos into simplified flat color regions for cute 2D output.')}</span>
        <label class="toggle"><input id="photoFlatten" type="checkbox" /><span class="slider"></span></label>
      </div>
      <span class="sample-heading">Choose a sample image</span>
      <div class="sample-inline-grid" id="sampleGrid">
        ${SAMPLES.map((s, idx) => `
          <div class="sample-inline-item" data-idx="${idx}">
            <img src="${s.src}" alt="${s.name}" />
            <span>${s.name}</span>
          </div>
        `).join('')}
      </div>

      <!-- Custom Base Shape Section -->
      <div class="section" style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border);">
        <span class="label">Custom Base Shape (Đế tùy chỉnh)</span>
        <div class="tabs" style="margin-bottom: 12px;">
          <button id="tab-base-match" class="tab active" type="button">Match Top</button>
          <button id="tab-base-custom" class="tab" type="button">Custom Image</button>
        </div>

        <div id="bottom-upload-zone" style="display: none;">
          <div class="drop" id="drop-bottom" style="min-height: 80px; padding: 16px;">
            <div class="drop-title" style="font-size: 13px;">Upload Bottom Base</div>
            <div class="drop-text" style="font-size: 11px;">Drop a silhouette image here</div>
          </div>
          <input type="file" id="file-bottom" accept="image/*" hidden />

          <!-- Toggle Bật/Tắt khối trơn không màu -->
          <div class="switch-row" style="margin-top: 10px;">
            <span class="switch-label" style="font-size: 12px;">Solid Base (Khối trơn không màu) ${tip('Chỉ giữ lại hình dáng viền đế, bỏ toàn bộ mảng màu họa tiết trên mặt đế.')}</span>
            <label class="toggle"><input id="bottomSolidOnly" type="checkbox" /><span class="slider"></span></label>
          </div>

          <!-- Slider Mở rộng khuôn đế (MẶC ĐỊNH DUY NHẤT 1 THANH TRƯỢT TẠI ĐÂY) -->
          <div class="prow-stacked" style="margin-top:12px;">
            <div class="prow-header">
              <label for="baseExpand">Mở rộng khuôn đế ${tip('Thêm tỷ lệ lề xung quanh để khuôn đế to hơn và bao bọc vừa vặn với logo nắp trên.')}</label>
              <input type="text" class="val" id="baseExpandVal" value="22%" />
            </div>
            <input type="range" id="baseExpand" min="0" max="100" step="1" value="22" />
          </div>

          <!-- Cụm phím D-Pad Căn chỉnh vị trí & Góc xoay đế -->
          <div style="margin-top:12px;">
            <div class="label" style="text-align:center; margin-bottom:6px; font-size:11px;">ALIGN BOTTOM BASE</div>
            <div style="display:flex; justify-content:center; gap:6px; margin-bottom:6px;">
              <button type="button" class="btn" id="baseRotLeft" title="Xoay 15° ngược chiều kim đồng hồ">↺ 15°</button>
              <button type="button" class="btn" id="baseNudgeUp" title="Di chuyển lên">↑</button>
              <button type="button" class="btn" id="baseRotRight" title="Xoay 15° theo chiều kim đồng hồ">↻ 15°</button>
            </div>
            <div style="display:flex; justify-content:center; gap:6px;">
              <button type="button" class="btn" id="baseNudgeLeft" title="Sang trái">←</button>
              <button type="button" class="btn" id="baseResetPos" title="Đặt lại vị trí gốc">⌂</button>
              <button type="button" class="btn" id="baseNudgeRight" title="Sang phải">→</button>
            </div>
            <div style="display:flex; justify-content:center; gap:6px; margin-top:6px;">
              <button type="button" class="btn" id="baseNudgeDown" title="Di chuyển xuống">↓</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- SVG Panel -->
    <div id="svgPanel" class="mode-panel" hidden>
      <p class="hint-text">Drop or upload SVG vector files.</p>
      <div id="uploadGallery"></div>
      <label class="upload-cta">Upload SVG file(s)<input id="svgUpload" type="file" accept=".svg,image/svg+xml" multiple /></label>
      <div class="switch-row">
        <span class="switch-label">Remove background</span>
        <label class="toggle"><input id="removebgSvg" type="checkbox" /><span class="slider"></span></label>
      </div>
      <button class="primary" id="generateSvg" style="margin-top: 10px; width: 100%;">Generate</button>
    </div>

    <!-- Icon Panel -->
    <div id="iconPanel" class="mode-panel" hidden>
      <div id="iconSearchWrap">
        <input id="iconSearch" type="search" placeholder="Search Lucide icons…" autocomplete="off" spellcheck="false" />
        <button id="iconSearchClear" type="button">×</button>
      </div>
      <div id="iconCount"></div>
      <div id="gallery"></div>
      <button class="primary" id="generateIcon" style="margin-top: 10px; width: 100%;">Generate</button>
    </div>

    <!-- Text Panel -->
    <div id="letterPanel" class="mode-panel" hidden>
      <div class="field">
        <label for="letterText">Custom Text</label>
        <textarea id="letterText" rows="2" maxlength="30" style="width: 100%; min-height: 48px;">Custom\nText</textarea>
      </div>
      <div class="field">
        <label>Font</label>
        <div id="fontGrid" class="font-grid"></div>
        <label class="upload">+ Import font<input id="fontUpload" type="file" accept=".ttf,.otf,.json" /></label>
      </div>
      <button class="primary" id="generateText" style="margin-top: 10px; width: 100%;">Generate</button>
    </div>
  </div>
`;