/**
 * HMI Designer Studio - Tag & Universal Device Address Manager
 * Multi-Brand PLC Support: Mitsubishi MELSEC, Siemens S7, Rockwell Allen-Bradley, Omron, Delta, Modbus
 */

const TagManager = (function() {
  // Built-in industrial tags
  let tagList = [
    { name: 'Motor1.Run', device: 'M100', type: 'Bit', comment: 'Main Conveyor Motor Run Command' },
    { name: 'Motor1.Speed', device: 'D200', type: 'Word', comment: 'Main Conveyor Motor Speed (RPM)' },
    { name: 'Tank1.Level', device: 'D202', type: 'Word', comment: 'Process Tank Level (0-100%)' },
    { name: 'Valve1.Open', device: 'Y0', type: 'Bit', comment: 'Inlet Solenoid Valve 1' },
    { name: 'Alarm.Active', device: 'M500', type: 'Bit', comment: 'Master System Fault Alarm' },
    { name: 'Batch.Count', device: 'D210', type: 'Word', comment: 'Total Produced Batch Count' },
    { name: 'Emergency.Stop', device: 'X0', type: 'Bit', comment: 'Field E-Stop Pushbutton' }
  ];

  // Device range definitions for Mitsubishi PLCs (Q/L/FX5U/iQ-R)
  const MELSEC_DEVICES = {
    'X':  { radix: 16, type: 'Bit',  min: 0, max: 0x1FFF, desc: 'Input (Hex)' },
    'Y':  { radix: 16, type: 'Bit',  min: 0, max: 0x1FFF, desc: 'Output (Hex)' },
    'M':  { radix: 10, type: 'Bit',  min: 0, max: 32767,  desc: 'Internal Relay (Dec)' },
    'L':  { radix: 10, type: 'Bit',  min: 0, max: 32767,  desc: 'Latch Relay (Dec)' },
    'B':  { radix: 16, type: 'Bit',  min: 0, max: 0x7FFF, desc: 'Link Relay (Hex)' },
    'SM': { radix: 10, type: 'Bit',  min: 0, max: 2047,   desc: 'Special Relay (Dec)' },
    'D':  { radix: 10, type: 'Word', min: 0, max: 32767,  desc: 'Data Register (Dec)' },
    'W':  { radix: 16, type: 'Word', min: 0, max: 0x7FFF, desc: 'Link Register (Hex)' },
    'R':  { radix: 10, type: 'Word', min: 0, max: 32767,  desc: 'File Register (Dec)' },
    'ZR': { radix: 16, type: 'Word', min: 0, max: 0xFFFF, desc: 'Extended Register (Hex)' },
    'SD': { radix: 10, type: 'Word', min: 0, max: 2047,   desc: 'Special Register (Dec)' }
  };

  /**
   * Validates whether a device address string is a valid Universal PLC address.
   * Supports: Mitsubishi MELSEC, Siemens S7, Rockwell Allen-Bradley CIP, Omron, Delta, Modbus
   * @param {string} addr - e.g. "X0", "M100", "DB1.DBX0.0", "Motor1_Run", "40001"
   * @param {string} [brandHint] - Optional brand hint e.g. "SIEMENS", "MELSEC", "ROCKWELL"
   * @returns {{ valid: boolean, type?: string, error?: string, parsed?: object }}
   */
  function validateAddress(addr, brandHint = '') {
    if (!addr || typeof addr !== 'string') {
      return { valid: false, error: 'Empty address' };
    }
    const clean = addr.trim();
    const upper = clean.toUpperCase();

    // 1. Check if it's a known named tag
    const tagMatch = tagList.find(t => t.name.toUpperCase() === upper);
    if (tagMatch) {
      return { valid: true, type: tagMatch.type, parsed: { isTag: true, tag: tagMatch } };
    }

    // 2. Modbus Protocol: e.g. 00001, 10001, 30001, 40001 or 4x:100
    const modbusMatch = upper.match(/^([0134])(\d{4,5})$/);
    if (modbusMatch) {
      const prefix = modbusMatch[1];
      const type = (prefix === '0' || prefix === '1') ? 'Bit' : 'Word';
      const desc = prefix === '0' ? 'Coil (R/W)' : prefix === '1' ? 'Discrete Input (RO)' : prefix === '3' ? 'Input Register (RO)' : 'Holding Register (R/W)';
      return {
        valid: true,
        type: type,
        parsed: { protocol: 'Modbus', prefix, offset: parseInt(modbusMatch[2], 10), desc }
      };
    }

    // 3. Siemens SIMATIC S7: e.g. DB1.DBX0.0, DB10.DBD0, DB1.DBW2, I0.0, Q0.1, M10.2, MW100, MD200
    const siemensDbBit = upper.match(/^DB(\d+)\.DBX(\d+)\.([0-7])$/);
    if (siemensDbBit) {
      return {
        valid: true,
        type: 'Bit',
        parsed: { protocol: 'Siemens S7', db: parseInt(siemensDbBit[1], 10), byte: parseInt(siemensDbBit[2], 10), bit: parseInt(siemensDbBit[3], 10), desc: `DB${siemensDbBit[1]} Bit ${siemensDbBit[2]}.${siemensDbBit[3]}` }
      };
    }
    const siemensDbWord = upper.match(/^DB(\d+)\.(DBW|DBD)(\d+)$/);
    if (siemensDbWord) {
      return {
        valid: true,
        type: siemensDbWord[2] === 'DBD' ? 'DWord' : 'Word',
        parsed: { protocol: 'Siemens S7', db: parseInt(siemensDbWord[1], 10), type: siemensDbWord[2], offset: parseInt(siemensDbWord[3], 10), desc: `DB${siemensDbWord[1]} ${siemensDbWord[2]} offset ${siemensDbWord[3]}` }
      };
    }
    const siemensIoBit = upper.match(/^([IQM])(\d+)\.([0-7])$/);
    if (siemensIoBit) {
      const area = siemensIoBit[1] === 'I' ? 'Process Input' : siemensIoBit[1] === 'Q' ? 'Process Output' : 'Internal Marker';
      return {
        valid: true,
        type: 'Bit',
        parsed: { protocol: 'Siemens S7', area: siemensIoBit[1], byte: parseInt(siemensIoBit[2], 10), bit: parseInt(siemensIoBit[3], 10), desc: `${area} ${siemensIoBit[1]}${siemensIoBit[2]}.${siemensIoBit[3]}` }
      };
    }
    const siemensIoWord = upper.match(/^(MW|MD|IW|QW)(\d+)$/);
    if (siemensIoWord) {
      return {
        valid: true,
        type: siemensIoWord[1].includes('D') ? 'DWord' : 'Word',
        parsed: { protocol: 'Siemens S7', area: siemensIoWord[1], offset: parseInt(siemensIoWord[2], 10), desc: `S7 ${siemensIoWord[1]} Register ${siemensIoWord[2]}` }
      };
    }

    // 4. Omron Sysmac: e.g. CIO0.00, W10.01, H0.00, D100
    const omronBit = upper.match(/^(CIO|W|H)(\d+)\.([0-1][0-5]|[0-9])$/);
    if (omronBit) {
      return {
        valid: true,
        type: 'Bit',
        parsed: { protocol: 'Omron', area: omronBit[1], channel: parseInt(omronBit[2], 10), bit: parseInt(omronBit[3], 10), desc: `Omron ${omronBit[1]} ${omronBit[2]}.${omronBit[3]}` }
      };
    }

    // 5. Mitsubishi MELSEC format: e.g. X0, Y10, M100, D200, ZR100, SM400
    const melsecMatch = upper.match(/^(SM|SD|ZR|[XYMLBWRD])([0-9A-F]+)$/i);
    if (melsecMatch) {
      const code = melsecMatch[1].toUpperCase();
      const numStr = melsecMatch[2];
      const spec = MELSEC_DEVICES[code];
      if (spec) {
        const num = parseInt(numStr, spec.radix);
        if (!isNaN(num) && num >= spec.min && num <= spec.max) {
          return {
            valid: true,
            type: spec.type,
            parsed: { protocol: 'MELSEC', device: code, offset: num, desc: spec.desc }
          };
        }
      }
    }

    // 6. Rockwell Allen-Bradley CIP Tags: e.g. Motor1_Run, Safety.Estop_Actuated, Tank1_Level
    const abTagMatch = clean.match(/^[A-Za-z_][A-Za-z0-9_.]*(\[\d+\])?$/);
    if (abTagMatch) {
      return {
        valid: true,
        type: clean.toLowerCase().includes('run') || clean.toLowerCase().includes('stop') || clean.toLowerCase().includes('estop') || clean.toLowerCase().includes('fault') ? 'Bit' : 'Word',
        parsed: { protocol: 'Allen-Bradley CIP', tagName: clean, desc: `Logix Native CIP Tag: ${clean}` }
      };
    }

    return {
      valid: false,
      error: `Unrecognized device address: '${addr}'. Supported formats:\n• Mitsubishi: M100, X0, Y0, D200\n• Siemens S7: DB1.DBX0.0, I0.0, Q0.0, DB10.DBD0\n• Allen-Bradley: TagName, Alarms.Estop\n• Omron: CIO0.00, W10.01, D100\n• Modbus: 00001, 10001, 40001`
    };
  }

  function getTags() {
    return [...tagList];
  }

  function addTag(tag) {
    if (!tag.name) return false;
    const existing = tagList.findIndex(t => t.name.toLowerCase() === tag.name.toLowerCase());
    if (existing >= 0) {
      tagList[existing] = { ...tagList[existing], ...tag };
    } else {
      tagList.push({
        name: tag.name,
        device: tag.device || 'M0',
        type: tag.type || 'Bit',
        comment: tag.comment || ''
      });
    }
    return true;
  }

  function removeTag(tagName) {
    tagList = tagList.filter(t => t.name.toLowerCase() !== tagName.toLowerCase());
  }

  function setTags(newTags) {
    if (Array.isArray(newTags)) {
      tagList = [...newTags];
    }
  }

  return {
    validateAddress,
    getTags,
    addTag,
    removeTag,
    setTags,
    MELSEC_DEVICES
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TagManager;
}
