/**
 * HMI Designer Studio - Project Validator & Diagnostics Engine
 * Verifies screen integrity, address mapping, and navigation links
 */

const ProjectValidator = (function() {
  function validate(project) {
    const errors = [];
    const warnings = [];

    if (!project) {
      errors.push('Project data is missing or empty.');
      return { valid: false, errors, warnings };
    }

    if (!project.name || project.name.trim() === '') {
      warnings.push('Project name is empty. Defaulting to "MyProject".');
    }

    const screenNames = Object.keys(project.screens || {});
    if (screenNames.length === 0) {
      errors.push('Project contains no screens. At least one Base screen is required.');
    }

    // Check each screen and object
    screenNames.forEach(screenName => {
      const objects = project.screens[screenName] || [];

      objects.forEach((obj, idx) => {
        const objLabel = `Screen '${screenName}' -> Object #${idx + 1} (${obj.type || 'Widget'})`;

        // Check dimensions
        if (!obj.width || obj.width <= 0 || !obj.height || obj.height <= 0) {
          warnings.push(`${objLabel} has invalid dimensions (${obj.width}x${obj.height}).`);
        }

        // Check device address
        const tagOrAddr = obj.tag || obj.device;
        const cat = WidgetRegistry.getCategory(obj.type);
        if (['switch', 'lamp', 'numeric', 'graph'].includes(cat)) {
          if (!tagOrAddr || tagOrAddr.trim() === '') {
            warnings.push(`${objLabel} has no PLC tag or device address assigned.`);
          } else {
            const addrCheck = TagManager.validateAddress(tagOrAddr);
            if (!addrCheck.valid) {
              errors.push(`${objLabel}: ${addrCheck.error || 'Invalid device address'}`);
            }
          }
        }

        // Check screen navigation target
        if (obj.type === 'Screen Navigation' || obj.action === 'Navigate') {
          const target = obj.navTarget || obj.text;
          if (target && !screenNames.includes(target) && target !== 'Return' && target !== 'Previous') {
            errors.push(`${objLabel}: Navigation target screen '${target}' does not exist.`);
          }
        }
      });
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      screenCount: screenNames.length,
      objectCount: screenNames.reduce((acc, s) => acc + (project.screens[s] || []).length, 0)
    };
  }

  return {
    validate
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProjectValidator;
}

