/**
 * HMI Designer Studio - Offline Runtime Simulation Engine
 * Simulates Mitsubishi GOT / Industrial HMI runtime with Virtual PLC Memory Table
 */

const HmiSimulator = (function() {
  let isRunning = false;
  let currentScreen = null;
  let simOverlay = null;
  let simStage = null;
  let simInspector = null;
  let screenSelect = null;

  // In-Memory Virtual PLC Data Store
  const VirtualPLC = {
    bits: {},
    words: {},
    subscribers: [],

    getBit(addr) {
      if (!addr) return 0;
      const key = addr.toUpperCase().trim();
      return this.bits[key] ? 1 : 0;
    },

    setBit(addr, val) {
      if (!addr) return;
      const key = addr.toUpperCase().trim();
      const numVal = val ? 1 : 0;
      if (this.bits[key] !== numVal) {
        this.bits[key] = numVal;
        this.notify();
      }
    },

    toggleBit(addr) {
      this.setBit(addr, 1 - this.getBit(addr));
    },

    getWord(addr) {
      if (!addr) return 0;
      const key = addr.toUpperCase().trim();
      return this.words[key] !== undefined ? this.words[key] : 0;
    },

    setWord(addr, val) {
      if (!addr) return;
      const key = addr.toUpperCase().trim();
      const numVal = parseFloat(val) || 0;
      if (this.words[key] !== numVal) {
        this.words[key] = numVal;
        this.notify();
      }
    },

    subscribe(fn) {
      this.subscribers.push(fn);
    },

    unsubscribe(fn) {
      this.subscribers = this.subscribers.filter(s => s !== fn);
    },

    notify() {
      this.subscribers.forEach(fn => fn());
    },

    reset() {
      this.bits = {};
      this.words = {};
      this.notify();
    }
  };

  function initUI() {
    if (simOverlay) return;

    simOverlay = document.createElement('div');
    simOverlay.id = 'sim-overlay';
    simOverlay.className = 'sim-overlay';
    simOverlay.style.display = 'none';

    simOverlay.innerHTML = `
      <div class="sim-window">
        <!-- Simulator Titlebar & Top Controls -->
        <div class="sim-header">
          <div class="sim-title-group">
            <span class="sim-status-dot">●</span>
            <span class="sim-title">HMI RUNTIME SIMULATOR</span>
            <span class="sim-badge">VIRTUAL PLC: RUNNING</span>
          </div>
          <div class="sim-header-center">
            <label style="font-size:11px;color:#94A3B8;font-weight:700">Screen:</label>
            <select id="sim-screen-select" class="sim-screen-dropdown"></select>
          </div>
          <div class="sim-header-actions">
            <button class="sim-btn" id="sim-btn-reset-plc" title="Reset all virtual memory">↺ Reset PLC</button>
            <button class="sim-btn close" id="sim-btn-close" title="Exit Simulator (Esc)">✕ Close (Esc)</button>
          </div>
        </div>

        <!-- Simulator Main Layout: Screen on Left, PLC Inspector on Right -->
        <div class="sim-body">
          <div class="sim-screen-viewport" id="sim-screen-viewport">
            <div class="sim-screen-stage" id="sim-screen-stage"></div>
          </div>

          <!-- Virtual PLC Memory & Scenario Inspector -->
          <div class="sim-inspector-dock" id="sim-inspector-dock">
            <div class="sim-insp-head">
              <span class="sim-insp-title">VIRTUAL PLC MEMORY</span>
              <span class="sim-insp-sub">Interactive Tag Inspector</span>
            </div>

            <!-- Quick Action Test Scenarios -->
            <div class="sim-insp-sec">
              <div class="sim-sec-title">Quick Test Scenarios</div>
              <div class="sim-scenarios-grid">
                <button class="sim-scen-btn fault" id="scen-fault">⚡ Trip Fault (M500)</button>
                <button class="sim-scen-btn motor" id="scen-motor">▶ Run Motor (M100)</button>
                <button class="sim-scen-btn tank" id="scen-tank-hi">🛢 Fill Tank (90%)</button>
                <button class="sim-scen-btn tank" id="scen-tank-lo">🛢 Empty Tank (15%)</button>
                <button class="sim-scen-btn ok" id="scen-ok">✔ Normal Operation</button>
              </div>
            </div>

            <!-- Digital Bit Coils Table -->
            <div class="sim-insp-sec" style="flex:1;overflow:auto">
              <div class="sim-sec-title">Digital Bit Coils (M, Y, X)</div>
              <div class="sim-plc-list" id="sim-bits-list"></div>

              <div class="sim-sec-title" style="margin-top:12px">Analog Word Registers (D, R, 4x)</div>
              <div class="sim-plc-list" id="sim-words-list"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(simOverlay);

    simStage = document.getElementById('sim-screen-stage');
    simInspector = document.getElementById('sim-inspector-dock');
    screenSelect = document.getElementById('sim-screen-select');

    // Close button
    document.getElementById('sim-btn-close').onclick = stop;

    // Reset PLC button
    document.getElementById('sim-btn-reset-plc').onclick = () => {
      VirtualPLC.reset();
      populateDefaultRegisters();
    };

    // Screen dropdown change
    screenSelect.onchange = (e) => {
      switchScreen(e.target.value);
    };

    // Quick Scenarios buttons
    document.getElementById('scen-fault').onclick = () => {
      VirtualPLC.setBit('M500', 1);
    };
    document.getElementById('scen-motor').onclick = () => {
      VirtualPLC.toggleBit('M100');
    };
    document.getElementById('scen-tank-hi').onclick = () => {
      VirtualPLC.setWord('D300', 90);
      VirtualPLC.setWord('D202', 90);
    };
    document.getElementById('scen-tank-lo').onclick = () => {
      VirtualPLC.setWord('D300', 15);
      VirtualPLC.setWord('D202', 15);
    };
    document.getElementById('scen-ok').onclick = () => {
      VirtualPLC.setBit('M500', 0);
      VirtualPLC.setWord('D300', 65);
      VirtualPLC.setWord('D200', 50);
    };

    // Escape key closes simulator
    window.addEventListener('keydown', (e) => {
      if (isRunning && e.key === 'Escape') {
        stop();
      }
    });

    // Virtual PLC subscriber updates live UI
    VirtualPLC.subscribe(() => {
      updateSimulationElements();
      renderInspectorLists();
    });
  }

  function populateDefaultRegisters() {
    // Scan all screens in project for tags
    const prj = ProjectModel.getProject();
    const screens = prj.screens || {};

    // Defaults
    VirtualPLC.setBit('M100', 0);
    VirtualPLC.setBit('M500', 0);
    VirtualPLC.setBit('Y0', 0);
    VirtualPLC.setBit('Y20', 0);
    VirtualPLC.setWord('D200', 45);
    VirtualPLC.setWord('D210', 30);
    VirtualPLC.setWord('D300', 65);

    Object.values(screens).forEach(objList => {
      (objList || []).forEach(cfg => {
        const tag = (cfg.tag || cfg.device || '').toUpperCase().trim();
        if (!tag) return;
        const cat = cfg.category || WidgetRegistry.getCategory(cfg.type);

        if (cat === 'switch' || cat === 'lamp' || tag.startsWith('M') || tag.startsWith('Y') || tag.startsWith('X')) {
          if (VirtualPLC.bits[tag] === undefined) VirtualPLC.setBit(tag, 0);
        } else {
          if (VirtualPLC.words[tag] === undefined) {
            VirtualPLC.setWord(tag, cfg.type === 'Process Tank' ? 65 : 50);
          }
        }
      });
    });
  }

  function start(screenName = null) {
    initUI();
    isRunning = true;

    const prj = ProjectModel.getProject();
    const screens = Object.keys(prj.screens || {});
    if (!screens.length) {
      alert('Please add or open a screen before running simulation.');
      return;
    }

    currentScreen = screenName || (ProjectModel.getStartupScreen && ProjectModel.getStartupScreen()) || ProjectModel.getCurrentScreen() || screens[0];

    // Populate screen dropdown
    screenSelect.innerHTML = screens.map(s => `
      <option value="${s}" ${s === currentScreen ? 'selected' : ''}>${s}</option>
    `).join('');

    populateDefaultRegisters();
    renderScreen(currentScreen);
    renderInspectorLists();

    simOverlay.style.display = 'flex';
  }

  function stop() {
    isRunning = false;
    if (simOverlay) simOverlay.style.display = 'none';
  }

  function switchScreen(screenName) {
    if (!screenName) return;
    currentScreen = screenName;
    if (screenSelect) screenSelect.value = screenName;
    renderScreen(screenName);
  }

  function renderScreen(screenName) {
    if (!simStage) return;
    simStage.innerHTML = '';

    const prj = ProjectModel.getProject();
    const res = prj.resolution || { w: 1280, h: 800 };
    simStage.style.width = res.w + 'px';
    simStage.style.height = res.h + 'px';
    simStage.style.background = (ProjectModel.getScreenMeta && ProjectModel.getScreenMeta(screenName).bgColor) || '#FFFFFF';

    const objList = ProjectModel.getScreenObjects(screenName) || [];
    objList.forEach((cfg, idx) => {
      const el = document.createElement('div');
      el.className = 'obj sim-interactive';
      el.id = `sim-obj-${idx}`;
      WidgetRegistry.renderWidgetContent(el, cfg);

      // Attach runtime interactive events
      attachInteractiveHandlers(el, cfg);
      simStage.appendChild(el);
    });

    updateSimulationElements();
    adjustViewportScale();
  }

  function adjustViewportScale() {
    const viewport = document.getElementById('sim-screen-viewport');
    if (!viewport || !simStage) return;

    const vw = viewport.clientWidth - 40;
    const vh = viewport.clientHeight - 40;
    const sw = simStage.offsetWidth || 1280;
    const sh = simStage.offsetHeight || 800;

    const scale = Math.min(1.0, Math.min(vw / sw, vh / sh));
    simStage.style.transform = `scale(${Math.max(0.3, scale)})`;
  }

  function attachInteractiveHandlers(el, cfg) {
    const t = cfg.type;
    const cat = cfg.category || WidgetRegistry.getCategory(t);
    const tag = (cfg.tag || cfg.device || '').toUpperCase().trim();
    const act = cfg.action || '';

    // 1. Bit Switch / Push Button
    if (cat === 'switch' && t !== 'Screen Navigation') {
      el.style.cursor = 'pointer';

      if (act === 'Alternate' || t === 'Toggle Switch') {
        el.addEventListener('click', (e) => {
          e.preventDefault();
          VirtualPLC.toggleBit(tag);
        });
      } else if (act === 'Set') {
        el.addEventListener('click', (e) => {
          e.preventDefault();
          VirtualPLC.setBit(tag, 1);
        });
      } else if (act === 'Reset') {
        el.addEventListener('click', (e) => {
          e.preventDefault();
          VirtualPLC.setBit(tag, 0);
        });
      } else {
        // Momentary
        el.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          VirtualPLC.setBit(tag, 1);
          el.classList.add('sim-pressed');
        });
        const release = () => {
          VirtualPLC.setBit(tag, 0);
          el.classList.remove('sim-pressed');
        };
        el.addEventListener('pointerup', release);
        el.addEventListener('pointerleave', release);
      }
    }

    // 2. Screen Navigation
    if (t === 'Screen Navigation') {
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const target = cfg.navTarget || el.getAttribute('data-nav') || 'Base_Screen_1';
        switchScreen(target);
      });
    }

    // 3. Alarm Acknowledge
    if (t === 'Alarm Acknowledge') {
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        e.preventDefault();
        VirtualPLC.setBit(tag || 'M501', 1);
        // Acknowledge alarm
        VirtualPLC.setBit('M500', 0);
        setTimeout(() => VirtualPLC.setBit(tag || 'M501', 0), 200);
      });
    }

    // 4. Alarm Reset
    if (t === 'Alarm Reset') {
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        e.preventDefault();
        VirtualPLC.setBit(tag || 'M502', 1);
        VirtualPLC.setBit('M500', 0);
        setTimeout(() => VirtualPLC.setBit(tag || 'M502', 0), 200);
      });
    }

    // 5. Analog Slider
    if (t === 'Analog Slider') {
      el.style.cursor = 'ns-resize';
      let isDragging = false;
      const minVal = parseFloat(cfg.min || 0);
      const maxVal = parseFloat(cfg.max || 100);

      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        isDragging = true;
        el.setPointerCapture(e.pointerId);

        function onMove(ev) {
          if (!isDragging) return;
          const rect = el.getBoundingClientRect();
          const ratio = Math.max(0, Math.min(1, 1 - (ev.clientY - rect.top) / rect.height));
          const val = Math.round(minVal + ratio * (maxVal - minVal));
          VirtualPLC.setWord(tag || 'D210', val);
        }

        function onUp(ev) {
          isDragging = false;
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          try { el.releasePointerCapture(ev.pointerId); } catch (_) {}
        }

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        onMove(e);
      });
    }

    // 6. Numeric Input
    if (t === 'Numeric Input') {
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const curVal = VirtualPLC.getWord(tag || 'D200');
        const input = prompt(`Enter Setpoint value for [${tag || 'D200'}]:`, curVal);
        if (input !== null) {
          VirtualPLC.setWord(tag || 'D200', parseFloat(input) || 0);
        }
      });
    }
  }

  function updateSimulationElements() {
    if (!simStage) return;

    simStage.querySelectorAll('.obj').forEach(el => {
      const type = el.getAttribute('data-type') || '';
      const tag = (el.getAttribute('data-tag') || '').toUpperCase().trim();
      const cat = WidgetRegistry.getCategory(type);

      // Process Tank dynamic fluid level
      if (type === 'Process Tank') {
        const val = VirtualPLC.getWord(tag || 'D300');
        const pct = Math.min(100, Math.max(0, Math.round(val)));
        const fillHeight = Math.round(116 * (pct / 100));
        const fillY = 138 - fillHeight;

        const fluidRect = el.querySelector('rect[fill^="url(#tankFluid"]');
        if (fluidRect) {
          fluidRect.setAttribute('y', fillY);
          fluidRect.setAttribute('height', fillHeight);
        }
        const textPct = el.querySelectorAll('text');
        textPct.forEach(tEl => {
          if (tEl.textContent.includes('%')) {
            tEl.textContent = `${pct}%`;
          }
        });
      }

      // Bit Lamp / Pilot LED
      if (cat === 'lamp' && type !== 'Tower Light' && type !== 'Word Lamp') {
        const bit = VirtualPLC.getBit(tag || 'Y0');
        const onCol = el.getAttribute('data-on') || '#22C55E';
        const offCol = el.getAttribute('data-off') || '#6B7280';
        const circle = el.querySelector('circle[fill="#22C55E"], circle[fill="#3B82F6"]');
        if (circle) {
          circle.setAttribute('fill', bit ? onCol : offCol);
          circle.setAttribute('opacity', bit ? '1' : '0.4');
        } else {
          el.style.backgroundColor = bit ? onCol : offCol;
        }
      }

      // Tower Light
      if (type === 'Tower Light') {
        const isFault = VirtualPLC.getBit('M500');
        const isRun = VirtualPLC.getBit('M100') || VirtualPLC.getBit('Y0');

        const redTier = el.querySelector('rect[fill="#EF4444"]');
        const amberTier = el.querySelector('rect[fill="#F59E0B"]');
        const greenTier = el.querySelector('rect[fill="#10B981"]');

        if (redTier) redTier.style.opacity = isFault ? '1' : '0.2';
        if (greenTier) greenTier.style.opacity = isRun && !isFault ? '1' : '0.2';
        if (amberTier) amberTier.style.opacity = !isRun && !isFault ? '1' : '0.2';
      }

      // Word Lamp
      if (type === 'Word Lamp') {
        const val = VirtualPLC.getWord(tag || 'D150');
        const stateText = el.querySelector('span:last-child');
        const stateDot = el.querySelector('span:first-child');
        if (val === 0) {
          if (stateText) stateText.textContent = 'STATE 0: STOPPED';
          if (stateDot) stateDot.style.background = '#6B7280';
        } else if (val === 1) {
          if (stateText) stateText.textContent = 'STATE 1: RUNNING';
          if (stateDot) stateDot.style.background = '#22C55E';
        } else if (val === 2) {
          if (stateText) stateText.textContent = 'STATE 2: WARNING';
          if (stateDot) stateDot.style.background = '#F59E0B';
        } else {
          if (stateText) stateText.textContent = 'STATE 3: ALARM';
          if (stateDot) stateDot.style.background = '#EF4444';
        }
      }

      // Numeric Display / Input
      if (cat === 'numeric' && type !== 'Analog Slider') {
        const val = VirtualPLC.getWord(tag || 'D200');
        const dec = parseInt(el.getAttribute('data-dec') || '0', 10);
        const spans = el.querySelectorAll('span');
        if (spans.length >= 2) {
          spans[1].textContent = Number(val).toFixed(dec);
        }
      }

      // Analog Slider
      if (type === 'Analog Slider') {
        const val = VirtualPLC.getWord(tag || 'D210');
        const min = parseFloat(el.getAttribute('data-min') || 0);
        const max = parseFloat(el.getAttribute('data-max') || 100);
        const pct = Math.max(0, Math.min(100, Math.round(((val - min) / (max - min)) * 100)));

        const fillTrack = el.querySelector('div[style*="background:#0284C7"]');
        const thumb = el.querySelector('div[style*="border-radius:3px"]');
        if (fillTrack) fillTrack.style.height = `${pct}%`;
        if (thumb) thumb.style.bottom = `${Math.max(0, pct - 5)}%`;
      }

      // Alarm Display / Summary
      if (type === 'Alarm Display') {
        const isFault = VirtualPLC.getBit('M500');
        const badge = el.querySelector('span[style*="border-radius:10px"]');
        const critRow = el.querySelector('div[style*="background:#FEF2F2"]');
        if (badge) badge.textContent = isFault ? '1 ACTIVE' : '0 ACTIVE';
        if (critRow) critRow.style.display = isFault ? 'flex' : 'none';
      }

      // Alarm Status Lamp
      if (type === 'Alarm Status Lamp') {
        const isFault = VirtualPLC.getBit('M500');
        const dot = el.querySelector('span[style*="border-radius:50%"]');
        const text = el.querySelector('span[style*="font-weight:800"]');
        if (dot) {
          dot.style.background = isFault ? '#EF4444' : '#10B981';
          dot.style.boxShadow = isFault ? '0 0 10px #EF4444' : '0 0 10px #10B981';
        }
        if (text) {
          text.textContent = isFault ? 'ALARM ACTIVE' : 'SYSTEM NORMAL';
          text.style.color = isFault ? '#FCA5A5' : '#86EFAC';
        }
      }
    });
  }

  function renderInspectorLists() {
    const bitsList = document.getElementById('sim-bits-list');
    const wordsList = document.getElementById('sim-words-list');
    if (!bitsList || !wordsList) return;

    // Render Bits
    const bitKeys = Object.keys(VirtualPLC.bits).sort();
    if (!bitKeys.length) {
      bitsList.innerHTML = '<div style="color:#64748B;font-size:11px;padding:4px">No active digital bits</div>';
    } else {
      bitsList.innerHTML = bitKeys.map(k => {
        const val = VirtualPLC.bits[k];
        return `
          <div class="sim-plc-row">
            <span class="sim-plc-tag">${k}</span>
            <span class="sim-plc-led ${val ? 'on' : 'off'}">●</span>
            <span class="sim-plc-val">${val ? 'ON (1)' : 'OFF (0)'}</span>
            <button class="sim-toggle-btn ${val ? 'active' : ''}" onclick="HmiSimulator.toggleBit('${k}')">
              ${val ? 'TURN OFF' : 'TURN ON'}
            </button>
          </div>
        `;
      }).join('');
    }

    // Render Words
    const wordKeys = Object.keys(VirtualPLC.words).sort();
    if (!wordKeys.length) {
      wordsList.innerHTML = '<div style="color:#64748B;font-size:11px;padding:4px">No active analog registers</div>';
    } else {
      wordsList.innerHTML = wordKeys.map(k => {
        const val = VirtualPLC.words[k];
        return `
          <div class="sim-plc-row word">
            <span class="sim-plc-tag">${k}</span>
            <input type="number" class="sim-word-input" value="${val}" onchange="HmiSimulator.setWord('${k}', this.value)">
            <input type="range" min="0" max="100" class="sim-word-range" value="${val}" oninput="HmiSimulator.setWord('${k}', this.value)">
          </div>
        `;
      }).join('');
    }
  }

  return {
    start,
    stop,
    switchScreen,
    toggleBit(addr) { VirtualPLC.toggleBit(addr); },
    setWord(addr, val) { VirtualPLC.setWord(addr, val); },
    getPLC() { return VirtualPLC; }
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = HmiSimulator;
}

