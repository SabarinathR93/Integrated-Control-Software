/**
 * HMI Designer Studio - .PRJR Compiler Engine
 * Prepares, strips, optimizes, and compiles project into .prjr runtime package
 */

const PrjrCompiler = (function() {
  /**
   * Compiles the project and requests Electron IPC to produce the encrypted .prjr file.
   * @param {object} projectData
   * @returns {Promise<{ success: boolean, path?: string, error?: string, diagnostics: object }>}
   */
  async function compileProject(projectData) {
    const diagnostics = ProjectValidator.validate(projectData);

    if (!diagnostics.valid) {
      return {
        success: false,
        error: `Validation failed with ${diagnostics.errors.length} error(s). Please fix before compiling.`,
        diagnostics
      };
    }

    // Prepare minified runtime package payload (strip editor-only metadata)
    const runtimeScreens = {};
    for (const [screenName, objects] of Object.entries(projectData.screens || {})) {
      runtimeScreens[screenName] = objects.map(o => ({
        type: o.type,
        action: o.action,
        style: o.style,
        tag: o.tag || o.device,
        min: o.min,
        max: o.max,
        dec: o.dec,
        on: o.colorOn,
        off: o.colorOff,
        text: o.text,
        left: o.left,
        top: o.top,
        width: o.width,
        height: o.height,
        bg: o.bg,
        fg: o.fg,
        navTarget: o.navTarget
      }));
    }

    const compiledPayload = {
      header: {
        format: 'PRJR',
        version: '1.0.0',
        compiler: 'HMI Designer Studio v1.0',
        compiledAt: new Date().toISOString(),
        projectName: projectData.name,
        resolution: projectData.resolution
      },
      screens: runtimeScreens,
      tags: projectData.tags || [],
      alarms: projectData.alarms || [],
      driverConfig: projectData.driverConfig || { driver: 'MELSEC MC Protocol' }
    };

    if (window.electronAPI && window.electronAPI.compileProject) {
      const result = await window.electronAPI.compileProject({
        projectName: (projectData.name || 'MyProject') + '.prjr',
        compiledData: compiledPayload
      });
      return {
        ...result,
        diagnostics
      };
    } else {
      return {
        success: false,
        error: 'Electron API is not available.',
        diagnostics
      };
    }
  }

  return {
    compileProject
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PrjrCompiler;
}

