    /**
     * HMI Designer Studio - Industrial Widget Component Library
     * Industrial Hardware Components & Widgets
     */

    const WidgetRegistry = (function () {
      const SWITCHES = ['Bit Switch', 'Word Switch', 'Push Button', 'Button', 'Selector Switch', 'Toggle Switch', 'Keypad', 'Screen Navigation', 'Go To Screen Switch'];
      const LAMPS = ['Bit Lamp', 'Word Lamp', 'Status Indicator', 'Pilot LED', 'Tower Light', 'Alarm Beacon'];
      const NUMERICS = ['Numeric Display', 'Numeric Input', 'Analog Slider', 'Static Text', 'Text', 'String Display', 'Date/Time'];
      const ALARMS = ['Alarm Display', 'Alarm History', 'Alarm Acknowledge', 'Alarm Reset', 'Alarm Status Lamp'];
      const PROCESS = ['Process Tank', 'Motor', 'Motor Drive', 'Centrifugal Pump', 'Valve', 'Solenoid Valve', 'Pneumatic Cylinder', 'Cylinder', 'Pipe', 'Conveyor'];
      const GRAPHS = ['Trend Graph', 'Historical Trend', 'Bar Graph', 'Gauge', 'Analog Gauge'];
      const SHAPES = ['Rectangle', 'Circle', 'Line', 'Divider Line'];

      function getCategory(type) {
        if (SWITCHES.includes(type)) return 'switch';
        if (LAMPS.includes(type)) return 'lamp';
        if (NUMERICS.includes(type)) return 'numeric';
        if (ALARMS.includes(type)) return 'alarm';
        if (PROCESS.includes(type)) return 'process';
        if (GRAPHS.includes(type)) return 'graph';
        if (SHAPES.includes(type)) return 'shape';
        return 'shape';
      }

      function getDefaultAction(type) {
        if (type === 'Screen Navigation' || type === 'Go To Screen Switch') return 'Navigate';
        if (type === 'Bit Switch' || type === 'Push Button' || type === 'Button') return 'Momentary';
        if (type === 'Selector Switch') return '3-Position';
        if (type === 'Toggle Switch') return 'Alternate';
        if (type === 'Word Switch') return 'Write Value';
        if (type === 'Bit Lamp' || type === 'Pilot LED' || type === 'Status Indicator') return 'ON when bit ON';
        if (type === 'Word Lamp') return 'Multi-State';
        if (type === 'Tower Light') return '3-Tier Andon';
        if (type === 'Alarm Beacon') return 'Strobe Flash';
        if (type === 'Alarm Display') return 'Active Alarms (FIFO)';
        if (type === 'Alarm History') return 'Historical Log';
        if (type === 'Alarm Acknowledge') return 'Momentary';
        if (type === 'Alarm Reset') return 'Momentary';
        if (type === 'Alarm Status Lamp') return 'Tri-State Severity';
        if (type === 'Numeric Display' || type === 'Numeric Input' || type === 'Analog Slider') return 'Signed 16-Bit';
        if (type === 'Process Tank') return 'Level Fill (0-100%)';
        if (type === 'Centrifugal Pump' || type === 'Motor' || type === 'Motor Drive') return 'Start / Stop';
        if (type === 'Pneumatic Cylinder' || type === 'Cylinder') return 'Extend / Retract';
        return '';
      }

      function getDefaultStyle(type) {
        if (type === 'Circle' || type === 'Gauge' || type === 'Analog Gauge' || type === 'Status Indicator' || type === 'Pilot LED' || type === 'Selector Switch') return 'Circle';
        if (type === 'Bit Lamp') return 'Circle';
        if (type === 'Trend Graph' || type === 'Historical Trend') return 'Line';
        return 'Flat';
      }

      function createWidgetConfig(type, x = 100, y = 100) {
        const cat = getCategory(type);
        let width = 120, height = 48;

        if (cat === 'graph') {
          width = 300; height = 180;
        } else if (type === 'Gauge' || type === 'Analog Gauge') {
          width = 140; height = 140;
        } else if (type === 'Bit Lamp' || type === 'Status Indicator' || type === 'Pilot LED') {
          width = 60; height = 60;
        } else if (type === 'Tower Light') {
          width = 50; height = 130;
        } else if (type === 'Alarm Beacon') {
          width = 64; height = 64;
        } else if (type === 'Selector Switch') {
          width = 80; height = 80;
        } else if (type === 'Toggle Switch') {
          width = 70; height = 70;
        } else if (type === 'Keypad') {
          width = 96; height = 96;
        } else if (type === 'Process Tank') {
          width = 120; height = 160;
        } else if (type === 'Motor' || type === 'Motor Drive') {
          width = 100; height = 80;
        } else if (type === 'Centrifugal Pump') {
          width = 100; height = 80;
        } else if (type === 'Pneumatic Cylinder' || type === 'Cylinder') {
          width = 160; height = 56;
        } else if (type === 'Valve' || type === 'Solenoid Valve') {
          width = 80; height = 60;
        } else if (type === 'Pipe') {
          width = 180; height = 24;
        } else if (type === 'Conveyor') {
          width = 180; height = 50;
        } else if (type === 'Analog Slider') {
          width = 54; height = 160;
        } else if (type === 'Word Lamp') {
          width = 120; height = 48;
        } else if (type === 'Static Text' || type === 'Text' || type === 'String Display') {
          width = 150; height = 36;
        } else if (type === 'Date/Time') {
          width = 140; height = 36;
        } else if (type === 'Line') {
          width = 180; height = 4;
        } else if (type === 'Divider Line') {
          width = 220; height = 4;
        } else if (type === 'Rectangle') {
          width = 160; height = 100;
        } else if (type === 'Circle') {
          width = 80; height = 80;
        } else if (type === 'Numeric Display' || type === 'Numeric Input') {
          width = 130; height = 44;
        } else if (type === 'Screen Navigation' || type === 'Go To Screen Switch') {
          width = 130; height = 44;
        } else if (type === 'Alarm Display') {
          width = 340; height = 140;
        } else if (type === 'Alarm History') {
          width = 360; height = 160;
        } else if (type === 'Alarm Acknowledge' || type === 'Alarm Reset' || type === 'Alarm Status Lamp') {
          width = 130; height = 44;
        }

        let defaultTag = 'M100';
        if (cat === 'lamp') defaultTag = 'Y0';
        else if (cat === 'numeric') defaultTag = 'D200';
        else if (cat === 'alarm') defaultTag = (type === 'Alarm History' ? 'D500' : (type === 'Alarm Acknowledge' ? 'M501' : (type === 'Alarm Reset' ? 'M502' : 'M500')));
        else if (cat === 'process') defaultTag = (type === 'Process Tank' ? 'D300' : 'Y20');
        else if (cat === 'graph') defaultTag = 'D100';

        return {
          type: type,
          category: cat,
          action: getDefaultAction(type),
          style: getDefaultStyle(type),
          tag: defaultTag,
          device: defaultTag,
          text: type,
          left: x,
          top: y,
          width: width,
          height: height,
          min: '0',
          max: '100',
          dec: '0',
          colorOn: '#22A06B',
          colorOff: '#9AA0A6',
          bg: (cat === 'switch' ? '#D9261C' : (cat === 'lamp' ? '#9AA0A6' : (cat === 'graph' ? '#1E1E1E' : '#FFFFFF'))),
          fg: (cat === 'switch' || cat === 'lamp' || cat === 'graph' ? '#FFFFFF' : '#000000'),
          navTarget: 'Base_Screen_1',
          fontSize: 13,
          borderWidth: 2,
          borderColor: '#000000',
          lineStyle: 'solid',
          cornerRadius: 4,
          fontFamily: 'Arial',
          bold: false,
          italic: false,
          textAlign: 'center',
          rotation: 0,
          dataFormat: 'BIN16',
          integerDigits: 5,
          zeroSuppress: true,
          comma: false,
          showSign: false,
          scaling: 1,
          offset: 0,
          dateFormat: 'yyyy-MM-dd HH:mm:ss',
          charCount: 16,
          setValue: 0,
          objectId: '',
          comment: '',
          layer: 0,
          visibilityMode: 'always',
          visibilityTag: '',
          flash: false,
          interlockMode: 'none',
          interlockTag: '',
          securityLevel: 0,
          notificationDevice: '',
          buzzer: false
        };
      }

      function renderWidgetContent(el, cfg) {
        const t = cfg.type;
        const cat = cfg.category || getCategory(t);

        el.setAttribute('data-type', t);
        el.setAttribute('data-action', cfg.action || '');
        el.setAttribute('data-style', cfg.style || '');
        el.setAttribute('data-tag', cfg.tag || cfg.device || '');
        el.setAttribute('data-text', cfg.text || '');
        el.setAttribute('data-min', cfg.min || '0');
        el.setAttribute('data-max', cfg.max || '100');
        el.setAttribute('data-dec', cfg.dec || '0');
        el.setAttribute('data-on', cfg.colorOn || '#22A06B');
        el.setAttribute('data-off', cfg.colorOff || '#9AA0A6');
        el.setAttribute('data-nav', cfg.navTarget || '');
        el.setAttribute('data-object-id', cfg.objectId || '');
        el.setAttribute('data-comment', cfg.comment || '');
        el.setAttribute('data-layer', cfg.layer === undefined ? '0' : String(cfg.layer));
        el.setAttribute('data-font-size', cfg.fontSize || 13);
        el.setAttribute('data-font-family', cfg.fontFamily || 'Arial');
        el.setAttribute('data-bold', cfg.bold ? '1' : '0');
        el.setAttribute('data-italic', cfg.italic ? '1' : '0');
        el.setAttribute('data-text-align', cfg.textAlign || 'center');
        el.setAttribute('data-rotation', cfg.rotation || 0);
        el.setAttribute('data-line-style', cfg.lineStyle || 'solid');
        el.setAttribute('data-border-width', cfg.borderWidth === undefined ? '2' : String(cfg.borderWidth));
        el.setAttribute('data-border-color', cfg.borderColor || '#000000');
        el.setAttribute('data-corner-radius', cfg.cornerRadius === undefined ? '4' : String(cfg.cornerRadius));
        el.setAttribute('data-format', cfg.dataFormat || 'BIN16');
        el.setAttribute('data-integer-digits', cfg.integerDigits || 5);
        el.setAttribute('data-zero-suppress', cfg.zeroSuppress === undefined || cfg.zeroSuppress ? '1' : '0');
        el.setAttribute('data-comma', cfg.comma ? '1' : '0');
        el.setAttribute('data-show-sign', cfg.showSign ? '1' : '0');
        el.setAttribute('data-scaling', cfg.scaling === undefined ? '1' : String(cfg.scaling));
        el.setAttribute('data-offset', cfg.offset === undefined ? '0' : String(cfg.offset));
        el.setAttribute('data-date-format', cfg.dateFormat || 'yyyy-MM-dd HH:mm:ss');
        el.setAttribute('data-char-count', cfg.charCount || 16);
        el.setAttribute('data-set-value', cfg.setValue === undefined ? '0' : String(cfg.setValue));
        el.setAttribute('data-word-action', cfg.wordAction || 'Write');
        el.setAttribute('data-vis-mode', cfg.visibilityMode || 'always');
        el.setAttribute('data-vis-tag', cfg.visibilityTag || '');
        el.setAttribute('data-flash', cfg.flash ? '1' : '0');
        el.setAttribute('data-interlock-mode', cfg.interlockMode || 'none');
        el.setAttribute('data-interlock-tag', cfg.interlockTag || '');
        el.setAttribute('data-security-level', cfg.securityLevel || 0);
        el.setAttribute('data-notification-device', cfg.notificationDevice || '');
        el.setAttribute('data-buzzer', cfg.buzzer ? '1' : '0');
        el.setAttribute('data-switch-preset', cfg.switchPreset || '');
        el.setAttribute('data-switch-shape', cfg.switchShape || '');
        el.setAttribute('data-switch-finish', cfg.switchFinish || '');
        el.setAttribute('data-switch-ind', cfg.switchIndicator || '');
        el.setAttribute('data-template-id', cfg.templateId || '');

        if (cfg.templateId && t !== 'Bit Switch') {
          el.style.backgroundColor = 'transparent';
          el.style.boxShadow = 'none';
          el.innerHTML = renderTemplateSvg(t, cfg, false);
          return;
        }

        el.style.left = cfg.left + 'px';
        el.style.top = cfg.top + 'px';
        el.style.width = cfg.width + 'px';
        el.style.height = cfg.height + 'px';
        el.style.backgroundColor = cfg.bg || 'transparent';
        el.style.color = cfg.fg || '#000';
        el.style.zIndex = String(Math.max(0, parseInt(cfg.layer, 10) || 0));
        el.style.transform = `rotate(${Math.max(-180, Math.min(180, parseInt(cfg.rotation, 10) || 0))}deg)`;
        el.style.textAlign = cfg.textAlign || 'center';
        el.style.setProperty('--object-font-size', `${Math.max(6, Math.min(96, parseInt(cfg.fontSize, 10) || 13))}px`);
        el.style.setProperty('--object-font-family', cfg.fontFamily || 'Arial, sans-serif');
        el.style.setProperty('--object-text-align', cfg.textAlign || 'center');
        el.style.setProperty('--object-font-weight', cfg.bold ? '700' : '400');
        el.style.setProperty('--object-font-style', cfg.italic ? 'italic' : 'normal');
        el.style.border = (t === 'Process Tank' || t === 'Pipe' || t === 'Tower Light' || t === 'Analog Slider' || t === 'Divider Line' || cat === 'alarm' || (t === 'Bit Switch' && cfg.switchPreset) || !!cfg.templateId)
          ? 'none'
          : `${Math.max(0, Math.min(20, cfg.borderWidth === undefined ? 2 : (parseInt(cfg.borderWidth, 10) || 0)))}px ${cfg.lineStyle || 'solid'} ${cfg.borderColor || '#000'}`;

        if (cfg.style === 'Circle') {
          el.style.borderRadius = '50%';
        } else if (cfg.style === 'Raised') {
          el.style.borderRadius = '4px';
          el.style.boxShadow = 'inset 0 -3px 0 rgba(0,0,0,.3)';
        } else if (cfg.style === 'Pill') {
          el.style.borderRadius = '999px';
        } else {
          el.style.borderRadius = `${Math.max(0, Math.min(100, parseInt(cfg.cornerRadius, 10) || 0))}px`;
        }

        // 1. Process Tank
        if (t === 'Process Tank') {
          const fillPct = Math.min(100, Math.max(0, parseInt(cfg.min || '65', 10) || 65));
          const fillHeight = Math.round(116 * (fillPct / 100));
          const fillY = 138 - fillHeight;
          const fluidCol = cfg.colorOn || '#0284C7';

          el.innerHTML = `
        <div style="width:100%;height:100%;position:relative;user-select:none;display:flex;flex-direction:column;align-items:center;justify-content:center">
          <svg viewBox="0 0 120 160" width="100%" height="100%" preserveAspectRatio="none" style="display:block">
            <defs>
              <linearGradient id="tankFluidGrad_${t}" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="${fluidCol}" />
                <stop offset="50%" stop-color="#38BDF8" />
                <stop offset="100%" stop-color="${fluidCol}" />
              </linearGradient>
            </defs>
            <!-- Tank Shell -->
            <rect x="8" y="16" width="104" height="128" rx="10" fill="#18181B" stroke="#52525B" stroke-width="2"/>
            <!-- Fluid Fill -->
            <rect x="11" y="${fillY}" width="98" height="${fillHeight}" rx="6" fill="url(#tankFluidGrad_${t})"/>
            <!-- Scale Graduation Ticks -->
            <line x1="14" y1="26" x2="24" y2="26" stroke="#FFFFFF" stroke-width="1.5" opacity="0.8"/>
            <line x1="14" y1="56" x2="20" y2="56" stroke="#FFFFFF" stroke-width="1" opacity="0.6"/>
            <line x1="14" y1="80" x2="24" y2="80" stroke="#FFFFFF" stroke-width="1.5" opacity="0.8"/>
            <line x1="14" y1="106" x2="20" y2="106" stroke="#FFFFFF" stroke-width="1" opacity="0.6"/>
            <line x1="14" y1="134" x2="24" y2="134" stroke="#FFFFFF" stroke-width="1.5" opacity="0.8"/>
            <!-- Text & Tag Overlays -->
            <text x="60" y="36" text-anchor="middle" fill="#FFFFFF" font-size="11" font-weight="bold" font-family="sans-serif">${cfg.text || 'TANK'}</text>
            <text x="60" y="90" text-anchor="middle" fill="#FFFFFF" font-size="16" font-weight="900" font-family="Consolas,monospace">${fillPct}%</text>
            <text x="60" y="110" text-anchor="middle" fill="#93C5FD" font-size="9" font-family="Consolas,monospace">[${cfg.tag || 'D300'}]</text>
          </svg>
        </div>
      `;
          return;
        }

        // 2. Tower Light (3-tier Andon)
        if (t === 'Tower Light') {
          el.innerHTML = `
        <svg viewBox="0 0 50 130" width="100%" height="100%" preserveAspectRatio="none" style="display:block;user-select:none">
          <!-- Mounting Stem & Base -->
          <rect x="22" y="96" width="6" height="26" fill="#71717A"/>
          <rect x="14" y="122" width="22" height="6" rx="2" fill="#27272A"/>
          <!-- Stack Housing Body -->
          <rect x="10" y="6" width="30" height="90" rx="4" fill="#18181B" stroke="#27272A" stroke-width="1.5"/>
          <!-- Red Tier (Top) -->
          <rect x="12" y="8" width="26" height="26" rx="3" fill="#EF4444" opacity="0.95"/>
          <rect x="14" y="10" width="8" height="22" rx="2" fill="#FFFFFF" opacity="0.25"/>
          <!-- Amber Tier (Middle) -->
          <rect x="12" y="38" width="26" height="26" rx="3" fill="#F59E0B" opacity="0.95"/>
          <rect x="14" y="40" width="8" height="22" rx="2" fill="#FFFFFF" opacity="0.25"/>
          <!-- Green Tier (Bottom) -->
          <rect x="12" y="68" width="26" height="26" rx="3" fill="#10B981" opacity="0.95"/>
          <rect x="14" y="70" width="8" height="22" rx="2" fill="#FFFFFF" opacity="0.25"/>
        </svg>
      `;
          return;
        }

        // 3. Selector Switch (Rotary dial)
        if (t === 'Selector Switch') {
          el.innerHTML = `
        <svg viewBox="0 0 80 80" width="100%" height="100%" style="display:block;user-select:none">
          <!-- Outer Dial Bezel -->
          <circle cx="40" cy="40" r="37" fill="#1F2937" stroke="#4B5563" stroke-width="2"/>
          <!-- Scale Position Markers -->
          <line x1="22" y1="24" x2="28" y2="30" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
          <line x1="40" y1="16" x2="40" y2="24" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
          <line x1="58" y1="24" x2="52" y2="30" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
          <!-- Labels -->
          <text x="16" y="22" font-size="7" fill="#E5E7EB" font-weight="bold" text-anchor="end">MAN</text>
          <text x="40" y="13" font-size="7" fill="#E5E7EB" font-weight="bold" text-anchor="middle">OFF</text>
          <text x="64" y="22" font-size="7" fill="#E5E7EB" font-weight="bold" text-anchor="start">AUTO</text>
          <!-- Center Rotary Knob -->
          <circle cx="40" cy="40" r="22" fill="#111827" stroke="#374151" stroke-width="2"/>
          <rect x="37" y="22" width="6" height="22" rx="3" fill="#D9261C"/>
          <circle cx="40" cy="40" r="6" fill="#374151"/>
          <!-- Tag text -->
          <text x="40" y="72" font-size="8" fill="#9CA3AF" font-family="Consolas,monospace" text-anchor="middle">${cfg.tag || 'D100'}</text>
        </svg>
      `;
          return;
        }

        // 4. Toggle Switch (Heavy-duty bat toggle)
        if (t === 'Toggle Switch') {
          el.innerHTML = `
        <svg viewBox="0 0 70 70" width="100%" height="100%" style="display:block;user-select:none">
          <!-- Brushed Metal Faceplate -->
          <rect x="5" y="5" width="60" height="60" rx="6" fill="#27272A" stroke="#52525B" stroke-width="2"/>
          <!-- Screws -->
          <circle cx="11" cy="11" r="2" fill="#71717A"/>
          <circle cx="59" cy="11" r="2" fill="#71717A"/>
          <circle cx="11" cy="59" r="2" fill="#71717A"/>
          <circle cx="59" cy="59" r="2" fill="#71717A"/>
          <!-- Position Marks -->
          <text x="35" y="16" font-size="7" fill="#22C55E" font-weight="900" text-anchor="middle">ON</text>
          <text x="35" y="60" font-size="7" fill="#EF4444" font-weight="900" text-anchor="middle">OFF</text>
          <!-- Bat Switch Lever Base -->
          <circle cx="35" cy="35" r="14" fill="#18181B" stroke="#3F3F46" stroke-width="2"/>
          <!-- Chrome Lever Flipped UP -->
          <polygon points="32,35 38,35 36,20 34,20" fill="#E4E4E7"/>
          <circle cx="35" cy="20" r="4.5" fill="#FAFAFA" stroke="#A1A1AA" stroke-width="1"/>
        </svg>
      `;
          return;
        }

        // 5. Centrifugal Pump
        if (t === 'Centrifugal Pump') {
          el.innerHTML = `
        <svg viewBox="0 0 100 80" width="100%" height="100%" style="display:block;user-select:none">
          <!-- Base mount -->
          <rect x="15" y="68" width="70" height="6" rx="2" fill="#374151"/>
          <!-- Drive motor back housing -->
          <rect x="48" y="24" width="36" height="40" rx="3" fill="#0284C7" stroke="#0369A1" stroke-width="1.5"/>
          <line x1="56" y1="24" x2="56" y2="64" stroke="#0369A1" stroke-width="1.5"/>
          <line x1="64" y1="24" x2="64" y2="64" stroke="#0369A1" stroke-width="1.5"/>
          <line x1="72" y1="24" x2="72" y2="64" stroke="#0369A1" stroke-width="1.5"/>
          <!-- Volute Scroll Pump Casing -->
          <circle cx="34" cy="44" r="22" fill="#0369A1" stroke="#075985" stroke-width="2"/>
          <!-- Discharge Nozzle Port (Top) -->
          <rect x="28" y="10" width="12" height="18" fill="#0369A1" stroke="#075985" stroke-width="1.5"/>
          <rect x="24" y="8" width="20" height="4" rx="1" fill="#075985"/>
          <!-- Suction Port -->
          <circle cx="34" cy="44" r="12" fill="#075985" stroke="#38BDF8" stroke-width="1.5"/>
          <circle cx="34" cy="44" r="5" fill="#38BDF8"/>
          <text x="34" y="47" font-size="8" fill="#FFF" font-weight="bold" text-anchor="middle">P</text>
          <text x="50" y="74" font-size="8" fill="#FFF" font-family="Consolas,monospace" text-anchor="middle">${cfg.tag || 'Y30'}</text>
        </svg>
      `;
          return;
        }

        // 6. Pneumatic Cylinder
        if (t === 'Pneumatic Cylinder' || t === 'Cylinder') {
          el.innerHTML = `
        <svg viewBox="0 0 160 56" width="100%" height="100%" style="display:block;user-select:none">
          <!-- Piston Rod extending right -->
          <rect x="90" y="23" width="55" height="10" fill="#E4E4E7" stroke="#A1A1AA" stroke-width="1"/>
          <!-- Rod Clevis / Eyelet -->
          <circle cx="150" cy="28" r="7" fill="#52525B" stroke="#27272A" stroke-width="1.5"/>
          <circle cx="150" cy="28" r="3" fill="#FFFFFF"/>
          <!-- Cylinder Extrusion Barrel -->
          <rect x="15" y="10" width="85" height="36" rx="3" fill="#3F3F46" stroke="#27272A" stroke-width="2"/>
          <line x1="15" y1="18" x2="100" y2="18" stroke="#52525B" stroke-width="1"/>
          <line x1="15" y1="38" x2="100" y2="38" stroke="#52525B" stroke-width="1"/>
          <!-- End Caps -->
          <rect x="10" y="8" width="10" height="40" rx="2" fill="#18181B"/>
          <rect x="95" y="8" width="10" height="40" rx="2" fill="#18181B"/>
          <!-- Magnetic Reed Sensor Leds -->
          <circle cx="26" cy="11" r="3" fill="#EF4444"/>
          <circle cx="84" cy="11" r="3" fill="#10B981"/>
          <text x="55" y="31" font-size="9" fill="#FFFFFF" font-weight="bold" text-anchor="middle">${cfg.text || 'CYLINDER'}</text>
          <text x="55" y="44" font-size="8" fill="#D4D4D8" font-family="Consolas,monospace" text-anchor="middle">${cfg.tag || 'Y20'}</text>
        </svg>
      `;
          return;
        }

        // 7. Analog Slider
        if (t === 'Analog Slider') {
          el.innerHTML = `
        <div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:space-between;background:#242424;border:2px solid #3A3A3A;border-radius:4px;padding:6px 4px;box-sizing:border-box;color:#FFF;user-select:none">
          <span style="font-size:9px;font-family:Consolas,monospace;font-weight:700;color:#22C55E">${cfg.max || '100'}</span>
          <div style="flex:1;width:12px;background:#111;border:1px solid #444;border-radius:6px;position:relative;margin:4px 0;display:flex;justify-content:center">
            <div style="position:absolute;bottom:0;width:100%;height:60%;background:#0284C7;border-radius:6px"></div>
            <div style="position:absolute;bottom:55%;width:24px;height:14px;background:linear-gradient(#E0E0E0,#9E9E9E);border:1px solid #333;border-radius:3px;box-shadow:0 2px 4px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center">
              <div style="width:14px;height:2px;background:#333"></div>
            </div>
          </div>
          <span style="font-size:9px;font-family:Consolas,monospace;font-weight:700;color:#888">${cfg.min || '0'}</span>
          <span style="font-size:8px;font-family:Consolas,monospace;color:#38BDF8;margin-top:2px">${cfg.tag || 'D210'}</span>
        </div>
      `;
          return;
        }

        // 8. Word Lamp (Multi-state)
        if (t === 'Word Lamp') {
          el.innerHTML = `
        <div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#18181B;border:2px solid #3F3F46;border-radius:4px;padding:4px;box-sizing:border-box;color:#FFF;user-select:none">
          <div style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:800;color:#22C55E">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#22C55E;box-shadow:0 0 8px #22C55E"></span>
            <span>${cfg.text || 'STATE 1: RUN'}</span>
          </div>
          <span style="font-size:9px;color:#A1A1AA;font-family:Consolas,monospace;margin-top:2px">[${cfg.tag || 'D150'}]</span>
        </div>
      `;
          return;
        }

        // 9. Alarm Beacon
        if (t === 'Alarm Beacon') {
          el.innerHTML = `
        <svg viewBox="0 0 64 64" width="100%" height="100%" style="display:block;user-select:none">
          <defs>
            <radialGradient id="beaconGlow_${t}" cx="50%" cy="40%" r="50%">
              <stop offset="0%" stop-color="#FEF08A" />
              <stop offset="60%" stop-color="#F59E0B" />
              <stop offset="100%" stop-color="#B45309" />
            </radialGradient>
          </defs>
          <rect x="16" y="48" width="32" height="12" rx="2" fill="#374151" stroke="#1F2937" stroke-width="1.5"/>
          <path d="M18,48 C18,22 46,22 46,48 Z" fill="url(#beaconGlow_${t})" stroke="#D97706" stroke-width="2"/>
          <line x1="22" y1="36" x2="42" y2="36" stroke="#FEF3C7" stroke-width="1.5" opacity="0.6"/>
          <line x1="20" y1="42" x2="44" y2="42" stroke="#FEF3C7" stroke-width="1.5" opacity="0.6"/>
          <line x1="32" y1="6" x2="32" y2="12" stroke="#F59E0B" stroke-width="2" stroke-linecap="round"/>
          <line x1="14" y1="16" x2="19" y2="20" stroke="#F59E0B" stroke-width="2" stroke-linecap="round"/>
          <line x1="50" y1="16" x2="45" y2="20" stroke="#F59E0B" stroke-width="2" stroke-linecap="round"/>
        </svg>
      `;
          return;
        }

        // 10. Keypad
        if (t === 'Keypad') {
          el.innerHTML = `
        <div style="width:100%;height:100%;display:grid;grid-template-columns:repeat(3,1fr);gap:2px;background:#27272A;border:2px solid #3F3F46;border-radius:4px;padding:3px;box-sizing:border-box;user-select:none">
          <div style="background:#3F3F46;color:#FFF;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;border-radius:2px">1</div>
          <div style="background:#3F3F46;color:#FFF;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;border-radius:2px">2</div>
          <div style="background:#3F3F46;color:#FFF;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;border-radius:2px">3</div>
          <div style="background:#3F3F46;color:#FFF;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;border-radius:2px">4</div>
          <div style="background:#3F3F46;color:#FFF;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;border-radius:2px">5</div>
          <div style="background:#3F3F46;color:#FFF;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;border-radius:2px">6</div>
          <div style="background:#3F3F46;color:#FFF;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;border-radius:2px">7</div>
          <div style="background:#3F3F46;color:#FFF;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;border-radius:2px">8</div>
          <div style="background:#3F3F46;color:#FFF;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;border-radius:2px">9</div>
          <div style="background:#B3261E;color:#FFF;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;border-radius:2px">CLR</div>
          <div style="background:#3F3F46;color:#FFF;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;border-radius:2px">0</div>
          <div style="background:#22A06B;color:#FFF;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;border-radius:2px">ENT</div>
        </div>
      `;
          return;
        }

        // 11. Pipe Conduit
        if (t === 'Pipe') {
          el.innerHTML = `
        <div style="width:100%;height:100%;background:linear-gradient(to bottom, #71717A 0%, #E4E4E7 50%, #52525B 100%);border-top:1px solid #3F3F46;border-bottom:1px solid #27272A;position:relative;display:flex;align-items:center;justify-content:center;user-select:none">
          <div style="position:absolute;left:0;top:-2px;bottom:-2px;width:6px;background:#3F3F46;border-radius:1px"></div>
          <div style="position:absolute;right:0;top:-2px;bottom:-2px;width:6px;background:#3F3F46;border-radius:1px"></div>
          <div style="color:#18181B;font-size:11px;font-weight:bold;letter-spacing:6px;opacity:0.6">▶ ▶ ▶</div>
        </div>
      `;
          return;
        }

        // 12. Divider Line
        if (t === 'Divider Line') {
          el.innerHTML = `
        <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;user-select:none">
          <div style="width:100%;height:2px;background:#D1D5DB;border-bottom:1px solid #FFFFFF"></div>
        </div>
      `;
          return;
        }

        // 13. Analog Gauge
        if (t === 'Gauge' || t === 'Analog Gauge') {
          el.innerHTML = `
        <svg viewBox="0 0 140 140" width="100%" height="100%" style="display:block;user-select:none">
          <circle cx="70" cy="70" r="66" fill="#18181B" stroke="#3F3F46" stroke-width="3"/>
          <path d="M 25 95 A 55 55 0 1 1 115 95" fill="none" stroke="#374151" stroke-width="8" stroke-linecap="round"/>
          <path d="M 25 95 A 55 55 0 0 1 70 15" fill="none" stroke="#22C55E" stroke-width="8" stroke-linecap="round"/>
          <path d="M 70 15 A 55 55 0 0 1 100 35" fill="none" stroke="#F59E0B" stroke-width="8"/>
          <path d="M 100 35 A 55 55 0 0 1 115 95" fill="none" stroke="#EF4444" stroke-width="8" stroke-linecap="round"/>
          <!-- Pointer Needle -->
          <line x1="70" y1="70" x2="88" y2="35" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>
          <circle cx="70" cy="70" r="8" fill="#D9261C"/>
          <!-- Text Value -->
          <text x="70" y="105" text-anchor="middle" fill="#FFFFFF" font-size="14" font-weight="900" font-family="Consolas,monospace">65.0</text>
          <text x="70" y="120" text-anchor="middle" fill="#9CA3AF" font-size="9" font-family="Consolas,monospace">${cfg.tag || 'D200'}</text>
        </svg>
      `;
          return;
        }

        // 14. Alarm Objects
        if (t === 'Alarm Display') {
          el.innerHTML = `
        <div style="width:100%;height:100%;display:flex;flex-direction:column;background:#FFFFFF;border:2px solid #B91C1C;border-radius:4px;overflow:hidden;user-select:none;font-family:sans-serif;box-sizing:border-box">
          <div style="background:#B91C1C;color:#FFFFFF;padding:4px 8px;font-size:11px;font-weight:800;display:flex;justify-content:space-between;align-items:center">
            <div style="display:flex;align-items:center;gap:6px">
              <span>⚠</span><span>${cfg.text || 'ACTIVE ALARM SUMMARY'}</span>
            </div>
            <span style="background:#7F1D1D;padding:1px 6px;border-radius:10px;font-size:9px">2 ACTIVE</span>
          </div>
          <div style="flex:1;overflow:hidden;display:flex;flex-direction:column;background:#FFF">
            <div style="display:flex;align-items:center;padding:4px 8px;font-size:10px;font-weight:700;color:#991B1B;background:#FEF2F2;border-bottom:1px solid #FEE2E2">
              <span style="background:#DC2626;color:#FFF;padding:1px 4px;border-radius:2px;font-size:8px;margin-right:6px">CRIT</span>
              <span style="font-family:Consolas,monospace;margin-right:6px">[${cfg.tag || 'M500'}]</span>
              <span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Motor Inverter Trip Overload</span>
              <span style="font-size:9px;opacity:0.7">14:32:01</span>
            </div>
            <div style="display:flex;align-items:center;padding:4px 8px;font-size:10px;font-weight:700;color:#92400E;background:#FFFBEB;border-bottom:1px solid #FEF3C7">
              <span style="background:#D97706;color:#FFF;padding:1px 4px;border-radius:2px;font-size:8px;margin-right:6px">WARN</span>
              <span style="font-family:Consolas,monospace;margin-right:6px">[D300]</span>
              <span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Process Tank High Level 90%</span>
              <span style="font-size:9px;opacity:0.7">14:30:15</span>
            </div>
          </div>
        </div>
      `;
          return;
        }

        if (t === 'Alarm History') {
          el.innerHTML = `
        <div style="width:100%;height:100%;display:flex;flex-direction:column;background:#FFFFFF;border:2px solid #334155;border-radius:4px;overflow:hidden;user-select:none;font-family:sans-serif;box-sizing:border-box">
          <div style="background:#1E293B;color:#FFFFFF;padding:4px 8px;font-size:11px;font-weight:800;display:flex;justify-content:space-between;align-items:center">
            <div style="display:flex;align-items:center;gap:6px">
              <span>🕘</span><span>${cfg.text || 'ALARM & EVENT LOG'}</span>
            </div>
            <span style="color:#94A3B8;font-size:9px;font-family:Consolas,monospace">[${cfg.tag || 'D500'}]</span>
          </div>
          <div style="display:grid;grid-template-columns:55px 45px 1fr 40px;gap:4px;background:#F1F5F9;padding:3px 6px;font-size:9px;font-weight:700;color:#475569;border-bottom:1px solid #E2E8F0">
            <span>TIME</span><span>TAG</span><span>EVENT</span><span>STAT</span>
          </div>
          <div style="flex:1;overflow:hidden;font-size:10px;display:flex;flex-direction:column">
            <div style="display:grid;grid-template-columns:55px 45px 1fr 40px;gap:4px;padding:3px 6px;border-bottom:1px solid #F1F5F9;font-family:Consolas,monospace">
              <span>14:32:01</span><span style="color:#DC2626">M500</span><span style="font-family:sans-serif">Inverter Trip</span><span style="color:#DC2626;font-weight:bold">ACT</span>
            </div>
            <div style="display:grid;grid-template-columns:55px 45px 1fr 40px;gap:4px;padding:3px 6px;border-bottom:1px solid #F1F5F9;font-family:Consolas,monospace">
              <span>14:30:15</span><span style="color:#D97706">D300</span><span style="font-family:sans-serif">Tank High Level</span><span style="color:#D97706;font-weight:bold">ACK</span>
            </div>
            <div style="display:grid;grid-template-columns:55px 45px 1fr 40px;gap:4px;padding:3px 6px;font-family:Consolas,monospace;color:#64748B">
              <span>14:15:20</span><span>M100</span><span style="font-family:sans-serif">System Started</span><span style="color:#10B981;font-weight:bold">OK</span>
            </div>
          </div>
        </div>
      `;
          return;
        }

        if (t === 'Alarm Acknowledge') {
          el.innerHTML = `
        <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;gap:6px;background:linear-gradient(to bottom, #F59E0B, #D97706);color:#FFFFFF;border:2px solid #B45309;border-radius:4px;font-weight:800;font-size:11px;user-select:none;box-shadow:inset 0 1px 0 rgba(255,255,255,0.4)">
          <span>✔</span>
          <span>${cfg.text || 'ACK ALARM'}</span>
          <span style="font-size:8px;opacity:0.8;font-family:Consolas,monospace">[${cfg.tag || 'M501'}]</span>
        </div>
      `;
          return;
        }

        if (t === 'Alarm Reset') {
          el.innerHTML = `
        <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;gap:6px;background:linear-gradient(to bottom, #374151, #1F2937);color:#FFFFFF;border:2px solid #111827;border-radius:4px;font-weight:800;font-size:11px;user-select:none;box-shadow:inset 0 1px 0 rgba(255,255,255,0.2)">
          <span>↺</span>
          <span>${cfg.text || 'FAULT RESET'}</span>
          <span style="font-size:8px;opacity:0.8;font-family:Consolas,monospace">[${cfg.tag || 'M502'}]</span>
        </div>
      `;
          return;
        }

        if (t === 'Alarm Status Lamp') {
          el.innerHTML = `
        <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:space-between;padding:0 8px;background:#18181B;border:2px solid #EF4444;border-radius:4px;color:#FFFFFF;user-select:none;box-sizing:border-box">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#EF4444;box-shadow:0 0 8px #EF4444"></span>
            <span style="font-size:11px;font-weight:800;color:#FCA5A5">${cfg.text || 'ALARM ACTIVE'}</span>
          </div>
          <span style="font-size:8px;color:#94A3B8;font-family:Consolas,monospace">[${cfg.tag || 'M500'}]</span>
        </div>
      `;
          return;
        }

        // 14. Graph / Trend
        if (cat === 'graph') {
          el.innerHTML = `
        <div style="width:100%;height:100%;display:flex;flex-direction:column;background:#181818;color:#FFF;padding:4px;box-sizing:border-box">
          <div style="font-size:10px;font-weight:700;color:#888;padding-bottom:2px">${t} [${cfg.tag || 'D200'}]</div>
          <canvas data-graph-canvas width="${Math.max(60, cfg.width - 10)}" height="${Math.max(40, cfg.height - 24)}" style="flex:1;background:#0A0A0A;border:1px solid #333"></canvas>
        </div>
      `;
          const cv = el.querySelector('canvas');
          if (cv) {
            const ctx = cv.getContext('2d');
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 1;
            for (let y = 0; y <= cv.height; y += 20) {
              ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cv.width, y); ctx.stroke();
            }
            ctx.strokeStyle = '#22C55E';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, cv.height * 0.7);
            ctx.bezierCurveTo(cv.width * 0.3, cv.height * 0.2, cv.width * 0.7, cv.height * 0.9, cv.width, cv.height * 0.4);
            ctx.stroke();
          }
          return;
        }

        // 15. Numeric Display / Input
        if (cat === 'numeric') {
          const dec = parseInt(cfg.dec || '0', 10);
          const valStr = (123.456).toFixed(dec);
          el.innerHTML = `
        <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:space-between;padding:0 8px;font-family:Consolas,monospace;font-size:16px;font-weight:700;box-sizing:border-box">
          <span style="font-size:10px;font-weight:600;opacity:0.6">${cfg.tag || 'D200'}</span>
          <span>${valStr}</span>
        </div>
      `;
          return;
        }

        // 16. Lamps
        if (cat === 'lamp') {
          el.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;width:100%;height:100%">
          <span style="font-size:11px;font-weight:700">${cfg.text || 'LAMP'}</span>
          <span style="font-size:9px;opacity:0.8">${cfg.tag || 'Y0'}</span>
        </div>
      `;
          return;
        }

        // 17. Navigation
        if (t === 'Screen Navigation' || t === 'Go To Screen Switch') {
          el.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;gap:6px;font-weight:700;width:100%;height:100%">
          <span>➔</span><span>${cfg.text || cfg.navTarget || 'Goto Screen'}</span>
        </div>
      `;
          return;
        }

        // 18. Switch
        if (cat === 'switch') {
          if (t === 'Bit Switch' && cfg.switchPreset) {
            el.style.backgroundColor = 'transparent';
            el.style.boxShadow = 'none';
            el.innerHTML = renderBitSwitchSvg(cfg, false);
            return;
          }
          el.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;width:100%;height:100%">
          <span style="font-size:12px;font-weight:700">${cfg.text || t}</span>
          <span style="font-size:9px;opacity:0.8">[${t === 'Word Switch' ? `${cfg.wordAction || 'Write'} ${cfg.setValue || 0}` : (cfg.action || 'Momentary')}: ${cfg.tag || 'M100'}]</span>
        </div>
      `;
          return;
        }

        // 19. Process Machines (Motor, Valve, Conveyor)
        if (cat === 'process') {
          let icon = '⚙';
          if (t === 'Valve' || t === 'Solenoid Valve') icon = '🔧';
          else if (t === 'Conveyor') icon = '➡';

          el.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:22px;width:100%;height:100%">
          <span>${icon}</span>
          <span style="font-size:11px;font-weight:700">${cfg.text || t}</span>
        </div>
      `;
          return;
        }

        // 20. Default / Shapes
        el.textContent = cfg.text || t;
      }

      // ======================================================================
      // 240+ Parametric Bit Switch Design Library & Unified SVG Renderer
      // ======================================================================
      const BS_SHAPES = [
        { id: 'rect', cat: 'Rectangular', label: 'Rectangular' },
        { id: 'pill', cat: 'Rectangular', label: 'Rounded Pill' },
        { id: 'bevel', cat: '3D & Metallic', label: '3D Bevel Key' },
        { id: 'circle', cat: 'Circular', label: 'Round Pushbutton' },
        { id: 'oct', cat: 'Circular', label: 'Octagon Industrial' },
        { id: 'tri-up', cat: 'Triangle / Jog', label: 'Triangle Up Jog' },
        { id: 'tri-down', cat: 'Triangle / Jog', label: 'Triangle Down Jog' },
        { id: 'tri-left', cat: 'Triangle / Jog', label: 'Triangle Left Jog' },
        { id: 'tri-right', cat: 'Triangle / Jog', label: 'Triangle Right Jog' },
        { id: 'toggle', cat: 'Toggle & Slide', label: 'Toggle Lever' },
        { id: 'slide', cat: 'Toggle & Slide', label: 'Slide Switch' },
        { id: 'estop', cat: 'Safety / E-Stop', label: 'E-Stop Mushroom' }
      ];
      const BS_FINISHES = [
        { id: 'flat', label: 'Flat' },
        { id: '3d', label: '3D Raised' },
        { id: 'chrome', label: 'Chrome Bezel' },
        { id: 'dark', label: 'Dark Panel' },
        { id: 'gloss', label: 'Glass Gloss' }
      ];
      const BS_INDICATORS = [
        { id: 'none', label: 'Clean' },
        { id: 'led-top', label: 'Top LED Bar' },
        { id: 'led-dot', label: 'Corner LED' },
        { id: 'halo', label: 'Center Halo' },
        { id: 'power', label: 'Power Glyph' }
      ];
      const BS_PALETTES = [
        { id: 'emerald', label: 'Emerald Run', on: '#16A34A', off: '#1E293B', fg: '#FFFFFF' },
        { id: 'crimson', label: 'Crimson Stop', on: '#DC2626', off: '#334155', fg: '#FFFFFF' },
        { id: 'amber', label: 'Amber Caution', on: '#D97706', off: '#292524', fg: '#FFFFFF' },
        { id: 'cobalt', label: 'Cobalt Cmd', on: '#2563EB', off: '#1E293B', fg: '#FFFFFF' },
        { id: 'cyan', label: 'Cyan Auto', on: '#0891B2', off: '#0F172A', fg: '#FFFFFF' },
        { id: 'violet', label: 'Violet Setup', on: '#7C3AED', off: '#1E293B', fg: '#FFFFFF' },
        { id: 'slate', label: 'Industrial Gray', on: '#0EA5E9', off: '#475569', fg: '#FFFFFF' },
        { id: 'yellow', label: 'Safety Yellow', on: '#EAB308', off: '#27272A', fg: '#111827' }
      ];

      const BIT_SWITCH_PRESETS = [];
      (() => {
        let idx = 1;
        for (const sh of BS_SHAPES) {
          for (const fin of BS_FINISHES) {
            for (let pIdx = 0; pIdx < 4; pIdx++) {
              const pal = BS_PALETTES[(idx + pIdx) % BS_PALETTES.length];
              const ind = BS_INDICATORS[(idx + pIdx) % BS_INDICATORS.length];
              const id = 'bs_' + String(idx).padStart(3, '0');
              BIT_SWITCH_PRESETS.push({
                id,
                name: `${sh.label} ${fin.label} (${pal.label} / ${ind.label})`,
                category: sh.cat,
                shape: sh.id,
                finish: fin.id,
                indicator: ind.id,
                colorOn: pal.on,
                colorOff: pal.off,
                fg: pal.fg
              });
              idx++;
            }
          }
        }
      })();

      function renderBitSwitchSvg(cfg, isOn) {
        const preset = BIT_SWITCH_PRESETS.find(p => p.id === cfg.switchPreset);
        const shape = cfg.switchShape || (preset ? preset.shape : 'rect');
        const finish = cfg.switchFinish || (preset ? preset.finish : '3d');
        const ind = cfg.switchIndicator || (preset ? preset.indicator : 'led-top');
        const onCol = cfg.colorOn || (preset ? preset.colorOn : '#16A34A');
        const offCol = cfg.colorOff || (preset ? preset.colorOff : '#1E293B');
        const fill = isOn ? onCol : offCol;
        const bezelStroke = finish === 'chrome' ? '#94A3B8' : (finish === 'dark' ? '#0F172A' : '#334155');
        const bezelWidth = finish === 'chrome' ? 4 : (finish === 'flat' ? 1.5 : 2.5);
        const label = (cfg.text || 'SW').replace(/[<>&"]/g, '');
        const ledCol = isOn ? '#4ADE80' : '#475569';
        const glow = isOn ? `filter:drop-shadow(0 0 4px ${onCol});` : '';

        let bodySvg = '';
        if (shape === 'circle' || shape === 'oct' || shape === 'estop') {
          const outer = shape === 'oct'
            ? `<polygon points="34,6 86,6 114,34 114,66 86,94 34,94 6,66 6,34" fill="${fill}" stroke="${bezelStroke}" stroke-width="${bezelWidth}"/>`
            : `<circle cx="60" cy="50" r="42" fill="${shape === 'estop' ? '#DC2626' : fill}" stroke="${shape === 'estop' ? '#FACC15' : bezelStroke}" stroke-width="${shape === 'estop' ? 6 : bezelWidth}"/>`;
          const innerRing = finish === 'chrome' || finish === '3d'
            ? `<circle cx="60" cy="50" r="33" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="2"/>` : '';
          const gloss = finish === 'gloss'
            ? `<ellipse cx="60" cy="34" rx="26" ry="12" fill="rgba(255,255,255,0.22)"/>` : '';
          bodySvg = `${outer}${innerRing}${gloss}`;
        } else if (shape.startsWith('tri-')) {
          const pts = shape === 'tri-up' ? '60,8 110,90 10,90'
            : shape === 'tri-down' ? '10,10 110,10 60,92'
            : shape === 'tri-left' ? '10,50 108,10 108,90'
            : '110,50 12,10 12,90';
          bodySvg = `<polygon points="${pts}" fill="${fill}" stroke="${bezelStroke}" stroke-width="${bezelWidth}" stroke-linejoin="round"/>`;
        } else if (shape === 'toggle') {
          const knobY = isOn ? 26 : 74;
          bodySvg = `
            <rect x="24" y="8" width="72" height="84" rx="10" fill="#1E293B" stroke="${bezelStroke}" stroke-width="2.5"/>
            <rect x="44" y="18" width="32" height="64" rx="6" fill="#0F172A"/>
            <circle cx="60" cy="${knobY}" r="14" fill="${isOn ? onCol : '#94A3B8'}" stroke="#FFF" stroke-width="2"/>
          `;
        } else if (shape === 'slide') {
          const thumbX = isOn ? 84 : 36;
          bodySvg = `
            <rect x="10" y="24" width="100" height="52" rx="26" fill="${isOn ? onCol : '#334155'}" stroke="${bezelStroke}" stroke-width="2.5"/>
            <circle cx="${thumbX}" cy="50" r="20" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5"/>
          `;
        } else {
          const rx = shape === 'pill' ? 44 : (shape === 'bevel' ? 10 : 5);
          const shadow = (finish === '3d' || shape === 'bevel') && !isOn
            ? `<rect x="6" y="10" width="108" height="84" rx="${rx}" fill="rgba(0,0,0,0.35)"/>` : '';
          const gloss = finish === 'gloss'
            ? `<rect x="10" y="10" width="100" height="34" rx="${Math.max(2, rx - 4)}" fill="rgba(255,255,255,0.18)"/>` : '';
          bodySvg = `${shadow}<rect x="6" y="${isOn ? 8 : 6}" width="108" height="84" rx="${rx}" fill="${fill}" stroke="${bezelStroke}" stroke-width="${bezelWidth}"/>${gloss}`;
        }

        let indSvg = '';
        if (ind === 'led-top') {
          indSvg = `<rect x="34" y="14" width="52" height="6" rx="3" fill="${ledCol}" style="${glow}"/>`;
        } else if (ind === 'led-dot') {
          indSvg = `<circle cx="96" cy="20" r="5.5" fill="${ledCol}" stroke="rgba(255,255,255,0.5)" stroke-width="1" style="${glow}"/>`;
        } else if (ind === 'halo') {
          indSvg = `<circle cx="60" cy="50" r="22" fill="none" stroke="${ledCol}" stroke-width="3" opacity="0.85" style="${glow}"/>`;
        } else if (ind === 'power') {
          indSvg = `<path d="M51 32a12 12 0 1 0 18 0M60 26v14" fill="none" stroke="#FFFFFF" stroke-width="2.8" stroke-linecap="round" opacity="0.85"/>`;
        }

        const textY = (shape === 'toggle' || shape === 'slide') ? 96 : (ind === 'power' ? 76 : 55);
        const textEl = (shape === 'toggle' || shape === 'slide')
          ? ''
          : `<text x="60" y="${textY}" text-anchor="middle" fill="${cfg.fg || '#FFFFFF'}" font-size="13" font-weight="700" font-family="Segoe UI,Arial,sans-serif">${label}</text>`;

        return `<svg viewBox="0 0 120 100" width="100%" height="100%" preserveAspectRatio="none" style="display:block;user-select:none;">${bodySvg}${indSvg}${textEl}</svg>`;
      }

      // ======================================================================
      // Universal Template Library for All 51 HMI Objects
      // ======================================================================
      const TPL_THEMES = [
        { id: 'light', cat: 'Industrial Light', label: 'Industrial Light', bg: '#F8FAFC', card: '#FFFFFF', border: '#CBD5E1', accent: '#2563EB', on: '#16A34A', off: '#94A3B8', fg: '#0F172A', muted: '#64748B' },
        { id: 'dark', cat: 'Dark SCADA', label: 'Dark SCADA', bg: '#0F172A', card: '#1E293B', border: '#334155', accent: '#38BDF8', on: '#22C55E', off: '#475569', fg: '#F8FAFC', muted: '#94A3B8' },
        { id: 'swiss', cat: 'Minimal / Flat', label: 'Swiss Clean', bg: '#FAFAFA', card: '#FFFFFF', border: '#E2E8F0', accent: '#D9261C', on: '#D9261C', off: '#64748B', fg: '#111111', muted: '#71717A' },
        { id: 'metal', cat: '3D & Metallic', label: 'Brushed Steel', bg: '#E2E8F0', card: '#F1F5F9', border: '#64748B', accent: '#0284C7', on: '#10B981', off: '#475569', fg: '#0F172A', muted: '#475569' },
        { id: 'amber', cat: 'High Contrast', label: 'Amber Telemetry', bg: '#18181B', card: '#27272A', border: '#D97706', accent: '#F59E0B', on: '#F59E0B', off: '#52525B', fg: '#FEF3C7', muted: '#FBBF24' },
        { id: 'emerald', cat: 'High Contrast', label: 'Emerald Matrix', bg: '#022C22', card: '#064E3B', border: '#10B981', accent: '#34D399', on: '#10B981', off: '#065F46', fg: '#ECFDF5', muted: '#6EE7B7' }
      ];

      function getLayoutsForType(type) {
        const t = String(type || '');
        if (t.includes('Alarm')) {
          return [
            { id: 'grid', label: 'Severity Grid' },
            { id: 'banner', label: 'Compact Banner' },
            { id: 'ticker', label: 'Fault Ticker' },
            { id: 'audit', label: 'Audit Timeline' }
          ];
        }
        if (t === 'Recipe Display') {
          return [
            { id: 'table', label: 'Parameter Table' },
            { id: 'selector', label: 'Selector Card' },
            { id: 'batch', label: 'Batch Header' },
            { id: 'split', label: 'Master-Detail' }
          ];
        }
        if (t === 'Bit Lamp' || t === 'Word Lamp' || t === 'Status Indicator' || t === 'Alarm Beacon' || t === 'Alarm Status Lamp') {
          return [
            { id: 'round', label: 'Round Bezel' },
            { id: 'square', label: 'Annunciator Tile' },
            { id: 'pill', label: 'Status Pill' },
            { id: 'delta', label: 'Delta Indicator' }
          ];
        }
        if (t === 'Tower Light') {
          return [
            { id: '3tier', label: '3-Tier Stack' },
            { id: '5tier', label: '5-Tier Stack' },
            { id: 'hbar', label: 'Horizontal Bar' },
            { id: 'compact', label: 'Compact Beacon' }
          ];
        }
        if (t.includes('Numeric') || t.includes('Text') || t.includes('Date') || t.includes('Time') || t.includes('Comment') || t.includes('Part')) {
          return [
            { id: 'led', label: '7-Seg / LED' },
            { id: 'kpi', label: 'KPI Card' },
            { id: 'lcd', label: 'Industrial LCD' },
            { id: 'pill', label: 'Inline Badge' }
          ];
        }
        if (t.includes('Meter') || t === 'Gauge' || t.includes('Trend') || t === 'Bar Graph' || t === 'Analog Slider') {
          return [
            { id: 'dial', label: 'Analog Dial / Scope' },
            { id: 'seg', label: 'Segmented Bar' },
            { id: 'modern', label: 'Modern Clean' },
            { id: 'vu', label: 'Classic Panel' }
          ];
        }
        if (t === 'Process Tank' || t === 'Motor' || t === 'Centrifugal Pump' || t === 'Valve' || t === 'Pneumatic Cylinder' || t === 'Pipe' || t === 'Conveyor') {
          return [
            { id: 'std', label: 'Standard ISO' },
            { id: 'cutaway', label: 'Cutaway / Sight' },
            { id: 'block', label: 'P&ID Symbol' },
            { id: 'mimic', label: '3D Mimic' }
          ];
        }
        return [
          { id: 'flat', label: 'Flat Key' },
          { id: '3d', label: '3D Raised' },
          { id: 'pill', label: 'Rounded Pill' },
          { id: 'badge', label: 'Icon Badge' }
        ];
      }

      function getTemplatesForType(type) {
        if (type === 'Bit Switch') return BIT_SWITCH_PRESETS;
        const layouts = getLayoutsForType(type);
        const list = [];
        let n = 1;
        for (const lay of layouts) {
          for (const th of TPL_THEMES) {
            list.push({
              id: `tpl_${type.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_${n++}`,
              name: `${lay.label} — ${th.label}`,
              category: th.cat,
              layout: lay.id,
              theme: th.id,
              bg: th.bg,
              card: th.card,
              border: th.border,
              accent: th.accent,
              colorOn: th.on,
              colorOff: th.off,
              fg: th.fg,
              muted: th.muted
            });
          }
        }
        return list;
      }

      function renderTemplateSvg(type, cfg, isOn) {
        if (type === 'Bit Switch') return renderBitSwitchSvg(cfg, isOn);
        const all = getTemplatesForType(type);
        const tpl = all.find(p => p.id === cfg.templateId) || all[0];
        const bg = tpl.bg;
        const card = tpl.card;
        const border = tpl.border;
        const accent = tpl.accent;
        const fg = cfg.fg || tpl.fg;
        const muted = tpl.muted;
        const stateCol = isOn ? (cfg.colorOn || tpl.colorOn) : (cfg.colorOff || tpl.colorOff);
        const label = (cfg.text || type).replace(/[<>&"]/g, '');
        const tag = (cfg.tag || 'TAG').replace(/[<>&"]/g, '');

        if (type.includes('Alarm')) {
          if (tpl.layout === 'banner' || tpl.layout === 'ticker') {
            return `<svg viewBox="0 0 260 64" width="100%" height="100%" preserveAspectRatio="none" style="display:block"><rect x="2" y="2" width="256" height="60" rx="5" fill="${bg}" stroke="${isOn ? '#EF4444' : border}" stroke-width="2"/><rect x="2" y="2" width="8" height="60" rx="2" fill="${isOn ? '#EF4444' : accent}"/><polygon points="32,18 44,44 20,44" fill="${isOn ? '#EF4444' : '#F59E0B'}"/><text x="32" y="40" text-anchor="middle" fill="#FFF" font-size="12" font-weight="800">!</text><text x="56" y="28" fill="${fg}" font-size="12" font-weight="700" font-family="Segoe UI,sans-serif">${label}</text><text x="56" y="46" fill="${muted}" font-size="10" font-family="Consolas,monospace">${isOn ? 'ALM-01: FAULT ACTIVE [' + tag + ']' : '0 ACTIVE ALARMS — NORMAL'}</text></svg>`;
          }
          return `<svg viewBox="0 0 260 120" width="100%" height="100%" preserveAspectRatio="none" style="display:block"><rect x="2" y="2" width="256" height="116" rx="5" fill="${bg}" stroke="${border}" stroke-width="2"/><rect x="2" y="2" width="256" height="24" rx="4" fill="${card}"/><text x="12" y="18" fill="${fg}" font-size="11" font-weight="700" font-family="Segoe UI,sans-serif">${label}</text><rect x="188" y="6" width="60" height="16" rx="8" fill="${isOn ? '#EF4444' : accent}"/><text x="218" y="17" text-anchor="middle" fill="#FFF" font-size="9" font-weight="700">${isOn ? '1 ACTIVE' : '0 ACTIVE'}</text><rect x="10" y="34" width="240" height="22" rx="3" fill="${isOn ? 'rgba(239,68,68,0.2)' : card}" stroke="${border}" stroke-width="1"/><text x="18" y="49" fill="${isOn ? '#FCA5A5' : fg}" font-size="10" font-family="Consolas,monospace">10:42:05 | ${tag} | ${isOn ? 'CRITICAL TRIP' : 'SYSTEM READY'}</text><rect x="10" y="62" width="240" height="22" rx="3" fill="${card}" stroke="${border}" stroke-width="1"/><text x="18" y="77" fill="${muted}" font-size="10" font-family="Consolas,monospace">10:40:12 | M101 | DRIVE INTERLOCK OK</text><rect x="10" y="90" width="240" height="20" rx="3" fill="${card}" opacity="0.7"/></svg>`;
        }

        if (type === 'Recipe Display') {
          return `<svg viewBox="0 0 260 130" width="100%" height="100%" preserveAspectRatio="none" style="display:block"><rect x="2" y="2" width="256" height="126" rx="5" fill="${bg}" stroke="${border}" stroke-width="2"/><rect x="2" y="2" width="256" height="26" rx="4" fill="${card}"/><rect x="2" y="2" width="6" height="26" fill="${accent}"/><text x="16" y="19" fill="${fg}" font-size="11" font-weight="700" font-family="Segoe UI,sans-serif">${label} — RCP #01</text><rect x="184" y="6" width="66" height="18" rx="3" fill="${accent}"/><text x="217" y="18" text-anchor="middle" fill="#FFF" font-size="9" font-weight="700">LOAD / SAVE</text><rect x="10" y="36" width="240" height="24" rx="2" fill="${card}" stroke="${border}" stroke-width="1"/><text x="18" y="52" fill="${fg}" font-size="10" font-family="Consolas,monospace">SPEED_SP</text><text x="240" y="52" text-anchor="end" fill="${accent}" font-size="10" font-weight="700" font-family="Consolas,monospace">1450 RPM</text><rect x="10" y="64" width="240" height="24" rx="2" fill="${card}" stroke="${border}" stroke-width="1"/><text x="18" y="80" fill="${fg}" font-size="10" font-family="Consolas,monospace">TEMP_SET</text><text x="240" y="80" text-anchor="end" fill="${accent}" font-size="10" font-weight="700" font-family="Consolas,monospace">82.5 C</text><rect x="10" y="92" width="240" height="24" rx="2" fill="${card}" stroke="${border}" stroke-width="1"/><text x="18" y="108" fill="${fg}" font-size="10" font-family="Consolas,monospace">BATCH_QTY</text><text x="240" y="108" text-anchor="end" fill="${accent}" font-size="10" font-weight="700" font-family="Consolas,monospace">500 PCS</text></svg>`;
        }

        if (type === 'Bit Lamp' || type === 'Word Lamp' || type === 'Status Indicator' || type === 'Alarm Beacon' || type === 'Alarm Status Lamp') {
          if (tpl.layout === 'round' || tpl.layout === 'delta') {
            return `<svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style="display:block"><circle cx="50" cy="50" r="42" fill="${card}" stroke="${border}" stroke-width="4"/><circle cx="50" cy="50" r="30" fill="${stateCol}"/><circle cx="40" cy="40" r="9" fill="#FFF" opacity="0.35"/><text x="50" y="96" text-anchor="middle" fill="${fg}" font-size="10" font-weight="700">${label}</text></svg>`;
          }
          const rx = tpl.layout === 'pill' ? 28 : 5;
          return `<svg viewBox="0 0 140 60" width="100%" height="100%" preserveAspectRatio="none" style="display:block"><rect x="3" y="3" width="134" height="54" rx="${rx}" fill="${stateCol}" stroke="${border}" stroke-width="2.5"/><text x="70" y="35" text-anchor="middle" fill="#FFF" font-size="12" font-weight="700" font-family="Segoe UI,sans-serif">${label}</text></svg>`;
        }

        if (type.includes('Numeric') || type.includes('Text') || type.includes('Date') || type.includes('Time') || type.includes('Comment') || type.includes('Part')) {
          const rx = tpl.layout === 'pill' ? 24 : 5;
          const valText = type.includes('Numeric') ? (cfg.text || '00125') : (type.includes('Date') ? '2026-11-24' : (type.includes('Time') ? '14:35:00' : label));
          return `<svg viewBox="0 0 160 56" width="100%" height="100%" preserveAspectRatio="none" style="display:block"><rect x="2" y="2" width="156" height="52" rx="${rx}" fill="${bg}" stroke="${border}" stroke-width="2"/><rect x="2" y="2" width="5" height="52" rx="2" fill="${accent}"/><text x="14" y="18" fill="${muted}" font-size="9" font-weight="700" font-family="Segoe UI,sans-serif">[${tag}]</text><text x="146" y="42" text-anchor="end" fill="${fg}" font-size="18" font-weight="800" font-family="Consolas,monospace">${valText}</text></svg>`;
        }

        if (type.includes('Meter') || type === 'Gauge' || type.includes('Trend') || type === 'Bar Graph' || type === 'Analog Slider') {
          if (type.includes('Trend') || type === 'Bar Graph') {
            return `<svg viewBox="0 0 200 110" width="100%" height="100%" preserveAspectRatio="none" style="display:block"><rect x="2" y="2" width="196" height="106" rx="5" fill="${bg}" stroke="${border}" stroke-width="2"/><path d="M16 84 L52 54 L88 68 L128 30 L182 46" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round"/><text x="14" y="20" fill="${fg}" font-size="10" font-weight="700">${label}</text></svg>`;
          }
          return `<svg viewBox="0 0 140 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style="display:block"><rect x="2" y="2" width="136" height="96" rx="6" fill="${bg}" stroke="${border}" stroke-width="2"/><path d="M26 76 A44 44 0 0 1 114 76" fill="none" stroke="${border}" stroke-width="8" stroke-linecap="round"/><path d="M26 76 A44 44 0 0 1 92 38" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round"/><line x1="70" y1="76" x2="96" y2="42" stroke="#EF4444" stroke-width="3" stroke-linecap="round"/><circle cx="70" cy="76" r="5" fill="${fg}"/><text x="70" y="92" text-anchor="middle" fill="${muted}" font-size="9" font-weight="700">${label}</text></svg>`;
        }

        // Default / Switches / Process / Shapes
        const rx = tpl.layout === 'pill' ? 28 : 5;
        return `<svg viewBox="0 0 140 60" width="100%" height="100%" preserveAspectRatio="none" style="display:block"><rect x="2" y="2" width="136" height="56" rx="${rx}" fill="${card}" stroke="${border}" stroke-width="2"/><rect x="2" y="2" width="6" height="56" rx="2" fill="${isOn ? stateCol : accent}"/><text x="74" y="34" text-anchor="middle" fill="${fg}" font-size="12" font-weight="700" font-family="Segoe UI,sans-serif">${label}</text></svg>`;
      }

      return {
        SWITCHES,
        LAMPS,
        NUMERICS,
        ALARMS,
        PROCESS,
        GRAPHS,
        SHAPES,
        BIT_SWITCH_PRESETS,
        renderBitSwitchSvg,
        getTemplatesForType,
        renderTemplateSvg,
        getCategory,
        createWidgetConfig,
        renderWidgetContent
      };
    })();

    if (typeof module !== 'undefined' && module.exports) {
      module.exports = WidgetRegistry;
    }
