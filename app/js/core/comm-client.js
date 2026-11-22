/**
 * Machine Control Studio - Native PLC Communication Client
 * Connects UI to C++ Driver DLLs (dist/drivers/*.dll) via window.electronAPI
 */
const CommClient = (() => {
  let connId = null;
  let connected = false;
  let pollTimer = null;
  let drivers = [];
  const liveValues = {};

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
      if (!connected || !connId || !hasNativeBridge()) return;
      if (typeof TagManager === 'undefined' || !TagManager.getTags) return;
      const tags = TagManager.getTags();
      for (const tag of tags) {
        if (!tag.device) continue;
        try {
          const r = await window.electronAPI.commReadTag(connId, tag.device);
          if (r && r.ok) {
            liveValues[tag.name] = r.value;
            liveValues[tag.device] = r.value;
          }
        } catch (_) {}
      }
    }, ms);
  }

  async function disconnect() {
    stopPolling();
    if (connId && hasNativeBridge()) {
      try { await window.electronAPI.commDisconnect(connId); } catch (_) {}
    }
    connId = null;
    connected = false;
    updateToolbarBadge();
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
            <label style="display:flex;flex-direction:column;gap:4px;font-weight:600;">
              Transport
              <select id="comm-transport" style="padding:6px 8px;border:1px solid #CCC;border-radius:4px;background:#FFF;">
                <option value="TCP">TCP / Ethernet</option>
                <option value="SERIAL">Serial (RTU / COM)</option>
              </select>
            </label>
          </div>

          <div id="comm-tcp-row" style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px;">
            <label style="display:flex;flex-direction:column;gap:4px;font-weight:600;">
              PLC IP Address
              <input id="comm-ip" type="text" value="192.168.1.10" style="padding:6px 8px;border:1px solid #CCC;border-radius:4px;">
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;font-weight:600;">
              Port
              <input id="comm-port" type="number" value="5000" style="padding:6px 8px;border:1px solid #CCC;border-radius:4px;">
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;font-weight:600;">
              Unit / Station ID
              <input id="comm-unit" type="number" value="1" style="padding:6px 8px;border:1px solid #CCC;border-radius:4px;">
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
    drvSel.onchange = () => {
      const d = drivers.find(x => x.id === drvSel.value);
      if (d) document.getElementById('comm-port').value = d.defaultPort || 0;
    };
    transSel.onchange = () => {
      const isSer = transSel.value === 'SERIAL';
      document.getElementById('comm-tcp-row').style.display = isSer ? 'none' : 'grid';
      document.getElementById('comm-serial-row').style.display = isSer ? 'grid' : 'none';
    };

    document.getElementById('comm-connect-btn').onclick = async () => {
      if (!hasNativeBridge()) {
        setStatus('Error: Native C++ bridge unavailable in browser mode.', true);
        return;
      }
      const isSer = transSel.value === 'SERIAL';
      const cfg = {
        driverId: drvSel.value,
        transport: transSel.value,
        address: document.getElementById('comm-ip').value.trim(),
        port: Number(document.getElementById('comm-port').value) || 502,
        unitId: Number(isSer ? document.getElementById('comm-rtu-unit').value : document.getElementById('comm-unit').value) || 1,
        comPort: document.getElementById('comm-com').value.trim(),
        baudRate: Number(document.getElementById('comm-baud').value) || 9600
      };
      setStatus('Connecting...', false);
      const res = await window.electronAPI.commConnect(cfg);
      if (!res || !res.ok) {
        setStatus('Connect failed: ' + (res && res.error ? res.error : 'Unknown error'), true);
        return;
      }
      connId = res.connId;
      connected = true;
      updateToolbarBadge();
      document.getElementById('comm-connect-btn').disabled = true;
      document.getElementById('comm-disconnect-btn').disabled = false;
      startPolling(document.getElementById('comm-poll').value);
      setStatus(`Connected (connId=${connId}) via ${cfg.driverId} (${isSer ? cfg.comPort : cfg.address + ':' + cfg.port})`, false);
    };

    document.getElementById('comm-disconnect-btn').onclick = async () => {
      await disconnect();
      document.getElementById('comm-connect-btn').disabled = false;
      document.getElementById('comm-disconnect-btn').disabled = true;
      setStatus('Status: Disconnected', false);
    };

    document.getElementById('comm-read-btn').onclick = async () => {
      if (!connected || !connId) return setStatus('Not connected.', true);
      const addr = document.getElementById('comm-test-addr').value.trim();
      const r = await window.electronAPI.commReadTag(connId, addr);
      if (!r || !r.ok) return setStatus('Read error: ' + (r && r.error ? r.error : 'Failed'), true);
      document.getElementById('comm-test-val').value = String(r.value);
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
      const r = await window.electronAPI.commWriteTag(connId, addr, val);
      if (!r || !r.ok) return setStatus('Write error: ' + (r && r.error ? r.error : 'Failed'), true);
      setStatus(`WRITE ${addr} <= ${val} (OK)`, false);
    };

    return overlay;
  }

  async function openDialog() {
    const overlay = ensureModal();
    await refreshDrivers();
    const drvSel = document.getElementById('comm-driver');
    drvSel.innerHTML = drivers.map(d => `<option value="${d.id}">${d.name}</option>`).join('');

    if (typeof Project !== 'undefined' && Project.getData) {
      const proj = Project.getData();
      if (proj && proj.driverConfig) {
        if (proj.driverConfig.address) document.getElementById('comm-ip').value = proj.driverConfig.address;
        if (proj.driverConfig.port) document.getElementById('comm-port').value = proj.driverConfig.port;
        const drvName = (proj.driverConfig.driver || '').toUpperCase();
        if (drvName.includes('MODBUS')) drvSel.value = 'modbus';
        else if (drvName.includes('MELSEC') || drvName.includes('MC')) drvSel.value = 'melsec_mc';
        else if (drvName.includes('SIEMENS') || drvName.includes('S7')) drvSel.value = 's7';
        else if (drvName.includes('OMRON') || drvName.includes('FINS')) drvSel.value = 'omron_fins';
        else if (drvName.includes('ETHERNET/IP') || drvName.includes('ALLEN')) drvSel.value = 'eip_cip';
      }
    }

    document.getElementById('comm-native-warn').style.display = hasNativeBridge() ? 'none' : 'block';
    document.getElementById('comm-connect-btn').disabled = connected;
    document.getElementById('comm-disconnect-btn').disabled = !connected;
    overlay.style.display = 'flex';
  }

  return {
    openDialog,
    disconnect,
    isConnected: () => connected,
    getLiveValues: () => liveValues
  };
})();
