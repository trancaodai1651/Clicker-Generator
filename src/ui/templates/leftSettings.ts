import { tip } from '../helpers';

export const renderLeftSettings = () => `
  <div id="geometrySettingsContainer">
    <!-- SECTION 1: COLORS & SMOOTHING -->
    <details class="section section-collapsible" id="sectionColors">
      <summary class="label collapsible-head">1 · Colors &amp; Smoothing</summary>
      <div class="collapsible-body">
        <div class="field" id="colorCountField">
          <label for="ccount">Colors ${tip('How many distinct filament colors the image is split into. Each color becomes a separate part in the export.')}</label>
          <select id="ccount">
            ${[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => `<option value="${n}">${n} Colors</option>`).join('')}
          </select>
        </div>
        <div class="prow-stacked" id="smoothingField">
          <div class="prow-header">
            <label for="smooth">Smoothing ${tip('Simplifies and smooths the traced outlines. Higher values give fewer, cleaner edges; lower keeps more fine detail.')}</label>
            <input type="text" class="val" id="smoothVal" />
          </div>
          <input type="range" id="smooth" min="0" max="1" step="0.05" />
        </div>
        <div class="palette" id="palette">
          <div class="hint">Load an image/vector to pick colors.</div>
        </div>
      </div>
    </details>

    <!-- SECTION 2: MORE SETTINGS -->
    <details class="section section-collapsible" id="sectionShape">
      <summary class="label collapsible-head">2 · More Settings</summary>
      <div class="collapsible-body">
        <!-- KEYCHAIN SETTINGS -->
        <div class="keychain-panel" style="margin-bottom: 16px;">
          <div class="switch-row" style="margin-bottom: 12px;">
            <span class="switch-label">Keychain ${tip('Adds a keyring attachment to the body so you can clip the clicker to a keychain.')}</span>
            <label class="toggle"><input id="keychain" type="checkbox" /><span class="slider"></span></label>
          </div>
          <div class="switch-row" id="flatKeychainRow" style="margin-bottom: 12px; padding-left: 12px; border-left: 2px solid var(--border);">
            <span class="switch-label" style="font-size: 0.9em;">Móc khóa phẳng (Flat Keychain) <br/><i style="font-size:0.8em; color:var(--muted);">Tạo tấm móc khóa phẳng, không đúc chân cắm Switch phía dưới.</i></span>
            <label class="toggle"><input id="isFlatKeychain" type="checkbox" /><span class="slider"></span></label>
          </div>
          <div id="keychainOpts" style="display:none;">
            <div class="prow-stacked">
              <div class="prow-header"><label>Position ${tip('Slides the keychain attachment around the edge of the body.')}</label></div>
              <div class="tol-stepper" id="keychainRotStepper">
                <button class="btn" id="keychainRotMinus" type="button">⟲</button>
                <span class="tol-val" id="keychainAngleVal">90°</span>
                <button class="btn" id="keychainRotPlus" type="button">⟳</button>
              </div>
            </div>
            <div class="prow-stacked">
              <div class="prow-header"><label>Slide offset</label></div>
              <div class="tol-stepper" id="keychainOffsetStepper">
                <button class="btn" id="keychainOffsetMinus" type="button">−</button>
                <span class="tol-val" id="keychainOffsetVal">0.0 mm</span>
                <button class="btn" id="keychainOffsetPlus" type="button">+</button>
              </div>
            </div>
            <div class="prow-stacked">
              <div class="prow-header"><label>Hole size</label></div>
              <div class="tol-stepper" id="keychainSizeStepper">
                <button class="btn" id="keychainSizeMinus" type="button">−</button>
                <span class="tol-val" id="keychainSizeVal">5.2 mm</span>
                <button class="btn" id="keychainSizePlus" type="button">+</button>
              </div>
            </div>
          </div>
        </div>

        <!-- GLOBAL EDGES -->
        <div class="global-edges" id="globalEdges" style="display:none; margin-bottom: 16px;">
          <span class="gedge-heading">Edges ${tip('Round (fillet) or bevel (chamfer) the outer edges.')}</span>
          <div class="gedge-row">
            <span class="gedge-name">Cap top</span>
            <div class="edge-style-btns" data-edge="capTop">
              <button class="edge-style-btn active" data-style="none" type="button">None</button>
              <button class="edge-style-btn" data-style="fillet" type="button">Fillet</button>
              <button class="edge-style-btn" data-style="chamfer" type="button">Chamfer</button>
            </div>
            <div class="edge-size-btns gedge-size" data-edge="capTop" style="display:none;">
              <button class="btn edge-size-minus" type="button">−</button>
              <span class="edge-size-val"></span>
              <button class="btn edge-size-plus" type="button">+</button>
            </div>
          </div>
          <div class="gedge-row">
            <span class="gedge-name">Clicker base</span>
            <div class="edge-style-btns" data-edge="clickerBase">
              <button class="edge-style-btn active" data-style="none" type="button">None</button>
              <button class="edge-style-btn" data-style="fillet" type="button">Fillet</button>
              <button class="edge-style-btn" data-style="chamfer" type="button">Chamfer</button>
            </div>
            <div class="edge-size-btns gedge-size" data-edge="clickerBase" style="display:none;">
              <button class="btn edge-size-minus" type="button">−</button>
              <span class="edge-size-val"></span>
              <button class="btn edge-size-plus" type="button">+</button>
            </div>
          </div>
        </div>

        <!-- 🟢 3D SURFACE PROFILE -->
        <div class="field" style="margin-top: 16px; border-top: 1px solid var(--border); padding-top: 12px;">
          <label>3D Surface Profile (Khối nổi bề mặt) ${tip('Đúc nắp thành dạng Bán cầu (Dome) hoặc Chóp nón (Cone) thay vì mặt phẳng.')}</label>
          <div class="tabs" id="topProfileTabs" role="tablist">
            <button class="tab active" data-profile="flat" type="button">Flat (Phẳng)</button>
            <button class="tab" data-profile="dome" type="button">Dome (Bán cầu)</button>
            <button class="tab" data-profile="cone" type="button">Cone (Chóp nón)</button>
          </div>
        </div>
        <div class="prow-stacked" id="profileHeightRow" style="display:none; margin-top:8px; margin-bottom: 16px;">
          <div class="prow-header"><label>Độ cao chóp / vòm</label><input type="text" class="val" id="profileHeightVal" value="5.0 mm" /></div>
          <input type="range" id="profileHeight" min="2" max="250" step="0.5" value="5" />
        </div>

        <!-- THICKNESS & TOLERANCES -->
        <div class="prow-stacked">
          <div class="prow-header">
            <label for="topthick">Top thickness (Độ dày nắp / đế phẳng)</label>
            <input type="text" class="val" id="topthickVal" />
          </div>
          <input type="range" id="topthick" min="0" max="250" step="0.1" />
        </div>
        <div class="prow-stacked">
          <div class="prow-header"><label for="imgdepth">Image depth</label><input type="text" class="val" id="imgdepthVal" /></div>
          <input type="range" id="imgdepth" min="0.2" max="3" step="0.1" />
        </div>
        <div class="prow-stacked">
          <div class="prow-header"><label>Switch socket tolerance</label></div>
          <div class="tol-stepper" id="socketTolStepper">
            <button class="btn" id="socketTolMinus" type="button">−</button><span class="tol-val" id="socketTolVal">0.00 mm</span><button class="btn" id="socketTolPlus" type="button">+</button>
          </div>
        </div>
        <div class="prow-stacked">
          <div class="prow-header"><label>Switch stem (top part) tolerance</label></div>
          <div class="tol-stepper" id="stemTolStepper">
            <button class="btn" id="stemTolMinus" type="button">−</button><span class="tol-val" id="stemTolVal">0.0 mm</span><button class="btn" id="stemTolPlus" type="button">+</button>
          </div>
        </div>
      </div>
    </details>

    <!-- SECTION 3: SWITCH -->
    <details class="section section-collapsible" id="sectionSwitch">
      <summary class="label collapsible-head">3 · Switch</summary>
      <div class="collapsible-body">
        <div class="field" style="margin-bottom:10px;">
          <label>Switches ${tip('Use 1–3 MX switches for larger or wider designs.')}</label>
          <div class="tabs" id="switchCount" role="tablist">
            <button class="tab active" data-count="1" type="button">1</button>
            <button class="tab" data-count="2" type="button">2</button>
            <button class="tab" data-count="3" type="button">3</button>
          </div>
        </div>
        <div class="tabs" id="switchChips" role="tablist" style="display:none; margin-bottom:10px;"></div>
        <p class="switch-pad-hint">Move &amp; rotate the MX switch</p>
        <div class="switch-pad" id="switchPad">
          <button type="button" class="switch-pad-btn pad-rotl" data-rot="3">⟲</button>
          <button type="button" class="switch-pad-btn pad-rotr" data-rot="-3">⟳</button>
          <button type="button" class="switch-pad-btn pad-up" data-dir="up">↑</button>
          <button type="button" class="switch-pad-btn pad-left" data-dir="left">←</button>
          <button type="button" class="switch-pad-center" id="switchReset">⌂</button>
          <button type="button" class="switch-pad-btn pad-right" data-dir="right">→</button>
          <button type="button" class="switch-pad-btn pad-down" data-dir="down">↓</button>
        </div>
        <div class="switch-pad-readout" id="switchReadout">Centered</div>
        <button class="secondary" id="switchResetAll" type="button" style="display:none; width:100%; margin-top:8px;">Reset all switches</button>
      </div>
    </details>
  </div>

  <div class="sidebar-sticky-footer">
    <div class="btn-row" id="historyControls">
      <button id="undoBtn" class="secondary" type="button" title="Undo (Ctrl+Z)" disabled>↶</button>
      <button id="refreshBtn" class="secondary" type="button" title="Refresh" disabled>⟳</button>
      <button id="redoBtn" class="secondary" type="button" title="Redo (Ctrl+Shift+Z)" disabled>↷</button>
    </div>
  </div>
`;