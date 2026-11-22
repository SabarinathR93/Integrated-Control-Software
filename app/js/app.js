/**
 * HMI Designer Studio - Main Application Controller
 * Orchestrates canvas, tools, menus, compiler, and project lifecycle
 */

document.addEventListener('DOMContentLoaded', () => {
  const canvasInner = document.getElementById('canvas-inner');
  const canvasEl = document.getElementById('canvas');
  const launcherOverlay = document.querySelector('.overlay');
  const designerPage = document.getElementById('designer-page');
  const canvasTitle = document.getElementById('canvas-title');
  const statusProject = document.getElementById('status-project');
  const statusConn = document.getElementById('status-conn');

  let screenCounts = { Base: 0, Popup: 0 };
  let clipboard = null;

  // Zoom display element
  const zoomBadge = document.getElementById('zoom-level-badge');
  function onZoomChanged(lvl) {
    if (zoomBadge) zoomBadge.textContent = `${Math.round(lvl * 100)}%`;
    const statusZoom = document.getElementById('status-zoom');
    if (statusZoom) statusZoom.textContent = `Zoom: ${Math.round(lvl * 100)}%`;
  }

  // Initialize Canvas CAD Engine with Zoom & Double-Click Callbacks
  CanvasEngine.init(canvasInner, canvasEl, onObjectSelected, onZoomChanged, openObjectPropertiesDialog);

  // Dedicated CAD Zoom Toolbar Controls
  const btnZoomIn = document.getElementById('btn-zoom-in');
  if (btnZoomIn) {
    btnZoomIn.addEventListener('click', () => {
      CanvasEngine.zoomAround(CanvasEngine.getZoom() + 0.15);
    });
  }

  const btnZoomOut = document.getElementById('btn-zoom-out');
  if (btnZoomOut) {
    btnZoomOut.addEventListener('click', () => {
      CanvasEngine.zoomAround(CanvasEngine.getZoom() - 0.15);
    });
  }

  if (zoomBadge) {
    zoomBadge.addEventListener('click', () => {
      CanvasEngine.setZoom(1.0, true);
    });
  }

  const btnZoomFit = document.getElementById('btn-zoom-fit');
  if (btnZoomFit) {
    btnZoomFit.addEventListener('click', () => {
      CanvasEngine.zoomToFit();
    });
  }

  // --- Object Selection & Double-Click Properties Dialog Popup ---
  function onObjectSelected(obj) {
    const toolHint = document.getElementById('tool-hint');
    if (!obj) {
      if (toolHint) toolHint.textContent = '';
      return;
    }
    const type = obj.getAttribute('data-type') || 'Object';
    const tag = obj.getAttribute('data-tag') || '';
    if (toolHint) {
      toolHint.textContent = `Selected: ${type} ${tag ? '(' + tag + ')' : ''} · Double-click to configure`;
    }
  }

  // Opens the dedicated Object Properties Modal dialog
  function openObjectPropertiesDialog(obj) {
    if (!obj) return;
    CanvasEngine.selectObject(obj);
    ModalManager.showObjectPropertiesModal(obj, (updatedObj) => {
      const cfg = getObjectConfig(updatedObj);
      WidgetRegistry.renderWidgetContent(updatedObj, cfg);
      UndoRedoManager.push({ type: 'edit', element: updatedObj });
      const curScreen = ProjectModel.getCurrentScreen();
      if (curScreen) {
        ProjectModel.saveScreenObjects(curScreen, captureCurrentScreenObjects());
      }
    });
  }

  // Double-click on any object in canvas pops up dedicated Object Properties Dialog
  canvasInner.addEventListener('dblclick', (e) => {
    const obj = e.target.closest('.obj');
    if (obj) {
      e.preventDefault();
      e.stopPropagation();
      openObjectPropertiesDialog(obj);
    }
  });

  // Enter key opens properties dialog for currently selected object
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      const sel = CanvasEngine.getSelected();
      if (sel) {
        e.preventDefault();
        openObjectPropertiesDialog(sel);
      }
    }
  });

  function getObjectConfig(el) {
    return {
      type: el.getAttribute('data-type') || 'Object',
      action: el.getAttribute('data-action') || '',
      style: el.getAttribute('data-style') || '',
      tag: el.getAttribute('data-tag') || '',
      device: el.getAttribute('data-tag') || '',
      text: el.getAttribute('data-text') || el.textContent || '',
      left: Math.round(parseFloat(el.style.left) || 0),
      top: Math.round(parseFloat(el.style.top) || 0),
      width: Math.round(el.offsetWidth || 100),
      height: Math.round(el.offsetHeight || 50),
      min: el.getAttribute('data-min') || '0',
      max: el.getAttribute('data-max') || '100',
      dec: el.getAttribute('data-dec') || '0',
      colorOn: el.getAttribute('data-on') || '#22A06B',
      colorOff: el.getAttribute('data-off') || '#9AA0A6',
      bg: el.style.backgroundColor || '#FFF',
      fg: el.style.color || '#000',
      navTarget: el.getAttribute('data-nav') || ''
    };
  }

  function captureCurrentScreenObjects() {
    const list = [];
    canvasInner.querySelectorAll('.obj').forEach(el => {
      list.push(getObjectConfig(el));
    });
    return list;
  }

  // --- Auto-Save & Workspace Session Engine ---
  const AutoSaveEngine = {
    timer: null,
    trigger() {
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.saveSession();
      }, 300);
    },
    saveSession() {
      try {
        const cur = ProjectModel.getCurrentScreen();
        if (cur) {
          ProjectModel.saveScreenObjects(cur, captureCurrentScreenObjects());
        }
        const proj = ProjectModel.serialize();
        proj.openTabs = [...openTabs];
        proj.activeScreen = cur;
        proj.filePath = ProjectModel.getFilePath();
        proj.dockLayout = (typeof DockingManager !== 'undefined') ? DockingManager.getLayout() : null;
        localStorage.setItem('hmi_autosave_session', JSON.stringify(proj));
        this.updateRecentProjects(ProjectModel.getFilePath(), proj.name);
      } catch (err) {
        console.warn('AutoSave session error:', err);
      }
    },
    getSession() {
      try {
        const str = localStorage.getItem('hmi_autosave_session');
        if (!str) return null;
        const data = JSON.parse(str);
        if (data && data.screens && Object.keys(data.screens).length > 0) {
          return data;
        }
      } catch (_) {}
      return null;
    },
    clearSession() {
      try {
        localStorage.removeItem('hmi_autosave_session');
      } catch (_) {}
    },
    updateRecentProjects(path, name) {
      if (!path) return;
      try {
        let recents = JSON.parse(localStorage.getItem('hmi_recent_projects') || '[]');
        recents = recents.filter(r => r.path !== path);
        recents.unshift({
          path,
          name: name || path.split(/[\\/]/).pop(),
          time: new Date().toISOString()
        });
        if (recents.length > 5) recents = recents.slice(0, 5);
        localStorage.setItem('hmi_recent_projects', JSON.stringify(recents));
      } catch (_) {}
    },
    renderRecentProjects() {
      const box = document.getElementById('launcher-recent-box');
      const container = document.getElementById('launcher-recent-items');
      if (!box || !container) return;
      try {
        const recents = JSON.parse(localStorage.getItem('hmi_recent_projects') || '[]');
        if (recents.length === 0) {
          box.style.display = 'none';
          return;
        }
        box.style.display = 'block';
        container.innerHTML = '';
        recents.forEach(r => {
          const item = document.createElement('div');
          item.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:#FFF;border:1px solid #E2E8F0;border-radius:4px;cursor:pointer;font-size:12px';
          item.innerHTML = `
            <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-right:8px">
              <span style="font-weight:700;color:#0F172A">${r.name}</span>
              <span style="font-size:10px;color:#64748B;margin-left:6px">${r.path}</span>
            </div>
            <span style="font-size:11px;color:#0284C7;font-weight:700;flex-shrink:0">Open →</span>
          `;
          item.addEventListener('click', () => {
            openProjectAction(r.path);
          });
          container.appendChild(item);
        });
      } catch (_) {
        box.style.display = 'none';
      }
    }
  };

  function triggerAutoSave() {
    AutoSaveEngine.trigger();
  }

  window.addEventListener('beforeunload', () => {
    AutoSaveEngine.saveSession();
  });

  // --- Chrome-Style Screen Tabs Manager ---
  let openTabs = [];

  function renderTabs() {
    const listEl = document.getElementById('screen-tabs-list');
    if (!listEl) return;

    const current = ProjectModel.getCurrentScreen();
    listEl.innerHTML = '';

    openTabs.forEach(sName => {
      const isActive = (sName === current);
      const tabEl = document.createElement('div');
      tabEl.className = `screen-tab ${isActive ? 'active' : ''}`;
      tabEl.setAttribute('data-screen', sName);
      tabEl.title = sName;

      tabEl.innerHTML = `
        <span class="tab-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        </span>
        <span class="tab-title">${sName}</span>
        <button class="tab-close-btn" title="Close Tab (Ctrl+W)">✕</button>
      `;

      // Tab click -> switch to screen
      tabEl.addEventListener('click', (e) => {
        if (e.target.closest('.tab-close-btn')) return;
        const target = tabEl.getAttribute('data-screen');
        if (ProjectModel.getCurrentScreen() !== target) {
          renderScreen(target);
        }
      });

      // Double-click tab title -> quick rename
      const titleSpan = tabEl.querySelector('.tab-title');
      if (titleSpan) {
        titleSpan.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          const target = tabEl.getAttribute('data-screen');
          if (ModalManager && ModalManager.showRenameScreenModal) {
            ModalManager.showRenameScreenModal(target, (newName) => {
              renameScreenAction(target, newName);
            });
          }
        });
      }

      // Close tab button click
      const closeBtn = tabEl.querySelector('.tab-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const target = tabEl.getAttribute('data-screen');
          closeScreenTab(target);
        });
      }

      // Middle-click to close tab (standard Chrome behavior)
      tabEl.addEventListener('auxclick', (e) => {
        if (e.button === 1) {
          e.preventDefault();
          const target = tabEl.getAttribute('data-screen');
          closeScreenTab(target);
        }
      });

      // Right-click context menu on tab
      tabEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const target = tabEl.getAttribute('data-screen');
        const item = document.querySelector(`.tree-item[data-name="${target}"]`);
        const type = item ? (item.getAttribute('data-type') || 'Base') : (target.startsWith('Popup') ? 'Popup' : 'Base');
        openScreenContextMenu(e.clientX, e.clientY, target, type);
      });

      listEl.appendChild(tabEl);
    });

    // Scroll active tab into view
    const activeTab = listEl.querySelector('.screen-tab.active');
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }

  function openScreenTab(screenName) {
    if (!screenName) return;
    if (!openTabs.includes(screenName)) {
      openTabs.push(screenName);
    }
    renderTabs();
    triggerAutoSave();
  }

  function showEmptyWorkspaceState() {
    ProjectModel.setCurrentScreen(null);
    if (canvasTitle) canvasTitle.textContent = 'No screen selected';
    if (canvasInner) {
      canvasInner.style.display = 'none';
      canvasInner.innerHTML = '';
    }
    const canvasStage = document.getElementById('canvas-stage');
    if (canvasStage) {
      canvasStage.style.display = 'none';
    }
    const emptyWs = document.getElementById('canvas-empty-workspace');
    if (emptyWs) {
      emptyWs.style.display = 'flex';
    }
    const canvasSizeEl = document.getElementById('canvas-size');
    if (canvasSizeEl) canvasSizeEl.textContent = 'No Screen Open';
    const alignBar = document.getElementById('canvas-align-bar');
    if (alignBar) {
      alignBar.style.opacity = '0.35';
      alignBar.style.pointerEvents = 'none';
    }
    const toolHint = document.getElementById('tool-hint');
    if (toolHint) toolHint.textContent = '';

    CanvasEngine.clearSelection();
    renderTabs();
    document.querySelectorAll('.tree-item').forEach(item => item.classList.remove('active'));
    triggerAutoSave();
  }

  function closeScreenTab(screenName) {
    const idx = openTabs.indexOf(screenName);
    if (idx === -1) return;

    const isActive = (ProjectModel.getCurrentScreen() === screenName);
    openTabs.splice(idx, 1);

    if (isActive) {
      if (openTabs.length > 0) {
        const nextIdx = Math.min(idx, openTabs.length - 1);
        renderScreen(openTabs[nextIdx]);
      } else {
        const current = ProjectModel.getCurrentScreen();
        if (current) {
          ProjectModel.saveScreenObjects(current, captureCurrentScreenObjects());
        }
        showEmptyWorkspaceState();
      }
    } else {
      if (openTabs.length === 0) {
        showEmptyWorkspaceState();
      } else {
        renderTabs();
      }
    }
    triggerAutoSave();
  }

  function renameScreenInTabs(oldName, newName) {
    let changed = false;
    openTabs = openTabs.map(t => {
      if (t === oldName) {
        changed = true;
        return newName;
      }
      return t;
    });
    if (changed) {
      renderTabs();
      triggerAutoSave();
    }
  }

  function removeScreenFromTabs(screenName) {
    closeScreenTab(screenName);
  }

  function renderScreen(screenName) {
    if (!screenName) {
      showEmptyWorkspaceState();
      return;
    }
    const current = ProjectModel.getCurrentScreen();
    if (current && current !== screenName) {
      ProjectModel.saveScreenObjects(current, captureCurrentScreenObjects());
    }

    if (canvasInner) canvasInner.style.display = 'block';
    const canvasStage = document.getElementById('canvas-stage');
    if (canvasStage) canvasStage.style.display = 'flex';
    const emptyWs = document.getElementById('canvas-empty-workspace');
    if (emptyWs) emptyWs.style.display = 'none';

    const alignBar = document.getElementById('canvas-align-bar');
    if (alignBar) {
      alignBar.style.opacity = '1';
      alignBar.style.pointerEvents = 'auto';
    }

    const proj = ProjectModel.getProject();
    const res = proj.resolution || { w: 1280, h: 800 };
    canvasInner.style.width = res.w + 'px';
    canvasInner.style.height = res.h + 'px';
    const canvasSizeEl = document.getElementById('canvas-size');
    if (canvasSizeEl) canvasSizeEl.textContent = `Screen: ${res.w} × ${res.h}`;

    ProjectModel.setCurrentScreen(screenName);
    if (canvasTitle) canvasTitle.textContent = screenName;
    canvasInner.innerHTML = '';
    CanvasEngine.clearSelection();

    const meta = ProjectModel.getScreenMeta(screenName);
    canvasInner.style.background = meta.bgColor || '#FFFFFF';

    const objects = ProjectModel.getScreenObjects(screenName);
    if (!objects || objects.length === 0) {
      canvasInner.innerHTML = `<div class="canvas-empty">Editing: ${screenName} — select an object from the Tools palette on the right</div>`;
    } else {
      objects.forEach(cfg => {
        createWidgetElement(cfg);
      });
    }

    // Ensure tab is open and displayed as active
    openScreenTab(screenName);

    // Update screen tree item active state
    document.querySelectorAll('.tree-item').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-name') === screenName);
    });
    triggerAutoSave();
  }

  function createWidgetElement(cfg) {
    const emptyNotice = canvasInner.querySelector('.canvas-empty');
    if (emptyNotice) emptyNotice.remove();

    const el = document.createElement('div');
    el.className = 'obj';
    WidgetRegistry.renderWidgetContent(el, cfg);
    CanvasEngine.makeDraggable(el);
    canvasInner.appendChild(el);
    return el;
  }

  // --- Screen Tree Management & Clipboard Engine ---
  let screenClipboard = null;
  let activeContextScreen = null;
  let activeContextType = null;

  function updateStartupBadges() {
    const startup = ProjectModel.getStartupScreen();
    document.querySelectorAll('.tree-item').forEach(item => {
      const sName = item.getAttribute('data-name');
      const badge = item.querySelector('.badge-startup');
      if (sName === startup) {
        if (!badge) {
          const b = document.createElement('span');
          b.className = 'badge-startup';
          b.title = 'Project Startup Screen';
          b.textContent = '🏠';
          const tdel = item.querySelector('.tdel');
          if (tdel) item.insertBefore(b, tdel);
          else item.appendChild(b);
        }
      } else {
        if (badge) badge.remove();
      }
    });
  }

  function createTreeItem(screenName, type = 'Base') {
    const isStartup = (ProjectModel.getStartupScreen() === screenName);
    const item = document.createElement('div');
    item.className = 'tree-item';
    item.setAttribute('data-name', screenName);
    item.setAttribute('data-type', type);
    item.innerHTML = `
      <span>▸</span>
      <span class="screen-label">${screenName}</span>
      ${isStartup ? '<span class="badge-startup" title="Project Startup Screen">🏠</span>' : ''}
      <a href="#" class="tdel" title="Delete Screen">✕</a>
    `;

    // Click handler - dynamically fetch latest screen name
    item.addEventListener('click', (e) => {
      const curName = item.getAttribute('data-name') || screenName;
      if (e.target.classList.contains('tdel')) {
        e.stopPropagation();
        deleteScreenAction(curName, item);
        return;
      }
      if (item.classList.contains('editing')) return;
      renderScreen(curName);
    });

    // Double-click on screen label triggers inline rename
    const labelEl = item.querySelector('.screen-label');
    if (labelEl) {
      labelEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const curName = item.getAttribute('data-name') || screenName;
        startInlineRename(item, labelEl, curName);
      });
    }

    // Right-click context menu - dynamically fetch latest screen name and type
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const curName = item.getAttribute('data-name') || screenName;
      const curType = item.getAttribute('data-type') || type;
      openScreenContextMenu(e.clientX, e.clientY, curName, curType);
    });

    return item;
  }

  function startInlineRename(item, labelEl, currentName) {
    if (item.classList.contains('editing')) return;
    item.classList.add('editing');

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'screen-inline-input';
    input.value = currentName;
    labelEl.style.display = 'none';
    item.insertBefore(input, labelEl);
    input.focus();
    input.select();

    function commit() {
      const newName = input.value.trim();
      input.remove();
      labelEl.style.display = '';
      item.classList.remove('editing');

      if (newName && newName !== currentName) {
        if (/[\\/:*?"<>|]/.test(newName)) {
          alert('Screen name cannot contain illegal characters (/ \\ : * ? " < > |).');
          return;
        }
        const screens = ProjectModel.getProject().screens || {};
        if (screens[newName]) {
          alert(`A screen named '${newName}' already exists.`);
          return;
        }
        renameScreenAction(currentName, newName);
      }
    }

    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        commit();
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        input.remove();
        labelEl.style.display = '';
        item.classList.remove('editing');
      }
    });

    input.addEventListener('blur', () => {
      commit();
    });
  }

  function renameScreenAction(oldName, newName) {
    if (!oldName || !newName || oldName === newName) return;
    const ok = ProjectModel.renameScreen(oldName, newName);
    if (!ok) return;

    renameScreenInTabs(oldName, newName);

    let item = null;
    try {
      item = document.querySelector(`.tree-item[data-name="${CSS.escape(oldName)}"]`);
    } catch (_) {
      item = Array.from(document.querySelectorAll('.tree-item')).find(el => el.getAttribute('data-name') === oldName);
    }
    if (item) {
      item.setAttribute('data-name', newName);
      const lbl = item.querySelector('.screen-label');
      if (lbl) lbl.textContent = newName;
    }

    if (ProjectModel.getCurrentScreen() === newName) {
      if (canvasTitle) canvasTitle.textContent = newName;
      const emptyNotice = canvasInner.querySelector('.canvas-empty');
      if (emptyNotice) {
        emptyNotice.textContent = `Editing: ${newName} — select an object from the Tools palette on the right`;
      }
    }

    updateStartupBadges();
    triggerAutoSave();
  }

  function duplicateScreenAction(sourceName) {
    const screens = ProjectModel.getProject().screens || {};
    let base = `${sourceName}_Copy`;
    let unique = base;
    let n = 1;
    while (screens[unique]) {
      unique = `${base}_${n++}`;
    }

    const item = document.querySelector(`.tree-item[data-name="${sourceName}"]`);
    const type = item ? (item.getAttribute('data-type') || 'Base') : (sourceName.startsWith('Popup') ? 'Popup' : 'Base');
    ProjectModel.duplicateScreen(sourceName, unique);

    const container = document.querySelector(`.tree-items[data-items="${type}"]`) || document.querySelector(`.tree-items[data-items="Base"]`);
    if (container) {
      const newItem = createTreeItem(unique, type);
      container.appendChild(newItem);
    }
    renderScreen(unique);
    triggerAutoSave();
  }

  function copyScreenAction(screenName) {
    document.querySelectorAll('.tree-item.cut-state').forEach(el => el.classList.remove('cut-state'));
    const item = document.querySelector(`.tree-item[data-name="${screenName}"]`);
    const type = item ? (item.getAttribute('data-type') || 'Base') : 'Base';

    screenClipboard = {
      op: 'copy',
      screenName,
      type,
      objects: JSON.parse(JSON.stringify(ProjectModel.getScreenObjects(screenName))),
      meta: JSON.parse(JSON.stringify(ProjectModel.getScreenMeta(screenName)))
    };
  }

  function cutScreenAction(screenName) {
    document.querySelectorAll('.tree-item.cut-state').forEach(el => el.classList.remove('cut-state'));
    const item = document.querySelector(`.tree-item[data-name="${screenName}"]`);
    const type = item ? (item.getAttribute('data-type') || 'Base') : 'Base';
    if (item) item.classList.add('cut-state');

    screenClipboard = {
      op: 'cut',
      screenName,
      type,
      objects: JSON.parse(JSON.stringify(ProjectModel.getScreenObjects(screenName))),
      meta: JSON.parse(JSON.stringify(ProjectModel.getScreenMeta(screenName)))
    };
  }

  function pasteScreenAction(targetType = null) {
    if (!screenClipboard) return;
    const screens = ProjectModel.getProject().screens || {};
    let type = targetType || screenClipboard.type || 'Base';
    if (type !== 'Base' && type !== 'Popup') type = 'Base';

    let base = `${screenClipboard.screenName}_Copy`;
    let unique = base;
    let n = 1;
    while (screens[unique]) {
      unique = `${screenClipboard.screenName}_Copy${n++}`;
    }

    ProjectModel.saveScreenObjects(unique, JSON.parse(JSON.stringify(screenClipboard.objects)));
    ProjectModel.setScreenMeta(unique, JSON.parse(JSON.stringify(screenClipboard.meta)));

    if (screenClipboard.op === 'cut') {
      ProjectModel.removeScreen(screenClipboard.screenName);
      const oldItem = document.querySelector(`.tree-item[data-name="${screenClipboard.screenName}"]`);
      if (oldItem) oldItem.remove();
      screenClipboard = null;
    }

    const container = document.querySelector(`.tree-items[data-items="${type}"]`) || document.querySelector(`.tree-items[data-items="Base"]`);
    if (container) {
      const newItem = createTreeItem(unique, type);
      container.appendChild(newItem);
    }
    renderScreen(unique);
  }

  function deleteScreenAction(screenName, item) {
    if (confirm(`Delete screen '${screenName}'?`)) {
      ProjectModel.removeScreen(screenName);
      removeScreenFromTabs(screenName);
      if (item) item.remove();
      else {
        const found = document.querySelector(`.tree-item[data-name="${screenName}"]`);
        if (found) found.remove();
      }
      if (ProjectModel.getCurrentScreen() === screenName) {
        const remaining = Object.keys(ProjectModel.getProject().screens || {});
        if (remaining.length && openTabs.length) {
          renderScreen(openTabs[0]);
        } else if (remaining.length) {
          renderScreen(remaining[0]);
        } else {
          showEmptyWorkspaceState();
        }
      }
      updateStartupBadges();
      triggerAutoSave();
    }
  }

  function exportScreenAction(screenName) {
    const screenData = {
      type: 'HMI_SCREEN',
      version: '1.0.0',
      screenName,
      objects: ProjectModel.getScreenObjects(screenName),
      meta: ProjectModel.getScreenMeta(screenName),
      exportedAt: new Date().toISOString()
    };
    const jsonStr = JSON.stringify(screenData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${screenName}.hmiscreen`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function openScreenContextMenu(x, y, screenName, type) {
    activeContextScreen = screenName;
    activeContextType = type;

    const menu = document.getElementById('screen-ctx-menu');
    if (!menu) return;

    const pasteItem = document.getElementById('ctx-item-paste');
    if (pasteItem) {
      pasteItem.classList.toggle('disabled', !screenClipboard);
    }

    menu.style.display = 'block';
    const menuW = menu.offsetWidth || 220;
    const menuH = menu.offsetHeight || 260;
    const posX = (x + menuW > window.innerWidth) ? (x - menuW) : x;
    const posY = (y + menuH > window.innerHeight) ? (y - menuH) : y;
    menu.style.left = posX + 'px';
    menu.style.top = posY + 'px';
  }

  function addScreen(type = 'Base', customName = null) {
    if (type !== 'Base' && type !== 'Popup') type = 'Base';
    let screenName;
    if (customName && customName.trim()) {
      screenName = customName.trim();
    } else {
      screenCounts[type] = (screenCounts[type] || 0) + 1;
      screenName = `${type}_Screen_${screenCounts[type]}`;
    }
    const screens = ProjectModel.getProject().screens || {};
    let unique = screenName;
    let n = 1;
    while (screens[unique]) {
      unique = `${screenName}_${n++}`;
    }
    screenName = unique;
    ProjectModel.saveScreenObjects(screenName, []);
    ProjectModel.setScreenMeta(screenName, { type });

    const container = document.querySelector(`.tree-items[data-items="${type}"]`) || document.querySelector(`.tree-items[data-items="Base"]`);
    if (container) {
      const item = createTreeItem(screenName, type);
      container.appendChild(item);
      renderScreen(screenName);
    }
    triggerAutoSave();
    return screenName;
  }

  // --- Project Launcher & New / Open / Save ---
  function showLauncher(viewId = 'main') {
    if (launcherOverlay) {
      launcherOverlay.style.display = 'flex';
      launcherOverlay.querySelectorAll('.view').forEach(v => v.style.display = 'none');
      const target = document.getElementById(viewId);
      if (target) target.style.display = 'block';
    }
    if (typeof AutoSaveEngine !== 'undefined') {
      AutoSaveEngine.renderRecentProjects();
      const session = AutoSaveEngine.getSession();
      const sessionBox = document.getElementById('launcher-session-box');
      if (sessionBox) {
        if (session && session.screens && Object.keys(session.screens).length > 0) {
          sessionBox.style.display = 'block';
          const titleEl = document.getElementById('launcher-session-title');
          const detailEl = document.getElementById('launcher-session-detail');
          if (titleEl) titleEl.textContent = session.name || 'Untitled';
          if (detailEl) detailEl.textContent = `Active Screen: ${session.activeScreen || Object.keys(session.screens)[0]} (${Object.keys(session.screens).length} screens)`;
        } else {
          sessionBox.style.display = 'none';
        }
      }
    }
  }

  function hideLauncher() {
    if (launcherOverlay) launcherOverlay.style.display = 'none';
    if (designerPage) designerPage.style.display = 'flex';
  }

  // Create Project Button (Clean, zero templates)
  const btnCreateProject = document.getElementById('create-project');
  if (btnCreateProject) {
    btnCreateProject.addEventListener('click', (e) => {
      e.preventDefault();
      const name = document.getElementById('pname').value.trim() || 'MyProject';
      const author = document.getElementById('pauthor').value.trim() || '';
      const comment = document.getElementById('pcomment').value.trim() || '';
      const plcBrand = document.getElementById('pplc') ? document.getElementById('pplc').value : 'MELSEC';
      const firstScreenInp = document.getElementById('pfirstscreen');
      const firstScreenName = (firstScreenInp && firstScreenInp.value.trim()) ? firstScreenInp.value.trim() : 'Home Screen';
      const resVal = document.getElementById('pres').value.split('x');
      const w = parseInt(resVal[0], 10), h = parseInt(resVal[1], 10);

      ProjectModel.initNew(name, author, comment, w, h, plcBrand);
      canvasInner.style.width = w + 'px';
      canvasInner.style.height = h + 'px';
      document.getElementById('canvas-size').textContent = `Screen: ${w} × ${h}`;
      statusProject.textContent = `Project: ${name} [${plcBrand}]`;
      if (statusConn) statusConn.textContent = `${plcBrand} / Universal Ready`;

      // Reset screen tree
      document.querySelectorAll('.tree-items').forEach(el => el.innerHTML = '');
      screenCounts = { Base: 0, Popup: 0 };
      openTabs = [];

      // Initialize with startup screen name (e.g. Home Screen)
      addScreen('Base', firstScreenName);
      ProjectModel.setStartupScreen(firstScreenName);
      updateStartupBadges();

      hideLauncher();
      CanvasEngine.zoomToFit();
      triggerAutoSave();
    });
  }

  // Save Project (.hmiproj)
  async function saveProjectAction(isSaveAs = false) {
    const curScreen = ProjectModel.getCurrentScreen();
    if (curScreen) {
      ProjectModel.saveScreenObjects(curScreen, captureCurrentScreenObjects());
    }

    const projectData = ProjectModel.serialize();
    projectData.openTabs = [...openTabs];
    projectData.activeScreen = ProjectModel.getCurrentScreen();
    if (typeof DockingManager !== 'undefined') {
      projectData.dockLayout = DockingManager.getLayout();
    }

    const currentPath = ProjectModel.getFilePath();
    const defaultName = (projectData.name || 'MyProject') + '.hmiproj';

    if (!window.electronAPI || !window.electronAPI.saveProject) {
      alert('Save Project is only supported within Electron.');
      return;
    }

    const payload = {
      projectName: currentPath && !isSaveAs ? currentPath : defaultName,
      projectData: projectData
    };

    const res = isSaveAs || !currentPath
      ? await window.electronAPI.saveProjectAs(payload)
      : await window.electronAPI.saveProject(payload);

    if (res.success) {
      ProjectModel.setFilePath(res.path);
      ProjectModel.markClean();
      statusProject.textContent = `Project: ${res.path.split(/[\\/]/).pop()}`;
      AutoSaveEngine.updateRecentProjects(res.path, projectData.name);
      AutoSaveEngine.saveSession();
      ModalManager.showModal('Project Saved', `<p>Project saved successfully to:</p><code style="font-size:11px;background:#EEE;padding:4px">${res.path}</code>`);
    } else if (!res.canceled) {
      ModalManager.showModal('Save Error', `<p style="color:#D9261C">${res.error || 'Failed to save project'}</p>`);
    }
  }

  // Open Project (.hmiproj)
  async function openProjectAction(filePath = null) {
    if (!window.electronAPI || !window.electronAPI.openProject) return;

    const res = await window.electronAPI.openProject(filePath ? { filePath } : undefined);
    if (res.success && res.data) {
      loadProjectData(res.data, res.path);
      hideLauncher();
    } else if (!res.canceled && res.error) {
      ModalManager.showModal('Open Error', `<p style="color:#D9261C">${res.error}</p>`);
    }
  }

  function loadProjectData(data, path) {
    ProjectModel.deserialize(data);
    ProjectModel.setFilePath(path);
    statusProject.textContent = `Project: ${path ? path.split(/[\\/]/).pop() : data.name}`;

    const res = data.resolution || { w: 1280, h: 800 };
    canvasInner.style.width = res.w + 'px';
    canvasInner.style.height = res.h + 'px';
    document.getElementById('canvas-size').textContent = `Screen: ${res.w} × ${res.h}`;

    // Rebuild tree
    document.querySelectorAll('.tree-items').forEach(el => el.innerHTML = '');
    screenCounts = { Base: 0, Popup: 0 };
    openTabs = [];

    const screenNames = Object.keys(data.screens || {});
    screenNames.forEach(screenName => {
      let type = 'Base';
      if (data.screenMeta && data.screenMeta[screenName] && data.screenMeta[screenName].type) {
        type = data.screenMeta[screenName].type;
      } else if (screenName.startsWith('Popup')) {
        type = 'Popup';
      }
      screenCounts[type] = (screenCounts[type] || 0) + 1;

      const container = document.querySelector(`.tree-items[data-items="${type}"]`) || document.querySelector(`.tree-items[data-items="Base"]`);
      if (container) {
        const item = createTreeItem(screenName, type);
        container.appendChild(item);
      }
    });

    updateStartupBadges();

    const startup = ProjectModel.getStartupScreen();
    const initialScreen = (data.activeScreen && data.screens[data.activeScreen])
      ? data.activeScreen
      : ((startup && data.screens[startup]) ? startup : (screenNames.length ? screenNames[0] : null));

    // Restore open tabs from project data
    if (Array.isArray(data.openTabs)) {
      openTabs = data.openTabs.filter(s => !!data.screens[s]);
    } else if (initialScreen) {
      openTabs = [initialScreen];
    }

    if (data.dockLayout && typeof DockingManager !== 'undefined') {
      DockingManager.setLayout(data.dockLayout);
    }

    if (openTabs.length > 0) {
      const activeToOpen = (data.activeScreen && openTabs.includes(data.activeScreen)) ? data.activeScreen : openTabs[0];
      renderScreen(activeToOpen);
    } else if (screenNames.length > 0) {
      showEmptyWorkspaceState();
    } else {
      addScreen('Base', 'Home Screen');
    }
    renderTabs();
    CanvasEngine.zoomToFit();
    if (path) {
      AutoSaveEngine.updateRecentProjects(path, data.name);
    }
    triggerAutoSave();
  }

  // Compile Project to .PRJR (Universal Runtime compile & package)
  async function compileProjectAction() {
    const curScreen = ProjectModel.getCurrentScreen();
    if (curScreen) {
      ProjectModel.saveScreenObjects(curScreen, captureCurrentScreenObjects());
    }

    const projectData = ProjectModel.serialize();
    const result = await PrjrCompiler.compileProject(projectData);
    ModalManager.showBuildOutput(result.diagnostics, result);
  }

  // Validate Project
  function validateProjectAction() {
    const curScreen = ProjectModel.getCurrentScreen();
    if (curScreen) {
      ProjectModel.saveScreenObjects(curScreen, captureCurrentScreenObjects());
    }
    const diagnostics = ProjectValidator.validate(ProjectModel.serialize());
    ModalManager.showBuildOutput(diagnostics);
  }

  // Add Screen Buttons in tree (+ icon)
  document.querySelectorAll('.tadd').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const type = btn.getAttribute('data-type') || 'Base';
      addScreen(type);
    });
  });

  // Helper: Spawns a new widget on current screen
  function spawnWidget(objType, dropX = null, dropY = null) {
    if (!objType || objType === 'Select') return;

    let curScreen = ProjectModel.getCurrentScreen();
    if (!curScreen) {
      addScreen('Base');
      curScreen = ProjectModel.getCurrentScreen();
    }

    let posX = 120, posY = 120;
    if (dropX !== null && dropY !== null) {
      posX = dropX;
      posY = dropY;
    } else {
      // Calculate center of visible canvas viewport
      if (canvasEl && canvasInner) {
        const cRect = canvasEl.getBoundingClientRect();
        const sRect = canvasInner.getBoundingClientRect();
        const zoom = CanvasEngine.getZoom() || 1;
        posX = (cRect.left + cRect.width / 2 - sRect.left) / zoom;
        posY = (cRect.top + cRect.height / 2 - sRect.top) / zoom;
      }
    }

    const cfg = WidgetRegistry.createWidgetConfig(objType, 0, 0);
    // Center object on position and snap to 10px grid
    cfg.left = Math.max(0, Math.round((posX - cfg.width / 2) / 10) * 10);
    cfg.top = Math.max(0, Math.round((posY - cfg.height / 2) / 10) * 10);

    const newEl = createWidgetElement(cfg);
    CanvasEngine.selectObject(newEl);
    UndoRedoManager.push({ type: 'add', element: newEl });
    if (curScreen) {
      ProjectModel.saveScreenObjects(curScreen, captureCurrentScreenObjects());
    }
    return newEl;
  }

  // Vertical Tool Palette click-to-place & drag-to-place
  document.querySelectorAll('.tool-card, .tb-item').forEach(card => {
    // Click to spawn in viewport center
    card.addEventListener('click', (e) => {
      e.preventDefault();
      const objType = card.getAttribute('data-obj');
      spawnWidget(objType);
    });

    // Drag start
    card.addEventListener('dragstart', (e) => {
      const objType = card.getAttribute('data-obj');
      if (!objType) return;
      e.dataTransfer.setData('text/plain', objType);
      e.dataTransfer.effectAllowed = 'copy';
      card.classList.add('dragging');
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });
  });

  // Canvas Drag & Drop Listeners
  const canvasStage = document.getElementById('canvas-stage');
  [canvasEl, canvasStage, canvasInner].forEach(targetEl => {
    if (!targetEl) return;
    targetEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    targetEl.addEventListener('drop', (e) => {
      e.preventDefault();
      const objType = e.dataTransfer.getData('text/plain');
      if (!objType) return;

      const sRect = canvasInner.getBoundingClientRect();
      const zoom = CanvasEngine.getZoom() || 1;
      const x = (e.clientX - sRect.left) / zoom;
      const y = (e.clientY - sRect.top) / zoom;

      spawnWidget(objType, x, y);
    });
  });

  // Tool Palette Accordion Collapse / Expand
  document.querySelectorAll('.tool-cat-header').forEach(hdr => {
    hdr.addEventListener('click', () => {
      const parentGroup = hdr.closest('.tool-cat-group');
      if (parentGroup) {
        parentGroup.classList.toggle('collapsed');
      }
    });
  });

  // Tool Palette Real-Time Search Filter
  const toolSearch = document.getElementById('tool-search');
  const toolSearchClear = document.getElementById('tool-search-clear');
  if (toolSearch) {
    toolSearch.addEventListener('input', () => {
      const q = toolSearch.value.trim().toLowerCase();
      if (toolSearchClear) {
        toolSearchClear.style.display = q ? 'block' : 'none';
      }

      const groups = document.querySelectorAll('.tool-cat-group');
      groups.forEach(grp => {
        let visibleInGroup = 0;
        const cards = grp.querySelectorAll('.tool-card, .tb-item');
        cards.forEach(card => {
          const name = (card.getAttribute('data-obj') || '').toLowerCase();
          const label = card.textContent.toLowerCase();
          const match = !q || name.includes(q) || label.includes(q);
          card.style.display = match ? 'flex' : 'none';
          if (match) visibleInGroup++;
        });

        if (!q) {
          grp.style.display = '';
        } else {
          grp.style.display = visibleInGroup > 0 ? 'block' : 'none';
          if (visibleInGroup > 0) grp.classList.remove('collapsed');
        }
      });
    });

    if (toolSearchClear) {
      toolSearchClear.addEventListener('click', (e) => {
        e.preventDefault();
        toolSearch.value = '';
        toolSearch.dispatchEvent(new Event('input'));
        toolSearch.focus();
      });
    }
  }

  // Menu bar item and quick action button click commands
  document.querySelectorAll('.dropdown a, .tb-action-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const cmd = btn.getAttribute('data-cmd');
      if (!cmd) return;
      e.preventDefault();

      if (cmd === 'New Project') showLauncher('new-project');
      else if (cmd === 'Open Project') openProjectAction();
      else if (cmd === 'Save') saveProjectAction(false);
      else if (cmd === 'Save As') saveProjectAction(true);
      else if (cmd === 'Compile Project (.prjr)') compileProjectAction();
      else if (cmd === 'Check View / Validate') validateProjectAction();
      else if (cmd === 'Tag Database') {
        if (typeof ModalManager !== 'undefined' && ModalManager.showTagManagerModal) {
          ModalManager.showTagManagerModal();
        }
      }
      else if (cmd === 'Simulate') {
        if (typeof HmiSimulator !== 'undefined') {
          HmiSimulator.start();
        }
      }
      else if (cmd === 'Delete') CanvasEngine.deleteSelected();
      else if (cmd === 'Duplicate') CanvasEngine.duplicateSelected();
      else if (cmd === 'Cut') {
        const sel = CanvasEngine.getSelected();
        if (sel) {
          clipboard = getObjectConfig(sel);
          CanvasEngine.deleteSelected();
        }
      }
      else if (cmd === 'Copy') {
        const sel = CanvasEngine.getSelected();
        if (sel) clipboard = getObjectConfig(sel);
      }
      else if (cmd === 'Paste') {
        if (clipboard) {
          const cfg = { ...clipboard, left: clipboard.left + 20, top: clipboard.top + 20 };
          const el = createWidgetElement(cfg);
          CanvasEngine.selectObject(el);
          UndoRedoManager.push({ type: 'add', element: el });
        }
      }
      else if (cmd === 'Align Left') CanvasEngine.alignLeft();
      else if (cmd === 'Align Right') CanvasEngine.alignRight();
      else if (cmd === 'Align Center (H)') CanvasEngine.alignCenterH();
      else if (cmd === 'Align Top') CanvasEngine.alignTop();
      else if (cmd === 'Align Bottom') CanvasEngine.alignBottom();
      else if (cmd === 'Align Center (V)') CanvasEngine.alignCenterV();
      else if (cmd === 'Distribute Horizontally') CanvasEngine.distributeH();
      else if (cmd === 'Distribute Vertically') CanvasEngine.distributeV();
      else if (cmd === 'Bring to Front') CanvasEngine.bringToFront();
      else if (cmd === 'Send to Back') CanvasEngine.sendToBack();
      else if (cmd === 'Zoom In') CanvasEngine.zoomAround(CanvasEngine.getZoom() + 0.15);
      else if (cmd === 'Zoom Out') CanvasEngine.zoomAround(CanvasEngine.getZoom() - 0.15);
      else if (cmd === 'Zoom 100%') CanvasEngine.setZoom(1.0, true);
      else if (cmd === 'Zoom to Fit' || cmd === 'Fit Screen') CanvasEngine.zoomToFit();
      else if (cmd === 'Show Grid' || cmd === 'Snap to Grid') {
        canvasEl.classList.toggle('grid-on');
        CanvasEngine.toggleGridSnap();
      }
      else if (cmd === 'Close Project') {
        ProjectModel.initNew();
        showEmptyWorkspaceState();
        showLauncher('main');
      }
      else if (cmd === 'Swap Panels') {
        if (typeof DockingManager !== 'undefined') DockingManager.swapPanels();
      }
      else if (cmd === 'Reset Window Layout') {
        if (typeof DockingManager !== 'undefined') DockingManager.resetLayout();
      }
      else if (cmd === 'About') {
        ModalManager.showModal('About HMI Designer Studio', `
          <div style="text-align:center;padding:12px">
            <h2 style="color:#D9261C;margin:0 0 6px">HMI Designer Studio</h2>
            <div style="font-weight:700;font-size:13px">Version 1.0.0 (Production Release)</div>
            <p style="font-size:12px;color:#555;margin:8px 0">Universal industrial HMI and SCADA screen engineering studio.<br>Compiles to encrypted <code>.prjr</code> runtime packages for the HMI Runtime Engine.</p>
            <div style="font-size:11px;color:#888">Offline Standalone Edition · © 2026</div>
          </div>
        `);
      }
    });
  });

  // CAD Alignment Ribbon Direct Click Handlers
  const alignBtnMap = [
    { id: 'btn-align-left', fn: () => CanvasEngine.alignLeft() },
    { id: 'btn-align-center-h', fn: () => CanvasEngine.alignCenterH() },
    { id: 'btn-align-right', fn: () => CanvasEngine.alignRight() },
    { id: 'btn-align-top', fn: () => CanvasEngine.alignTop() },
    { id: 'btn-align-center-v', fn: () => CanvasEngine.alignCenterV() },
    { id: 'btn-align-bottom', fn: () => CanvasEngine.alignBottom() },
    { id: 'btn-dist-h', fn: () => CanvasEngine.distributeH() },
    { id: 'btn-dist-v', fn: () => CanvasEngine.distributeV() },
    { id: 'btn-z-front', fn: () => CanvasEngine.bringToFront() },
    { id: 'btn-z-back', fn: () => CanvasEngine.sendToBack() }
  ];
  alignBtnMap.forEach(({ id, fn }) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  });

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F5') {
      e.preventDefault();
      if (typeof HmiSimulator !== 'undefined') {
        HmiSimulator.start();
      }
    } else if (e.key === 'F2') {
      e.preventDefault();
      const cur = ProjectModel.getCurrentScreen();
      if (cur && ModalManager && ModalManager.showRenameScreenModal) {
        ModalManager.showRenameScreenModal(cur, (newName) => {
          renameScreenAction(cur, newName);
        });
      }
    } else if (e.ctrlKey && e.key.toLowerCase() === 'w') {
      e.preventDefault();
      const cur = ProjectModel.getCurrentScreen();
      if (cur) closeScreenTab(cur);
    } else if (e.ctrlKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveProjectAction(e.shiftKey);
    } else if (e.ctrlKey && e.key.toLowerCase() === 'o') {
      e.preventDefault();
      openProjectAction();
    } else if (e.ctrlKey && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      showLauncher('new-project');
    } else if (e.key === 'F7' || (e.ctrlKey && e.key === 'F7')) {
      e.preventDefault();
      compileProjectAction();
    } else if (e.ctrlKey && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      if (CanvasEngine.getSelected()) {
        CanvasEngine.duplicateSelected();
      } else {
        const cur = ProjectModel.getCurrentScreen();
        if (cur) duplicateScreenAction(cur);
      }
    } else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      CanvasEngine.zoomAround(CanvasEngine.getZoom() + 0.15);
    } else if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
      e.preventDefault();
      CanvasEngine.zoomAround(CanvasEngine.getZoom() - 0.15);
    } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
      e.preventDefault();
      CanvasEngine.zoomToFit();
    } else if ((e.ctrlKey || e.metaKey) && e.key === '1') {
      e.preventDefault();
      CanvasEngine.setZoom(1.0, true);
    }
  });

  // Screen Context Menu Click Dispatcher
  const ctxMenu = document.getElementById('screen-ctx-menu');
  if (ctxMenu) {
    ctxMenu.addEventListener('click', (e) => {
      const item = e.target.closest('.ctx-item');
      if (!item || item.classList.contains('disabled')) return;
      const action = item.getAttribute('data-action');
      ctxMenu.style.display = 'none';

      if (!activeContextScreen && action !== 'paste') return;

      if (action === 'rename') {
        if (ModalManager && ModalManager.showRenameScreenModal) {
          ModalManager.showRenameScreenModal(activeContextScreen, (newName) => {
            renameScreenAction(activeContextScreen, newName);
          });
        }
      } else if (action === 'duplicate') {
        duplicateScreenAction(activeContextScreen);
      } else if (action === 'cut') {
        cutScreenAction(activeContextScreen);
      } else if (action === 'copy') {
        copyScreenAction(activeContextScreen);
      } else if (action === 'paste') {
        pasteScreenAction(activeContextType);
      } else if (action === 'startup') {
        ProjectModel.setStartupScreen(activeContextScreen);
        updateStartupBadges();
      } else if (action === 'properties') {
        if (ModalManager && ModalManager.showScreenPropertiesModal) {
          ModalManager.showScreenPropertiesModal(activeContextScreen, (props) => {
            if (ProjectModel.getCurrentScreen() === activeContextScreen) {
              canvasInner.style.background = props.bgColor || '#FFFFFF';
            }
            updateStartupBadges();
          });
        }
      } else if (action === 'export') {
        exportScreenAction(activeContextScreen);
      } else if (action === 'delete') {
        deleteScreenAction(activeContextScreen);
      }
    });
  }

  // Dismiss context menu on click outside or Esc
  window.addEventListener('click', () => {
    if (ctxMenu) ctxMenu.style.display = 'none';
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ctxMenu && ctxMenu.style.display !== 'none') {
      ctxMenu.style.display = 'none';
    }
  });

  // Screen Import File Input Listener
  const importScreenInp = document.getElementById('import-screen-input');
  if (importScreenInp) {
    importScreenInp.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = JSON.parse(evt.target.result);
          let sName = data.screenName || 'Imported_Screen';
          const screens = ProjectModel.getProject().screens || {};
          let unique = sName;
          let n = 1;
          while (screens[unique]) {
            unique = `${sName}_${n++}`;
          }

          const type = unique.split('_')[0] === 'Popup' ? 'Popup' : 'Base';
          ProjectModel.saveScreenObjects(unique, data.objects || []);
          if (data.meta) ProjectModel.setScreenMeta(unique, data.meta);

          const container = document.querySelector(`.tree-items[data-items="${type}"]`) || document.querySelector(`.tree-items[data-items="Base"]`);
          if (container) {
            const item = createTreeItem(unique, type);
            container.appendChild(item);
          }
          renderScreen(unique);
        } catch (err) {
          alert('Failed to import screen file: ' + err.message);
        }
        importScreenInp.value = '';
      };
      reader.readAsText(file);
    });
  }

  // Chrome Tab Bar: "+" Add Screen Button
  const btnTabAddScreen = document.getElementById('btn-tab-add-screen');
  if (btnTabAddScreen) {
    btnTabAddScreen.addEventListener('click', (e) => {
      e.preventDefault();
      addScreen('Base');
    });
  }

  // Empty Workspace State: "+ Create Base Screen" Button
  const btnEmptyWsCreate = document.getElementById('btn-empty-ws-create');
  if (btnEmptyWsCreate) {
    btnEmptyWsCreate.addEventListener('click', (e) => {
      e.preventDefault();
      addScreen('Base');
    });
  }

  // Setup launcher navigation links
  document.querySelectorAll('a[href="#new-project"]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      showLauncher('new-project');
    });
  });
  document.querySelectorAll('a[href="#main"]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      showLauncher('main');
    });
  });

  // Check if Electron passed a startup file (e.g. user double-clicked .hmiproj in Explorer)
  if (window.electronAPI && window.electronAPI.getStartupFile) {
    window.electronAPI.getStartupFile().then(fileInfo => {
      if (fileInfo && fileInfo.path && fileInfo.data) {
        loadProjectData(fileInfo.data, fileInfo.path);
        hideLauncher();
      }
    });
  }

  // Setup launcher close button
  const launcherClose = document.getElementById('close-x');
  if (launcherClose) {
    launcherClose.onclick = () => {
      if (ProjectModel.getCurrentScreen()) hideLauncher();
    };
  }

  // --- Authentic CAD 4-Way Adaptive Docking Manager ---
  const DockingManager = (function() {
    let layout = {
      screens: { side: 'left', width: 230, height: 180 },
      tools: { side: 'right', width: 230, height: 180 }
    };

    // Load persisted layout
    try {
      const saved = localStorage.getItem('hmi_dock_layout');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.screens && parsed.tools) {
          layout = {
            screens: { side: parsed.screens.side || 'left', width: parsed.screens.width || 230, height: parsed.screens.height || 180 },
            tools: { side: parsed.tools.side || 'right', width: parsed.tools.width || 230, height: parsed.tools.height || 180 }
          };
        }
      }
    } catch (_) {}

    const workspaceEl = document.getElementById('designer-page');
    const dockZoneLeft = document.getElementById('dock-zone-left');
    const dockZoneRight = document.getElementById('dock-zone-right');
    const dockZoneTop = document.getElementById('dock-zone-top');
    const dockZoneBottom = document.getElementById('dock-zone-bottom');
    const winScreens = document.getElementById('win-screens');
    const iconToolbox = document.getElementById('icon-toolbox');
    const splitScreens = document.getElementById('splitter-screens');
    const splitTools = document.getElementById('splitter-tools');
    const dockOverlay = document.getElementById('dock-overlay');
    const guideLeft = document.getElementById('dock-guide-left');
    const guideRight = document.getElementById('dock-guide-right');
    const guideTop = document.getElementById('dock-guide-top');
    const guideBottom = document.getElementById('dock-guide-bottom');
    const compassLeft = document.querySelector('.dock-compass-btn.left');
    const compassRight = document.querySelector('.dock-compass-btn.right');
    const compassTop = document.querySelector('.dock-compass-btn.top');
    const compassBottom = document.querySelector('.dock-compass-btn.bottom');
    const snapPreview = document.getElementById('dock-snap-preview');

    let isDragging = false;
    let draggedPanelId = null;
    let activeSnapSide = null;

    function applyLayout() {
      if (!workspaceEl || !winScreens || !iconToolbox) return;

      const panels = [
        { id: 'screens', el: winScreens, splitter: splitScreens },
        { id: 'tools', el: iconToolbox, splitter: splitTools }
      ];

      panels.forEach(p => {
        const side = (layout[p.id] && layout[p.id].side) ? layout[p.id].side : (p.id === 'screens' ? 'left' : 'right');
        const w = (layout[p.id] && layout[p.id].width) ? layout[p.id].width : 230;
        const h = (layout[p.id] && layout[p.id].height) ? layout[p.id].height : 180;

        if (side === 'left') {
          if (dockZoneLeft) dockZoneLeft.appendChild(p.el);
          p.el.classList.remove('docked-horizontal');
          p.el.classList.add('docked-vertical');
          p.el.style.width = w + 'px';
          p.el.style.height = '100%';
          p.el.style.borderRight = '1px solid #CCC';
          p.el.style.borderLeft = 'none';
          p.el.style.borderTop = 'none';
          p.el.style.borderBottom = 'none';
          if (p.splitter) {
            p.splitter.className = 'dock-splitter dock-splitter-r';
            p.splitter.style.left = '';
            p.splitter.style.right = '-3px';
            p.splitter.style.top = '0';
            p.splitter.style.bottom = '0';
            p.splitter.style.width = '7px';
            p.splitter.style.height = 'auto';
            p.splitter.style.cursor = 'ew-resize';
          }
        } else if (side === 'right') {
          if (dockZoneRight) dockZoneRight.appendChild(p.el);
          p.el.classList.remove('docked-horizontal');
          p.el.classList.add('docked-vertical');
          p.el.style.width = w + 'px';
          p.el.style.height = '100%';
          p.el.style.borderLeft = '1px solid #CBD5E1';
          p.el.style.borderRight = 'none';
          p.el.style.borderTop = 'none';
          p.el.style.borderBottom = 'none';
          if (p.splitter) {
            p.splitter.className = 'dock-splitter dock-splitter-l';
            p.splitter.style.right = '';
            p.splitter.style.left = '-3px';
            p.splitter.style.top = '0';
            p.splitter.style.bottom = '0';
            p.splitter.style.width = '7px';
            p.splitter.style.height = 'auto';
            p.splitter.style.cursor = 'ew-resize';
          }
        } else if (side === 'top') {
          if (dockZoneTop) dockZoneTop.appendChild(p.el);
          p.el.classList.remove('docked-vertical');
          p.el.classList.add('docked-horizontal');
          p.el.style.width = '100%';
          p.el.style.height = h + 'px';
          p.el.style.borderBottom = '1px solid #CCC';
          p.el.style.borderTop = 'none';
          p.el.style.borderLeft = 'none';
          p.el.style.borderRight = 'none';
          if (p.splitter) {
            p.splitter.className = 'dock-splitter dock-splitter-b';
            p.splitter.style.top = '';
            p.splitter.style.bottom = '-3px';
            p.splitter.style.left = '0';
            p.splitter.style.right = '0';
            p.splitter.style.height = '7px';
            p.splitter.style.width = 'auto';
            p.splitter.style.cursor = 'ns-resize';
          }
        } else if (side === 'bottom') {
          if (dockZoneBottom) dockZoneBottom.appendChild(p.el);
          p.el.classList.remove('docked-vertical');
          p.el.classList.add('docked-horizontal');
          p.el.style.width = '100%';
          p.el.style.height = h + 'px';
          p.el.style.borderTop = '1px solid #CBD5E1';
          p.el.style.borderBottom = 'none';
          p.el.style.borderLeft = 'none';
          p.el.style.borderRight = 'none';
          if (p.splitter) {
            p.splitter.className = 'dock-splitter dock-splitter-t';
            p.splitter.style.bottom = '';
            p.splitter.style.top = '-3px';
            p.splitter.style.left = '0';
            p.splitter.style.right = '0';
            p.splitter.style.height = '7px';
            p.splitter.style.width = 'auto';
            p.splitter.style.cursor = 'ns-resize';
          }
        }
      });

      // Show/hide dock zones according to whether they hold panels
      if (dockZoneTop) dockZoneTop.style.display = dockZoneTop.children.length ? 'flex' : 'none';
      if (dockZoneBottom) dockZoneBottom.style.display = dockZoneBottom.children.length ? 'flex' : 'none';
      if (dockZoneLeft) dockZoneLeft.style.display = dockZoneLeft.children.length ? 'flex' : 'none';
      if (dockZoneRight) dockZoneRight.style.display = dockZoneRight.children.length ? 'flex' : 'none';

      // Update quick dock active buttons
      document.querySelectorAll('.dock-qb').forEach(qb => {
        const p = qb.getAttribute('data-panel');
        const d = qb.getAttribute('data-dock');
        if (p && d && layout[p]) {
          qb.classList.toggle('active', layout[p].side === d);
        }
      });

      // Compact view for tools if narrow and vertical
      iconToolbox.classList.toggle('compact', layout.tools.side !== 'top' && layout.tools.side !== 'bottom' && layout.tools.width < 90);

      // Save to localStorage
      try {
        localStorage.setItem('hmi_dock_layout', JSON.stringify(layout));
      } catch (_) {}

      // Recalculate canvas view
      if (typeof CanvasEngine !== 'undefined') {
        CanvasEngine.updateStageDimensions();
        CanvasEngine.centerScreen();
      }
    }

    function initDragging() {
      document.querySelectorAll('.panel-drag-handle').forEach(handle => {
        handle.addEventListener('pointerdown', (e) => {
          if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) return;
          e.preventDefault();

          const panelId = handle.getAttribute('data-panel');
          if (!panelId) return;

          isDragging = true;
          draggedPanelId = panelId;
          activeSnapSide = null;

          const panelEl = (panelId === 'screens') ? winScreens : iconToolbox;
          if (panelEl) panelEl.classList.add('dock-dragging');

          if (dockOverlay) dockOverlay.style.display = 'block';
          if (snapPreview) snapPreview.style.display = 'none';

          function onPointerMove(ev) {
            if (!isDragging) return;
            const wsRect = workspaceEl.getBoundingClientRect();
            const mouseX = ev.clientX - wsRect.left;
            const mouseY = ev.clientY - wsRect.top;
            const relX = mouseX / wsRect.width;
            const relY = mouseY / wsRect.height;

            let targetSide = null;
            if (relY < 0.22) targetSide = 'top';
            else if (relY > 0.78) targetSide = 'bottom';
            else if (relX < 0.25) targetSide = 'left';
            else if (relX > 0.75) targetSide = 'right';
            else {
              // 4-Way Compass detection in center
              const cx = wsRect.width / 2;
              const cy = wsRect.height / 2;
              const dx = mouseX - cx;
              const dy = mouseY - cy;
              if (Math.abs(dx) > Math.abs(dy)) {
                targetSide = (dx < 0) ? 'left' : 'right';
              } else {
                targetSide = (dy < 0) ? 'top' : 'bottom';
              }
            }

            activeSnapSide = targetSide;

            if (guideLeft) guideLeft.classList.toggle('hover', targetSide === 'left');
            if (guideRight) guideRight.classList.toggle('hover', targetSide === 'right');
            if (guideTop) guideTop.classList.toggle('hover', targetSide === 'top');
            if (guideBottom) guideBottom.classList.toggle('hover', targetSide === 'bottom');

            if (compassLeft) compassLeft.classList.toggle('hover', targetSide === 'left');
            if (compassRight) compassRight.classList.toggle('hover', targetSide === 'right');
            if (compassTop) compassTop.classList.toggle('hover', targetSide === 'top');
            if (compassBottom) compassBottom.classList.toggle('hover', targetSide === 'bottom');

            if (targetSide && snapPreview) {
              snapPreview.style.display = 'block';
              const targetW = (draggedPanelId && layout[draggedPanelId]) ? (layout[draggedPanelId].width || 230) : 230;
              const targetH = (draggedPanelId && layout[draggedPanelId]) ? (layout[draggedPanelId].height || 180) : 180;
              if (targetSide === 'left') {
                snapPreview.style.top = '0px';
                snapPreview.style.bottom = '0px';
                snapPreview.style.left = '0px';
                snapPreview.style.right = '';
                snapPreview.style.width = targetW + 'px';
                snapPreview.style.height = '';
              } else if (targetSide === 'right') {
                snapPreview.style.top = '0px';
                snapPreview.style.bottom = '0px';
                snapPreview.style.left = '';
                snapPreview.style.right = '0px';
                snapPreview.style.width = targetW + 'px';
                snapPreview.style.height = '';
              } else if (targetSide === 'top') {
                snapPreview.style.top = '0px';
                snapPreview.style.bottom = '';
                snapPreview.style.left = '0px';
                snapPreview.style.right = '0px';
                snapPreview.style.width = '100%';
                snapPreview.style.height = targetH + 'px';
              } else if (targetSide === 'bottom') {
                snapPreview.style.top = '';
                snapPreview.style.bottom = '0px';
                snapPreview.style.left = '0px';
                snapPreview.style.right = '0px';
                snapPreview.style.width = '100%';
                snapPreview.style.height = targetH + 'px';
              }
            } else if (snapPreview) {
              snapPreview.style.display = 'none';
            }
          }

          function onPointerUp() {
            isDragging = false;
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);

            if (panelEl) panelEl.classList.remove('dock-dragging');
            if (dockOverlay) dockOverlay.style.display = 'none';
            if (guideLeft) guideLeft.classList.remove('hover');
            if (guideRight) guideRight.classList.remove('hover');
            if (guideTop) guideTop.classList.remove('hover');
            if (guideBottom) guideBottom.classList.remove('hover');
            if (compassLeft) compassLeft.classList.remove('hover');
            if (compassRight) compassRight.classList.remove('hover');
            if (compassTop) compassTop.classList.remove('hover');
            if (compassBottom) compassBottom.classList.remove('hover');

            if (activeSnapSide && draggedPanelId) {
              dockPanel(draggedPanelId, activeSnapSide);
            }
            draggedPanelId = null;
            activeSnapSide = null;
          }

          window.addEventListener('pointermove', onPointerMove);
          window.addEventListener('pointerup', onPointerUp);
        });
      });

      // Quick dock buttons (⬅ ⬆ ⬇ ➡)
      document.querySelectorAll('.dock-qb').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const pId = btn.getAttribute('data-panel');
          const side = btn.getAttribute('data-dock');
          if (pId && side) {
            dockPanel(pId, side);
          }
        });
      });

      // Splitter resize for Screen Tree
      if (splitScreens && winScreens) {
        splitScreens.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          splitScreens.classList.add('dragging');
          const startX = e.clientX;
          const startY = e.clientY;
          const startWidth = winScreens.offsetWidth;
          const startHeight = winScreens.offsetHeight;
          const curSide = layout.screens.side;

          function onMove(ev) {
            if (curSide === 'left') {
              const delta = ev.clientX - startX;
              const newW = Math.max(160, Math.min(500, startWidth + delta));
              winScreens.style.width = newW + 'px';
              layout.screens.width = newW;
            } else if (curSide === 'right') {
              const delta = startX - ev.clientX;
              const newW = Math.max(160, Math.min(500, startWidth + delta));
              winScreens.style.width = newW + 'px';
              layout.screens.width = newW;
            } else if (curSide === 'top') {
              const delta = ev.clientY - startY;
              const newH = Math.max(100, Math.min(480, startHeight + delta));
              winScreens.style.height = newH + 'px';
              layout.screens.height = newH;
            } else if (curSide === 'bottom') {
              const delta = startY - ev.clientY;
              const newH = Math.max(100, Math.min(480, startHeight + delta));
              winScreens.style.height = newH + 'px';
              layout.screens.height = newH;
            }
            CanvasEngine.updateStageDimensions();
          }
          function onUp(ev) {
            splitScreens.classList.remove('dragging');
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            try { splitScreens.releasePointerCapture(ev.pointerId); } catch (_) {}
            try { localStorage.setItem('hmi_dock_layout', JSON.stringify(layout)); } catch (_) {}
            CanvasEngine.centerScreen();
            triggerAutoSave();
          }
          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', onUp);
          splitScreens.setPointerCapture(e.pointerId);
        });
      }

      // Splitter resize for Tools Palette
      if (splitTools && iconToolbox) {
        splitTools.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          splitTools.classList.add('dragging');
          const startX = e.clientX;
          const startY = e.clientY;
          const startWidth = iconToolbox.offsetWidth;
          const startHeight = iconToolbox.offsetHeight;
          const curSide = layout.tools.side;

          function onMove(ev) {
            if (curSide === 'right') {
              const delta = startX - ev.clientX;
              const newW = Math.max(52, Math.min(400, startWidth + delta));
              iconToolbox.style.width = newW + 'px';
              iconToolbox.classList.toggle('compact', newW < 90);
              layout.tools.width = newW;
            } else if (curSide === 'left') {
              const delta = ev.clientX - startX;
              const newW = Math.max(52, Math.min(400, startWidth + delta));
              iconToolbox.style.width = newW + 'px';
              iconToolbox.classList.toggle('compact', newW < 90);
              layout.tools.width = newW;
            } else if (curSide === 'top') {
              const delta = ev.clientY - startY;
              const newH = Math.max(100, Math.min(480, startHeight + delta));
              iconToolbox.style.height = newH + 'px';
              layout.tools.height = newH;
            } else if (curSide === 'bottom') {
              const delta = startY - ev.clientY;
              const newH = Math.max(100, Math.min(480, startHeight + delta));
              iconToolbox.style.height = newH + 'px';
              layout.tools.height = newH;
            }
            CanvasEngine.updateStageDimensions();
          }
          function onUp(ev) {
            splitTools.classList.remove('dragging');
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            try { splitTools.releasePointerCapture(ev.pointerId); } catch (_) {}
            try { localStorage.setItem('hmi_dock_layout', JSON.stringify(layout)); } catch (_) {}
            CanvasEngine.centerScreen();
            triggerAutoSave();
          }
          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', onUp);
          splitTools.setPointerCapture(e.pointerId);
        });
      }
    }

    function dockPanel(panelId, side) {
      if (!layout[panelId]) return;
      layout[panelId].side = side;
      applyLayout();
      triggerAutoSave();
    }

    function swapPanels() {
      const s = layout.screens.side;
      layout.screens.side = layout.tools.side;
      layout.tools.side = s;
      applyLayout();
      triggerAutoSave();
    }

    function resetLayout() {
      layout = {
        screens: { side: 'left', width: 230, height: 180 },
        tools: { side: 'right', width: 230, height: 180 }
      };
      applyLayout();
      triggerAutoSave();
    }

    function setLayout(newLayout) {
      if (newLayout && newLayout.screens && newLayout.tools) {
        layout = { ...layout, ...newLayout };
        applyLayout();
      }
    }

    return {
      init() {
        applyLayout();
        initDragging();
      },
      dockPanel,
      swapPanels,
      resetLayout,
      setLayout,
      getLayout() { return layout; }
    };
  })();

  // Initialize Adaptive 4-Way Docking Manager
  DockingManager.init();

  // Setup Resume Session button in Launcher
  const btnResumeSession = document.getElementById('btn-resume-session');
  if (btnResumeSession) {
    btnResumeSession.addEventListener('click', (e) => {
      e.preventDefault();
      const session = AutoSaveEngine.getSession();
      if (session) {
        loadProjectData(session, session.filePath);
        hideLauncher();
      }
    });
  }

  // Session Recovery & Startup Logic:
  // If an active session was previously being edited, seamlessly restore it!
  let openedViaStartup = false;
  if (window.electronAPI && window.electronAPI.getStartupFile) {
    window.electronAPI.getStartupFile().then(fileInfo => {
      if (fileInfo && fileInfo.path && fileInfo.data) {
        openedViaStartup = true;
        loadProjectData(fileInfo.data, fileInfo.path);
        hideLauncher();
      } else {
        const lastSession = AutoSaveEngine.getSession();
        if (lastSession && lastSession.screens && Object.keys(lastSession.screens).length > 0) {
          loadProjectData(lastSession, lastSession.filePath);
          hideLauncher();
        } else {
          showLauncher('main');
        }
      }
    });
  } else {
    const lastSession = AutoSaveEngine.getSession();
    if (lastSession && lastSession.screens && Object.keys(lastSession.screens).length > 0) {
      loadProjectData(lastSession, lastSession.filePath);
      hideLauncher();
    } else {
      showLauncher('main');
    }
  }

  console.log('HMI Designer Studio initialized successfully.');
});

