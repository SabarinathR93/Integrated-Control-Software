    /**
     * HMI Designer Studio - Dialog & Modal Management
     */

    const ModalManager = (function () {
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

        const escapeAttr = (value) => String(value == null ? '' : value)
          .replace(/&/g, '&amp;')
          .replace(/"/g, '&quot;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        const asColor = (value, fallback) => {
          if (/^#[0-9a-f]{6}$/i.test(value || '')) return value;
          const rgb = String(value || '').match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
          return rgb ? '#' + rgb.slice(1).map(part => Number(part).toString(16).padStart(2, '0')).join('') : fallback;
        };
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
        const objectId = obj.getAttribute('data-object-id') || '';
        const comment = obj.getAttribute('data-comment') || '';
        const layer = obj.getAttribute('data-layer') || '0';
        const fontSize = obj.getAttribute('data-font-size') || '13';
        const fontFamily = obj.getAttribute('data-font-family') || 'Arial';
        const isBold = obj.getAttribute('data-bold') === '1';
        const isItalic = obj.getAttribute('data-italic') === '1';
        const textAlign = obj.getAttribute('data-text-align') || 'center';
        const rotation = obj.getAttribute('data-rotation') || '0';
        const lineStyle = obj.getAttribute('data-line-style') || 'solid';
        const borderWidth = obj.style.borderWidth ? parseInt(obj.style.borderWidth, 10) : 2;
        const borderColor = asColor(obj.style.borderColor, '#000000');
        const bgColor = asColor(obj.style.backgroundColor, '#FFFFFF');
        const fgColor = asColor(obj.style.color, '#000000');
        const cornerRadius = obj.getAttribute('data-corner-radius') || '4';
        const dataFormat = obj.getAttribute('data-format') || 'BIN16';
        const integerDigits = obj.getAttribute('data-integer-digits') || '5';
        const zeroSuppress = obj.getAttribute('data-zero-suppress') === '1';
        const comma = obj.getAttribute('data-comma') === '1';
        const showSign = obj.getAttribute('data-show-sign') === '1';
        const scaling = obj.getAttribute('data-scaling') || '1';
        const offset = obj.getAttribute('data-offset') || '0';
        const dateFormat = obj.getAttribute('data-date-format') || 'yyyy-MM-dd HH:mm:ss';
        const charCount = obj.getAttribute('data-char-count') || '16';
        const setValue = obj.getAttribute('data-set-value') || '0';
        const wordAction = obj.getAttribute('data-word-action') || 'Write';

        const curX = Math.round(parseFloat(obj.style.left) || 0);
        const curY = Math.round(parseFloat(obj.style.top) || 0);
        const curW = Math.round(obj.offsetWidth || 120);
        const curH = Math.round(obj.offsetHeight || 50);

        const cat = (typeof WidgetRegistry !== 'undefined') ? WidgetRegistry.getCategory(type) : 'shape';
        const screens = (typeof ProjectModel !== 'undefined') ? Object.keys(ProjectModel.getProject().screens || {}) : ['Base_Screen_1'];

        const visMode = obj.getAttribute('data-vis-mode') || 'always';
        const visTag = obj.getAttribute('data-vis-tag') || '';
        const isFlash = obj.getAttribute('data-flash') === 'true' || obj.getAttribute('data-flash') === '1';
        const interlockMode = obj.getAttribute('data-interlock-mode') || 'none';
        const interlockTag = obj.getAttribute('data-interlock-tag') || '';
        const securityLevel = obj.getAttribute('data-security-level') || '0';
        const notificationDevice = obj.getAttribute('data-notification-device') || '';
        const hasBuzzer = obj.getAttribute('data-buzzer') === '1';

        let funcFieldsHtml = '';

        // Process Tank specific fields
        if (type === 'Process Tank') {
          funcFieldsHtml += `
        <div class="prop-sec-title">Process Tank Dynamics & Fluid Calibration</div>
        <div class="prop-grid-2">
          <div>
            <label>Current Fluid Fill Level (0 - 100%)</label>
            <input type="number" id="dlg-min" min="0" max="100" value="${escapeAttr(min || '65')}">
          </div>
          <div>
            <label>Total Tank Capacity (Engineering Units)</label>
            <input type="number" id="dlg-max" value="${escapeAttr(max || '1000')}">
          </div>
        </div>
        <div class="prop-grid-2" style="margin-top:10px">
          <div>
            <label>Fluid Color (Fill Gradient)</label>
            <input type="color" id="dlg-on" value="${escapeAttr(onColor || '#0284C7')}" style="height:38px;padding:2px;cursor:pointer">
          </div>
          <div>
            <label>Tank Vessel Name / Identifier</label>
            <input type="text" id="dlg-text" value="${escapeAttr(text || 'STORAGE TANK')}">
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
            <input type="text" id="dlg-text" value="${escapeAttr(text || 'SELECTOR')}">
          </div>
        </div>
      `;
        } else if (type === 'Analog Slider') {
          funcFieldsHtml += `
        <div class="prop-sec-title">Analog Slider Range & Scale</div>
        <div class="prop-grid-2">
          <div>
            <label>Minimum Setpoint (0%)</label>
            <input type="number" id="dlg-min" value="${escapeAttr(min || '0')}">
          </div>
          <div>
            <label>Maximum Setpoint (100%)</label>
            <input type="number" id="dlg-max" value="${escapeAttr(max || '100')}">
          </div>
        </div>
        <div style="margin-top:10px">
          <label>Slider Tag / Caption</label>
          <input type="text" id="dlg-text" value="${escapeAttr(text || 'SLIDER')}">
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
            <input type="text" id="dlg-text" value="${escapeAttr(text || 'STATE 1: RUN')}">
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
            <input type="text" id="dlg-text" value="${escapeAttr(text || 'TOWER 1')}">
          </div>
        </div>
      `;
        } else if (cat === 'switch') {
          funcFieldsHtml += `
        <div style="${type === 'Word Switch' || type === 'Go To Screen Switch' ? 'display:none' : ''}">
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
              <input type="text" id="dlg-text" value="${escapeAttr(text)}">
            </div>
          </div>
        </div>
      `;
          if (type === 'Screen Navigation' || type === 'Go To Screen Switch') {
            funcFieldsHtml += `
          <div style="margin-top:10px">
            <label>Target Screen to Open</label>
            <select id="dlg-nav">
              ${screens.map(s => `<option value="${s}" ${navTarget === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
        `;
          }
          if (type === 'Word Switch') {
            funcFieldsHtml += `
          <div class="prop-sec-title">Word Operation</div>
          <div class="prop-grid-2">
            <div>
              <label>Operation</label>
              <select id="dlg-word-action">
                <option value="Write" ${wordAction === 'Write' ? 'selected' : ''}>Write value</option>
                <option value="Add" ${wordAction === 'Add' ? 'selected' : ''}>Add value</option>
                <option value="Subtract" ${wordAction === 'Subtract' ? 'selected' : ''}>Subtract value</option>
                <option value="Bit ON" ${wordAction === 'Bit ON' ? 'selected' : ''}>Turn bit ON</option>
                <option value="Bit OFF" ${wordAction === 'Bit OFF' ? 'selected' : ''}>Turn bit OFF</option>
              </select>
            </div>
            <div>
              <label>Value / Bit Number</label>
              <input type="number" id="dlg-set-value" value="${escapeAttr(setValue)}">
            </div>
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
            <input type="color" id="dlg-on" value="${escapeAttr(onColor)}" style="height:38px;padding:2px;cursor:pointer">
          </div>
          <div>
            <label>OFF Color (Inactive Bit)</label>
            <input type="color" id="dlg-off" value="${escapeAttr(offColor)}" style="height:38px;padding:2px;cursor:pointer">
          </div>
        </div>
        <div style="margin-top:10px">
          <label>Lamp Caption Text</label>
          <input type="text" id="dlg-text" value="${escapeAttr(text)}">
        </div>
      `;
        } else if (cat === 'numeric' && ['Static Text', 'Text', 'String Display', 'Date/Time'].includes(type)) {
          funcFieldsHtml += `
        <div class="prop-sec-title">Text & String Display</div>
        ${type === 'String Display' ? `
          <div>
            <label>Maximum characters</label>
            <input type="number" id="dlg-char-count" min="1" max="256" value="${escapeAttr(charCount)}">
          </div>
        ` : ''}
        ${type === 'Date/Time' ? `
          <div>
            <label>Date / time format</label>
            <select id="dlg-date-format">
              ${['yyyy-MM-dd HH:mm:ss', 'MM/dd/yyyy h:mm:ss tt', 'HH:mm:ss', 'yyyy-MM-dd', 'ddd, MMM d yyyy'].map(format => `<option value="${format}" ${dateFormat === format ? 'selected' : ''}>${format}</option>`).join('')}
            </select>
          </div>
        ` : ''}
        <div style="font-size:11px;color:#64748B">
          Text content is editable in the Text tab. Data binding and device-specific format execution are not simulated for this object.
        </div>
      `;
        } else if (cat === 'numeric') {
          // Numeric specific fields
          funcFieldsHtml += `
        <div class="prop-sec-title">Data Format & Numeric Limits</div>
        <div class="prop-grid-2">
          <div>
            <label>Minimum Value</label>
            <input type="number" id="dlg-min" value="${escapeAttr(min)}">
          </div>
          <div>
            <label>Maximum Value</label>
            <input type="number" id="dlg-max" value="${escapeAttr(max)}">
          </div>
        </div>
        <div class="prop-grid-2" style="margin-top:10px">
          <div>
            <label>Decimal Places (0 - 4)</label>
            <input type="number" id="dlg-dec" min="0" max="4" value="${escapeAttr(dec)}">
          </div>
          <div>
            <label>Unit / Engineering Suffix</label>
            <input type="text" id="dlg-text" value="${escapeAttr(text)}" placeholder="e.g. RPM, °C, Bar, kg">
          </div>
        </div>
        <div class="prop-grid-2" style="margin-top:10px">
          <div>
            <label>Data Type</label>
            <select id="dlg-data-format">
              <option value="BIN16" ${dataFormat === 'BIN16' ? 'selected' : ''}>BIN 16-bit</option>
              <option value="BIN32" ${dataFormat === 'BIN32' ? 'selected' : ''}>BIN 32-bit</option>
              <option value="BCD" ${dataFormat === 'BCD' ? 'selected' : ''}>BCD</option>
              <option value="FLOAT" ${dataFormat === 'FLOAT' ? 'selected' : ''}>Floating point</option>
            </select>
          </div>
          <div>
            <label>Integer Digits</label>
            <input type="number" id="dlg-integer-digits" min="1" max="12" value="${escapeAttr(integerDigits)}">
          </div>
        </div>
        <div class="prop-grid-2" style="margin-top:10px">
          <label><input type="checkbox" id="dlg-zero-suppress" ${zeroSuppress ? 'checked' : ''}> Suppress leading zeroes</label>
          <label><input type="checkbox" id="dlg-comma" ${comma ? 'checked' : ''}> Use thousands separator</label>
          <label><input type="checkbox" id="dlg-show-sign" ${showSign ? 'checked' : ''}> Always show positive sign</label>
        </div>
        <div class="prop-grid-2" style="margin-top:10px">
          <div>
            <label>Scale Factor</label>
            <input type="number" id="dlg-scaling" step="any" value="${escapeAttr(scaling)}">
          </div>
          <div>
            <label>Offset</label>
            <input type="number" id="dlg-offset" step="any" value="${escapeAttr(offset)}">
          </div>
        </div>
        <div style="font-size:11px;color:#64748B">
          The simulator formats virtual numeric values; PLC-specific BIN/BCD/float word conversion is not modeled.
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
              <input type="text" id="dlg-text" value="${escapeAttr(text)}">
            </div>
          </div>
        `;
          } else if (type === 'Alarm Status Lamp') {
            funcFieldsHtml += `
          <div class="prop-sec-title">Alarm Status Indication Colors</div>
          <div class="prop-grid-2">
            <div>
              <label>Active Alarm Color</label>
              <input type="color" id="dlg-on" value="${escapeAttr(onColor || '#EF4444')}" style="height:38px;padding:2px;cursor:pointer">
            </div>
            <div>
              <label>System Normal Color</label>
              <input type="color" id="dlg-off" value="${escapeAttr(offColor || '#10B981')}" style="height:38px;padding:2px;cursor:pointer">
            </div>
          </div>
          <div style="margin-top:10px">
            <label>Lamp Status Caption</label>
            <input type="text" id="dlg-text" value="${escapeAttr(text)}">
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
              <input type="text" id="dlg-text" value="${escapeAttr(text)}">
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
            <input type="number" id="dlg-min" value="${escapeAttr(min)}">
          </div>
          <div>
            <label>Y-Axis Maximum (100% SP)</label>
            <input type="number" id="dlg-max" value="${escapeAttr(max)}">
          </div>
        </div>
        <div style="margin-top:10px">
          <label>Graph Caption</label>
          <input type="text" id="dlg-text" value="${escapeAttr(text)}">
        </div>
      `;
        } else {
          // Shapes / Machines
          funcFieldsHtml += `
        <div class="prop-sec-title">Symbol & Machine Identification</div>
        <div>
          <label>Caption / Machine Name</label>
          <input type="text" id="dlg-text" value="${escapeAttr(text)}">
        </div>
      `;
        }

        const advancedFieldsHtml = `
      <div class="prop-sec-title">Display Conditions</div>
      <div class="prop-grid-2">
        <div>
          <label>Conditional Visibility</label>
          <select id="dlg-vis-mode">
            <option value="always" ${visMode === 'always' ? 'selected' : ''}>Always visible</option>
            <option value="on" ${visMode === 'on' ? 'selected' : ''}>Visible when bit is ON</option>
            <option value="off" ${visMode === 'off' ? 'selected' : ''}>Visible when bit is OFF</option>
          </select>
        </div>
        <div>
          <label>Visibility Bit Device</label>
          <input type="text" id="dlg-vis-tag" value="${escapeAttr(visTag)}" placeholder="e.g. M120" style="font-family:Consolas,monospace">
        </div>
      </div>
      <label style="display:flex;align-items:center;gap:8px">
        <input type="checkbox" id="dlg-flash" ${isFlash ? 'checked' : ''} style="width:16px;height:16px">
        Enable flashing in the simulator
      </label>

      <div class="prop-sec-title">Touch, Interlock & Security</div>
      <div class="prop-grid-2">
        <div>
          <label>Interlock condition</label>
          <select id="dlg-interlock-mode">
            <option value="none" ${interlockMode === 'none' ? 'selected' : ''}>No interlock</option>
            <option value="on" ${interlockMode === 'on' ? 'selected' : ''}>Allow touch when bit is ON</option>
            <option value="off" ${interlockMode === 'off' ? 'selected' : ''}>Allow touch when bit is OFF</option>
          </select>
        </div>
        <div>
          <label>Interlock Bit Device</label>
          <input type="text" id="dlg-interlock-tag" value="${escapeAttr(interlockTag)}" placeholder="e.g. M120" style="font-family:Consolas,monospace">
        </div>
      </div>
      <div class="prop-grid-2">
        <div>
          <label>Security level</label>
          <select id="dlg-security-level">
            ${[0, 1, 2, 3, 4, 5].map(level => `<option value="${level}" ${String(level) === securityLevel ? 'selected' : ''}>${level === 0 ? 'None' : 'Level ' + level}</option>`).join('')}
          </select>
        </div>
        <div>
          <label>Notification device</label>
          <input type="text" id="dlg-notification-device" value="${escapeAttr(notificationDevice)}" placeholder="Optional device address" style="font-family:Consolas,monospace">
        </div>
      </div>
      <label style="display:flex;align-items:center;gap:8px">
        <input type="checkbox" id="dlg-buzzer" ${hasBuzzer ? 'checked' : ''} style="width:16px;height:16px">
        Request buzzer notification
      </label>
      <div style="font-size:11px;color:#64748B">
        Security, interlock and notification settings are saved as design properties; enforcement depends on runtime support.
      </div>
    `;

        const html = `
      <div style="display:flex;flex-direction:column;gap:12px">
        <!-- Tabs Header -->
        <div class="prop-tabs">
          <button class="prop-tab-btn active" data-tab="dlg-tab-dev">Basic</button>
          <button class="prop-tab-btn" data-tab="dlg-tab-func">Function</button>
          <button class="prop-tab-btn" data-tab="dlg-tab-style">Style</button>
          <button class="prop-tab-btn" data-tab="dlg-tab-text">Text</button>
          <button class="prop-tab-btn" data-tab="dlg-tab-advanced">Advanced</button>
          <button class="prop-tab-btn" data-tab="dlg-tab-geom">Position</button>
        </div>

        <!-- Tab 1: Device Address & Tag Binding -->
        <div class="prop-tab-page active" id="dlg-tab-dev">
          <div class="prop-sec-title">PLC Device & Register Assignment</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <label>Assigned Device Address / Tag</label>
            <div style="display:flex;gap:6px">
              <input type="text" id="dlg-tag" value="${escapeAttr(tag)}" placeholder="e.g. M100, D200, X0, Y0" style="flex:1;font-family:Consolas,monospace;font-weight:700">
              <button class="btn" id="dlg-btn-pick" style="padding:0 14px">... Pick Address</button>
            </div>
            <div id="dlg-tag-feedback" style="font-size:11px;color:#767676;margin-top:4px">
              Supported protocols: Mitsubishi MELSEC (X, Y, M, D, W, ZR), Siemens S7 (DB/I/Q), Modbus TCP (0x, 4x).
            </div>
          </div>
          <div class="prop-sec-title">Object Identification</div>
          <div class="prop-grid-2">
            <div>
              <label>Object ID / Name</label>
              <input type="text" id="dlg-object-id" value="${escapeAttr(objectId)}" placeholder="Optional unique name">
            </div>
            <div>
              <label>Comment</label>
              <input type="text" id="dlg-comment" value="${escapeAttr(comment)}" placeholder="Engineering note">
            </div>
          </div>
        </div>

        <!-- Tab 2: Function & Behavior -->
        <div class="prop-tab-page" id="dlg-tab-func">
          ${funcFieldsHtml}
        </div>

        <div class="prop-tab-page" id="dlg-tab-style">
          <div class="prop-sec-title">${type} Design &amp; Template Library</div>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;padding:10px;border:1px solid #DDD;border-radius:6px;background:#F8FAFC;">
            <div id="dlg-bs-preview" style="width:92px;height:54px;flex-shrink:0;"></div>
            <div style="flex:1;min-width:0;">
              <div id="dlg-bs-name" style="font-size:12px;font-weight:700;color:#111;margin-bottom:4px;">${escapeAttr(obj.getAttribute('data-switch-preset') || obj.getAttribute('data-template-id') || 'Default Template')}</div>
              <button type="button" id="dlg-bs-browse" style="padding:5px 12px;border:0;border-radius:4px;background:#D9261C;color:#FFF;font-size:11px;font-weight:700;cursor:pointer;">Browse Templates…</button>
            </div>
          </div>
          <div class="prop-sec-title">Shape & Colors</div>
          <div class="prop-grid-2">
            <div>
              <label>Shape style</label>
              <select id="dlg-style">
                <option value="Flat" ${obj.getAttribute('data-style') === 'Flat' ? 'selected' : ''}>Flat</option>
                <option value="Raised" ${obj.getAttribute('data-style') === 'Raised' ? 'selected' : ''}>Raised</option>
                <option value="Pill" ${obj.getAttribute('data-style') === 'Pill' ? 'selected' : ''}>Pill</option>
                <option value="Circle" ${obj.getAttribute('data-style') === 'Circle' ? 'selected' : ''}>Circle</option>
              </select>
            </div>
            <div>
              <label>Corner radius (px)</label>
              <input type="number" id="dlg-corner-radius" min="0" max="100" value="${escapeAttr(cornerRadius)}">
            </div>
          </div>
          <div class="prop-grid-2">
            <div><label>Background / Fill</label><input type="color" id="dlg-bg" value="${bgColor}"></div>
            <div><label>Text / Foreground</label><input type="color" id="dlg-fg" value="${fgColor}"></div>
          </div>
          <div class="prop-grid-2">
            <div><label>Border color</label><input type="color" id="dlg-border-color" value="${borderColor}"></div>
            <div>
              <label>Border width (px)</label>
              <input type="number" id="dlg-border-width" min="0" max="20" value="${Number.isFinite(borderWidth) ? borderWidth : 2}">
            </div>
          </div>
          <div class="prop-grid-2">
            <div>
              <label>Line type</label>
              <select id="dlg-line-style">
                <option value="solid" ${lineStyle === 'solid' ? 'selected' : ''}>Solid</option>
                <option value="dashed" ${lineStyle === 'dashed' ? 'selected' : ''}>Dashed</option>
                <option value="dotted" ${lineStyle === 'dotted' ? 'selected' : ''}>Dotted</option>
                <option value="double" ${lineStyle === 'double' ? 'selected' : ''}>Double</option>
              </select>
            </div>
            <div class="prop-grid-2" style="align-items:center">
              <div><label>ON color</label><input type="color" id="dlg-style-on" value="${escapeAttr(onColor)}"></div>
              <div><label>OFF color</label><input type="color" id="dlg-style-off" value="${escapeAttr(offColor)}"></div>
            </div>
          </div>
        </div>

        <div class="prop-tab-page" id="dlg-tab-text">
          <div class="prop-sec-title">Text Appearance</div>
          <div class="prop-grid-2">
            <div>
              <label>Font family</label>
              <select id="dlg-font-family">
                ${['Arial', 'Segoe UI', 'Tahoma', 'Verdana', 'Consolas'].map(font => `<option value="${font}" ${font === fontFamily ? 'selected' : ''}>${font}</option>`).join('')}
              </select>
            </div>
            <div><label>Font size (px)</label><input type="number" id="dlg-font-size" min="6" max="96" value="${escapeAttr(fontSize)}"></div>
          </div>
          <div class="prop-grid-2">
            <div>
              <label>Alignment</label>
              <select id="dlg-text-align">
                <option value="left" ${textAlign === 'left' ? 'selected' : ''}>Left</option>
                <option value="center" ${textAlign === 'center' ? 'selected' : ''}>Center</option>
                <option value="right" ${textAlign === 'right' ? 'selected' : ''}>Right</option>
              </select>
            </div>
            <div><label>Rotation (degrees)</label><input type="number" id="dlg-rotation" min="-180" max="180" value="${escapeAttr(rotation)}"></div>
          </div>
          <div class="prop-grid-2">
            <label><input type="checkbox" id="dlg-bold" ${isBold ? 'checked' : ''}> Bold</label>
            <label><input type="checkbox" id="dlg-italic" ${isItalic ? 'checked' : ''}> Italic</label>
          </div>
          <div class="prop-sec-title">Object Text</div>
          <div>
            <label>Text / caption</label>
            <input type="text" id="dlg-text-content" value="${escapeAttr(text)}" placeholder="Object label or caption">
          </div>
        </div>

        <div class="prop-tab-page" id="dlg-tab-advanced">
          ${advancedFieldsHtml}
        </div>

        <!-- Position & dimensions -->
        <div class="prop-tab-page" id="dlg-tab-geom">
          <div class="prop-sec-title">Layout Coordinates</div>
          <div class="prop-grid-2">
            <div>
              <label>X Position (Left)</label>
              <input type="number" id="dlg-x" value="${curX}" min="0">
            </div>
            <div>
              <label>Y Position (Top)</label>
              <input type="number" id="dlg-y" value="${curY}" min="0">
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
          <div>
            <label>Layer / drawing order</label>
            <input type="number" id="dlg-layer" min="0" max="999" value="${escapeAttr(layer)}">
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

        const functionTextInput = document.getElementById('dlg-text');
        const textTabInput = document.getElementById('dlg-text-content');
        if (functionTextInput && textTabInput) {
          functionTextInput.addEventListener('input', () => { textTabInput.value = functionTextInput.value; });
          textTabInput.addEventListener('input', () => { functionTextInput.value = textTabInput.value; });
        }

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

        // Universal Object Template & Design Gallery (All 51 Objects)
        let pendingSwitchDesign = null;
        let pendingTemplateDesign = null;
        const bsPreviewEl = document.getElementById('dlg-bs-preview');
        const bsNameEl = document.getElementById('dlg-bs-name');
        const bsBrowseBtn = document.getElementById('dlg-bs-browse');
        const templatesForThis = (typeof WidgetRegistry !== 'undefined' && WidgetRegistry.getTemplatesForType)
          ? WidgetRegistry.getTemplatesForType(type)
          : [];
        if (bsBrowseBtn && templatesForThis.length) {
          bsBrowseBtn.textContent = `Browse ${templatesForThis.length} ${type} Templates…`;
        }
        if (bsPreviewEl && typeof WidgetRegistry !== 'undefined' && WidgetRegistry.renderTemplateSvg) {
          const curId = type === 'Bit Switch'
            ? (obj.getAttribute('data-switch-preset') || (templatesForThis[0] && templatesForThis[0].id) || '')
            : (obj.getAttribute('data-template-id') || (templatesForThis[0] && templatesForThis[0].id) || '');
          const curTpl = templatesForThis.find(p => p.id === curId);
          if (curTpl && bsNameEl) bsNameEl.textContent = curTpl.name;
          bsPreviewEl.innerHTML = WidgetRegistry.renderTemplateSvg(type, {
            switchPreset: obj.getAttribute('data-switch-preset') || curId,
            templateId: obj.getAttribute('data-template-id') || curId,
            switchShape: obj.getAttribute('data-switch-shape') || '',
            switchFinish: obj.getAttribute('data-switch-finish') || '',
            switchIndicator: obj.getAttribute('data-switch-ind') || '',
            colorOn: obj.getAttribute('data-on') || '#16A34A',
            colorOff: obj.getAttribute('data-off') || '#1E293B',
            fg: obj.style.color || '#FFFFFF',
            text: obj.getAttribute('data-text') || type,
            tag: obj.getAttribute('data-tag') || 'TAG'
          }, false);
        }
        if (bsBrowseBtn && templatesForThis.length) {
          bsBrowseBtn.onclick = () => {
            const ov = document.createElement('div');
            ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.6);z-index:10050;display:flex;align-items:center;justify-content:center;';
            const cats = ['All', ...Array.from(new Set(templatesForThis.map(p => p.category)))];
            let activeCat = 'All';
            let previewOn = false;
            ov.innerHTML = `
              <div style="width:min(880px,94vw);height:min(620px,88vh);background:#FFF;border:1px solid #CBD5E1;border-radius:8px;box-shadow:0 24px 60px rgba(0,0,0,0.35);display:flex;flex-direction:column;overflow:hidden;font-family:Segoe UI,sans-serif;">
                <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#F7F6F2;border-bottom:1px solid #DDD;">
                  <div style="font-size:14px;font-weight:700;color:#111;">${type} Template Gallery (${templatesForThis.length} Templates)</div>
                  <div style="display:flex;align-items:center;gap:8px;">
                    <button type="button" id="bsg-state-btn" style="padding:5px 10px;border:1px solid #CBD5E1;border-radius:4px;background:#FFF;font-size:11px;font-weight:700;cursor:pointer;">Preview: OFF</button>
                    <button type="button" id="bsg-close" style="border:0;background:transparent;font-size:20px;cursor:pointer;color:#475569;">&times;</button>
                  </div>
                </div>
                <div style="padding:10px 16px;border-bottom:1px solid #EEE;display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
                  <div id="bsg-tabs" style="display:flex;flex-wrap:wrap;gap:4px;">${cats.map(c => `<button type="button" data-cat="${c}" style="padding:4px 10px;border:1px solid #CBD5E1;border-radius:4px;background:${c === 'All' ? '#111' : '#F8FAFC'};color:${c === 'All' ? '#FFF' : '#334155'};font-size:11px;font-weight:600;cursor:pointer;">${c}</button>`).join('')}</div>
                  <input id="bsg-search" type="text" placeholder="Search templates..." style="margin-left:auto;min-width:210px;padding:5px 9px;border:1px solid #CBD5E1;border-radius:4px;font-size:11px;">
                </div>
                <div id="bsg-grid" style="flex:1;overflow:auto;padding:14px 16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:10px;align-content:start;background:#F8FAFC;"></div>
              </div>
            `;
            document.body.appendChild(ov);
            const grid = ov.querySelector('#bsg-grid');
            const searchInp = ov.querySelector('#bsg-search');
            const stateBtn = ov.querySelector('#bsg-state-btn');

            function renderGrid() {
              const q = searchInp.value.trim().toLowerCase();
              const list = templatesForThis.filter(p => {
                if (activeCat !== 'All' && p.category !== activeCat) return false;
                if (q && !p.name.toLowerCase().includes(q) && !p.category.toLowerCase().includes(q)) return false;
                return true;
              });
              const txt = (document.getElementById('dlg-text')?.value || type).slice(0, 14);
              const tg = document.getElementById('dlg-tag')?.value || 'TAG';
              grid.innerHTML = list.map(p => `
                <button type="button" data-id="${p.id}" title="${p.name}" style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px;border:1px solid #E2E8F0;border-radius:6px;background:#FFF;cursor:pointer;text-align:center;">
                  <div style="width:118px;height:66px;">${WidgetRegistry.renderTemplateSvg(type, { switchPreset: p.id, templateId: p.id, text: txt, tag: tg }, previewOn)}</div>
                  <div style="font-size:10px;color:#334155;font-weight:600;line-height:1.2;max-height:24px;overflow:hidden;">${p.name}</div>
                </button>
              `).join('');
            }

            ov.querySelector('#bsg-tabs').onclick = (e) => {
              const btn = e.target.closest('button[data-cat]');
              if (!btn) return;
              activeCat = btn.getAttribute('data-cat');
              ov.querySelectorAll('#bsg-tabs button').forEach(b => {
                const act = b.getAttribute('data-cat') === activeCat;
                b.style.background = act ? '#111' : '#F8FAFC';
                b.style.color = act ? '#FFF' : '#334155';
              });
              renderGrid();
            };
            searchInp.oninput = renderGrid;
            stateBtn.onclick = () => {
              previewOn = !previewOn;
              stateBtn.textContent = previewOn ? 'Preview: ON' : 'Preview: OFF';
              stateBtn.style.background = previewOn ? '#DCFCE7' : '#FFF';
              renderGrid();
            };
            grid.onclick = (e) => {
              const card = e.target.closest('button[data-id]');
              if (!card) return;
              const picked = templatesForThis.find(p => p.id === card.getAttribute('data-id'));
              if (picked) {
                if (type === 'Bit Switch') pendingSwitchDesign = picked;
                else pendingTemplateDesign = picked;
                if (bsNameEl) bsNameEl.textContent = picked.name;
                if (bsPreviewEl) {
                  bsPreviewEl.innerHTML = WidgetRegistry.renderTemplateSvg(type, {
                    switchPreset: picked.id,
                    templateId: picked.id,
                    text: document.getElementById('dlg-text')?.value || type,
                    tag: document.getElementById('dlg-tag')?.value || 'TAG'
                  }, false);
                }
                const fgInput = document.getElementById('dlg-fg');
                if (fgInput && picked.fg) fgInput.value = picked.fg;
              }
              ov.remove();
            };
            ov.querySelector('#bsg-close').onclick = () => ov.remove();
            ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
            renderGrid();
          };
        }

        // Cancel Button
        const cancelBtn = document.getElementById('dlg-btn-cancel');
        if (cancelBtn) cancelBtn.onclick = hideModal;

        // Apply / OK Button
        const applyBtn = document.getElementById('dlg-btn-apply');
        function applyChanges() {
          const newTag = tagInp ? tagInp.value.trim().toUpperCase() : tag;
          const textEl = document.getElementById('dlg-text-content') || document.getElementById('dlg-text');
          const actEl = document.getElementById('dlg-action');
          const onEl = document.getElementById('dlg-style-on') || document.getElementById('dlg-on');
          const offEl = document.getElementById('dlg-style-off') || document.getElementById('dlg-off');
          const minEl = document.getElementById('dlg-min');
          const maxEl = document.getElementById('dlg-max');
          const decEl = document.getElementById('dlg-dec');
          const navEl = document.getElementById('dlg-nav');
          const wordActionEl = document.getElementById('dlg-word-action');
          const setValueEl = document.getElementById('dlg-set-value');
          const visModeEl = document.getElementById('dlg-vis-mode');
          const visTagEl = document.getElementById('dlg-vis-tag');
          const interlockModeEl = document.getElementById('dlg-interlock-mode');
          const interlockTagEl = document.getElementById('dlg-interlock-tag');
          const xEl = document.getElementById('dlg-x');
          const yEl = document.getElementById('dlg-y');
          const wEl = document.getElementById('dlg-w');
          const hEl = document.getElementById('dlg-h');
          const minValue = minEl ? Number(minEl.value) : NaN;
          const maxValue = maxEl ? Number(maxEl.value) : NaN;
          const decimalPlaces = decEl ? Number(decEl.value) : 0;
          const numericScaleField = document.getElementById('dlg-scaling');
          if (Number.isFinite(minValue) && Number.isFinite(maxValue) && minValue > maxValue) {
            alert('Minimum value must be less than or equal to maximum value.');
            return;
          }
          if (decEl && (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 4)) {
            alert('Decimal places must be a whole number from 0 to 4.');
            return;
          }
          if (numericScaleField && (!Number.isFinite(Number(numericScaleField.value)) || Number(numericScaleField.value) === 0)) {
            alert('Scale factor must be a valid non-zero number.');
            return;
          }
          if (visModeEl && visModeEl.value !== 'always' && !visTagEl.value.trim()) {
            alert('Enter a bit device address for conditional visibility.');
            return;
          }
          if (interlockModeEl && interlockModeEl.value !== 'none' && !interlockTagEl.value.trim()) {
            alert('Enter a bit device address for the touch interlock.');
            return;
          }
          if (wordActionEl && (wordActionEl.value === 'Bit ON' || wordActionEl.value === 'Bit OFF')) {
            const bitNumber = Number(setValueEl.value);
            if (!Number.isInteger(bitNumber) || bitNumber < 0 || bitNumber > 15) {
              alert('Word bit number must be a whole number from 0 to 15.');
              return;
            }
          }

          if (newTag) obj.setAttribute('data-tag', newTag);
          if (textEl) obj.setAttribute('data-text', textEl.value);
          if (actEl) obj.setAttribute('data-action', actEl.value);
          if (onEl) obj.setAttribute('data-on', onEl.value);
          if (offEl) obj.setAttribute('data-off', offEl.value);
          if (minEl) obj.setAttribute('data-min', minEl.value);
          if (maxEl) obj.setAttribute('data-max', maxEl.value);
          if (decEl) obj.setAttribute('data-dec', decEl.value);
          if (navEl) obj.setAttribute('data-nav', navEl.value);
          if (wordActionEl) obj.setAttribute('data-word-action', wordActionEl.value);
          if (setValueEl) obj.setAttribute('data-set-value', String(Number(setValueEl.value) || 0));

          const objectIdEl = document.getElementById('dlg-object-id');
          const commentEl = document.getElementById('dlg-comment');
          const styleEl = document.getElementById('dlg-style');
          const bgEl = document.getElementById('dlg-bg');
          const fgEl = document.getElementById('dlg-fg');
          const borderColorEl = document.getElementById('dlg-border-color');
          const borderWidthEl = document.getElementById('dlg-border-width');
          const lineStyleEl = document.getElementById('dlg-line-style');
          const cornerRadiusEl = document.getElementById('dlg-corner-radius');
          const fontSizeEl = document.getElementById('dlg-font-size');
          const fontFamilyEl = document.getElementById('dlg-font-family');
          const textAlignEl = document.getElementById('dlg-text-align');
          const rotationEl = document.getElementById('dlg-rotation');
          const boldEl = document.getElementById('dlg-bold');
          const italicEl = document.getElementById('dlg-italic');
          if (objectIdEl) obj.setAttribute('data-object-id', objectIdEl.value.trim());
          if (commentEl) obj.setAttribute('data-comment', commentEl.value.trim());
          if (styleEl) obj.setAttribute('data-style', styleEl.value);
          if (bgEl) obj.style.backgroundColor = bgEl.value;
          if (fgEl) obj.style.color = fgEl.value;
          if (borderColorEl) obj.setAttribute('data-border-color', borderColorEl.value);
          if (borderWidthEl) obj.setAttribute('data-border-width', String(Math.max(0, Math.min(20, Number(borderWidthEl.value) || 0))));
          if (lineStyleEl) obj.setAttribute('data-line-style', lineStyleEl.value);
          if (cornerRadiusEl) obj.setAttribute('data-corner-radius', String(Math.max(0, Math.min(100, Number(cornerRadiusEl.value) || 0))));
          if (fontSizeEl) obj.setAttribute('data-font-size', String(Math.max(6, Math.min(96, Number(fontSizeEl.value) || 13))));
          if (fontFamilyEl) obj.setAttribute('data-font-family', fontFamilyEl.value);
          if (textAlignEl) obj.setAttribute('data-text-align', textAlignEl.value);
          if (rotationEl) obj.setAttribute('data-rotation', String(Math.max(-180, Math.min(180, Number(rotationEl.value) || 0))));
          if (boldEl) obj.setAttribute('data-bold', boldEl.checked ? '1' : '0');
          if (italicEl) obj.setAttribute('data-italic', italicEl.checked ? '1' : '0');

          const dataFormatEl = document.getElementById('dlg-data-format');
          const integerDigitsEl = document.getElementById('dlg-integer-digits');
          const zeroSuppressEl = document.getElementById('dlg-zero-suppress');
          const commaEl = document.getElementById('dlg-comma');
          const showSignEl = document.getElementById('dlg-show-sign');
          const scalingEl = document.getElementById('dlg-scaling');
          const offsetEl = document.getElementById('dlg-offset');
          const dateFormatEl = document.getElementById('dlg-date-format');
          const charCountEl = document.getElementById('dlg-char-count');
          if (dataFormatEl) obj.setAttribute('data-format', dataFormatEl.value);
          if (integerDigitsEl) obj.setAttribute('data-integer-digits', String(Math.max(1, Math.min(12, Number(integerDigitsEl.value) || 1))));
          if (zeroSuppressEl) obj.setAttribute('data-zero-suppress', zeroSuppressEl.checked ? '1' : '0');
          if (commaEl) obj.setAttribute('data-comma', commaEl.checked ? '1' : '0');
          if (showSignEl) obj.setAttribute('data-show-sign', showSignEl.checked ? '1' : '0');
          if (scalingEl) obj.setAttribute('data-scaling', String(Number(scalingEl.value) || 0));
          if (offsetEl) obj.setAttribute('data-offset', String(Number(offsetEl.value) || 0));
          if (dateFormatEl) obj.setAttribute('data-date-format', dateFormatEl.value);
          if (charCountEl) obj.setAttribute('data-char-count', String(Math.max(1, Math.min(256, Number(charCountEl.value) || 1))));

          const flashEl = document.getElementById('dlg-flash');
          const securityLevelEl = document.getElementById('dlg-security-level');
          const notificationDeviceEl = document.getElementById('dlg-notification-device');
          const buzzerEl = document.getElementById('dlg-buzzer');
          if (visModeEl) obj.setAttribute('data-vis-mode', visModeEl.value);
          if (visTagEl) obj.setAttribute('data-vis-tag', visTagEl.value.trim().toUpperCase());
          if (flashEl) obj.setAttribute('data-flash', flashEl.checked ? '1' : '0');
          if (interlockModeEl) obj.setAttribute('data-interlock-mode', interlockModeEl.value);
          if (interlockTagEl) obj.setAttribute('data-interlock-tag', interlockTagEl.value.trim().toUpperCase());
          if (securityLevelEl) obj.setAttribute('data-security-level', securityLevelEl.value);
          if (notificationDeviceEl) obj.setAttribute('data-notification-device', notificationDeviceEl.value.trim().toUpperCase());
          if (buzzerEl) obj.setAttribute('data-buzzer', buzzerEl.checked ? '1' : '0');
          if (pendingSwitchDesign) {
            obj.setAttribute('data-switch-preset', pendingSwitchDesign.id);
            obj.setAttribute('data-switch-shape', pendingSwitchDesign.shape);
            obj.setAttribute('data-switch-finish', pendingSwitchDesign.finish);
            obj.setAttribute('data-switch-ind', pendingSwitchDesign.indicator);
            obj.setAttribute('data-on', pendingSwitchDesign.colorOn);
            obj.setAttribute('data-off', pendingSwitchDesign.colorOff);
            obj.style.color = pendingSwitchDesign.fg;
          }
          if (pendingTemplateDesign) {
            obj.setAttribute('data-template-id', pendingTemplateDesign.id);
            obj.setAttribute('data-on', pendingTemplateDesign.colorOn);
            obj.setAttribute('data-off', pendingTemplateDesign.colorOff);
            obj.style.color = pendingTemplateDesign.fg;
          }

          if (xEl) obj.style.left = Math.max(0, parseInt(xEl.value, 10) || 0) + 'px';
          if (yEl) obj.style.top = Math.max(0, parseInt(yEl.value, 10) || 0) + 'px';
          if (wEl) obj.style.width = Math.max(20, parseInt(wEl.value, 10) || 20) + 'px';
          if (hEl) obj.style.height = Math.max(10, parseInt(hEl.value, 10) || 10) + 'px';
          const layerEl = document.getElementById('dlg-layer');
          if (layerEl) obj.setAttribute('data-layer', String(Math.max(0, Math.min(999, parseInt(layerEl.value, 10) || 0))));

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
