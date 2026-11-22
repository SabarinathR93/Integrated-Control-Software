/**
 * PLC Instruction Set Reference & IEC 61131-3 / PLCopen Catalog
 * Complete 9-Section Instruction Set (159 Instructions, Functions & Function Blocks)
 * Pure 7-bit ASCII + Crisp Inline SVGs
 */

const PlcInstructionCatalog = (function () {

  // Category SVG Icons (20x20 crisp industrial schematic icons)
  const ICONS = {
    NO: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2"><line x1="2" y1="12" x2="9" y2="12"/><line x1="9" y1="5" x2="9" y2="19"/><line x1="15" y1="5" x2="15" y2="19"/><line x1="15" y1="12" x2="22" y2="12"/></svg>',
    NC: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2"><line x1="2" y1="12" x2="9" y2="12"/><line x1="9" y1="5" x2="9" y2="19"/><line x1="15" y1="5" x2="15" y2="19"/><line x1="15" y1="12" x2="22" y2="12"/><line x1="7" y1="18" x2="17" y2="6" stroke="#D9261C"/></svg>',
    COIL: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D9261C" stroke-width="2"><line x1="2" y1="12" x2="7" y2="12" stroke="#111"/><path d="M9 6 C6 9 6 15 9 18"/><path d="M15 6 C18 9 18 15 15 18"/><line x1="17" y1="12" x2="22" y2="12" stroke="#111"/></svg>',
    COIL_NEG: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D9261C" stroke-width="2"><line x1="2" y1="12" x2="7" y2="12" stroke="#111"/><path d="M9 6 C6 9 6 15 9 18"/><path d="M15 6 C18 9 18 15 15 18"/><line x1="9" y1="16" x2="15" y2="8" stroke="#111" stroke-width="1.8"/><line x1="17" y1="12" x2="22" y2="12" stroke="#111"/></svg>',
    COIL_SET: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2"><path d="M8 6 C5 9 5 15 8 18"/><path d="M16 6 C19 9 19 15 16 18"/><text x="12" y="15" font-size="9" font-weight="800" fill="#D9261C" stroke="none" text-anchor="middle">S</text></svg>',
    COIL_RST: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2"><path d="M8 6 C5 9 5 15 8 18"/><path d="M16 6 C19 9 19 15 16 18"/><text x="12" y="15" font-size="9" font-weight="800" fill="#334155" stroke="none" text-anchor="middle">R</text></svg>',
    EDGE: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="1.8"><polyline points="3 17 9 17 9 7 15 7 15 17 21 17"/><polyline points="6 11 9 7 12 11" stroke="#D9261C"/></svg>',
    BRANCH: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="1.8"><line x1="2" y1="8" x2="22" y2="8"/><path d="M6 8v8h12V8" stroke="#D9261C"/></svg>',
    TIMER: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2" fill="#F8FAFC"/><circle cx="12" cy="12" r="5"/><polyline points="12 9 12 12 14.5 13.5" stroke="#D9261C"/></svg>',
    COUNTER: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2" fill="#F8FAFC"/><text x="12" y="15" font-size="8" font-family="Consolas,monospace" font-weight="900" fill="#111" stroke="none" text-anchor="middle">123</text></svg>',
    CMP: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2" fill="#F8FAFC"/><text x="12" y="15" font-size="9" font-family="Consolas,monospace" font-weight="900" fill="#D9261C" stroke="none" text-anchor="middle">&gt;=</text></svg>',
    MATH: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2" fill="#F8FAFC"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="12" y1="8" x2="12" y2="16" stroke="#D9261C"/></svg>',
    LOGIC: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2" fill="#F8FAFC"/><text x="12" y="15" font-size="8.5" font-family="Consolas,monospace" font-weight="900" fill="#111" stroke="none" text-anchor="middle">&amp;/|</text></svg>',
    CONV: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2" fill="#F8FAFC"/><path d="M7 12h10m-3-3l3 3-3 3" stroke="#D9261C"/></svg>',
    STR: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2" fill="#F8FAFC"/><text x="12" y="15" font-size="8.5" font-family="Consolas,monospace" font-weight="900" fill="#111" stroke="none" text-anchor="middle">&quot;S&quot;</text></svg>',
    ST_CTRL: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="1.8"><polyline points="7 8 3 12 7 16"/><polyline points="17 8 21 12 17 16"/><line x1="14" y1="4" x2="10" y2="20" stroke="#D9261C"/></svg>',
    PID: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="1.8"><rect x="2" y="4" width="20" height="16" rx="2" fill="#F8FAFC"/><path d="M5 16c2-8 4-8 6-2s4 2 8-4" stroke="#D9261C"/></svg>',
    MOTION: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5" fill="#D9261C" stroke="none"/><line x1="12" y1="4" x2="12" y2="7"/><line x1="12" y1="17" x2="12" y2="20"/><line x1="4" y1="12" x2="7" y2="12"/><line x1="17" y1="12" x2="20" y2="12"/></svg>',
    SYNC: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="1.8"><circle cx="8" cy="12" r="5"/><circle cx="16" cy="12" r="5" stroke="#D9261C"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
    MODBUS: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2" fill="#F8FAFC"/><line x1="7" y1="10" x2="17" y2="10" stroke="#D9261C"/><line x1="7" y1="14" x2="14" y2="14"/></svg>',
    SYS: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="2" fill="#F8FAFC"/><path d="M8 12h2l2-4 2 8 2-4h2" stroke="#D9261C"/></svg>'
  };

  const COMMON_MC_OUT = ['Done: BOOL', 'Busy: BOOL', 'Active: BOOL', 'CommandAborted: BOOL', 'Error: BOOL', 'ErrorID: WORD'];
  const COMMON_MB_OUT = ['Done: BOOL', 'Busy: BOOL', 'Error: BOOL', 'ErrorID: WORD', 'ExceptionCode: BYTE'];

  // Complete 9-Section Catalog (159 items matching the PDF Reference)
  const SECTIONS = [
    {
      id: 'sec1',
      title: '1. Bit & Contact (LD)',
      items: [
        { name: 'NO contact', kind: 'NO', isFb: false, icon: 'NO', inputs: ['Operand: BOOL'], outputs: [], desc: 'Passes power when the operand is TRUE' },
        { name: 'NC contact', kind: 'NC', isFb: false, icon: 'NC', inputs: ['Operand: BOOL'], outputs: [], desc: 'Passes power when the operand is FALSE' },
        { name: 'Output coil', kind: 'COIL', isFb: false, icon: 'COIL', inputs: [], outputs: ['Operand: BOOL'], desc: 'Writes the rung state to the operand each scan' },
        { name: 'Negated coil', kind: 'COIL_NEG', isFb: false, icon: 'COIL_NEG', inputs: [], outputs: ['Operand: BOOL'], desc: 'Writes NOT of the rung state' },
        { name: 'SET (latch)', kind: 'COIL_SET', isFb: false, icon: 'COIL_SET', inputs: [], outputs: ['Operand: BOOL'], desc: 'Sets the operand TRUE when the rung is true and keeps it TRUE' },
        { name: 'RESET (unlatch)', kind: 'COIL_RST', isFb: false, icon: 'COIL_RST', inputs: [], outputs: ['Operand: BOOL'], desc: 'Sets the operand FALSE when the rung is true and keeps it FALSE' },
        { name: 'R_TRIG', kind: 'FB', isFb: true, icon: 'EDGE', inputs: ['CLK: BOOL'], outputs: ['Q: BOOL'], desc: 'Rising edge: Q is TRUE for one scan when CLK goes FALSE to TRUE' },
        { name: 'F_TRIG', kind: 'FB', isFb: true, icon: 'EDGE', inputs: ['CLK: BOOL'], outputs: ['Q: BOOL'], desc: 'Falling edge: Q is TRUE for one scan when CLK goes TRUE to FALSE' },
        { name: 'SR', kind: 'FB', isFb: true, icon: 'COIL_SET', inputs: ['SET1: BOOL', 'RESET: BOOL'], outputs: ['Q1: BOOL'], desc: 'Set-dominant latch; SET1 wins if both are TRUE' },
        { name: 'RS', kind: 'FB', isFb: true, icon: 'COIL_RST', inputs: ['SET: BOOL', 'RESET1: BOOL'], outputs: ['Q1: BOOL'], desc: 'Reset-dominant latch; RESET1 wins if both are TRUE' },
        { name: 'NOT', kind: 'NOT', isFb: false, icon: 'NC', inputs: ['IN: BOOL'], outputs: ['OUT: BOOL'], desc: 'Inverts the rung or signal' },
        { name: 'Parallel branch (OR)', kind: 'OR_BRANCH', isFb: false, icon: 'BRANCH', inputs: ['BranchA: BOOL', 'BranchB: BOOL'], outputs: [], desc: 'Two or more parallel branches; power passes if any branch is true' },
        { name: 'JMP', kind: 'JMP', isFb: false, icon: 'CONV', inputs: [], outputs: ['Label: IDENT'], desc: 'Skips to a named label in the same POU' },
        { name: 'RETURN', kind: 'RET', isFb: false, icon: 'CONV', inputs: [], outputs: ['Return: POU'], desc: 'Leaves the POU when the rung is true' },
        { name: 'MCR', kind: 'MCR', isFb: false, icon: 'BRANCH', inputs: ['Enable: BOOL'], outputs: ['Marker: ZONE'], desc: 'Master control: forces all coils between markers to FALSE when Enable is FALSE' }
      ]
    },
    {
      id: 'sec2',
      title: '2. Timers & Counters',
      items: [
        { name: 'TON', kind: 'FB', isFb: true, icon: 'TIMER', inputs: ['IN: BOOL', 'PT: TIME := T#1s'], outputs: ['Q: BOOL', 'ET: TIME'], desc: 'On-delay timer: Q goes TRUE after IN has been TRUE for PT; resets when IN goes FALSE' },
        { name: 'TOF', kind: 'FB', isFb: true, icon: 'TIMER', inputs: ['IN: BOOL', 'PT: TIME := T#1s'], outputs: ['Q: BOOL', 'ET: TIME'], desc: 'Off-delay timer: Q goes FALSE after IN has been FALSE for PT' },
        { name: 'TP', kind: 'FB', isFb: true, icon: 'TIMER', inputs: ['IN: BOOL', 'PT: TIME := T#500ms'], outputs: ['Q: BOOL', 'ET: TIME'], desc: 'Pulse timer: Q is TRUE for exactly PT after a rising edge on IN' },
        { name: 'TONR', kind: 'FB', isFb: true, icon: 'TIMER', inputs: ['IN: BOOL', 'RESET: BOOL', 'PT: TIME := T#5s'], outputs: ['Q: BOOL', 'ET: TIME'], desc: 'Retentive timer (vendor extension): accumulates time while IN is TRUE; only RESET clears it' },
        { name: 'CTU', kind: 'FB', isFb: true, icon: 'COUNTER', inputs: ['CU: BOOL', 'RESET: BOOL', 'PV: INT := 100'], outputs: ['Q: BOOL', 'CV: INT'], desc: 'Count up: adds 1 on each rising edge of CU; Q is TRUE when CV >= PV' },
        { name: 'CTD', kind: 'FB', isFb: true, icon: 'COUNTER', inputs: ['CD: BOOL', 'LOAD: BOOL', 'PV: INT := 100'], outputs: ['Q: BOOL', 'CV: INT'], desc: 'Count down: subtracts 1 on each rising edge of CD; LOAD sets CV = PV; Q is TRUE when CV <= 0' },
        { name: 'CTUD', kind: 'FB', isFb: true, icon: 'COUNTER', inputs: ['CU: BOOL', 'CD: BOOL', 'RESET: BOOL', 'LOAD: BOOL', 'PV: INT := 100'], outputs: ['QU: BOOL', 'QD: BOOL', 'CV: INT'], desc: 'Up/down counter: QU when CV >= PV, QD when CV <= 0' }
      ]
    },
    {
      id: 'sec3',
      title: '3. Compare, Select & Math',
      items: [
        { name: 'EQ', kind: 'FN', isFb: false, icon: 'CMP', inputs: ['IN1: ANY_NUM', 'IN2: ANY_NUM'], outputs: ['OUT: BOOL'], desc: 'Equal comparison (IN1 = IN2)' },
        { name: 'NE', kind: 'FN', isFb: false, icon: 'CMP', inputs: ['IN1: ANY_NUM', 'IN2: ANY_NUM'], outputs: ['OUT: BOOL'], desc: 'Not equal comparison (IN1 <> IN2)' },
        { name: 'GT', kind: 'FN', isFb: false, icon: 'CMP', inputs: ['IN1: ANY_NUM', 'IN2: ANY_NUM'], outputs: ['OUT: BOOL'], desc: 'Greater than comparison (IN1 > IN2)' },
        { name: 'GE', kind: 'FN', isFb: false, icon: 'CMP', inputs: ['IN1: ANY_NUM', 'IN2: ANY_NUM'], outputs: ['OUT: BOOL'], desc: 'Greater than or equal comparison (IN1 >= IN2)' },
        { name: 'LT', kind: 'FN', isFb: false, icon: 'CMP', inputs: ['IN1: ANY_NUM', 'IN2: ANY_NUM'], outputs: ['OUT: BOOL'], desc: 'Less than comparison (IN1 < IN2)' },
        { name: 'LE', kind: 'FN', isFb: false, icon: 'CMP', inputs: ['IN1: ANY_NUM', 'IN2: ANY_NUM'], outputs: ['OUT: BOOL'], desc: 'Less than or equal comparison (IN1 <= IN2)' },
        { name: 'LIMIT', kind: 'FN', isFb: false, icon: 'CMP', inputs: ['MN: ANY_NUM', 'IN: ANY_NUM', 'MX: ANY_NUM'], outputs: ['OUT: ANY_NUM'], desc: 'Clamps IN between MN and MX' },
        { name: 'MAX', kind: 'FN', isFb: false, icon: 'CMP', inputs: ['IN1: ANY_NUM', 'IN2: ANY_NUM'], outputs: ['OUT: ANY_NUM'], desc: 'Returns larger value of IN1 and IN2' },
        { name: 'MIN', kind: 'FN', isFb: false, icon: 'CMP', inputs: ['IN1: ANY_NUM', 'IN2: ANY_NUM'], outputs: ['OUT: ANY_NUM'], desc: 'Returns smaller value of IN1 and IN2' },
        { name: 'SEL', kind: 'FN', isFb: false, icon: 'CMP', inputs: ['G: BOOL', 'IN0: ANY', 'IN1: ANY'], outputs: ['OUT: ANY'], desc: 'Binary selection: returns IN0 when G is FALSE, IN1 when TRUE' },
        { name: 'MUX', kind: 'FN', isFb: false, icon: 'CMP', inputs: ['K: INT', 'IN0: ANY', 'IN1: ANY', 'IN2: ANY'], outputs: ['OUT: ANY'], desc: 'Multiplexer: returns the input numbered K' },
        { name: 'ADD', kind: 'FN', isFb: false, icon: 'MATH', inputs: ['IN1: ANY_NUM', 'IN2: ANY_NUM'], outputs: ['OUT: ANY_NUM'], desc: 'Addition (IN1 + IN2)' },
        { name: 'SUB', kind: 'FN', isFb: false, icon: 'MATH', inputs: ['IN1: ANY_NUM', 'IN2: ANY_NUM'], outputs: ['OUT: ANY_NUM'], desc: 'Subtraction (IN1 - IN2)' },
        { name: 'MUL', kind: 'FN', isFb: false, icon: 'MATH', inputs: ['IN1: ANY_NUM', 'IN2: ANY_NUM'], outputs: ['OUT: ANY_NUM'], desc: 'Multiplication (IN1 * IN2)' },
        { name: 'DIV', kind: 'FN', isFb: false, icon: 'MATH', inputs: ['IN1: ANY_NUM', 'IN2: ANY_NUM'], outputs: ['OUT: ANY_NUM'], desc: 'Division (IN1 / IN2); integer DIV by zero raises a runtime fault' },
        { name: 'MOD', kind: 'FN', isFb: false, icon: 'MATH', inputs: ['IN1: DINT', 'IN2: DINT'], outputs: ['OUT: DINT'], desc: 'Modulo integer remainder' },
        { name: 'MOVE', kind: 'FN', isFb: false, icon: 'CONV', inputs: ['IN: ANY'], outputs: ['OUT: ANY'], desc: 'Copies IN value to OUT' },
        { name: 'ABS', kind: 'FN', isFb: false, icon: 'MATH', inputs: ['IN: ANY_NUM'], outputs: ['OUT: ANY_NUM'], desc: 'Absolute value' },
        { name: 'SQRT', kind: 'FN', isFb: false, icon: 'MATH', inputs: ['IN: REAL'], outputs: ['OUT: REAL'], desc: 'Square root' },
        { name: 'LN', kind: 'FN', isFb: false, icon: 'MATH', inputs: ['IN: REAL'], outputs: ['OUT: REAL'], desc: 'Natural logarithm' },
        { name: 'LOG', kind: 'FN', isFb: false, icon: 'MATH', inputs: ['IN: REAL'], outputs: ['OUT: REAL'], desc: 'Base-10 logarithm' },
        { name: 'EXP', kind: 'FN', isFb: false, icon: 'MATH', inputs: ['IN: REAL'], outputs: ['OUT: REAL'], desc: 'Natural exponential (e^IN)' },
        { name: 'EXPT', kind: 'FN', isFb: false, icon: 'MATH', inputs: ['IN1: REAL', 'IN2: ANY_NUM'], outputs: ['OUT: REAL'], desc: 'Exponentiation (IN1 to the power IN2)' },
        { name: 'SIN', kind: 'FN', isFb: false, icon: 'MATH', inputs: ['IN: REAL'], outputs: ['OUT: REAL'], desc: 'Sine (IN in radians)' },
        { name: 'COS', kind: 'FN', isFb: false, icon: 'MATH', inputs: ['IN: REAL'], outputs: ['OUT: REAL'], desc: 'Cosine (IN in radians)' },
        { name: 'TAN', kind: 'FN', isFb: false, icon: 'MATH', inputs: ['IN: REAL'], outputs: ['OUT: REAL'], desc: 'Tangent (IN in radians)' },
        { name: 'ASIN', kind: 'FN', isFb: false, icon: 'MATH', inputs: ['IN: REAL'], outputs: ['OUT: REAL'], desc: 'Arc sine (output in radians)' },
        { name: 'ACOS', kind: 'FN', isFb: false, icon: 'MATH', inputs: ['IN: REAL'], outputs: ['OUT: REAL'], desc: 'Arc cosine (output in radians)' },
        { name: 'ATAN', kind: 'FN', isFb: false, icon: 'MATH', inputs: ['IN: REAL'], outputs: ['OUT: REAL'], desc: 'Arc tangent (output in radians)' },
        { name: 'ATAN2', kind: 'FN', isFb: false, icon: 'MATH', inputs: ['Y: REAL', 'X: REAL'], outputs: ['OUT: REAL'], desc: 'Four-quadrant angle from the X axis, full circle' },
        { name: 'INC', kind: 'FN', isFb: false, icon: 'MATH', inputs: ['Variable: INT'], outputs: ['Variable: INT'], desc: 'Increments integer variable by 1 (in/out)' },
        { name: 'DEC', kind: 'FN', isFb: false, icon: 'MATH', inputs: ['Variable: INT'], outputs: ['Variable: INT'], desc: 'Decrements integer variable by 1 (in/out)' }
      ]
    },
    {
      id: 'sec4',
      title: '4. Logic, Shift, Conv & String',
      items: [
        { name: 'AND', kind: 'FN', isFb: false, icon: 'LOGIC', inputs: ['IN1: WORD', 'IN2: WORD'], outputs: ['OUT: WORD'], desc: 'Bitwise AND on BOOL or BYTE/WORD/DWORD' },
        { name: 'OR', kind: 'FN', isFb: false, icon: 'LOGIC', inputs: ['IN1: WORD', 'IN2: WORD'], outputs: ['OUT: WORD'], desc: 'Bitwise OR on BOOL or BYTE/WORD/DWORD' },
        { name: 'XOR', kind: 'FN', isFb: false, icon: 'LOGIC', inputs: ['IN1: WORD', 'IN2: WORD'], outputs: ['OUT: WORD'], desc: 'Bitwise exclusive-OR on BOOL or BYTE/WORD/DWORD' },
        { name: 'NOT (Word)', kind: 'FN', isFb: false, icon: 'LOGIC', inputs: ['IN: WORD'], outputs: ['OUT: WORD'], desc: 'Bitwise inversion on BOOL or word type' },
        { name: 'SHL', kind: 'FN', isFb: false, icon: 'LOGIC', inputs: ['IN: WORD', 'N: INT'], outputs: ['OUT: WORD'], desc: 'Shift left by N bits, fills with 0' },
        { name: 'SHR', kind: 'FN', isFb: false, icon: 'LOGIC', inputs: ['IN: WORD', 'N: INT'], outputs: ['OUT: WORD'], desc: 'Shift right by N bits, fills with 0' },
        { name: 'ROL', kind: 'FN', isFb: false, icon: 'LOGIC', inputs: ['IN: WORD', 'N: INT'], outputs: ['OUT: WORD'], desc: 'Rotate left by N bits' },
        { name: 'ROR', kind: 'FN', isFb: false, icon: 'LOGIC', inputs: ['IN: WORD', 'N: INT'], outputs: ['OUT: WORD'], desc: 'Rotate right by N bits' },
        { name: 'INT_TO_REAL', kind: 'FN', isFb: false, icon: 'CONV', inputs: ['IN: INT'], outputs: ['OUT: REAL'], desc: 'Type conversion: INT to REAL' },
        { name: 'REAL_TO_DINT', kind: 'FN', isFb: false, icon: 'CONV', inputs: ['IN: REAL'], outputs: ['OUT: DINT'], desc: 'Type conversion: REAL to DINT (rounds to nearest)' },
        { name: 'BOOL_TO_INT', kind: 'FN', isFb: false, icon: 'CONV', inputs: ['IN: BOOL'], outputs: ['OUT: INT'], desc: 'Type conversion: BOOL to INT' },
        { name: 'DINT_TO_REAL', kind: 'FN', isFb: false, icon: 'CONV', inputs: ['IN: DINT'], outputs: ['OUT: REAL'], desc: 'Type conversion: DINT to REAL' },
        { name: 'TRUNC', kind: 'FN', isFb: false, icon: 'CONV', inputs: ['IN: REAL'], outputs: ['OUT: DINT'], desc: 'Truncates REAL to DINT (drops fraction)' },
        { name: 'ROUND', kind: 'FN', isFb: false, icon: 'CONV', inputs: ['IN: REAL'], outputs: ['OUT: DINT'], desc: 'Rounds REAL to nearest DINT integer' },
        { name: 'BCD_TO_INT', kind: 'FN', isFb: false, icon: 'CONV', inputs: ['IN: WORD'], outputs: ['OUT: INT'], desc: 'Binary-coded decimal WORD to INT conversion' },
        { name: 'INT_TO_BCD', kind: 'FN', isFb: false, icon: 'CONV', inputs: ['IN: INT'], outputs: ['OUT: WORD'], desc: 'INT to Binary-coded decimal WORD conversion' },
        { name: 'NORM_X', kind: 'FN', isFb: false, icon: 'CONV', inputs: ['MIN: REAL', 'VALUE: REAL', 'MAX: REAL'], outputs: ['OUT: REAL'], desc: 'Normalizes VALUE from [MIN..MAX] to [0.0..1.0]' },
        { name: 'SCALE_X', kind: 'FN', isFb: false, icon: 'CONV', inputs: ['MIN: REAL', 'VALUE: REAL', 'MAX: REAL'], outputs: ['OUT: REAL'], desc: 'Scales normalized [0.0..1.0] VALUE to [MIN..MAX] engineering range' },
        { name: 'LEN', kind: 'FN', isFb: false, icon: 'STR', inputs: ['IN: STRING'], outputs: ['OUT: INT'], desc: 'Returns length of the string' },
        { name: 'LEFT', kind: 'FN', isFb: false, icon: 'STR', inputs: ['IN: STRING', 'L: INT'], outputs: ['OUT: STRING'], desc: 'First L characters of string' },
        { name: 'RIGHT', kind: 'FN', isFb: false, icon: 'STR', inputs: ['IN: STRING', 'L: INT'], outputs: ['OUT: STRING'], desc: 'Last L characters of string' },
        { name: 'MID', kind: 'FN', isFb: false, icon: 'STR', inputs: ['IN: STRING', 'L: INT', 'P: INT'], outputs: ['OUT: STRING'], desc: 'L characters starting at position P' },
        { name: 'CONCAT', kind: 'FN', isFb: false, icon: 'STR', inputs: ['IN1: STRING', 'IN2: STRING'], outputs: ['OUT: STRING'], desc: 'Joins two strings together' },
        { name: 'INSERT', kind: 'FN', isFb: false, icon: 'STR', inputs: ['IN1: STRING', 'IN2: STRING', 'P: INT'], outputs: ['OUT: STRING'], desc: 'Inserts IN2 into IN1 after position P' },
        { name: 'DELETE', kind: 'FN', isFb: false, icon: 'STR', inputs: ['IN: STRING', 'L: INT', 'P: INT'], outputs: ['OUT: STRING'], desc: 'Removes L characters starting at position P' },
        { name: 'REPLACE', kind: 'FN', isFb: false, icon: 'STR', inputs: ['IN1: STRING', 'IN2: STRING', 'L: INT', 'P: INT'], outputs: ['OUT: STRING'], desc: 'Replaces L characters at position P with IN2' },
        { name: 'FIND', kind: 'FN', isFb: false, icon: 'STR', inputs: ['IN1: STRING', 'IN2: STRING'], outputs: ['OUT: INT'], desc: 'Position of IN2 inside IN1, 0 if not found' }
      ]
    },
    {
      id: 'sec5',
      title: '5. Program & Process Control',
      items: [
        { name: 'IF ... THEN', kind: 'ST', isFb: false, icon: 'ST_CTRL', inputs: ['Condition: BOOL'], outputs: [], desc: 'ST conditional statement with optional ELSIF and ELSE branches', stSnippet: 'IF Condition THEN\n    // statements\nELSIF AltCondition THEN\n    // statements\nELSE\n    // statements\nEND_IF;' },
        { name: 'CASE ... OF', kind: 'ST', isFb: false, icon: 'ST_CTRL', inputs: ['Selector: INT'], outputs: [], desc: 'ST multi-way branch matching integer or enum selector', stSnippet: 'CASE StepIndex OF\n    10:\n        // step 10\n    20:\n        // step 20\nELSE\n    // default\nEND_CASE;' },
        { name: 'FOR ... TO', kind: 'ST', isFb: false, icon: 'ST_CTRL', inputs: ['i := 0 TO 15 BY 1'], outputs: [], desc: 'ST loop repeating a fixed number of times', stSnippet: 'FOR i := 0 TO 15 BY 1 DO\n    // loop body\nEND_FOR;' },
        { name: 'WHILE ... DO', kind: 'ST', isFb: false, icon: 'ST_CTRL', inputs: ['Condition: BOOL'], outputs: [], desc: 'ST loop tested before each pass', stSnippet: 'WHILE Condition DO\n    // loop body\nEND_WHILE;' },
        { name: 'REPEAT ... UNTIL', kind: 'ST', isFb: false, icon: 'ST_CTRL', inputs: ['Condition: BOOL'], outputs: [], desc: 'ST loop tested after each pass until Condition is TRUE', stSnippet: 'REPEAT\n    // loop body\nUNTIL Condition\nEND_REPEAT;' },
        { name: 'EXIT', kind: 'ST', isFb: false, icon: 'ST_CTRL', inputs: [], outputs: [], desc: 'Leaves the innermost FOR/WHILE/REPEAT loop', stSnippet: 'EXIT;' },
        { name: 'CONTINUE', kind: 'ST', isFb: false, icon: 'ST_CTRL', inputs: [], outputs: [], desc: 'Skips to the next loop pass', stSnippet: 'CONTINUE;' },
        { name: 'RETURN (ST)', kind: 'ST', isFb: false, icon: 'ST_CTRL', inputs: [], outputs: [], desc: 'Leaves the current POU immediately', stSnippet: 'RETURN;' },
        { name: 'PID', kind: 'FB', isFb: true, icon: 'PID', inputs: ['PV: REAL', 'SP: REAL', 'MAN: BOOL', 'MAN_VAL: REAL', 'Kp: REAL := 1.5', 'Ti: TIME := T#5s', 'Td: TIME := T#0s', 'OUT_MIN: REAL := 0.0', 'OUT_MAX: REAL := 100.0', 'RESET: BOOL'], outputs: ['OUT: REAL', 'ERR: REAL', 'LIMITING: BOOL'], desc: 'PID controller with anti-windup and bumpless auto/manual transfer' },
        { name: 'PID_Autotune', kind: 'FB', isFb: true, icon: 'PID', inputs: ['Enable: BOOL', 'PV: REAL', 'StepSize: REAL := 10.0'], outputs: ['Kp: REAL', 'Ti: REAL', 'Td: REAL', 'Done: BOOL'], desc: 'Relay-feedback closed-loop PID autotuner' },
        { name: 'RAMP', kind: 'FB', isFb: true, icon: 'PID', inputs: ['IN: REAL', 'RATE: REAL := 50.0'], outputs: ['OUT: REAL'], desc: 'Slew-rate limiter: moves OUT toward IN at RATE units/sec' },
        { name: 'HYSTERESIS', kind: 'FB', isFb: true, icon: 'PID', inputs: ['IN: REAL', 'HIGH: REAL', 'LOW: REAL'], outputs: ['Q: BOOL'], desc: 'Schmitt comparator: Q goes TRUE above HIGH, FALSE below LOW' },
        { name: 'DEADBAND', kind: 'FB', isFb: true, icon: 'PID', inputs: ['IN: REAL', 'DB: REAL'], outputs: ['OUT: REAL'], desc: 'Zero output while IN is within DB of zero' },
        { name: 'FILTER', kind: 'FB', isFb: true, icon: 'PID', inputs: ['IN: REAL', 'T: TIME := T#100ms'], outputs: ['OUT: REAL'], desc: 'First-order low-pass lag filter' },
        { name: 'INTEGRATOR', kind: 'FB', isFb: true, icon: 'PID', inputs: ['IN: REAL', 'RESET: BOOL'], outputs: ['OUT: REAL'], desc: 'Accumulates IN over time (dt scan integral)' },
        { name: 'DERIVATIVE', kind: 'FB', isFb: true, icon: 'PID', inputs: ['IN: REAL', 'T: TIME := T#50ms'], outputs: ['OUT: REAL'], desc: 'Filtered rate of change of IN' },
        { name: 'LIMIT_ALARM', kind: 'FB', isFb: true, icon: 'PID', inputs: ['IN: REAL', 'HH: REAL', 'H: REAL', 'L: REAL', 'LL: REAL', 'HYST: REAL'], outputs: ['AL_HH: BOOL', 'AL_H: BOOL', 'AL_L: BOOL', 'AL_LL: BOOL'], desc: 'Four-level process alarm comparator with hysteresis' },
        { name: 'PWM', kind: 'FB', isFb: true, icon: 'PID', inputs: ['DUTY: REAL := 50.0', 'PERIOD: TIME := T#100ms'], outputs: ['Q: BOOL'], desc: 'Pulse-width modulated digital output generator' }
      ]
    },
    {
      id: 'sec6',
      title: '6. Single-Axis Motion (PLCopen)',
      items: [
        { name: 'MC_Power', kind: 'FB', isFb: true, icon: 'MOTION', inputs: ['Axis: AXIS_REF', 'Enable: BOOL', 'Enable_Positive: BOOL := TRUE', 'Enable_Negative: BOOL := TRUE'], outputs: ['Status: BOOL', 'Valid: BOOL', 'Error: BOOL', 'ErrorID: WORD'], desc: 'Enables/disables servo drive power stage and directional travel' },
        { name: 'MC_Reset', kind: 'FB', isFb: true, icon: 'MOTION', inputs: ['Axis: AXIS_REF', 'Execute: BOOL'], outputs: ['Done: BOOL', 'Busy: BOOL', 'Error: BOOL', 'ErrorID: WORD'], desc: 'Clears axis motion faults and transitions from ErrorStop to StandStill' },
        { name: 'MC_ReadStatus', kind: 'FB', isFb: true, icon: 'MOTION', inputs: ['Axis: AXIS_REF', 'Enable: BOOL'], outputs: ['Valid: BOOL', 'Busy: BOOL', 'Error: BOOL', 'ErrorID: WORD', 'ErrorStop: BOOL', 'Disabled: BOOL', 'Stopping: BOOL', 'StandStill: BOOL', 'DiscreteMotion: BOOL', 'ContinuousMotion: BOOL', 'SynchronizedMotion: BOOL', 'Homing: BOOL'], desc: 'Reads PLCopen state machine flags of the axis' },
        { name: 'MC_ReadAxisError', kind: 'FB', isFb: true, icon: 'MOTION', inputs: ['Axis: AXIS_REF', 'Enable: BOOL'], outputs: ['Valid: BOOL', 'Busy: BOOL', 'Error: BOOL', 'ErrorID: WORD', 'AxisErrorID: WORD'], desc: 'Reads current servo drive diagnostic alarm code' },
        { name: 'MC_ReadActualPosition', kind: 'FB', isFb: true, icon: 'MOTION', inputs: ['Axis: AXIS_REF', 'Enable: BOOL'], outputs: ['Valid: BOOL', 'Busy: BOOL', 'Error: BOOL', 'ErrorID: WORD', 'Position: REAL'], desc: 'Reads actual axis position in user engineering units' },
        { name: 'MC_ReadActualVelocity', kind: 'FB', isFb: true, icon: 'MOTION', inputs: ['Axis: AXIS_REF', 'Enable: BOOL'], outputs: ['Valid: BOOL', 'Busy: BOOL', 'Error: BOOL', 'ErrorID: WORD', 'Velocity: REAL'], desc: 'Reads actual axis velocity in user units/sec' },
        { name: 'MC_ReadParameter', kind: 'FB', isFb: true, icon: 'MOTION', inputs: ['Axis: AXIS_REF', 'Enable: BOOL', 'ParameterNumber: INT'], outputs: ['Valid: BOOL', 'Busy: BOOL', 'Error: BOOL', 'ErrorID: WORD', 'Value: REAL'], desc: 'Reads an axis/drive parameter by index' },
        { name: 'MC_WriteParameter', kind: 'FB', isFb: true, icon: 'MOTION', inputs: ['Axis: AXIS_REF', 'Execute: BOOL', 'ParameterNumber: INT', 'Value: REAL'], outputs: ['Done: BOOL', 'Busy: BOOL', 'Error: BOOL', 'ErrorID: WORD'], desc: 'Writes an axis/drive parameter on rising edge of Execute' },
        { name: 'MC_SetPosition', kind: 'FB', isFb: true, icon: 'MOTION', inputs: ['Axis: AXIS_REF', 'Execute: BOOL', 'Position: REAL := 0.0', 'Relative: BOOL := FALSE'], outputs: ['Done: BOOL', 'Busy: BOOL', 'Error: BOOL', 'ErrorID: WORD'], desc: 'Shifts axis coordinate system without physical movement' },
        { name: 'MC_Home', kind: 'FB', isFb: true, icon: 'MOTION', inputs: ['Axis: AXIS_REF', 'Execute: BOOL', 'Position: REAL := 0.0', 'BufferMode: MC_BUFFER_MODE'], outputs: COMMON_MC_OUT, desc: 'Executes axis reference homing sequence' },
        { name: 'MC_Stop', kind: 'FB', isFb: true, icon: 'MOTION', inputs: ['Axis: AXIS_REF', 'Execute: BOOL', 'Deceleration: REAL := 2000.0', 'Jerk: REAL := 10000.0'], outputs: COMMON_MC_OUT, desc: 'Brings axis to a controlled stop and locks in Stopping state while Execute is TRUE' },
        { name: 'MC_Halt', kind: 'FB', isFb: true, icon: 'MOTION', inputs: ['Axis: AXIS_REF', 'Execute: BOOL', 'Deceleration: REAL := 1500.0', 'Jerk: REAL := 5000.0', 'BufferMode: MC_BUFFER_MODE'], outputs: COMMON_MC_OUT, desc: 'Decelerates axis to StandStill, allowing subsequent motion commands' },
        { name: 'MC_MoveAbsolute', kind: 'FB', isFb: true, icon: 'MOTION', inputs: ['Axis: AXIS_REF', 'Execute: BOOL', 'Position: REAL := 100.0', 'Velocity: REAL := 250.0', 'Acceleration: REAL := 1500.0', 'Deceleration: REAL := 1500.0', 'Jerk: REAL := 5000.0', 'Direction: MC_DIRECTION', 'BufferMode: MC_BUFFER_MODE'], outputs: COMMON_MC_OUT, desc: 'Moves axis to absolute target Position with S-curve profile' },
        { name: 'MC_MoveRelative', kind: 'FB', isFb: true, icon: 'MOTION', inputs: ['Axis: AXIS_REF', 'Execute: BOOL', 'Distance: REAL := 50.0', 'Velocity: REAL := 250.0', 'Acceleration: REAL := 1500.0', 'Deceleration: REAL := 1500.0', 'Jerk: REAL := 5000.0', 'BufferMode: MC_BUFFER_MODE'], outputs: COMMON_MC_OUT, desc: 'Moves axis by relative Distance from current position' },
        { name: 'MC_MoveAdditive', kind: 'FB', isFb: true, icon: 'MOTION', inputs: ['Axis: AXIS_REF', 'Execute: BOOL', 'Distance: REAL := 25.0', 'Velocity: REAL := 250.0', 'Acceleration: REAL := 1500.0', 'Deceleration: REAL := 1500.0', 'Jerk: REAL := 5000.0', 'BufferMode: MC_BUFFER_MODE'], outputs: COMMON_MC_OUT, desc: 'Adds Distance to the target of the currently running move' },
        { name: 'MC_MoveSuperimposed', kind: 'FB', isFb: true, icon: 'MOTION', inputs: ['Axis: AXIS_REF', 'Execute: BOOL', 'Distance: REAL := 10.0', 'VelocityDiff: REAL := 50.0', 'Acceleration: REAL := 1000.0', 'Deceleration: REAL := 1000.0', 'Jerk: REAL := 5000.0'], outputs: [...COMMON_MC_OUT, 'CoveredDistance: REAL'], desc: 'Superimposes a relative phase/distance shift onto an active motion' },
        { name: 'MC_MoveVelocity', kind: 'FB', isFb: true, icon: 'MOTION', inputs: ['Axis: AXIS_REF', 'Execute: BOOL', 'Velocity: REAL := 200.0', 'Acceleration: REAL := 1500.0', 'Deceleration: REAL := 1500.0', 'Jerk: REAL := 5000.0', 'Direction: MC_DIRECTION', 'BufferMode: MC_BUFFER_MODE'], outputs: ['InVelocity: BOOL', 'Busy: BOOL', 'Active: BOOL', 'CommandAborted: BOOL', 'Error: BOOL', 'ErrorID: WORD'], desc: 'Accelerates axis to continuous target Velocity' },
        { name: 'MC_TorqueControl', kind: 'FB', isFb: true, icon: 'MOTION', inputs: ['Axis: AXIS_REF', 'Execute: BOOL', 'Torque: REAL := 25.0', 'TorqueRamp: REAL := 100.0', 'Velocity: REAL := 100.0', 'Acceleration: REAL := 1000.0', 'Deceleration: REAL := 1000.0', 'Jerk: REAL := 5000.0', 'Direction: MC_DIRECTION', 'BufferMode: MC_BUFFER_MODE'], outputs: ['InTorque: BOOL', 'Busy: BOOL', 'Active: BOOL', 'CommandAborted: BOOL', 'Error: BOOL', 'ErrorID: WORD'], desc: 'Closed-loop torque/force control with velocity limit' },
        { name: 'MC_SetOverride', kind: 'FB', isFb: true, icon: 'MOTION', inputs: ['Axis: AXIS_REF', 'Enable: BOOL', 'VelFactor: REAL := 1.0', 'AccFactor: REAL := 1.0', 'JerkFactor: REAL := 1.0'], outputs: ['Enabled: BOOL', 'Busy: BOOL', 'Error: BOOL', 'ErrorID: WORD'], desc: 'Applies real-time feedrate/acceleration override factors (0.0 to 1.0+)' },
        { name: 'MC_TouchProbe', kind: 'FB', isFb: true, icon: 'MOTION', inputs: ['Axis: AXIS_REF', 'Execute: BOOL', 'TriggerInput: TRIGGER_REF', 'WindowOnly: BOOL', 'FirstPosition: REAL', 'LastPosition: REAL'], outputs: ['Done: BOOL', 'Busy: BOOL', 'CommandAborted: BOOL', 'Error: BOOL', 'ErrorID: WORD', 'RecordedPosition: REAL'], desc: 'Captures high-speed hardware latch position on trigger edge' },
        { name: 'MC_AbortTrigger', kind: 'FB', isFb: true, icon: 'MOTION', inputs: ['Axis: AXIS_REF', 'Execute: BOOL', 'TriggerInput: TRIGGER_REF'], outputs: ['Done: BOOL', 'Busy: BOOL', 'Error: BOOL', 'ErrorID: WORD'], desc: 'Disarms an active MC_TouchProbe trigger latch' },
        { name: 'MC_Jog', kind: 'FB', isFb: true, icon: 'MOTION', inputs: ['Axis: AXIS_REF', 'JogForward: BOOL', 'JogBackward: BOOL', 'Velocity: REAL := 50.0', 'Acceleration: REAL := 1000.0', 'Deceleration: REAL := 1000.0', 'Jerk: REAL := 5000.0'], outputs: ['Busy: BOOL', 'Active: BOOL', 'Error: BOOL', 'ErrorID: WORD'], desc: 'Manual push-button forward/backward jogging block' }
      ]
    },
    {
      id: 'sec7',
      title: '7. Sync & Group Motion',
      items: [
        { name: 'MC_GearIn', kind: 'FB', isFb: true, icon: 'SYNC', inputs: ['Master: AXIS_REF', 'Slave: AXIS_REF', 'Execute: BOOL', 'RatioNumerator: INT := 1', 'RatioDenominator: UINT := 1', 'Acceleration: REAL := 1500.0', 'Deceleration: REAL := 1500.0', 'Jerk: REAL := 5000.0', 'BufferMode: MC_BUFFER_MODE'], outputs: ['InGear: BOOL', 'Busy: BOOL', 'Active: BOOL', 'CommandAborted: BOOL', 'Error: BOOL', 'ErrorID: WORD'], desc: 'Electronic gearing: locks Slave velocity to Master by ratio' },
        { name: 'MC_GearOut', kind: 'FB', isFb: true, icon: 'SYNC', inputs: ['Slave: AXIS_REF', 'Execute: BOOL'], outputs: ['Done: BOOL', 'Busy: BOOL', 'Error: BOOL', 'ErrorID: WORD'], desc: 'Disengages electronic gear coupling on Slave axis' },
        { name: 'MC_GearInPos', kind: 'FB', isFb: true, icon: 'SYNC', inputs: ['Master: AXIS_REF', 'Slave: AXIS_REF', 'Execute: BOOL', 'RatioNumerator: INT := 1', 'RatioDenominator: UINT := 1', 'MasterSyncPosition: REAL', 'SlaveSyncPosition: REAL', 'SyncMode: INT', 'MasterStartDistance: REAL', 'Velocity: REAL', 'Acceleration: REAL', 'Deceleration: REAL', 'Jerk: REAL'], outputs: ['InSync: BOOL', 'StartSync: BOOL', 'Busy: BOOL', 'Active: BOOL', 'CommandAborted: BOOL', 'Error: BOOL', 'ErrorID: WORD'], desc: 'Phase-synchronized electronic gearing reaching lock at MasterSyncPosition' },
        { name: 'MC_CamTableSelect', kind: 'FB', isFb: true, icon: 'SYNC', inputs: ['Master: AXIS_REF', 'Slave: AXIS_REF', 'CamTable: CAM_REF', 'Execute: BOOL', 'Periodic: BOOL := TRUE', 'MasterAbsolute: BOOL := TRUE', 'SlaveAbsolute: BOOL := TRUE'], outputs: ['Done: BOOL', 'Busy: BOOL', 'Error: BOOL', 'ErrorID: WORD', 'CamTableID: INT'], desc: 'Preloads and validates an electronic cam spline table' },
        { name: 'MC_CamIn', kind: 'FB', isFb: true, icon: 'SYNC', inputs: ['Master: AXIS_REF', 'Slave: AXIS_REF', 'Execute: BOOL', 'MasterOffset: REAL := 0.0', 'SlaveOffset: REAL := 0.0', 'MasterScaling: REAL := 1.0', 'SlaveScaling: REAL := 1.0', 'StartMode: INT', 'CamTableID: INT', 'BufferMode: MC_BUFFER_MODE'], outputs: ['InSync: BOOL', 'EndOfProfile: BOOL', 'Busy: BOOL', 'Active: BOOL', 'CommandAborted: BOOL', 'Error: BOOL', 'ErrorID: WORD'], desc: 'Engages synchronous electronic cam profile between Master and Slave' },
        { name: 'MC_CamOut', kind: 'FB', isFb: true, icon: 'SYNC', inputs: ['Slave: AXIS_REF', 'Execute: BOOL'], outputs: ['Done: BOOL', 'Busy: BOOL', 'Error: BOOL', 'ErrorID: WORD'], desc: 'Disengages electronic cam profile on Slave axis' },
        { name: 'MC_Phasing', kind: 'FB', isFb: true, icon: 'SYNC', inputs: ['Master: AXIS_REF', 'Slave: AXIS_REF', 'Execute: BOOL', 'PhaseShift: REAL := 15.0', 'Velocity: REAL := 100.0', 'Acceleration: REAL := 1000.0', 'Deceleration: REAL := 1000.0', 'Jerk: REAL := 5000.0'], outputs: ['Done: BOOL', 'CoveredPhaseShift: REAL', 'Busy: BOOL', 'Active: BOOL', 'CommandAborted: BOOL', 'Error: BOOL', 'ErrorID: WORD'], desc: 'Shifts Master phase angle seen by a synchronized Slave axis' },
        { name: 'MC_CombineAxes', kind: 'FB', isFb: true, icon: 'SYNC', inputs: ['Master1: AXIS_REF', 'Master2: AXIS_REF', 'Slave: AXIS_REF', 'Execute: BOOL', 'CombineMode: INT', 'GearRatio1: REAL := 1.0', 'GearRatio2: REAL := 1.0', 'BufferMode: MC_BUFFER_MODE'], outputs: ['InSync: BOOL', 'Busy: BOOL', 'Active: BOOL', 'CommandAborted: BOOL', 'Error: BOOL', 'ErrorID: WORD'], desc: 'Differential sum/difference motion of two Master axes into Slave' },
        { name: 'MC_GroupEnable', kind: 'FB', isFb: true, icon: 'SYNC', inputs: ['AxesGroup: AXES_GROUP_REF', 'Execute: BOOL'], outputs: ['Done: BOOL', 'Busy: BOOL', 'Error: BOOL', 'ErrorID: WORD'], desc: 'Enables coordinated multi-axis kinematics group (PLCopen Part 4)' },
        { name: 'MC_GroupDisable', kind: 'FB', isFb: true, icon: 'SYNC', inputs: ['AxesGroup: AXES_GROUP_REF', 'Execute: BOOL'], outputs: ['Done: BOOL', 'Busy: BOOL', 'Error: BOOL', 'ErrorID: WORD'], desc: 'Disables coordinated multi-axis kinematics group' },
        { name: 'MC_GroupHome', kind: 'FB', isFb: true, icon: 'SYNC', inputs: ['AxesGroup: AXES_GROUP_REF', 'Execute: BOOL', 'Position: REAL[6]', 'BufferMode: MC_BUFFER_MODE'], outputs: COMMON_MC_OUT, desc: 'Executes coordinated homing for all axes in an AxesGroup' },
        { name: 'MC_GroupStop', kind: 'FB', isFb: true, icon: 'SYNC', inputs: ['AxesGroup: AXES_GROUP_REF', 'Execute: BOOL', 'Deceleration: REAL := 2500.0', 'Jerk: REAL := 10000.0'], outputs: COMMON_MC_OUT, desc: 'Stops coordinated group motion along path and locks group while Execute is TRUE' },
        { name: 'MC_GroupHalt', kind: 'FB', isFb: true, icon: 'SYNC', inputs: ['AxesGroup: AXES_GROUP_REF', 'Execute: BOOL', 'Deceleration: REAL := 2000.0', 'Jerk: REAL := 8000.0', 'BufferMode: MC_BUFFER_MODE'], outputs: COMMON_MC_OUT, desc: 'Halts coordinated group motion along path to GroupStandby' },
        { name: 'MC_MoveLinearAbsolute', kind: 'FB', isFb: true, icon: 'SYNC', inputs: ['AxesGroup: AXES_GROUP_REF', 'Execute: BOOL', 'Position: REAL[6]', 'Velocity: REAL := 300.0', 'Acceleration: REAL := 1500.0', 'Deceleration: REAL := 1500.0', 'Jerk: REAL := 5000.0', 'BufferMode: MC_BUFFER_MODE', 'TransitionMode: INT', 'CoordSystem: INT'], outputs: COMMON_MC_OUT, desc: '3D/6-DOF linear interpolated path to absolute Cartesian coordinates' },
        { name: 'MC_MoveLinearRelative', kind: 'FB', isFb: true, icon: 'SYNC', inputs: ['AxesGroup: AXES_GROUP_REF', 'Execute: BOOL', 'Distance: REAL[6]', 'Velocity: REAL := 300.0', 'Acceleration: REAL := 1500.0', 'Deceleration: REAL := 1500.0', 'Jerk: REAL := 5000.0', 'BufferMode: MC_BUFFER_MODE', 'TransitionMode: INT', 'CoordSystem: INT'], outputs: COMMON_MC_OUT, desc: 'Linear interpolated move by relative Cartesian distance vector' },
        { name: 'MC_MoveCircularAbsolute', kind: 'FB', isFb: true, icon: 'SYNC', inputs: ['AxesGroup: AXES_GROUP_REF', 'Execute: BOOL', 'CircMode: INT', 'AuxPoint1: REAL[3]', 'AuxPoint2: REAL[3]', 'EndPoint: REAL[3]', 'PathChoice: INT', 'Velocity: REAL := 200.0', 'Acceleration: REAL := 1200.0', 'Deceleration: REAL := 1200.0', 'Jerk: REAL := 5000.0', 'BufferMode: MC_BUFFER_MODE', 'TransitionMode: INT', 'CoordSystem: INT'], outputs: COMMON_MC_OUT, desc: 'Circular arc interpolation to absolute Cartesian EndPoint' },
        { name: 'MC_MoveCircularRelative', kind: 'FB', isFb: true, icon: 'SYNC', inputs: ['AxesGroup: AXES_GROUP_REF', 'Execute: BOOL', 'CircMode: INT', 'AuxPoint1: REAL[3]', 'AuxPoint2: REAL[3]', 'EndPoint: REAL[3]', 'PathChoice: INT', 'Velocity: REAL := 200.0', 'Acceleration: REAL := 1200.0', 'Deceleration: REAL := 1200.0', 'Jerk: REAL := 5000.0', 'BufferMode: MC_BUFFER_MODE', 'TransitionMode: INT', 'CoordSystem: INT'], outputs: COMMON_MC_OUT, desc: 'Circular arc interpolation using relative Cartesian points' }
      ]
    },
    {
      id: 'sec8',
      title: '8. Modbus Communication',
      items: [
        { name: 'MB_ReadCoils', kind: 'FB', isFb: true, icon: 'MODBUS', inputs: ['Execute: BOOL', 'Device: MB_DEVICE_REF', 'SlaveId: BYTE := 1', 'Address: UINT := 0', 'Quantity: UINT := 16'], outputs: [...COMMON_MB_OUT, 'pData: BOOL[]'], desc: 'Modbus FC 01: Read Coils (0x) into BOOL array' },
        { name: 'MB_ReadDiscreteInputs', kind: 'FB', isFb: true, icon: 'MODBUS', inputs: ['Execute: BOOL', 'Device: MB_DEVICE_REF', 'SlaveId: BYTE := 1', 'Address: UINT := 0', 'Quantity: UINT := 16'], outputs: [...COMMON_MB_OUT, 'pData: BOOL[]'], desc: 'Modbus FC 02: Read Discrete Inputs (1x) into BOOL array' },
        { name: 'MB_ReadHoldingRegs', kind: 'FB', isFb: true, icon: 'MODBUS', inputs: ['Execute: BOOL', 'Device: MB_DEVICE_REF', 'SlaveId: BYTE := 1', 'Address: UINT := 0', 'Quantity: UINT := 8'], outputs: [...COMMON_MB_OUT, 'pData: WORD[]'], desc: 'Modbus FC 03: Read Holding Registers (4x) into WORD array' },
        { name: 'MB_ReadInputRegs', kind: 'FB', isFb: true, icon: 'MODBUS', inputs: ['Execute: BOOL', 'Device: MB_DEVICE_REF', 'SlaveId: BYTE := 1', 'Address: UINT := 0', 'Quantity: UINT := 8'], outputs: [...COMMON_MB_OUT, 'pData: WORD[]'], desc: 'Modbus FC 04: Read Input Registers (3x) into WORD array' },
        { name: 'MB_WriteSingleCoil', kind: 'FB', isFb: true, icon: 'MODBUS', inputs: ['Execute: BOOL', 'Device: MB_DEVICE_REF', 'SlaveId: BYTE := 1', 'Address: UINT := 0', 'Value: BOOL'], outputs: COMMON_MB_OUT, desc: 'Modbus FC 05: Write Single Coil' },
        { name: 'MB_WriteSingleReg', kind: 'FB', isFb: true, icon: 'MODBUS', inputs: ['Execute: BOOL', 'Device: MB_DEVICE_REF', 'SlaveId: BYTE := 1', 'Address: UINT := 0', 'Value: WORD'], outputs: COMMON_MB_OUT, desc: 'Modbus FC 06: Write Single Holding Register' },
        { name: 'MB_WriteMultiCoils', kind: 'FB', isFb: true, icon: 'MODBUS', inputs: ['Execute: BOOL', 'Device: MB_DEVICE_REF', 'SlaveId: BYTE := 1', 'Address: UINT := 0', 'Quantity: UINT := 16', 'pData: BOOL[]'], outputs: COMMON_MB_OUT, desc: 'Modbus FC 15: Write Multiple Coils from BOOL array' },
        { name: 'MB_WriteMultiRegs', kind: 'FB', isFb: true, icon: 'MODBUS', inputs: ['Execute: BOOL', 'Device: MB_DEVICE_REF', 'SlaveId: BYTE := 1', 'Address: UINT := 0', 'Quantity: UINT := 8', 'pData: WORD[]'], outputs: COMMON_MB_OUT, desc: 'Modbus FC 16: Write Multiple Holding Registers from WORD array' }
      ]
    },
    {
      id: 'sec9',
      title: '9. System & Diagnostics',
      items: [
        { name: 'SYS_FirstScan', kind: 'NO', isFb: false, icon: 'SYS', inputs: ['SYS_FirstScan: BOOL'], outputs: [], desc: 'System bit: TRUE only in the first scan after start; use to initialise values' },
        { name: 'SYS_AlwaysOn', kind: 'NO', isFb: false, icon: 'SYS', inputs: ['SYS_AlwaysOn: BOOL'], outputs: [], desc: 'System bit: Constant TRUE every scan' },
        { name: 'SYS_AlwaysOff', kind: 'NC', isFb: false, icon: 'SYS', inputs: ['SYS_AlwaysOff: BOOL'], outputs: [], desc: 'System bit: Constant FALSE every scan' },
        { name: 'SYS_Clock100ms', kind: 'NO', isFb: false, icon: 'SYS', inputs: ['SYS_Clock100ms: BOOL'], outputs: [], desc: 'System bit: 100 ms square-wave pulse for high-rate blinking/heartbeats' },
        { name: 'SYS_Clock1s', kind: 'NO', isFb: false, icon: 'SYS', inputs: ['SYS_Clock1s: BOOL'], outputs: [], desc: 'System bit: 1.0 s square-wave pulse for status lamps and heartbeats' },
        { name: 'SysGetCycleTime', kind: 'FB', isFb: true, icon: 'SYS', inputs: ['Task: STRING := \'MainTask\''], outputs: ['LastCycle: TIME', 'MaxCycle: TIME', 'AvgCycle: TIME', 'Jitter: TIME'], desc: 'Reads deterministic task timing and jitter statistics' },
        { name: 'SysGetTime', kind: 'FB', isFb: true, icon: 'SYS', inputs: [], outputs: ['DT: DATE_AND_TIME'], desc: 'Reads real-time controller wall clock' },
        { name: 'SysSetTime', kind: 'FB', isFb: true, icon: 'SYS', inputs: ['Execute: BOOL', 'DT: DATE_AND_TIME'], outputs: ['Done: BOOL', 'Error: BOOL'], desc: 'Sets controller real-time clock on rising edge of Execute' },
        { name: 'SysWatchdog', kind: 'FB', isFb: true, icon: 'SYS', inputs: ['Enable: BOOL', 'Timeout: TIME := T#50ms'], outputs: ['Triggered: BOOL'], desc: 'Raises a fault if not retriggered within Timeout' },
        { name: 'SysRetainClear', kind: 'FB', isFb: true, icon: 'SYS', inputs: ['Execute: BOOL'], outputs: ['Done: BOOL'], desc: 'Clears non-volatile retain variables in NVRAM' },
        { name: 'EventLog_Write', kind: 'FB', isFb: true, icon: 'SYS', inputs: ['Execute: BOOL', 'Level: LOG_LEVEL := Info', 'Text: STRING'], outputs: ['Done: BOOL'], desc: 'Writes a timestamped diagnostic entry to the runtime event log' },
        { name: 'Alarm_Raise', kind: 'FB', isFb: true, icon: 'SYS', inputs: ['Execute: BOOL', 'AlarmId: INT := 101', 'Severity: INT := 2', 'Text: STRING'], outputs: ['Active: BOOL'], desc: 'Raises an active alarm displayed immediately on the HMI Alarm Display' },
        { name: 'Alarm_Ack', kind: 'FB', isFb: true, icon: 'SYS', inputs: ['Execute: BOOL', 'AlarmId: INT := 101'], outputs: ['Done: BOOL'], desc: 'Acknowledges an active controller/HMI alarm by AlarmId' }
      ]
    }
  ];

  // Build flat lookup map
  const BY_NAME = {};
  let TOTAL_COUNT = 0;
  SECTIONS.forEach(sec => {
    sec.items.forEach(item => {
      item.sectionTitle = sec.title;
      item.sectionId = sec.id;
      item.svg = ICONS[item.icon] || ICONS.LOGIC;
      BY_NAME[item.name] = item;
      TOTAL_COUNT++;
    });
  });

  function getSections() { return SECTIONS; }
  function getByName(name) { return BY_NAME[name] || null; }
  function getTotalCount() { return TOTAL_COUNT; }

  // Parse pin specification 'PT: TIME := T#1s' -> { pin: 'PT', type: 'TIME', defVal: 'T#1s' }
  function parsePin(pinSpec) {
    const [left, defVal] = String(pinSpec).split(':=').map(s => s.trim());
    const [pin, type] = left.split(':').map(s => s.trim());
    return { pin: pin || 'IN', type: type || 'ANY', defVal: defVal || '' };
  }

  // Create a Ladder node object from an instruction name
  function createLadderNode(instrName, instanceNum) {
    const spec = getByName(instrName);
    if (!spec) {
      return { kind: 'NO', instr: instrName, addr: 'M100', label: instrName, pinsIn: [], pinsOut: [] };
    }
    if (['NO', 'NC', 'COIL', 'COIL_NEG', 'COIL_SET', 'COIL_RST', 'NOT', 'JMP', 'RET', 'MCR', 'OR_BRANCH'].includes(spec.kind)) {
      const isSysBit = instrName.startsWith('SYS_');
      const defAddr = isSysBit ? instrName : (spec.kind.startsWith('COIL') ? 'Y10' : (spec.kind === 'JMP' ? 'LBL_END' : 'M100'));
      return {
        kind: spec.kind,
        instr: spec.name,
        addr: defAddr,
        label: isSysBit ? 'System_Bit' : spec.name.replace(/\s+/g, '_'),
        desc: spec.desc
      };
    }

    // Function Block or Stateless Function Box with Full Pins
    const cleanBase = spec.name.replace(/[^A-Za-z0-9_]/g, '_');
    const instName = spec.isFb ? `${cleanBase}_${instanceNum || 1}` : '';
    const pinsIn = (spec.inputs || []).map(p => {
      const parsed = parsePin(p);
      return { pin: parsed.pin, type: parsed.type, val: parsed.defVal || (parsed.type === 'AXIS_REF' ? 'Axis_01_Master' : '') };
    });
    const pinsOut = (spec.outputs || []).map(p => {
      const parsed = parsePin(p);
      return { pin: parsed.pin, type: parsed.type, val: '' };
    });

    return {
      kind: spec.isFb ? 'FB_BOX' : 'FN_BOX',
      instr: spec.name,
      isFb: spec.isFb,
      instance: instName,
      addr: instName || spec.name,
      label: spec.sectionTitle,
      desc: spec.desc,
      pinsIn,
      pinsOut
    };
  }

  // Generate Structured Text (ST) code snippet + optional VAR instance declaration
  function generateStInsert(instrName, existingVarsCount) {
    const spec = getByName(instrName);
    if (!spec) return { code: `// ${instrName}();`, varDecl: null };

    if (spec.stSnippet) {
      return { code: spec.stSnippet, varDecl: null };
    }

    if (spec.name.startsWith('SYS_')) {
      return { code: `// Read System Diagnostic Bit: ${spec.name}\nIF ${spec.name} THEN\n    ;\nEND_IF;`, varDecl: null };
    }

    if (!spec.isFb && spec.kind !== 'FN') {
      if (spec.kind.startsWith('COIL')) {
        return { code: `Y10 := RungCondition; // ${spec.name}`, varDecl: null };
      }
      return { code: `RungCondition := M100; // ${spec.name}`, varDecl: null };
    }

    const inArgs = (spec.inputs || []).map(p => {
      const parsed = parsePin(p);
      const val = parsed.defVal || (parsed.type === 'AXIS_REF' ? 'Axis_01_Master' : (parsed.type === 'BOOL' ? 'TRUE' : '0'));
      return `${parsed.pin} := ${val}`;
    });

    if (!spec.isFb) {
      // Stateless IEC Function
      const fnName = spec.name.replace(/\s*\(.*\)/, '');
      if (fnName === 'INC' || fnName === 'DEC') {
        return { code: `${fnName}(Variable := StepCounter);`, varDecl: null };
      }
      return { code: `ResultVar := ${fnName}(${inArgs.join(', ')});`, varDecl: null };
    }

    // Stateful Function Block (requires instance variable in VAR table)
    const cleanBase = spec.name.replace(/[^A-Za-z0-9_]/g, '_');
    const instName = `${cleanBase}_${(existingVarsCount || 0) + 1}`;
    const outArgs = (spec.outputs || []).slice(0, 3).map(p => {
      const parsed = parsePin(p);
      return `${parsed.pin} => `;
    });
    const allArgs = [...inArgs, ...outArgs];
    const callCode = `${instName}(\n    ${allArgs.join(',\n    ')}\n);`;
    const varDecl = {
      name: instName,
      type: cleanBase,
      addr: 'FB_INST',
      init: '-',
      comment: spec.desc
    };
    return { code: callCode, varDecl };
  }

  return {
    getSections,
    getByName,
    getTotalCount,
    parsePin,
    createLadderNode,
    generateStInsert
  };
})();

if (typeof window !== 'undefined') {
  window.PlcInstructionCatalog = PlcInstructionCatalog;
}

