    /**
     * HMI Designer Studio - Offline Runtime Simulation Engine
     * Simulates Mitsubishi GOT / Industrial HMI runtime with Virtual PLC Memory Table
     */

    const HmiSimulator = (function () {
      let isRunning = false;
      let currentScreen = null;
      let simWin = null;
      let simDoc = null;
      let simOverlay = null;
      let simStage = null;
      let simInspector = null;
      let screenSelect = null;
      let subscribed = false;

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

      function getSimulatorStyles() {
        const styles = Array.from(document.querySelectorAll('head style'))
          .filter(s => !s.textContent.includes('#ics-splash-overlay'))
          .map(s => s.textContent)
          .join('\n');
        return styles + `
      html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #0F172A; font-family: 'Segoe UI', sans-serif; }
      .gt-sim-shell { display: flex; flex-direction: column; width: 100%; height: 100%; }
      .gt-sim-viewport { flex: 1; position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #0F172A; }
      .gt-sim-stage { position: relative; transform-origin: center center; overflow: hidden; flex-shrink: 0; }
    `;
      }

      function buildShellHTML() {
        return `
      <div class="gt-sim-shell">
        <div class="gt-sim-viewport" id="sim-screen-viewport">
          <div class="gt-sim-stage" id="sim-screen-stage"></div>
        </div>
      </div>
    `;
      }

      function wireSimulatorDOM(targetDoc, targetWin) {
        simDoc = targetDoc;
        simWin = targetWin;
        simStage = simDoc.getElementById('sim-screen-stage');
        simInspector = null;
        screenSelect = null;

        simWin.addEventListener('keydown', (e) => {
          if (isRunning && e.key === 'Escape') stop();
        });
        simWin.addEventListener('resize', adjustViewportScale);

        if (!subscribed) {
          subscribed = true;
          VirtualPLC.subscribe(() => {
            if (!isRunning) return;
            updateSimulationElements();
          });
        }
      }

      function openFallbackModal(res) {
        if (simOverlay && simOverlay.parentNode) simOverlay.parentNode.removeChild(simOverlay);
        simOverlay = document.createElement('div');
        simOverlay.id = 'sim-overlay';
        simOverlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;';
        const winBox = document.createElement('div');
        const maxW = Math.min(res.w, window.innerWidth - 24);
        const maxH = Math.min(res.h + 30, window.innerHeight - 24);
        winBox.style.cssText = `width:${maxW}px;height:${maxH}px;background:#0F172A;border:1px solid #475569;border-radius:6px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.45);display:flex;flex-direction:column;`;
        winBox.innerHTML = `
      <div style="height:30px;flex-shrink:0;background:#F1F5F9;border-bottom:1px solid #CBD5E1;display:flex;align-items:center;justify-content:space-between;padding:0 10px;font-size:12px;font-weight:600;color:#0F172A;user-select:none;">
        <span>Integrated Control Software - Simulator</span>
        <div style="display:flex;gap:4px;">
          <button type="button" id="sim-win-min" title="Minimize" style="width:26px;height:22px;border:1px solid #CBD5E1;border-radius:3px;background:#FFF;cursor:pointer;">&#8211;</button>
          <button type="button" id="sim-win-max" title="Maximize" style="width:26px;height:22px;border:1px solid #CBD5E1;border-radius:3px;background:#FFF;cursor:pointer;">&#9633;</button>
          <button type="button" id="sim-win-close" title="Close" style="width:26px;height:22px;border:0;border-radius:3px;background:#DC2626;color:#FFF;cursor:pointer;">&#10005;</button>
        </div>
      </div>
      ${buildShellHTML()}
    `;
        simOverlay.appendChild(winBox);
        document.body.appendChild(simOverlay);
        let maximized = false;
        let minimized = false;
        winBox.querySelector('#sim-win-close').onclick = stop;
        winBox.querySelector('#sim-win-max').onclick = () => {
          maximized = !maximized;
          minimized = false;
          winBox.style.width = maximized ? '100vw' : `${maxW}px`;
          winBox.style.height = maximized ? '100vh' : `${maxH}px`;
          winBox.querySelector('.gt-sim-shell').style.display = 'flex';
          adjustViewportScale();
        };
        winBox.querySelector('#sim-win-min').onclick = () => {
          minimized = !minimized;
          winBox.querySelector('.gt-sim-shell').style.display = minimized ? 'none' : 'flex';
          winBox.style.height = minimized ? '30px' : (maximized ? '100vh' : `${maxH}px`);
        };
        wireSimulatorDOM(document, window);
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
        const prj = ProjectModel.getProject();
        const screens = Object.keys(prj.screens || {});
        if (!screens.length) {
          alert('Please add or open a screen before running simulation.');
          return;
        }

        const res = prj.resolution || { w: 1280, h: 800 };
        const projectName = prj.name || 'HMI Runtime';
        if (simWin && simWin !== window && !simWin.closed) {
          try { simWin.close(); } catch (_) { }
        }

        const feat = `width=${res.w},height=${res.h},resizable=yes,scrollbars=no,menubar=no,toolbar=no,location=no,status=no`;
        const popup = window.open('', 'ICS_SIMULATOR', feat);
        if (popup && popup.document) {
          popup.document.open();
          popup.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Integrated Control Software - Simulator</title><style>${getSimulatorStyles()}</style></head><body>${buildShellHTML()}</body></html>`);
          popup.document.close();
          popup.addEventListener('beforeunload', () => {
            isRunning = false;
            simWin = null;
            simDoc = null;
            simStage = null;
          });
          wireSimulatorDOM(popup.document, popup);
          // Resize popup so the INNER viewport matches res.w x res.h (accounting for OS/browser chrome)
          try {
            const chromeW = Math.max(0, popup.outerWidth - popup.innerWidth);
            const chromeH = Math.max(0, popup.outerHeight - popup.innerHeight);
            const targetW = Math.min(screen.availWidth, res.w + chromeW);
            const targetH = Math.min(screen.availHeight, res.h + chromeH);
            popup.resizeTo(targetW, targetH);
          } catch (_) {}
          popup.focus();
        } else {
          openFallbackModal(res);
        }

        isRunning = true;
        currentScreen = screenName || (ProjectModel.getStartupScreen && ProjectModel.getStartupScreen()) || ProjectModel.getCurrentScreen() || screens[0];

        populateDefaultRegisters();
        renderScreen(currentScreen);
      }

      function stop() {
        isRunning = false;
        if (simWin && simWin !== window && !simWin.closed) {
          try { simWin.close(); } catch (_) { }
        }
        simWin = null;
        simDoc = null;
        simStage = null;
        if (simOverlay && simOverlay.parentNode) {
          simOverlay.parentNode.removeChild(simOverlay);
          simOverlay = null;
        }
      }

      function switchScreen(screenName) {
        if (!screenName) return;
        currentScreen = screenName;
        if (screenSelect) screenSelect.value = screenName;
        renderScreen(screenName);
      }

      function renderScreen(screenName) {
        if (!simStage || !simDoc) return;
        simStage.innerHTML = '';

        const prj = ProjectModel.getProject();
        const res = prj.resolution || { w: 1280, h: 800 };
        const bg = (ProjectModel.getScreenMeta && ProjectModel.getScreenMeta(screenName).bgColor) || '#FFFFFF';
        simStage.style.width = res.w + 'px';
        simStage.style.height = res.h + 'px';
        simStage.style.background = bg;
        const vp = simDoc.getElementById('sim-screen-viewport');
        if (vp) vp.style.background = bg;

        const objList = ProjectModel.getScreenObjects(screenName) || [];
        objList.forEach((cfg, idx) => {
          const el = simDoc.createElement('div');
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
        if (!simDoc || !simStage) return;
        const viewport = simDoc.getElementById('sim-screen-viewport');
        if (!viewport) return;

        const vw = viewport.clientWidth;
        const vh = viewport.clientHeight;
        const sw = simStage.offsetWidth || 1280;
        const sh = simStage.offsetHeight || 800;

        const scale = Math.min(1.0, Math.min(vw / sw, vh / sh));
        simStage.style.transform = `scale(${Math.max(0.25, scale)})`;
      }

      function attachInteractiveHandlers(el, cfg) {
        const t = cfg.type;
        const cat = cfg.category || WidgetRegistry.getCategory(t);
        const tag = (cfg.tag || cfg.device || '').toUpperCase().trim();
        const act = cfg.action || '';
        const canTouch = () => {
          const mode = cfg.interlockMode || el.getAttribute('data-interlock-mode') || 'none';
          const interlockTag = (cfg.interlockTag || el.getAttribute('data-interlock-tag') || '').toUpperCase().trim();
          if (mode === 'none') return true;
          if (!interlockTag) return false;
          const isOn = VirtualPLC.getBit(interlockTag) === 1;
          return mode === 'on' ? isOn : !isOn;
        };

        // Word switches operate on virtual word registers rather than bit coils.
        if (t === 'Word Switch') {
          el.style.cursor = 'pointer';
          el.addEventListener('click', (e) => {
            e.preventDefault();
            if (!canTouch()) return;
            const current = VirtualPLC.getWord(tag);
            const operand = Number(cfg.setValue) || 0;
            let next = current;
            if (cfg.wordAction === 'Add') next = current + operand;
            else if (cfg.wordAction === 'Subtract') next = current - operand;
            else if (cfg.wordAction === 'Bit ON') next = current | (1 << operand);
            else if (cfg.wordAction === 'Bit OFF') next = current & ~(1 << operand);
            else next = operand;
            VirtualPLC.setWord(tag, next);
          });
          // 1. Bit Switch / Push Button
        } else if (cat === 'switch' && t !== 'Screen Navigation' && t !== 'Go To Screen Switch') {
          el.style.cursor = 'pointer';

          if (act === 'Alternate' || t === 'Toggle Switch') {
            el.addEventListener('click', (e) => {
              e.preventDefault();
              if (!canTouch()) return;
              VirtualPLC.toggleBit(tag);
            });
          } else if (act === 'Set') {
            el.addEventListener('click', (e) => {
              e.preventDefault();
              if (!canTouch()) return;
              VirtualPLC.setBit(tag, 1);
            });
          } else if (act === 'Reset') {
            el.addEventListener('click', (e) => {
              e.preventDefault();
              if (!canTouch()) return;
              VirtualPLC.setBit(tag, 0);
            });
          } else {
            // Momentary
            el.addEventListener('pointerdown', (e) => {
              e.preventDefault();
              if (!canTouch()) return;
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
        if (t === 'Screen Navigation' || t === 'Go To Screen Switch') {
          el.style.cursor = 'pointer';
          el.addEventListener('click', (e) => {
            e.preventDefault();
            if (!canTouch()) return;
            const target = cfg.navTarget || el.getAttribute('data-nav') || 'Base_Screen_1';
            switchScreen(target);
          });
        }

        // 3. Alarm Acknowledge
        if (t === 'Alarm Acknowledge') {
          el.style.cursor = 'pointer';
          el.addEventListener('click', (e) => {
            e.preventDefault();
            if (!canTouch()) return;
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
            if (!canTouch()) return;
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
            if (!canTouch()) return;
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
              const targetWin = simWin || window;
              targetWin.removeEventListener('pointermove', onMove);
              targetWin.removeEventListener('pointerup', onUp);
              try { el.releasePointerCapture(ev.pointerId); } catch (_) { }
            }

            const targetWin = simWin || window;
            targetWin.addEventListener('pointermove', onMove);
            targetWin.addEventListener('pointerup', onUp);
            onMove(e);
          });
        }

        // 6. Numeric Input
        if (t === 'Numeric Input') {
          el.style.cursor = 'pointer';
          el.addEventListener('click', (e) => {
            e.preventDefault();
            if (!canTouch()) return;
            const scale = Number(cfg.scaling) || 1;
            const offset = Number(cfg.offset) || 0;
            const curVal = VirtualPLC.getWord(tag || 'D200') * scale + offset;
            const input = prompt(`Enter Setpoint value for [${tag || 'D200'}]:`, curVal);
            if (input !== null) {
              const value = Number(input);
              const min = Number(cfg.min);
              const max = Number(cfg.max);
              if (!Number.isFinite(value)) {
                alert('Enter a valid numeric value.');
                return;
              }
              if (Number.isFinite(min) && value < min || Number.isFinite(max) && value > max) {
                alert(`Value must be between ${Number.isFinite(min) ? min : '-∞'} and ${Number.isFinite(max) ? max : '∞'}.`);
                return;
              }
              VirtualPLC.setWord(tag || 'D200', (value - offset) / scale);
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
          const visibilityMode = el.getAttribute('data-vis-mode') || 'always';
          const visibilityTag = (el.getAttribute('data-vis-tag') || '').toUpperCase().trim();
          const visibilityBit = visibilityTag ? VirtualPLC.getBit(visibilityTag) === 1 : false;
          el.style.visibility = visibilityMode === 'on' && !visibilityBit || visibilityMode === 'off' && visibilityBit
            ? 'hidden'
            : 'visible';
          const flash = el.getAttribute('data-flash') === '1' || el.getAttribute('data-flash') === 'true';
          el.classList.toggle('hmi-object-flash', flash);

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

          // Universal Template Rendering in Simulation
          if (el.hasAttribute('data-template-id') && el.getAttribute('data-template-id') && type !== 'Bit Switch') {
            const bit = VirtualPLC.getBit(tag || (type.includes('Alarm') ? 'M500' : 'M100')) === 1;
            el.innerHTML = WidgetRegistry.renderTemplateSvg(type, {
              templateId: el.getAttribute('data-template-id'),
              colorOn: el.getAttribute('data-on'),
              colorOff: el.getAttribute('data-off'),
              fg: el.style.color || '',
              text: el.getAttribute('data-text') || type,
              tag: tag || 'TAG'
            }, bit);
          }

          // Bit Switch (240+ Preset SVG Designs)
          if (type === 'Bit Switch' && el.hasAttribute('data-switch-preset') && el.getAttribute('data-switch-preset')) {
            const bit = VirtualPLC.getBit(tag || 'M100') === 1;
            el.innerHTML = WidgetRegistry.renderBitSwitchSvg({
              switchPreset: el.getAttribute('data-switch-preset'),
              switchShape: el.getAttribute('data-switch-shape'),
              switchFinish: el.getAttribute('data-switch-finish'),
              switchIndicator: el.getAttribute('data-switch-ind'),
              colorOn: el.getAttribute('data-on'),
              colorOff: el.getAttribute('data-off'),
              fg: el.style.color || '#FFFFFF',
              text: el.getAttribute('data-text') || 'SW'
            }, bit);
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
              const scale = Number(el.getAttribute('data-scaling') || '1');
              const offset = Number(el.getAttribute('data-offset') || '0');
              const formattedValue = Number(val) * scale + offset;
              const useGrouping = el.getAttribute('data-comma') === '1';
              const suppressZeros = el.getAttribute('data-zero-suppress') === '1';
              const digits = Math.max(1, Math.min(12, parseInt(el.getAttribute('data-integer-digits') || '5', 10) || 5));
              let output = new Intl.NumberFormat(undefined, {
                minimumIntegerDigits: suppressZeros ? 1 : digits,
                minimumFractionDigits: dec,
                maximumFractionDigits: dec,
                useGrouping
              }).format(formattedValue);
              if (el.getAttribute('data-show-sign') === '1' && formattedValue >= 0) output = '+' + output;
              spans[1].textContent = output;
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
        if (!simDoc) return;
        const bitsList = simDoc.getElementById('sim-bits-list');
        const wordsList = simDoc.getElementById('sim-words-list');
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
            <button class="sim-toggle-btn ${val ? 'active' : ''}" onclick="(window.HmiSimulator||window.opener.HmiSimulator).toggleBit('${k}')">
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
            <input type="number" class="sim-word-input" value="${val}" onchange="(window.HmiSimulator||window.opener.HmiSimulator).setWord('${k}', this.value)">
            <input type="range" min="0" max="100" class="sim-word-range" value="${val}" oninput="(window.HmiSimulator||window.opener.HmiSimulator).setWord('${k}', this.value)">
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
