/**
 * HMI Designer Studio - Dialog & Modal Management
 */

const ModalManager = (function() {
  const overlay = document.getElementById('modal-overlay');
  const titleEl = document.getElementById('modal-title');
  const bodyEl = document.getElementById('modal-body');
  const closeBtn = document.getElementById('modal-close');

  if (closeBtn) {
    closeBtn.addEventListener('click', hideModal);
  }

  function showModal(title, htmlContent) {
    if (!overlay) return;
    titleEl.textContent = title;
    bodyEl.innerHTML = htmlContent;
    overlay.classList.add('open');
  }

  function hideModal() {
    if (!overlay) return;
    overlay.classList.remove('open');
    bodyEl.innerHTML = '';
  }

  function showBuildOutput(diagnostics, compileResult = null) {
    let logHtml = `<div class="build-log">`;
    logHtml += `<div class="log-info">=== HMI DESIGNER STUDIO BUILD & VALIDATION ===</div>`;
    logHtml += `<div>Screens: ${diagnostics.screenCount} | Objects: ${diagnostics.objectCount}</div><br>`;

    if (diagnostics.errors.length === 0) {
      logHtml += `<div class="log-success">✔ VALIDATION PASSED: 0 errors found.</div>`;
    } else {
      logHtml += `<div class="log-err">✖ VALIDATION FAILED: ${diagnostics.errors.length} error(s):</div>`;
      diagnostics.errors.forEach(err => {
        logHtml += `<div class="log-err">  • ${err}</div>`;
      });
    }

    if (diagnostics.warnings.length > 0) {
      logHtml += `<br><div class="log-warn">⚠ WARNINGS (${diagnostics.warnings.length}):</div>`;
      diagnostics.warnings.forEach(warn => {
        logHtml += `<div class="log-warn">  • ${warn}</div>`;
      });
    }

    if (compileResult) {
      logHtml += `<br><div class="log-info">=== COMPILATION TO .PRJR ===</div>`;
      if (compileResult.success) {
        logHtml += `<div class="log-success">✔ PRJR COMPILED SUCCESSFULLY!</div>`;
        logHtml += `<div class="log-success">Output File: ${compileResult.path}</div>`;
        logHtml += `<div class="log-info">Protected with AES-256-GCM. Ready for HMI Runtime Engine.</div>`;
      } else if (!compileResult.canceled) {
        logHtml += `<div class="log-err">✖ COMPILATION ERROR: ${compileResult.error}</div>`;
      }
    }

    logHtml += `</div><div class="row"><button class="btn primary" id="btn-close-log">Close</button></div>`;
    showModal('Build Output & Diagnostics', logHtml);

    const closeBtnInner = document.getElementById('btn-close-log');
    if (closeBtnInner) {
      closeBtnInner.onclick = hideModal;
    }
  }

  function showDeviceAddressPicker(currentVal, onSelect) {
    let html = `
      <div style="display:flex;flex-direction:column;gap:12px">
        <label>PLC Device Architecture</label>
        <select id="addr-family">
          <option value="MELSEC" selected>Mitsubishi Electric (MELSEC / GOT)</option>
          <option value="SIEMENS">Siemens SIMATIC (S7-1200 / S7-1500 / S7-300)</option>
          <option value="ROCKWELL">Rockwell Automation (Allen-Bradley Logix CIP)</option>
          <option value="OMRON">Omron (Sysmac NJ/NX / CP1H)</option>
          <option value="DELTA">Delta Electronics (DVP / AS Series)</option>
          <option value="MODBUS">Modbus Protocol (0x / 1x / 3x / 4x)</option>
        </select>
        
        <div id="melsec-group" style="display:flex;gap:10px">
          <div style="flex:1">
            <label>Device Type</label>
            <select id="melsec-type">
              <optgroup label="Bit Devices (Contacts / Relays)">
                <option value="X">X - Input (Hex: 0 - 1FFF)</option>
                <option value="Y">Y - Output (Hex: 0 - 1FFF)</option>
                <option value="M" selected>M - Internal Relay (Dec: 0 - 32767)</option>
                <option value="L">L - Latch Relay (Dec: 0 - 32767)</option>
                <option value="B">B - Link Relay (Hex: 0 - 7FFF)</option>
                <option value="SM">SM - Special Relay (Dec: 0 - 2047)</option>
              </optgroup>
              <optgroup label="Word Devices (Registers)">
                <option value="D">D - Data Register (Dec: 0 - 32767)</option>
                <option value="W">W - Link Register (Hex: 0 - 7FFF)</option>
                <option value="R">R - File Register (Dec: 0 - 32767)</option>
                <option value="ZR">ZR - Extended Register (Hex: 0 - FFFF)</option>
                <option value="SD">SD - Special Register (Dec: 0 - 2047)</option>
              </optgroup>
            </select>
          </div>
          <div style="flex:1">
            <label>Address Number</label>
            <input type="text" id="melsec-num" placeholder="e.g. 100" value="100">
          </div>
        </div>

        <div id="siemens-group" style="display:none;flex-direction:column;gap:8px">
          <label>Siemens Address Format</label>
          <input type="text" id="siemens-addr" placeholder="e.g. DB1.DBX0.0 or I0.0 or DB10.DBD0" value="DB1.DBX0.0">
          <span style="font-size:11px;color:#666">Examples: DB1.DBX0.0 (Bit), DB1.DBW2 (Word), DB10.DBD0 (Real/DWord), I0.0 (Input), Q0.0 (Output)</span>
        </div>

        <div id="rockwell-group" style="display:none;flex-direction:column;gap:8px">
          <label>Allen-Bradley CIP Tag Name</label>
          <input type="text" id="rockwell-tag" placeholder="e.g. Motor1_Run or Safety.Estop_Actuated" value="Motor1_Run">
          <span style="font-size:11px;color:#666">Native Logix controller or program scoped tag name</span>
        </div>

        <div id="modbus-group" style="display:none;flex-direction:column;gap:8px">
          <label>Modbus Register / Point</label>
          <input type="text" id="modbus-addr" placeholder="e.g. 40001 (Holding Reg) or 00001 (Coil)" value="40001">
          <span style="font-size:11px;color:#666">00001-09999: Coils · 10001-19999: Inputs · 30001-39999: Input Regs · 40001-49999: Holding Regs</span>
        </div>

        <div style="background:#F7F6F2;padding:10px;border-radius:6px;font-size:12px;color:#4D4D4D">
          <b>Selected Device:</b> <span id="addr-preview" style="color:#D9261C;font-weight:700">M100</span>
        </div>

        <div class="row">
          <button class="btn" id="addr-cancel">Cancel</button>
          <button class="btn primary" id="addr-apply">Apply Address</button>
        </div>
      </div>
    `;

    showModal('Universal Device Address Selector', html);

    const famEl = document.getElementById('addr-family');
    const mGroup = document.getElementById('melsec-group');
    const sGroup = document.getElementById('siemens-group');
    const rGroup = document.getElementById('rockwell-group');
    const modGroup = document.getElementById('modbus-group');

    const typeEl = document.getElementById('melsec-type');
    const numEl = document.getElementById('melsec-num');
    const sAddrEl = document.getElementById('siemens-addr');
    const rTagEl = document.getElementById('rockwell-tag');
    const modAddrEl = document.getElementById('modbus-addr');
    const prevEl = document.getElementById('addr-preview');

    function updatePrev() {
      const fam = famEl.value;
      mGroup.style.display = (fam === 'MELSEC' || fam === 'OMRON' || fam === 'DELTA') ? 'flex' : 'none';
      sGroup.style.display = fam === 'SIEMENS' ? 'flex' : 'none';
      rGroup.style.display = fam === 'ROCKWELL' ? 'flex' : 'none';
      modGroup.style.display = fam === 'MODBUS' ? 'flex' : 'none';

      if (fam === 'MELSEC') {
        prevEl.textContent = `${typeEl.value}${numEl.value.trim().toUpperCase()}`;
      } else if (fam === 'SIEMENS') {
        prevEl.textContent = sAddrEl.value.trim().toUpperCase();
      } else if (fam === 'ROCKWELL') {
        prevEl.textContent = rTagEl.value.trim();
      } else if (fam === 'MODBUS') {
        prevEl.textContent = modAddrEl.value.trim();
      } else if (fam === 'OMRON') {
        prevEl.textContent = `W${numEl.value.trim()}.00`;
      } else if (fam === 'DELTA') {
        prevEl.textContent = `${typeEl.value}${numEl.value.trim()}`;
      }
    }

    famEl.onchange = updatePrev;
    typeEl.onchange = updatePrev;
    numEl.oninput = updatePrev;
    sAddrEl.oninput = updatePrev;
    rTagEl.oninput = updatePrev;
    modAddrEl.oninput = updatePrev;

    document.getElementById('addr-cancel').onclick = hideModal;
    document.getElementById('addr-apply').onclick = () => {
      const fullAddr = prevEl.textContent.trim();
      const check = TagManager.validateAddress(fullAddr, famEl.value);
      if (!check.valid) {
        alert(check.error);
        return;
      }
      hideModal();
      if (onSelect) onSelect(fullAddr);
    };
  }

  /**
   * Universal Object Properties Modal Dialog
   * Pops up whenever an object in the design area is double-clicked.
   */
  function showObjectPropertiesModal(obj, onApply) {
    if (!obj) return;

    const type = obj.getAttribute('data-type') || 'Object';
    const tag = obj.getAttribute('data-tag') || '';
    const text = obj.getAttribute('data-text') || obj.textContent.trim() || '';
    const action = obj.getAttribute('data-action') || '';
    const onColor = obj.getAttribute('data-on') || '#22A06B';
    const offColor = obj.getAttribute('data-off') || '#9AA0A6';
    const min = obj.getAttribute('data-min') || '0';
    const max = obj.getAttribute('data-max') || '100';
    const dec = obj.getAttribute('data-dec') || '0';
    const navTarget = obj.getAttribute('data-nav') || '';

    const curX = Math.round(parseFloat(obj.style.left) || 0);
    const curY = Math.round(parseFloat(obj.style.top) || 0);
    const curW = Math.round(obj.offsetWidth || 120);
    const curH = Math.round(obj.offsetHeight || 50);

    const cat = (typeof WidgetRegistry !== 'undefined') ? WidgetRegistry.getCategory(type) : 'shape';
    const screens = (typeof ProjectModel !== 'undefined') ? Object.keys(ProjectModel.getProject().screens || {}) : ['Base_Screen_1'];

    const visMode = obj.getAttribute('data-vis-mode') || 'always';
    const visTag = obj.getAttribute('data-vis-tag') || '';
    const isFlash = obj.getAttribute('data-flash') === 'true';

    let funcFieldsHtml = '';

    // Process Tank specific fields
    if (type === 'Process Tank') {
      funcFieldsHtml += `
        <div class="prop-sec-title">Process Tank Dynamics & Fluid Calibration</div>
        <div class="prop-grid-2">
          <div>
            <label>Current Fluid Fill Level (0 - 100%)</label>
            <input type="number" id="dlg-min" min="0" max="100" value="${min || '65'}">
          </div>
          <div>
            <label>Total Tank Capacity (Engineering Units)</label>
            <input type="number" id="dlg-max" value="${max || '1000'}">
          </div>
        </div>
        <div class="prop-grid-2" style="margin-top:10px">
          <div>
            <label>Fluid Color (Fill Gradient)</label>
            <input type="color" id="dlg-on" value="${onColor || '#0284C7'}" style="height:38px;padding:2px;cursor:pointer">
          </div>
          <div>
            <label>Tank Vessel Name / Identifier</label>
            <input type="text" id="dlg-text" value="${text || 'STORAGE TANK'}">
          </div>
        </div>
      `;
    } else if (type === 'Selector Switch') {
      funcFieldsHtml += `
        <div class="prop-sec-title">Rotary Selector Switch Positions</div>
        <div class="prop-grid-2">
          <div>
            <label>Selector Position Mode</label>
            <select id="dlg-action">
              <option value="3-Position" ${action === '3-Position' ? 'selected' : ''}>3-Position (MAN / OFF / AUTO)</option>
              <option value="2-Position" ${action === '2-Position' ? 'selected' : ''}>2-Position (OFF / ON)</option>
              <option value="4-Position" ${action === '4-Position' ? 'selected' : ''}>4-Position (P0 / P1 / P2 / P3)</option>
            </select>
          </div>
          <div>
            <label>Switch Label Text</label>
            <input type="text" id="dlg-text" value="${text || 'SELECTOR'}">
          </div>
        </div>
      `;
    } else if (type === 'Analog Slider') {
      funcFieldsHtml += `
        <div class="prop-sec-title">Analog Slider Range & Scale</div>
        <div class="prop-grid-2">
          <div>
            <label>Minimum Setpoint (0%)</label>
            <input type="number" id="dlg-min" value="${min || '0'}">
          </div>
          <div>
            <label>Maximum Setpoint (100%)</label>
            <input type="number" id="dlg-max" value="${max || '100'}">
          </div>
        </div>
        <div style="margin-top:10px">
          <label>Slider Tag / Caption</label>
          <input type="text" id="dlg-text" value="${text || 'SLIDER'}">
        </div>
      `;
    } else if (type === 'Word Lamp') {
      funcFieldsHtml += `
        <div class="prop-sec-title">Multi-State Word Lamp Configuration</div>
        <div class="prop-grid-2">
          <div>
            <label>Active Display State</label>
            <select id="dlg-action">
              <option value="State 0" ${action === 'State 0' ? 'selected' : ''}>State 0 (STOPPED / Gray)</option>
              <option value="State 1" ${action === 'State 1' ? 'selected' : ''}>State 1 (RUNNING / Green)</option>
              <option value="State 2" ${action === 'State 2' ? 'selected' : ''}>State 2 (WARNING / Amber)</option>
              <option value="State 3" ${action === 'State 3' ? 'selected' : ''}>State 3 (ALARM / Red)</option>
            </select>
          </div>
          <div>
            <label>Current State Text</label>
            <input type="text" id="dlg-text" value="${text || 'STATE 1: RUN'}">
          </div>
        </div>
      `;
    } else if (type === 'Tower Light') {
      funcFieldsHtml += `
        <div class="prop-sec-title">Andon Tower Light Signaling</div>
        <div class="prop-grid-2">
          <div>
            <label>Stack Illumination Mode</label>
            <select id="dlg-action">
              <option value="Steady" ${action === 'Steady' ? 'selected' : ''}>Steady ON (Continuous)</option>
              <option value="Flashing" ${action === 'Flashing' ? 'selected' : ''}>Flashing Strobe (1 Hz)</option>
            </select>
          </div>
          <div>
            <label>Tower Name / Location</label>
            <input type="text" id="dlg-text" value="${text || 'TOWER 1'}">
          </div>
        </div>
      `;
    } else if (cat === 'switch') {
      funcFieldsHtml += `
        <div class="prop-sec-title">Switch Behavior & Action</div>
        <div class="prop-grid-2">
          <div>
            <label>Switch Action</label>
            <select id="dlg-action">
              <option value="Momentary" ${action === 'Momentary' ? 'selected' : ''}>Momentary (ON while pressed)</option>
              <option value="Alternate" ${action === 'Alternate' ? 'selected' : ''}>Alternate (Toggle ON / OFF)</option>
              <option value="Set" ${action === 'Set' ? 'selected' : ''}>Set (Force Bit ON)</option>
              <option value="Reset" ${action === 'Reset' ? 'selected' : ''}>Reset (Force Bit OFF)</option>
            </select>
          </div>
          <div>
            <label>Button Label Text</label>
            <input type="text" id="dlg-text" value="${text}">
          </div>
        </div>
      `;
      if (type === 'Screen Navigation') {
        funcFieldsHtml += `
          <div style="margin-top:10px">
            <label>Target Screen to Open</label>
            <select id="dlg-nav">
              ${screens.map(s => `<option value="${s}" ${navTarget === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
        `;
      }
    } else if (cat === 'lamp') {
      // Lamp specific fields
      funcFieldsHtml += `
        <div class="prop-sec-title">Pilot Lamp Illumination Colors</div>
        <div class="prop-grid-2">
          <div>
            <label>ON Color (Active Bit)</label>
            <input type="color" id="dlg-on" value="${onColor}" style="height:38px;padding:2px;cursor:pointer">
          </div>
          <div>
            <label>OFF Color (Inactive Bit)</label>
            <input type="color" id="dlg-off" value="${offColor}" style="height:38px;padding:2px;cursor:pointer">
          </div>
        </div>
        <div style="margin-top:10px">
          <label>Lamp Caption Text</label>
          <input type="text" id="dlg-text" value="${text}">
        </div>
      `;
    } else if (cat === 'numeric') {
      // Numeric specific fields
      funcFieldsHtml += `
        <div class="prop-sec-title">Data Format & Numeric Limits</div>
        <div class="prop-grid-2">
          <div>
            <label>Minimum Value</label>
            <input type="number" id="dlg-min" value="${min}">
          </div>
          <div>
            <label>Maximum Value</label>
            <input type="number" id="dlg-max" value="${max}">
          </div>
        </div>
        <div class="prop-grid-2" style="margin-top:10px">
          <div>
            <label>Decimal Places (0 - 4)</label>
            <input type="number" id="dlg-dec" min="0" max="4" value="${dec}">
          </div>
          <div>
            <label>Unit / Engineering Suffix</label>
            <input type="text" id="dlg-text" value="${text}" placeholder="e.g. RPM, °C, Bar, kg">
          </div>
        </div>
      `;
    } else if (cat === 'alarm') {
      if (type === 'Alarm Acknowledge' || type === 'Alarm Reset') {
        funcFieldsHtml += `
          <div class="prop-sec-title">${type} Configuration</div>
          <div class="prop-grid-2">
            <div>
              <label>Contact Action</label>
              <select id="dlg-action">
                <option value="Momentary" ${action === 'Momentary' ? 'selected' : ''}>Momentary (Pulse On Press)</option>
                <option value="Alternate" ${action === 'Alternate' ? 'selected' : ''}>Alternate (Toggle Bit)</option>
              </select>
            </div>
            <div>
              <label>Button Label Text</label>
              <input type="text" id="dlg-text" value="${text}">
            </div>
          </div>
        `;
      } else if (type === 'Alarm Status Lamp') {
        funcFieldsHtml += `
          <div class="prop-sec-title">Alarm Status Indication Colors</div>
          <div class="prop-grid-2">
            <div>
              <label>Active Alarm Color</label>
              <input type="color" id="dlg-on" value="${onColor || '#EF4444'}" style="height:38px;padding:2px;cursor:pointer">
            </div>
            <div>
              <label>System Normal Color</label>
              <input type="color" id="dlg-off" value="${offColor || '#10B981'}" style="height:38px;padding:2px;cursor:pointer">
            </div>
          </div>
          <div style="margin-top:10px">
            <label>Lamp Status Caption</label>
            <input type="text" id="dlg-text" value="${text}">
          </div>
        `;
      } else {
        funcFieldsHtml += `
          <div class="prop-sec-title">Alarm Matrix & Severity Display</div>
          <div class="prop-grid-2">
            <div>
              <label>Alarm Filter Level</label>
              <select id="dlg-action">
                <option value="All" ${action === 'All' ? 'selected' : ''}>All Active Alarms</option>
                <option value="Critical" ${action === 'Critical' ? 'selected' : ''}>Critical Faults Only</option>
                <option value="Warnings" ${action === 'Warnings' ? 'selected' : ''}>Warnings & Info</option>
              </select>
            </div>
            <div>
              <label>Display Title</label>
              <input type="text" id="dlg-text" value="${text}">
            </div>
          </div>
        `;
      }
    } else if (cat === 'graph') {
      // Trend graph fields
      funcFieldsHtml += `
        <div class="prop-sec-title">Graph Range & Trend Bounds</div>
        <div class="prop-grid-2">
          <div>
            <label>Y-Axis Minimum (0% SP)</label>
            <input type="number" id="dlg-min" value="${min}">
          </div>
          <div>
            <label>Y-Axis Maximum (100% SP)</label>
            <input type="number" id="dlg-max" value="${max}">
          </div>
        </div>
        <div style="margin-top:10px">
          <label>Graph Caption</label>
          <input type="text" id="dlg-text" value="${text}">
        </div>
      `;
    } else {
      // Shapes / Machines
      funcFieldsHtml += `
        <div class="prop-sec-title">Symbol & Machine Identification</div>
        <div>
          <label>Caption / Machine Name</label>
          <input type="text" id="dlg-text" value="${text}">
        </div>
      `;
    }

    // Dynamic Visibility & Alarm Flashing for all components
    funcFieldsHtml += `
      <div class="prop-sec-title" style="margin-top:14px">Dynamic Visibility & Alarm Flashing</div>
      <div class="prop-grid-2">
        <div>
          <label>Conditional Visibility</label>
          <select id="dlg-vis-mode">
            <option value="always" ${visMode === 'always' ? 'selected' : ''}>Always Visible (Default)</option>
            <option value="on" ${visMode === 'on' ? 'selected' : ''}>Visible only when bit is ON (1)</option>
            <option value="off" ${visMode === 'off' ? 'selected' : ''}>Visible only when bit is OFF (0)</option>
          </select>
        </div>
        <div>
          <label>Visibility Bit Trigger</label>
          <input type="text" id="dlg-vis-tag" value="${visTag}" placeholder="e.g. M120, M500, X0" style="font-family:Consolas,monospace">
        </div>
      </div>
      <div style="margin-top:8px;display:flex;align-items:center;gap:8px">
        <input type="checkbox" id="dlg-flash" ${isFlash ? 'checked' : ''} style="width:16px;height:16px">
        <label for="dlg-flash" style="font-size:11px;font-weight:700;color:#334155;cursor:pointer">Enable Dynamic Flashing (Pulsing Alarm State)</label>
      </div>
    `;

    const html = `
      <div style="display:flex;flex-direction:column;gap:12px">
        <!-- Tabs Header -->
        <div class="prop-tabs">
          <button class="prop-tab-btn active" data-tab="dlg-tab-dev">1. Device & Address</button>
          <button class="prop-tab-btn" data-tab="dlg-tab-func">2. Function & Settings</button>
          <button class="prop-tab-btn" data-tab="dlg-tab-geom">3. Position & Size</button>
        </div>

        <!-- Tab 1: Device Address & Tag Binding -->
        <div class="prop-tab-page active" id="dlg-tab-dev">
          <div class="prop-sec-title">PLC Device & Register Assignment</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <label>Assigned Device Address / Tag</label>
            <div style="display:flex;gap:6px">
              <input type="text" id="dlg-tag" value="${tag}" placeholder="e.g. M100, D200, X0, Y0" style="flex:1;font-family:Consolas,monospace;font-weight:700">
              <button class="btn" id="dlg-btn-pick" style="padding:0 14px">... Pick Address</button>
            </div>
            <div id="dlg-tag-feedback" style="font-size:11px;color:#767676;margin-top:4px">
              Supported protocols: Mitsubishi MELSEC (X, Y, M, D, W, ZR), Siemens S7 (DB/I/Q), Modbus TCP (0x, 4x).
            </div>
          </div>
        </div>

        <!-- Tab 2: Function & Behavior -->
        <div class="prop-tab-page" id="dlg-tab-func">
          ${funcFieldsHtml}
        </div>

        <!-- Tab 3: Coordinates & Dimensions -->
        <div class="prop-tab-page" id="dlg-tab-geom">
          <div class="prop-sec-title">Layout Coordinates (10px Snap Grid)</div>
          <div class="prop-grid-2">
            <div>
              <label>X Position (Left)</label>
              <input type="number" id="dlg-x" value="${curX}">
            </div>
            <div>
              <label>Y Position (Top)</label>
              <input type="number" id="dlg-y" value="${curY}">
            </div>
          </div>
          <div class="prop-grid-2" style="margin-top:10px">
            <div>
              <label>Width (px)</label>
              <input type="number" id="dlg-w" value="${curW}">
            </div>
            <div>
              <label>Height (px)</label>
              <input type="number" id="dlg-h" value="${curH}">
            </div>
          </div>
        </div>

        <!-- Dialog Footer Actions -->
        <div class="row" style="margin-top:16px;border-top:1px solid #DDD;padding-top:12px;display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:11px;color:#777">Press <b>Enter</b> to apply changes</span>
          <div style="display:flex;gap:8px">
            <button class="btn" id="dlg-btn-cancel">Cancel</button>
            <button class="btn primary" id="dlg-btn-apply">✔ OK / Apply</button>
          </div>
        </div>
      </div>
    `;

    showModal(`Object Properties — [${type.toUpperCase()}]`, html);

    // Tab switching inside modal
    const tabBtns = document.querySelectorAll('.prop-tab-btn');
    const tabPages = document.querySelectorAll('.prop-tab-page');
    tabBtns.forEach(btn => {
      btn.onclick = () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPages.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const targetId = btn.getAttribute('data-tab');
        const targetPage = document.getElementById(targetId);
        if (targetPage) targetPage.classList.add('active');
      };
    });

    // Device Address Selector Integration
    const pickBtn = document.getElementById('dlg-btn-pick');
    const tagInp = document.getElementById('dlg-tag');
    if (pickBtn && tagInp) {
      pickBtn.onclick = () => {
        showDeviceAddressPicker(tagInp.value, (newAddr) => {
          tagInp.value = newAddr;
          // Re-open this object dialog
          showObjectPropertiesModal(obj, onApply);
          const reopenedTag = document.getElementById('dlg-tag');
          if (reopenedTag) reopenedTag.value = newAddr;
        });
      };
    }

    // Cancel Button
    const cancelBtn = document.getElementById('dlg-btn-cancel');
    if (cancelBtn) cancelBtn.onclick = hideModal;

    // Apply / OK Button
    const applyBtn = document.getElementById('dlg-btn-apply');
    function applyChanges() {
      const newTag = tagInp ? tagInp.value.trim().toUpperCase() : tag;
      const textEl = document.getElementById('dlg-text');
      const actEl = document.getElementById('dlg-action');
      const onEl = document.getElementById('dlg-on');
      const offEl = document.getElementById('dlg-off');
      const minEl = document.getElementById('dlg-min');
      const maxEl = document.getElementById('dlg-max');
      const decEl = document.getElementById('dlg-dec');
      const navEl = document.getElementById('dlg-nav');
      const xEl = document.getElementById('dlg-x');
      const yEl = document.getElementById('dlg-y');
      const wEl = document.getElementById('dlg-w');
      const hEl = document.getElementById('dlg-h');

      if (newTag) obj.setAttribute('data-tag', newTag);
      if (textEl) obj.setAttribute('data-text', textEl.value);
      if (actEl) obj.setAttribute('data-action', actEl.value);
      if (onEl) obj.setAttribute('data-on', onEl.value);
      if (offEl) obj.setAttribute('data-off', offEl.value);
      if (minEl) obj.setAttribute('data-min', minEl.value);
      if (maxEl) obj.setAttribute('data-max', maxEl.value);
      if (decEl) obj.setAttribute('data-dec', decEl.value);
      if (navEl) obj.setAttribute('data-nav', navEl.value);

      const visModeEl = document.getElementById('dlg-vis-mode');
      const visTagEl = document.getElementById('dlg-vis-tag');
      const flashEl = document.getElementById('dlg-flash');
      if (visModeEl) obj.setAttribute('data-vis-mode', visModeEl.value);
      if (visTagEl) obj.setAttribute('data-vis-tag', visTagEl.value.trim().toUpperCase());
      if (flashEl) obj.setAttribute('data-flash', flashEl.checked ? '1' : '0');

      if (xEl) obj.style.left = Math.max(0, parseInt(xEl.value, 10) || 0) + 'px';
      if (yEl) obj.style.top = Math.max(0, parseInt(yEl.value, 10) || 0) + 'px';
      if (wEl) obj.style.width = Math.max(20, parseInt(wEl.value, 10) || 20) + 'px';
      if (hEl) obj.style.height = Math.max(10, parseInt(hEl.value, 10) || 10) + 'px';

      hideModal();

      if (onApply) onApply(obj);
    }

    if (applyBtn) applyBtn.onclick = applyChanges;

    // Enter key saves and closes
    const modalEl = document.querySelector('.modal');
    if (modalEl) {
      modalEl.onkeydown = (e) => {
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          applyChanges();
        }
      };
    }
  }

  /**
   * Universal Tag Database Manager Modal
   * Displays all defined symbols, allows adding/editing/deleting,
   * and provides CSV import and export for Mitsubishi / Siemens / Excel workflows.
   */
  function showTagManagerModal(onClose) {
    function renderTable() {
      const tags = (typeof TagManager !== 'undefined') ? TagManager.getTags() : [];
      const filter = (document.getElementById('tag-search-inp')?.value || '').toLowerCase();
      const filtered = tags.filter(t => 
        t.name.toLowerCase().includes(filter) || 
        t.device.toLowerCase().includes(filter) || 
        (t.comment || '').toLowerCase().includes(filter)
      );

      const rows = filtered.map(t => `
        <tr style="border-bottom:1px solid #E2E8F0">
          <td style="padding:6px 10px;font-weight:700;color:#1E293B">${t.name}</td>
          <td style="padding:6px 10px"><code style="background:#F1F5F9;padding:2px 6px;border-radius:4px;font-weight:700;color:#0F172A;font-size:11px">${t.device}</code></td>
          <td style="padding:6px 10px"><span class="tag-type-badge ${t.type.toLowerCase()}">${t.type}</span></td>
          <td style="padding:6px 10px;color:#64748B">${t.comment || '—'}</td>
          <td style="padding:6px 10px;text-align:center">
            <button class="btn btn-tag-del" data-name="${t.name}" style="padding:2px 8px;font-size:11px;color:#EF4444;border-color:#FCA5A5">Delete</button>
          </td>
        </tr>
      `).join('');

      const tbody = document.getElementById('tag-mgr-tbody');
      if (tbody) {
        tbody.innerHTML = rows || `<tr><td colspan="5" style="text-align:center;padding:24px;color:#94A3B8">No tags found. Add a tag above or import a CSV file.</td></tr>`;
        
        tbody.querySelectorAll('.btn-tag-del').forEach(btn => {
          btn.onclick = () => {
            const name = btn.getAttribute('data-name');
            if (typeof TagManager !== 'undefined') {
              TagManager.removeTag(name);
              renderTable();
            }
          };
        });
      }
    }

    const html = `
      <div style="display:flex;flex-direction:column;gap:12px;width:720px;max-width:100%">
        <!-- Quick Add Tag Row -->
        <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:6px;padding:10px 12px">
          <div style="font-size:11px;font-weight:700;color:#475569;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px">Add New PLC Tag / Symbol</div>
          <div style="display:grid;grid-template-columns:1.5fr 1fr 1fr 2fr auto;gap:8px;align-items:center">
            <input type="text" id="new-tag-name" placeholder="Tag Name (e.g. Tank.High)" style="font-size:12px">
            <input type="text" id="new-tag-dev" placeholder="PLC (e.g. M105, D250)" style="font-size:12px;font-family:Consolas,monospace">
            <select id="new-tag-type" style="font-size:12px">
              <option value="Bit">Bit (Boolean)</option>
              <option value="Word">Word (16-bit)</option>
              <option value="DWord">DWord (32-bit)</option>
              <option value="Float">Float (Real)</option>
            </select>
            <input type="text" id="new-tag-desc" placeholder="Engineering Comment" style="font-size:12px">
            <button class="btn primary" id="btn-add-tag" style="white-space:nowrap;padding:0 12px">➕ Add</button>
          </div>
          <div id="new-tag-error" style="color:#EF4444;font-size:11px;margin-top:6px;display:none"></div>
        </div>

        <!-- Search & CSV Toolbar -->
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <div style="display:flex;align-items:center;gap:8px;flex:1">
            <input type="text" id="tag-search-inp" placeholder="🔍 Search by name, device address, comment..." style="flex:1;max-width:320px;font-size:12px">
          </div>
          <div style="display:flex;gap:6px">
            <label class="btn" style="cursor:pointer;margin:0;display:inline-flex;align-items:center;gap:4px">
              📤 Import CSV
              <input type="file" id="tag-csv-file" accept=".csv" style="display:none">
            </label>
            <button class="btn" id="btn-export-csv" style="display:inline-flex;align-items:center;gap:4px">
              📥 Export CSV
            </button>
          </div>
        </div>

        <!-- Tag Table -->
        <div style="max-height:280px;overflow-y:auto;border:1px solid #CBD5E1;border-radius:4px;background:#FFF">
          <table class="tag-mgr-table" style="width:100%;border-collapse:collapse;font-size:12px">
            <thead>
              <tr style="background:#F1F5F9;position:sticky;top:0;z-index:1;border-bottom:1px solid #CBD5E1">
                <th style="padding:6px 10px;text-align:left;font-weight:700;color:#475569">Symbol Name</th>
                <th style="padding:6px 10px;text-align:left;font-weight:700;color:#475569">PLC Device</th>
                <th style="padding:6px 10px;text-align:left;font-weight:700;color:#475569">Data Type</th>
                <th style="padding:6px 10px;text-align:left;font-weight:700;color:#475569">Description / Comment</th>
                <th style="padding:6px 10px;text-align:center;width:60px">Action</th>
              </tr>
            </thead>
            <tbody id="tag-mgr-tbody"></tbody>
          </table>
        </div>

        <!-- Dialog Footer -->
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
          <button class="btn primary" id="btn-close-tags" style="padding:0 20px">Close</button>
        </div>
      </div>
    `;

    showModal('Universal Tag Database Manager', html);
    renderTable();

    // Search filter
    const searchInp = document.getElementById('tag-search-inp');
    if (searchInp) {
      searchInp.oninput = renderTable;
    }

    // Add Tag
    const addBtn = document.getElementById('btn-add-tag');
    const nameInp = document.getElementById('new-tag-name');
    const devInp = document.getElementById('new-tag-dev');
    const typeSel = document.getElementById('new-tag-type');
    const descInp = document.getElementById('new-tag-desc');
    const errEl = document.getElementById('new-tag-error');

    if (addBtn && nameInp && devInp) {
      addBtn.onclick = () => {
        const name = nameInp.value.trim();
        const dev = devInp.value.trim().toUpperCase();
        const type = typeSel ? typeSel.value : 'Bit';
        const comment = descInp ? descInp.value.trim() : '';

        if (!name) {
          if (errEl) { errEl.textContent = 'Please enter a Tag Name.'; errEl.style.display = 'block'; }
          return;
        }
        if (!dev) {
          if (errEl) { errEl.textContent = 'Please enter a PLC Device address.'; errEl.style.display = 'block'; }
          return;
        }

        if (typeof TagManager !== 'undefined') {
          TagManager.addTag({ name, device: dev, type, comment });
          nameInp.value = '';
          devInp.value = '';
          if (descInp) descInp.value = '';
          if (errEl) errEl.style.display = 'none';
          renderTable();
        }
      };
    }

    // Export CSV
    const expBtn = document.getElementById('btn-export-csv');
    if (expBtn) {
      expBtn.onclick = () => {
        if (typeof TagManager === 'undefined') return;
        const tags = TagManager.getTags();
        let csv = 'Symbol Name,PLC Device,Data Type,Comment\r\n';
        tags.forEach(t => {
          csv += `"${t.name}","${t.device}","${t.type}","${(t.comment || '').replace(/"/g, '""')}"\r\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'hmi_tag_database.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };
    }

    // Import CSV
    const fileInp = document.getElementById('tag-csv-file');
    if (fileInp) {
      fileInp.onchange = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          const content = evt.target.result;
          const lines = content.split(/\r?\n/);
          let imported = 0;
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || (i === 0 && line.toLowerCase().includes('symbol'))) continue;
            const cols = line.split(',').map(c => c.replace(/^["']|["']$/g, '').trim());
            if (cols.length >= 2 && cols[0]) {
              const name = cols[0];
              const device = cols[1];
              const type = cols[2] || 'Bit';
              const comment = cols[3] || '';
              if (typeof TagManager !== 'undefined') {
                TagManager.addTag({ name, device, type, comment });
                imported++;
              }
            }
          }
          renderTable();
          alert(`Successfully imported ${imported} tags into database.`);
        };
        reader.readAsText(file);
      };
    }

    // Close button
    const closeBtn = document.getElementById('btn-close-tags');
    if (closeBtn) {
      closeBtn.onclick = () => {
        hideModal();
        if (onClose) onClose();
      };
    }
  }

  /**
   * Screen Renaming Modal
   */
  function showRenameScreenModal(currentName, onRename) {
    const html = `
      <div style="display:flex;flex-direction:column;gap:12px;width:380px;max-width:100%">
        <div>
          <label style="font-size:11px;font-weight:700;color:#64748B">Current Screen Name</label>
          <div style="font-family:Consolas,monospace;font-size:13px;font-weight:700;color:#1E293B;padding:4px 0">${currentName}</div>
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;color:#0F172A">New Screen Name</label>
          <input type="text" id="dlg-rename-input" value="${currentName}" style="font-family:Consolas,monospace;font-size:13px;font-weight:700;width:100%;margin-top:4px" autofocus>
          <div id="dlg-rename-err" style="color:#EF4444;font-size:11px;margin-top:4px;display:none"></div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
          <button class="btn" id="dlg-rename-cancel">Cancel</button>
          <button class="btn primary" id="dlg-rename-apply">✔ Rename</button>
        </div>
      </div>
    `;

    showModal('Rename Screen', html);

    const input = document.getElementById('dlg-rename-input');
    const err = document.getElementById('dlg-rename-err');
    const cancelBtn = document.getElementById('dlg-rename-cancel');
    const applyBtn = document.getElementById('dlg-rename-apply');

    if (input) {
      input.focus();
      input.select();
    }

    if (cancelBtn) cancelBtn.onclick = hideModal;

    function apply() {
      const newName = input.value.trim();
      if (!newName) {
        if (err) { err.textContent = 'Screen name cannot be empty.'; err.style.display = 'block'; }
        return;
      }
      if (/[\\/:*?"<>|]/.test(newName)) {
        if (err) { err.textContent = 'Name contains illegal characters (/ \\ : * ? " < > |).'; err.style.display = 'block'; }
        return;
      }
      if (newName !== currentName) {
        const screens = (typeof ProjectModel !== 'undefined') ? ProjectModel.getProject().screens || {} : {};
        if (screens[newName]) {
          if (err) { err.textContent = `A screen named '${newName}' already exists.`; err.style.display = 'block'; }
          return;
        }
      }
      hideModal();
      if (onRename) onRename(newName);
    }

    if (applyBtn) applyBtn.onclick = apply;
    if (input) {
      input.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          apply();
        }
      };
    }
  }

  /**
   * Screen Properties Modal (Appearance, Popups & Security)
   */
  function showScreenPropertiesModal(screenName, onApply) {
    const meta = (typeof ProjectModel !== 'undefined') ? ProjectModel.getScreenMeta(screenName) : {};
    const isStartup = (typeof ProjectModel !== 'undefined') && (ProjectModel.getStartupScreen() === screenName);
    const bgColor = meta.bgColor || '#FFFFFF';
    const secLevel = meta.securityLevel || '0';

    const html = `
      <div style="display:flex;flex-direction:column;gap:12px;width:440px;max-width:100%">
        <!-- Screen Identification -->
        <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:6px;padding:8px 12px;display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:10px;font-weight:700;color:#64748B;text-transform:uppercase">Configuring Screen</div>
            <div style="font-size:14px;font-weight:800;color:#0F172A">${screenName}</div>
          </div>
          <label style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;cursor:pointer">
            <input type="checkbox" id="dlg-prop-startup" ${isStartup ? 'checked' : ''}>
            <span>🏠 Project Startup Screen</span>
          </label>
        </div>

        <!-- Canvas Background Color -->
        <div>
          <label style="font-size:11px;font-weight:700;color:#0F172A">Canvas Background Color</label>
          <div style="display:flex;gap:8px;align-items:center;margin-top:6px">
            <input type="color" id="dlg-prop-bg" value="${bgColor}" style="width:40px;height:34px;padding:2px;cursor:pointer;border-radius:4px;border:1px solid #CBD5E1">
            <input type="text" id="dlg-prop-bg-hex" value="${bgColor}" style="width:90px;font-family:Consolas,monospace;font-size:12px">
            <div style="display:flex;gap:4px;flex:1;justify-content:flex-end">
              <button type="button" class="btn btn-bg-preset" data-color="#FFFFFF" title="Clean White" style="background:#FFFFFF;border:1px solid #CBD5E1;width:24px;height:24px;padding:0"></button>
              <button type="button" class="btn btn-bg-preset" data-color="#F1F5F9" title="Slate 100" style="background:#F1F5F9;border:1px solid #CBD5E1;width:24px;height:24px;padding:0"></button>
              <button type="button" class="btn btn-bg-preset" data-color="#E2E8F0" title="Machine Gray" style="background:#E2E8F0;border:1px solid #CBD5E1;width:24px;height:24px;padding:0"></button>
              <button type="button" class="btn btn-bg-preset" data-color="#1E293B" title="Dark SCADA" style="background:#1E293B;border:1px solid #0F172A;width:24px;height:24px;padding:0"></button>
              <button type="button" class="btn btn-bg-preset" data-color="#000000" title="High Contrast Black" style="background:#000000;border:1px solid #000;width:24px;height:24px;padding:0"></button>
            </div>
          </div>
        </div>

        <!-- Security & User Authorization Level -->
        <div style="margin-top:4px">
          <label style="font-size:11px;font-weight:700;color:#0F172A">Security & Authorization Access Level</label>
          <select id="dlg-prop-sec" style="width:100%;margin-top:4px;font-size:12px">
            <option value="0" ${secLevel === '0' ? 'selected' : ''}>Level 0: Operator (Unrestricted Public Screen)</option>
            <option value="1" ${secLevel === '1' ? 'selected' : ''}>Level 1: Line Supervisor (Password Required)</option>
            <option value="2" ${secLevel === '2' ? 'selected' : ''}>Level 2: Lead Engineer / Maintenance (Master Access)</option>
          </select>
          <div style="font-size:11px;color:#64748B;margin-top:4px">Requires user authorization PIN before navigating to this screen in runtime.</div>
        </div>

        <!-- Dialog Footer -->
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px;border-top:1px solid #E2E8F0;padding-top:12px">
          <button class="btn" id="dlg-prop-cancel">Cancel</button>
          <button class="btn primary" id="dlg-prop-apply">✔ Apply Properties</button>
        </div>
      </div>
    `;

    showModal('Screen Properties', html);

    const bgEl = document.getElementById('dlg-prop-bg');
    const bgHex = document.getElementById('dlg-prop-bg-hex');
    const startupEl = document.getElementById('dlg-prop-startup');
    const secEl = document.getElementById('dlg-prop-sec');
    const cancelBtn = document.getElementById('dlg-prop-cancel');
    const applyBtn = document.getElementById('dlg-prop-apply');

    if (bgEl && bgHex) {
      bgEl.oninput = () => { bgHex.value = bgEl.value; };
      bgHex.oninput = () => {
        if (/^#[0-9A-Fa-f]{6}$/.test(bgHex.value)) bgEl.value = bgHex.value;
      };
      document.querySelectorAll('.btn-bg-preset').forEach(btn => {
        btn.onclick = () => {
          const col = btn.getAttribute('data-color');
          bgEl.value = col;
          bgHex.value = col;
        };
      });
    }

    if (cancelBtn) cancelBtn.onclick = hideModal;

    if (applyBtn) {
      applyBtn.onclick = () => {
        const newProps = {
          bgColor: bgHex ? bgHex.value : bgColor,
          securityLevel: secEl ? secEl.value : '0'
        };
        const isSetStartup = startupEl ? startupEl.checked : false;

        if (typeof ProjectModel !== 'undefined') {
          ProjectModel.setScreenMeta(screenName, newProps);
          if (isSetStartup) {
            ProjectModel.setStartupScreen(screenName);
          } else if (isStartup && !isSetStartup) {
            ProjectModel.setStartupScreen(null);
          }
        }

        hideModal();
        if (onApply) onApply(newProps, isSetStartup);
      };
    }
  }

  return {
    showModal,
    hideModal,
    showBuildOutput,
    showDeviceAddressPicker,
    showObjectPropertiesModal,
    showTagManagerModal,
    showRenameScreenModal,
    showScreenPropertiesModal
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ModalManager;
}

