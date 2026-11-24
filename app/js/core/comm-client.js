/**
 * Machine Control Studio - Native PLC Communication Client
 * Connects UI to C++ Driver DLLs (dist/drivers/*.dll) via window.electronAPI
 */
const CommClient = (() => {
  let connId = null;
  let connected = false;
  let pollTimer = null;
  let pollInFlight = false;
  let drivers = [];
  let activeConfig = null;
  let activeConnId = null;
  const liveValues = {};

  function getStorageKey() {
    let projectKey = 'unsaved';
    if (typeof ProjectModel !== 'undefined') {
      const path = ProjectModel.getFilePath();
      if (path) projectKey = path;
      else projectKey = ProjectModel.getProject().name || 'unsaved';
    }
    return 'ics_comm_config:' + projectKey;
  }

  function mapDriverNameToId(name) {
    const value = String(name || '').toUpperCase();
    if (value.includes('MODBUS') || value.includes('DELTA')) return 'modbus';
    if (value.includes('MELSEC') || value.includes('MC')) return 'melsec_mc';
    if (value.includes('SIEMENS') || value.includes('S7')) return 's7';
    if (value.includes('OMRON') || value.includes('FINS')) return 'omron_fins';
    if (value.includes('ETHERNET/IP') || value.includes('ALLEN') || value.includes('ROCKWELL')) return 'eip_cip';
    if (value.includes('ETHERCAT')) return 'ethercat';
    return '';
  }

  function getSavedConfig() {
    let localConfig = {};
    try {
      localConfig = JSON.parse(localStorage.getItem(getStorageKey()) || '{}');
    } catch (_) {}

    let projectConfig = {};
    if (typeof ProjectModel !== 'undefined' && ProjectModel.getDriverConfig) {
      projectConfig = ProjectModel.getDriverConfig();
    }
    return { ...localConfig, ...projectConfig };
  }

  function saveConfig(extra) {
    const config = {
      ...getSavedConfig(),
      ...(extra || {})
    };
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(config));
    } catch (_) {}
    if (typeof ProjectModel !== 'undefined' && ProjectModel.setDriverConfig) {
      ProjectModel.setDriverConfig(config);
    }
  }

  function readDialogConfig() {
    const isSer = document.getElementById('comm-transport').value === 'SERIAL';
    return {
      driverId: document.getElementById('comm-driver').value,
      driver: document.getElementById('comm-driver').selectedOptions[0]?.text || '',
      transport: document.getElementById('comm-transport').value,
      address: document.getElementById('comm-ip').value.trim(),
      port: Number(document.getElementById('comm-port').value) || 502,
      unitId: Number(isSer ? document.getElementById('comm-rtu-unit').value : document.getElementById('comm-unit').value) || 1,
      comPort: document.getElementById('comm-com').value.trim(),
      baudRate: Number(document.getElementById('comm-baud').value) || 9600,
      pollRate: Number(document.getElementById('comm-poll').value) || 250,
      testAddress: document.getElementById('comm-test-addr').value.trim(),
      testValue: document.getElementById('comm-test-val').value.trim()
    };
  }

  const DEFAULT_DRIVERS = [
    { id: 'modbus', name: 'Modbus TCP / RTU', defaultPort: 502, transportMask: 3 },
    { id: 'melsec_mc', name: 'Mitsubishi MELSEC MC Protocol (3E)', defaultPort: 5000, transportMask: 1 },
    { id: 's7', name: 'Siemens S7comm (ISO-on-TCP)', defaultPort: 102, transportMask: 1 },
    { id: 'omron_fins', name: 'Omron FINS (TCP)', defaultPort: 9600, transportMask: 1 },
    { id: 'eip_cip', name: 'Allen-Bradley EtherNet/IP (CIP)', defaultPort: 44818, transportMask: 1 },
    { id: 'ethercat', name: 'EtherCAT Master (Layer-2 / Npcap)', defaultPort: 0, transportMask: 4 }
  ];

  function hasNativeBridge() {
    return typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.commConnect === 'function';
  }

  async function refreshDrivers() {
    if (!hasNativeBridge()) {
      drivers = DEFAULT_DRIVERS;
      return drivers;
    }
    try {
      const res = await window.electronAPI.commListDrivers();
      if (res && res.ok && Array.isArray(res.drivers) && res.drivers.length > 0) {
        drivers = res.drivers;
      } else {
        drivers = DEFAULT_DRIVERS;
      }
    } catch (_) {
      drivers = DEFAULT_DRIVERS;
    }
    return drivers;
  }

  function updateToolbarBadge() {
    const btn = document.getElementById('btn-plc-comms');
    if (!btn) return;
    const dot = btn.querySelector('.comm-dot');
    if (dot) {
      dot.style.background = connected ? '#16A34A' : '#94A3B8';
    }
    btn.classList.toggle('active', connected);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function startPolling(intervalMs) {
    stopPolling();
    const ms = Math.max(100, Number(intervalMs) || 250);
    pollTimer = setInterval(async () => {
      if (pollInFlight || !connected || !connId || !hasNativeBridge()) return;
      if (typeof TagManager === 'undefined' || !TagManager.getTags) return;
      pollInFlight = true;
      try {
        const tags = TagManager.getTags();
        for (const tag of tags) {
          if (!connected || !connId) break;
          if (!tag.device) continue;
          try {
            const r = await window.electronAPI.commReadTag(connId, tag.device);
            if (r && r.ok) {
              liveValues[tag.name] = r.value;
              liveValues[tag.device] = r.value;
            }
          } catch (_) {}
        }
      } finally {
        pollInFlight = false;
      }
    }, ms);
  }

  async function disconnect() {
    const previousConnId = connId;
    stopPolling();
    connId = null;
    connected = false;
    updateToolbarBadge();
    if (previousConnId && hasNativeBridge()) {
      try { await window.electronAPI.commDisconnect(previousConnId); } catch (_) {}
    }
    activeConnId = null;
    activeConfig = null;
  }

  function ensureModal() {
    let overlay = document.getElementById('comm-modal-overlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'comm-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.45);z-index:9999;display:none;align-items:center;justify-content:center;font-family:Segoe UI,sans-serif;';
    overlay.innerHTML = `
      <div style="width:540px;max-width:94vw;background:#FFFFFF;border:1px solid #DDD;border-radius:6px;box-shadow:0 16px 40px rgba(0,0,0,0.2);overflow:hidden;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#F7F6F2;border-bottom:1px solid #DDD;">
          <div style="font-size:13px;font-weight:700;color:#111;">PLC Communications &amp; Driver Setup</div>
          <button type="button" id="comm-close-btn" style="border:0;background:transparent;font-size:18px;cursor:pointer;color:#4D4D4D;">&times;</button>
        </div>
        <div style="padding:16px;display:flex;flex-direction:column;gap:12px;font-size:12px;color:#111;">
          <div id="comm-native-warn" style="display:none;padding:8px 10px;background:#FEF2F2;border:1px solid #FECACA;border-radius:4px;color:#991B1B;">
            Native C++ driver bridge not detected. Run inside <b>MachineControlStudio.exe</b> to use live DLL drivers.
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <label style="display:flex;flex-direction:column;gap:4px;font-weight:600;">
              Protocol Driver (DLL)
              <select id="comm-driver" style="padding:6px 8px;border:1px solid #CCC;border-radius:4px;background:#FFF;"></select>
            </label>
            <label id="comm-transport-field" style="display:flex;flex-direction:column;gap:4px;font-weight:600;">
              Transport
              <select id="comm-transport" style="padding:6px 8px;border:1px solid #CCC;border-radius:4px;background:#FFF;">
                <option value="TCP">TCP / Ethernet</option>
                <option value="SERIAL">Serial (RTU / COM)</option>
              </select>
            </label>
          </div>

          <div id="comm-tcp-row" style="display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr) minmax(0,1fr);gap:10px;min-width:0;">
            <label style="display:flex;flex-direction:column;gap:4px;font-weight:600;min-width:0;">
              PLC IP Address
              <input id="comm-ip" type="text" value="192.168.1.10" style="padding:6px 8px;border:1px solid #CCC;border-radius:4px;">
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;font-weight:600;min-width:0;">
              Port
              <input id="comm-port" type="number" value="5000" style="padding:6px 8px;border:1px solid #CCC;border-radius:4px;">
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;font-weight:600;min-width:0;">
              Unit / Station ID
              <input id="comm-unit" type="number" value="1" style="width:100%;min-width:0;box-sizing:border-box;padding:6px 8px;border:1px solid #CCC;border-radius:4px;">
            </label>
          </div>

          <div id="comm-serial-row" style="display:none;grid-template-columns:1fr 1fr 1fr;gap:10px;">
            <label style="display:flex;flex-direction:column;gap:4px;font-weight:600;">
              COM Port
              <input id="comm-com" type="text" value="COM1" style="padding:6px 8px;border:1px solid #CCC;border-radius:4px;">
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;font-weight:600;">
              Baud Rate
              <select id="comm-baud" style="padding:6px 8px;border:1px solid #CCC;border-radius:4px;background:#FFF;">
                <option value="9600">9600</option>
                <option value="19200">19200</option>
                <option value="38400">38400</option>
                <option value="57600">57600</option>
                <option value="115200">115200</option>
              </select>
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;font-weight:600;">
              Slave ID
              <input id="comm-rtu-unit" type="number" value="1" style="padding:6px 8px;border:1px solid #CCC;border-radius:4px;">
            </label>
          </div>

          <div style="display:flex;align-items:center;gap:10px;">
            <label style="display:flex;align-items:center;gap:6px;font-weight:600;">
              Poll Rate (ms):
              <input id="comm-poll" type="number" value="250" min="50" step="50" style="width:76px;padding:5px 7px;border:1px solid #CCC;border-radius:4px;">
            </label>
            <div style="margin-left:auto;display:flex;gap:8px;">
              <button type="button" id="comm-connect-btn" style="padding:7px 14px;border:0;border-radius:4px;background:#D9261C;color:#FFF;font-weight:700;cursor:pointer;">Connect</button>
              <button type="button" id="comm-disconnect-btn" style="padding:7px 14px;border:1px solid #CCC;border-radius:4px;background:#F7F6F2;color:#111;font-weight:600;cursor:pointer;" disabled>Disconnect</button>
            </div>
          </div>

          <div style="border-top:1px solid #EEE;padding-top:12px;">
            <div style="font-weight:700;margin-bottom:6px;">Live Tag Read / Write Test</div>
            <div style="display:grid;grid-template-columns:1.5fr 1fr auto auto;gap:8px;align-items:center;">
              <input id="comm-test-addr" type="text" placeholder="Address (e.g. 40001, D100, M0, DB1.DBW0)" style="padding:6px 8px;border:1px solid #CCC;border-radius:4px;">
              <input id="comm-test-val" type="text" placeholder="Value" style="padding:6px 8px;border:1px solid #CCC;border-radius:4px;">
              <button type="button" id="comm-read-btn" style="padding:6px 12px;border:1px solid #CCC;border-radius:4px;background:#FFF;font-weight:600;cursor:pointer;">Read</button>
              <button type="button" id="comm-write-btn" style="padding:6px 12px;border:1px solid #CCC;border-radius:4px;background:#FFF;font-weight:600;cursor:pointer;">Write</button>
            </div>
          </div>

          <div id="comm-status-box" style="padding:8px 10px;background:#F7F6F2;border:1px solid #DDD;border-radius:4px;font-family:Consolas,monospace;font-size:11px;color:#334155;">
            Status: Disconnected
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const setStatus = (msg, isErr) => {
      const box = document.getElementById('comm-status-box');
      if (!box) return;
      box.textContent = msg;
      box.style.color = isErr ? '#B91C1C' : '#1E293B';
    };

    document.getElementById('comm-close-btn').onclick = () => { overlay.style.display = 'none'; };
    overlay.onclick = (e) => { if (e.target === overlay) overlay.style.display = 'none'; };

    const drvSel = document.getElementById('comm-driver');
    const transSel = document.getElementById('comm-transport');
    const updateConnectionFields = () => {
      const isSer = transSel.value === 'SERIAL';
      document.getElementById('comm-transport-field').style.display = 'flex';
      document.getElementById('comm-tcp-row').style.display = isSer ? 'none' : 'grid';
      document.getElementById('comm-serial-row').style.display = isSer ? 'grid' : 'none';
    };
    drvSel.onchange = () => {
      const d = drivers.find(x => x.id === drvSel.value);
      if (d) document.getElementById('comm-port').value = d.defaultPort || 0;
      document.getElementById('comm-transport').onchange();
      saveConfig(readDialogConfig());
    };
    transSel.onchange = updateConnectionFields;

    [
      'comm-ip', 'comm-port', 'comm-unit', 'comm-com', 'comm-baud',
      'comm-rtu-unit', 'comm-poll', 'comm-test-addr', 'comm-test-val'
    ].forEach(id => {
      const el = document.getElementById(id);
      el.addEventListener('change', () => saveConfig(readDialogConfig()));
      el.addEventListener('input', () => {
        if (id === 'comm-test-addr' || id === 'comm-test-val') return;
        saveConfig(readDialogConfig());
      });
    });

    document.getElementById('comm-connect-btn').onclick = async () => {
      if (!hasNativeBridge()) {
        setStatus('Error: Native C++ bridge unavailable in browser mode.', true);
        return;
      }
      const isSer = transSel.value === 'SERIAL';
      const cfg = {
        driverId: drvSel.value,
        driver: drvSel.selectedOptions[0]?.text || drvSel.value,
        transport: transSel.value,
        address: document.getElementById('comm-ip').value.trim(),
        port: Number(document.getElementById('comm-port').value) || 502,
        unitId: Number(isSer ? document.getElementById('comm-rtu-unit').value : document.getElementById('comm-unit').value) || 1,
        comPort: document.getElementById('comm-com').value.trim(),
        baudRate: Number(document.getElementById('comm-baud').value) || 9600,
        pollRate: Number(document.getElementById('comm-poll').value) || 250,
        testAddress: document.getElementById('comm-test-addr').value.trim(),
        testValue: document.getElementById('comm-test-val').value.trim(),
        autoConnect: true
      };
      setStatus('Connecting...', false);
      const res = await window.electronAPI.commConnect(cfg);
      if (!res || !res.ok) {
        setStatus('Connect failed: ' + (res && res.error ? res.error : 'Unknown error'), true);
        return;
      }
      connId = res.connId;
      activeConnId = res.connId;
      activeConfig = cfg;
      connected = true;
      updateToolbarBadge();
      document.getElementById('comm-connect-btn').disabled = true;
      document.getElementById('comm-disconnect-btn').disabled = false;
      startPolling(document.getElementById('comm-poll').value);
      saveConfig(cfg);
      const endpoint = isSer ? cfg.comPort : cfg.address + ':' + cfg.port;
      setStatus(`Connected (connId=${connId}) via ${cfg.driverId} (${endpoint})`, false);
    };

    document.getElementById('comm-disconnect-btn').onclick = async () => {
      await disconnect();
      document.getElementById('comm-connect-btn').disabled = false;
      document.getElementById('comm-disconnect-btn').disabled = true;
      saveConfig({ autoConnect: false });
      setStatus('Status: Disconnected', false);
    };

    document.getElementById('comm-read-btn').onclick = async () => {
      if (!connected || !connId) return setStatus('Not connected.', true);
      const addr = document.getElementById('comm-test-addr').value.trim();
      setStatus(`Reading ${addr}...`, false);
      const r = await window.electronAPI.commReadTag(connId, addr);
      if (!r || !r.ok) return setStatus('Read error: ' + (r && r.error ? r.error : 'Failed'), true);
      document.getElementById('comm-test-val').value = String(r.value);
      saveConfig({ testAddress: addr, testValue: String(r.value) });
      setStatus(`READ ${addr} => ${r.value}`, false);
    };

    document.getElementById('comm-write-btn').onclick = async () => {
      if (!connected || !connId) return setStatus('Not connected.', true);
      const addr = document.getElementById('comm-test-addr').value.trim();
      const raw = document.getElementById('comm-test-val').value.trim();
      let val = raw;
      if (raw.toLowerCase() === 'true') val = true;
      else if (raw.toLowerCase() === 'false') val = false;
      else if (raw !== '' && !isNaN(Number(raw))) val = Number(raw);
      setStatus(`Writing ${addr}...`, false);
      const r = await window.electronAPI.commWriteTag(connId, addr, val);
      if (!r || !r.ok) return setStatus('Write error: ' + (r && r.error ? r.error : 'Failed'), true);
      saveConfig({ testAddress: addr, testValue: String(val) });
      setStatus(`WRITE ${addr} <= ${val} (OK)`, false);
    };

    return overlay;
  }

  async function openDialog() {
    const overlay = ensureModal();
    await refreshDrivers();
    const drvSel = document.getElementById('comm-driver');
    drvSel.innerHTML = drivers.map(d => `<option value="${d.id}">${d.name}</option>`).join('');

    const cfg = getSavedConfig();
    const legacyDriverId = mapDriverNameToId(cfg.driver);
    const savedConfig = legacyDriverId ? { ...cfg, driverId: legacyDriverId } : cfg;
    const displayConfig = connected && activeConfig ? activeConfig : savedConfig;
    if (displayConfig.driverId && drivers.some(d => d.id === displayConfig.driverId)) {
      drvSel.value = displayConfig.driverId;
    }
    document.getElementById('comm-transport').value = displayConfig.transport || 'TCP';
    if (displayConfig.address) document.getElementById('comm-ip').value = displayConfig.address;
    if (displayConfig.port) document.getElementById('comm-port').value = displayConfig.port;
    if (displayConfig.unitId) document.getElementById('comm-unit').value = displayConfig.unitId;
    if (displayConfig.comPort) document.getElementById('comm-com').value = displayConfig.comPort;
    if (displayConfig.baudRate) document.getElementById('comm-baud').value = displayConfig.baudRate;
    if (displayConfig.unitId) document.getElementById('comm-rtu-unit').value = displayConfig.unitId;
    document.getElementById('comm-poll').value = displayConfig.pollRate || 250;
    document.getElementById('comm-test-addr').value = displayConfig.testAddress || '';
    document.getElementById('comm-test-val').value = displayConfig.testValue || '';
    document.getElementById('comm-transport').onchange();

    document.getElementById('comm-native-warn').style.display = hasNativeBridge() ? 'none' : 'block';
    document.getElementById('comm-connect-btn').disabled = connected;
    document.getElementById('comm-disconnect-btn').disabled = !connected;
    const statusBox = document.getElementById('comm-status-box');
    if (connected && activeConfig && statusBox) {
      const endpoint = activeConfig.transport === 'SERIAL'
        ? activeConfig.comPort
        : `${activeConfig.address}:${activeConfig.port}`;
      statusBox.textContent = `Connected (connId=${activeConnId}) via ${activeConfig.driverId} (${endpoint})`;
      statusBox.style.color = '#1E293B';
    } else if (statusBox) {
      statusBox.textContent = 'Status: Disconnected';
    }
    overlay.style.display = 'flex';
  }

  function mapBrandToDriver(brand) {
    const b = String(brand || '').toUpperCase();
    if (b.includes('MODBUS') || b.includes('DELTA')) return 'modbus';
    if (b.includes('SIEMENS') || b.includes('S7')) return 's7';
    if (b.includes('OMRON') || b.includes('FINS')) return 'omron_fins';
    if (b.includes('ROCKWELL') || b.includes('ALLEN') || b.includes('EIP')) return 'eip_cip';
    if (b.includes('ETHERCAT')) return 'ethercat';
    return 'melsec_mc';
  }

  async function connectPlcByBrand(brand, ip, port) {
    if (!hasNativeBridge()) {
      return { ok: false, error: 'Native C++ bridge unavailable in standalone browser' };
    }
    const driverId = mapBrandToDriver(brand);
    const driverInfo = drivers.find(driver => driver.id === driverId) ||
      DEFAULT_DRIVERS.find(driver => driver.id === driverId);
    const config = {
      driverId,
      driver: driverInfo ? driverInfo.name : String(brand || driverId),
      transport: 'TCP',
      address: String(ip || '192.168.1.10').trim(),
      port: Number(port) || (driverInfo ? driverInfo.defaultPort : 5000),
      unitId: 1,
      comPort: 'COM1',
      baudRate: 9600,
      pollRate: Number(getSavedConfig().pollRate) || 250,
      testAddress: '',
      testValue: '',
      autoConnect: true
    };
    const previousConnId = connId;
    const res = await window.electronAPI.commConnect(config);
    if (res && res.ok) {
      connId = res.connId;
      activeConnId = res.connId;
      activeConfig = config;
      connected = true;
      updateToolbarBadge();
      startPolling(config.pollRate);
      saveConfig(config);
      if (previousConnId && previousConnId !== connId) {
        try { await window.electronAPI.commDisconnect(previousConnId); } catch (_) {}
      }
      return { ok: true, connId: res.connId, driverId };
    }
    return { ok: false, error: (res && res.error) ? res.error : 'Connection failed' };
  }

  async function restoreAndAutoConnect() {
    const cfg = getSavedConfig();
    if (!cfg.autoConnect || !hasNativeBridge()) return { ok: false, skipped: true };

    const res = await window.electronAPI.commConnect({
      driverId: cfg.driverId || mapBrandToDriver(cfg.driver),
      transport: cfg.transport || 'TCP',
      address: cfg.address || '192.168.1.10',
      port: Number(cfg.port) || 5000,
      unitId: Number(cfg.unitId) || 1,
      comPort: cfg.comPort || 'COM1',
      baudRate: Number(cfg.baudRate) || 9600
    });
    if (res && res.ok) {
      connId = res.connId;
      activeConnId = res.connId;
      activeConfig = cfg;
      connected = true;
      updateToolbarBadge();
      startPolling(cfg.pollRate || 250);
      saveConfig(cfg);
      return { ok: true, connId: res.connId };
    }
    saveConfig({ autoConnect: false });
    return { ok: false, error: (res && res.error) ? res.error : 'Connection failed' };
  }

  return {
    openDialog,
    disconnect,
    connectPlcByBrand,
    restoreAndAutoConnect,
    getActiveConfig: () => activeConfig ? { ...activeConfig } : null,
    isConnected: () => connected,
    getLiveValues: () => liveValues
  };
})();
