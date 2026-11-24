/**
 * HMI Designer Studio - Project Model & Serialization Engine
 */

const ProjectModel = (function() {
  let projectData = {
    name: 'MyProject',
    author: '',
    comment: '',
    resolution: { w: 1280, h: 800 },
    screens: {},
    tags: [],
    alarms: [],
    openTabs: [],
    activeScreen: null,
    driverConfig: {
      driver: 'MELSEC MC Protocol',
      driverId: 'melsec_mc',
      transport: 'TCP',
      address: '192.168.1.10',
      port: 5000,
      unitId: 1,
      comPort: 'COM1',
      baudRate: 9600,
      pollRate: 250,
      testAddress: '',
      testValue: '',
      autoConnect: false
    },
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    version: '1.0.0'
  };

  let currentProjectFilePath = null;
  let currentScreenName = null;
  let isDirty = false;

  function initNew(name, author, comment, w, h, plcBrand = 'MELSEC') {
    let driver = 'MELSEC MC Protocol (TCP 5000)';
    let port = 5000;
    const b = (plcBrand || 'MELSEC').toUpperCase();
    if (b.includes('SIEMENS')) {
      driver = 'Siemens S7comm (ISO-on-TCP 102)';
      port = 102;
    } else if (b.includes('ROCKWELL') || b.includes('ALLEN')) {
      driver = 'Allen-Bradley EtherNet/IP CIP (TCP 44818)';
      port = 44818;
    } else if (b.includes('OMRON')) {
      driver = 'Omron FINS (TCP/UDP 9600)';
      port = 9600;
    } else if (b.includes('DELTA')) {
      driver = 'Delta DVP / AS Modbus (TCP 502)';
      port = 502;
    } else if (b.includes('MODBUS')) {
      driver = 'Modbus TCP / RTU (TCP 502)';
      port = 502;
    }

    projectData = {
      name: name || 'MyProject',
      author: author || '',
      comment: comment || '',
      plcBrand: plcBrand || 'MELSEC',
      resolution: { w: parseInt(w, 10) || 1280, h: parseInt(h, 10) || 800 },
      screens: {},
      tags: TagManager.getTags(),
      alarms: [],
      openTabs: [],
      activeScreen: null,
      driverConfig: {
        driver,
        driverId: b.includes('SIEMENS') ? 's7'
          : b.includes('ROCKWELL') || b.includes('ALLEN') ? 'eip_cip'
          : b.includes('OMRON') ? 'omron_fins'
          : b.includes('DELTA') || b.includes('MODBUS') ? 'modbus'
          : 'melsec_mc',
        transport: 'TCP',
        address: '192.168.1.10',
        port,
        unitId: 1,
        comPort: 'COM1',
        baudRate: 9600,
        pollRate: 250,
        testAddress: '',
        testValue: '',
        autoConnect: false
      },
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      version: '1.0.0'
    };
    currentProjectFilePath = null;
    currentScreenName = null;
    isDirty = false;
  }

  function getProject() {
    return projectData;
  }

  function setFilePath(path) {
    currentProjectFilePath = path;
  }

  function getFilePath() {
    return currentProjectFilePath;
  }

  function getCurrentScreen() {
    return currentScreenName;
  }

  function setCurrentScreen(name) {
    currentScreenName = name;
  }

  function saveScreenObjects(screenName, objects) {
    if (!screenName) return;
    projectData.screens[screenName] = objects;
    projectData.modifiedAt = new Date().toISOString();
    isDirty = true;
  }

  function getScreenObjects(screenName) {
    return projectData.screens[screenName] || [];
  }

  function removeScreen(screenName) {
    if (projectData.screens[screenName]) {
      delete projectData.screens[screenName];
      if (projectData.screenMeta && projectData.screenMeta[screenName]) {
        delete projectData.screenMeta[screenName];
      }
      if (projectData.startupScreen === screenName) {
        projectData.startupScreen = null;
      }
      projectData.modifiedAt = new Date().toISOString();
      isDirty = true;
    }
  }

  function renameScreen(oldName, newName) {
    if (!oldName || !newName || oldName === newName) return false;
    if (projectData.screens[newName]) return false; // Name collision

    // Move screen objects
    projectData.screens[newName] = projectData.screens[oldName] || [];
    delete projectData.screens[oldName];

    // Move screen metadata if present
    if (!projectData.screenMeta) projectData.screenMeta = {};
    if (projectData.screenMeta[oldName]) {
      projectData.screenMeta[newName] = projectData.screenMeta[oldName];
      delete projectData.screenMeta[oldName];
    }

    // Cascade link updates across all screens (jump buttons targeting oldName)
    Object.keys(projectData.screens).forEach(sName => {
      const objs = projectData.screens[sName] || [];
      objs.forEach(obj => {
        if (obj.nav === oldName) obj.nav = newName;
        if (obj.navTarget === oldName) obj.navTarget = newName;
      });
    });

    if (currentScreenName === oldName) {
      currentScreenName = newName;
    }
    if (projectData.startupScreen === oldName) {
      projectData.startupScreen = newName;
    }
    if (Array.isArray(projectData.openTabs)) {
      projectData.openTabs = projectData.openTabs.map(t => t === oldName ? newName : t);
    }

    projectData.modifiedAt = new Date().toISOString();
    isDirty = true;
    return true;
  }

  function duplicateScreen(sourceName, newName) {
    if (!sourceName || !newName || projectData.screens[newName]) return false;
    const cloned = JSON.parse(JSON.stringify(projectData.screens[sourceName] || []));
    projectData.screens[newName] = cloned;

    if (!projectData.screenMeta) projectData.screenMeta = {};
    if (projectData.screenMeta[sourceName]) {
      projectData.screenMeta[newName] = JSON.parse(JSON.stringify(projectData.screenMeta[sourceName]));
    }

    projectData.modifiedAt = new Date().toISOString();
    isDirty = true;
    return true;
  }

  function setStartupScreen(name) {
    projectData.startupScreen = name;
    projectData.modifiedAt = new Date().toISOString();
    isDirty = true;
  }

  function getStartupScreen() {
    return projectData.startupScreen || null;
  }

  function setDriverConfig(config) {
    projectData.driverConfig = {
      ...(projectData.driverConfig || {}),
      ...(config || {})
    };
    projectData.modifiedAt = new Date().toISOString();
    isDirty = true;
  }

  function getDriverConfig() {
    return JSON.parse(JSON.stringify(projectData.driverConfig || {}));
  }

  function setScreenMeta(name, meta) {
    if (!name) return;
    if (!projectData.screenMeta) projectData.screenMeta = {};
    projectData.screenMeta[name] = { ...(projectData.screenMeta[name] || {}), ...meta };
    projectData.modifiedAt = new Date().toISOString();
    isDirty = true;
  }

  function getScreenMeta(name) {
    if (!name || !projectData.screenMeta) return {};
    return projectData.screenMeta[name] || {};
  }

  function serialize() {
    projectData.modifiedAt = new Date().toISOString();
    projectData.tags = TagManager.getTags();
    projectData.activeScreen = currentScreenName;
    if (typeof window !== 'undefined' && window.coreState) {
      projectData.projectLocation = window.coreState.projectLocation || '';
      projectData.coreControl = {
        activeDomain: window.coreState.activeDomain || 'ui',
        openTabs: Array.isArray(window.coreState.openTabs) ? [...window.coreState.openTabs] : [],
        activeBlock: window.coreState.activeBlock || null,
        blocks: JSON.parse(JSON.stringify(window.coreState.blocks || []))
      };
    }
    return JSON.parse(JSON.stringify(projectData));
  }

  function deserialize(data) {
    if (!data) return false;
    projectData.name = data.name || 'Untitled';
    projectData.author = data.author || '';
    projectData.comment = data.comment || '';
    projectData.plcBrand = data.plcBrand || 'MELSEC';
    projectData.resolution = data.resolution || { w: 1280, h: 800 };
    projectData.screens = data.screens || {};
    projectData.screenMeta = data.screenMeta || {};
    projectData.startupScreen = data.startupScreen || null;
    projectData.openTabs = Array.isArray(data.openTabs) ? data.openTabs : [];
    projectData.activeScreen = data.activeScreen || null;
    projectData.alarms = data.alarms || [];
    projectData.driverConfig = {
      driver: 'MELSEC MC Protocol',
      driverId: 'melsec_mc',
      transport: 'TCP',
      address: '192.168.1.10',
      port: 5000,
      unitId: 1,
      comPort: 'COM1',
      baudRate: 9600,
      pollRate: 250,
      testAddress: '',
      testValue: '',
      autoConnect: false,
      ...(data.driverConfig || {})
    };
    projectData.createdAt = data.createdAt || new Date().toISOString();
    projectData.modifiedAt = data.modifiedAt || new Date().toISOString();
    projectData.version = data.version || '1.0.0';
    projectData.projectLocation = data.projectLocation || '';
    projectData.coreControl = data.coreControl || null;

    if (Array.isArray(data.tags)) {
      TagManager.setTags(data.tags);
    }
    if (typeof window !== 'undefined' && window.coreState) {
      if (data.projectLocation) {
        window.coreState.projectLocation = data.projectLocation;
        const locStatus = document.getElementById('status-location');
        if (locStatus) locStatus.textContent = 'Location: ' + data.projectLocation;
      }
      if (data.coreControl && Array.isArray(data.coreControl.blocks) && data.coreControl.blocks.length > 0) {
        window.coreState.blocks = JSON.parse(JSON.stringify(data.coreControl.blocks));
        window.coreState.openTabs = Array.isArray(data.coreControl.openTabs) ? [...data.coreControl.openTabs] : ['Main_Cycle'];
        window.coreState.activeBlock = data.coreControl.activeBlock || window.coreState.openTabs[0] || null;
      }
      const plcPill = document.getElementById('core-plc-pill');
      if (plcPill) plcPill.textContent = projectData.plcBrand;
      if (typeof window.renderCoreAll === 'function') {
        window.renderCoreAll();
      }
    }
    isDirty = false;
    return true;
  }

  return {
    initNew,
    getProject,
    setFilePath,
    getFilePath,
    getCurrentScreen,
    setCurrentScreen,
    getOpenTabs: () => projectData.openTabs || [],
    setOpenTabs: (tabs) => { projectData.openTabs = Array.isArray(tabs) ? [...tabs] : []; },
    saveScreenObjects,
    getScreenObjects,
    removeScreen,
    renameScreen,
    duplicateScreen,
    setStartupScreen,
    getStartupScreen,
    setDriverConfig,
    getDriverConfig,
    setScreenMeta,
    getScreenMeta,
    serialize,
    deserialize,
    isDirty: () => isDirty,
    markClean: () => { isDirty = false; }
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProjectModel;
}

