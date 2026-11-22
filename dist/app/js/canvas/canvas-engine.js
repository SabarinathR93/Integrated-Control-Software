/**
 * HMI Designer Studio - Canvas Engine
 * Universal Industrial CAD Layout Engine
 */

const CanvasEngine = (function() {
  let canvasInner = null;
  let canvasEl = null;
  let canvasStage = null;
  let selectedObjects = [];
  let isGridSnap = true;
  let gridSize = 10;
  let zoomLevel = 1.0;
  let onSelectCallback = null;
  let onZoomCallback = null;
  let onDblClickCallback = null;

  // Panning state
  let isPanning = false;
  let panStartX = 0, panStartY = 0;
  let panStartScrollX = 0, panStartScrollY = 0;
  let isSpacePressed = false;

  function init(innerEl, containerEl, onSelect, onZoom, onDblClick) {
    canvasInner = innerEl;
    canvasEl = containerEl;
    canvasStage = innerEl.parentElement;
    onSelectCallback = onSelect;
    onZoomCallback = onZoom;
    onDblClickCallback = onDblClick;

    // Center screen on load
    updateStageDimensions();
    centerScreen();

    // Two-finger pinch / Ctrl + Wheel Zoom
    canvasEl.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        // Precision touchpad pinch-to-zoom & Ctrl+Wheel
        const zoomFactor = Math.exp(-e.deltaY * 0.0035);
        const targetZoom = Math.max(0.2, Math.min(3.0, zoomLevel * zoomFactor));
        zoomAround(targetZoom, e.clientX, e.clientY);
      }
    }, { passive: false });

    // Spacebar key tracking for Panning
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        isSpacePressed = true;
        canvasEl.classList.add('panning');
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        isSpacePressed = false;
        if (!isPanning) canvasEl.classList.remove('panning');
      }
    });

    // Panning (Middle click or Spacebar + Left drag) & Deselect
    canvasEl.addEventListener('pointerdown', (e) => {
      if (e.button === 1 || (e.button === 0 && isSpacePressed)) {
        e.preventDefault();
        isPanning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        panStartScrollX = canvasEl.scrollLeft;
        panStartScrollY = canvasEl.scrollTop;
        canvasEl.classList.add('panning-active');
        canvasEl.setPointerCapture(e.pointerId);
        return;
      }

      // Deselect on canvas background click
      if (e.target === canvasEl || e.target === canvasInner || e.target === canvasStage) {
        clearSelection();
      }
    });

    canvasEl.addEventListener('pointermove', (e) => {
      if (isPanning) {
        const dx = e.clientX - panStartX;
        const dy = e.clientY - panStartY;
        canvasEl.scrollLeft = panStartScrollX - dx;
        canvasEl.scrollTop = panStartScrollY - dy;
      }
    });

    canvasEl.addEventListener('pointerup', (e) => {
      if (isPanning) {
        isPanning = false;
        canvasEl.classList.remove('panning-active');
        if (!isSpacePressed) canvasEl.classList.remove('panning');
        try { canvasEl.releasePointerCapture(e.pointerId); } catch (_) {}
      }
    });

    // Window resize keeps stage centered
    window.addEventListener('resize', () => {
      updateStageDimensions();
    });

    // Keyboard shortcuts (Delete, Arrows for nudge)
    window.addEventListener('keydown', (e) => {
      if (!selectedObjects.length) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        nudge(0, - (e.shiftKey ? 10 : 1));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        nudge(0, e.shiftKey ? 10 : 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        nudge(-(e.shiftKey ? 10 : 1), 0);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nudge(e.shiftKey ? 10 : 1, 0);
      }
    });
  }

  function snap(val) {
    if (!isGridSnap) return Math.round(val);
    return Math.round(val / gridSize) * gridSize;
  }

  function makeDraggable(el) {
    let startX, startY, origLeft, origTop, origWidth, origHeight;
    let isDragging = false;
    let isResizing = false;
    let lastTapTime = 0;

    el.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (onDblClickCallback) onDblClickCallback(el);
    });

    el.addEventListener('pointerdown', (e) => {
      const now = Date.now();
      if (now - lastTapTime < 350 && !e.target.classList.contains('rz')) {
        // Double-press / Double-click on object
        lastTapTime = 0;
        e.preventDefault();
        e.stopPropagation();
        if (onDblClickCallback) onDblClickCallback(el);
        return;
      }
      lastTapTime = now;

      e.stopPropagation();
      if (e.target.classList.contains('rz')) {
        // Resizing
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        origWidth = el.offsetWidth;
        origHeight = el.offsetHeight;
        e.target.setPointerCapture(e.pointerId);
      } else {
        // Dragging / Selecting
        if (!e.ctrlKey && !selectedObjects.includes(el)) {
          clearSelection();
        }
        selectObject(el, e.ctrlKey);
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        origLeft = parseFloat(el.style.left) || 0;
        origTop = parseFloat(el.style.top) || 0;
        el.setPointerCapture(e.pointerId);
      }

      function onPointerMove(ev) {
        if (isResizing) {
          const dx = (ev.clientX - startX) / zoomLevel;
          const dy = (ev.clientY - startY) / zoomLevel;
          const newW = Math.max(20, snap(origWidth + dx));
          const newH = Math.max(10, snap(origHeight + dy));
          el.style.width = newW + 'px';
          el.style.height = newH + 'px';
          if (onSelectCallback) onSelectCallback(el);
        } else if (isDragging) {
          const dx = (ev.clientX - startX) / zoomLevel;
          const dy = (ev.clientY - startY) / zoomLevel;
          const newX = Math.max(0, snap(origLeft + dx));
          const newY = Math.max(0, snap(origTop + dy));
          el.style.left = newX + 'px';
          el.style.top = newY + 'px';
          if (onSelectCallback) onSelectCallback(el);
        }
      }

      function onPointerUp(ev) {
        isDragging = false;
        isResizing = false;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        try {
          if (e.target.hasPointerCapture(ev.pointerId)) {
            e.target.releasePointerCapture(ev.pointerId);
          }
        } catch (_) {}
      }

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });

    // Ensure resize handle exists
    if (!el.querySelector('.rz')) {
      const rz = document.createElement('div');
      rz.className = 'rz';
      rz.title = 'Drag to resize';
      el.appendChild(rz);
    }
  }

  function selectObject(el, toggle = false) {
    if (toggle) {
      if (selectedObjects.includes(el)) {
        el.classList.remove('sel');
        selectedObjects = selectedObjects.filter(o => o !== el);
      } else {
        el.classList.add('sel');
        selectedObjects.push(el);
      }
    } else {
      clearSelection();
      el.classList.add('sel');
      selectedObjects.push(el);
    }
    if (onSelectCallback) {
      onSelectCallback(selectedObjects[selectedObjects.length - 1] || null);
    }
  }

  function clearSelection() {
    selectedObjects.forEach(o => o.classList.remove('sel'));
    selectedObjects = [];
    if (onSelectCallback) onSelectCallback(null);
  }

  function getSelected() {
    return selectedObjects[selectedObjects.length - 1] || null;
  }

  function getAllSelected() {
    return [...selectedObjects];
  }

  function deleteSelected() {
    selectedObjects.forEach(el => {
      UndoRedoManager.push({ type: 'delete', element: el.cloneNode(true), parent: canvasInner });
      el.remove();
    });
    clearSelection();
  }

  function duplicateSelected() {
    const newSelection = [];
    selectedObjects.forEach(el => {
      const clone = el.cloneNode(true);
      const curLeft = parseFloat(el.style.left) || 0;
      const curTop = parseFloat(el.style.top) || 0;
      clone.style.left = (curLeft + 20) + 'px';
      clone.style.top = (curTop + 20) + 'px';
      clone.classList.remove('sel');
      makeDraggable(clone);
      canvasInner.appendChild(clone);
      newSelection.push(clone);
      UndoRedoManager.push({ type: 'add', element: clone });
    });
    clearSelection();
    newSelection.forEach(c => selectObject(c, true));
  }

  function nudge(dx, dy) {
    selectedObjects.forEach(el => {
      const curX = parseFloat(el.style.left) || 0;
      const curY = parseFloat(el.style.top) || 0;
      el.style.left = Math.max(0, curX + dx) + 'px';
      el.style.top = Math.max(0, curY + dy) + 'px';
    });
    if (onSelectCallback && selectedObjects.length) {
      onSelectCallback(selectedObjects[0]);
    }
  }

  /* --- Smart Alignment & Distribution --- */
  function alignLeft() {
    if (selectedObjects.length < 2) return;
    const minLeft = Math.min(...selectedObjects.map(o => parseFloat(o.style.left) || 0));
    selectedObjects.forEach(o => o.style.left = minLeft + 'px');
  }

  function alignRight() {
    if (selectedObjects.length < 2) return;
    const maxRight = Math.max(...selectedObjects.map(o => (parseFloat(o.style.left) || 0) + o.offsetWidth));
    selectedObjects.forEach(o => o.style.left = (maxRight - o.offsetWidth) + 'px');
  }

  function alignCenterH() {
    if (selectedObjects.length < 2) return;
    const centers = selectedObjects.map(o => (parseFloat(o.style.left) || 0) + o.offsetWidth / 2);
    const avgCenter = centers.reduce((a, b) => a + b, 0) / centers.length;
    selectedObjects.forEach(o => o.style.left = snap(avgCenter - o.offsetWidth / 2) + 'px');
  }

  function alignTop() {
    if (selectedObjects.length < 2) return;
    const minTop = Math.min(...selectedObjects.map(o => parseFloat(o.style.top) || 0));
    selectedObjects.forEach(o => o.style.top = minTop + 'px');
  }

  function alignBottom() {
    if (selectedObjects.length < 2) return;
    const maxBottom = Math.max(...selectedObjects.map(o => (parseFloat(o.style.top) || 0) + o.offsetHeight));
    selectedObjects.forEach(o => o.style.top = (maxBottom - o.offsetHeight) + 'px');
  }

  function alignCenterV() {
    if (selectedObjects.length < 2) return;
    const middles = selectedObjects.map(o => (parseFloat(o.style.top) || 0) + o.offsetHeight / 2);
    const avgMiddle = middles.reduce((a, b) => a + b, 0) / middles.length;
    selectedObjects.forEach(o => o.style.top = snap(avgMiddle - o.offsetHeight / 2) + 'px');
  }

  function distributeH() {
    if (selectedObjects.length < 3) return;
    const sorted = [...selectedObjects].sort((a, b) => (parseFloat(a.style.left) || 0) - (parseFloat(b.style.left) || 0));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const firstLeft = parseFloat(first.style.left) || 0;
    const lastLeft = parseFloat(last.style.left) || 0;
    const innerWidths = sorted.slice(1, -1).reduce((sum, o) => sum + o.offsetWidth, 0);
    const availableSpace = (lastLeft - (firstLeft + first.offsetWidth)) - innerWidths;
    const gap = availableSpace / (sorted.length - 1);
    let curLeft = firstLeft + first.offsetWidth + gap;
    for (let i = 1; i < sorted.length - 1; i++) {
      sorted[i].style.left = snap(curLeft) + 'px';
      curLeft += sorted[i].offsetWidth + gap;
    }
  }

  function distributeV() {
    if (selectedObjects.length < 3) return;
    const sorted = [...selectedObjects].sort((a, b) => (parseFloat(a.style.top) || 0) - (parseFloat(b.style.top) || 0));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const firstTop = parseFloat(first.style.top) || 0;
    const lastTop = parseFloat(last.style.top) || 0;
    const innerHeights = sorted.slice(1, -1).reduce((sum, o) => sum + o.offsetHeight, 0);
    const availableSpace = (lastTop - (firstTop + first.offsetHeight)) - innerHeights;
    const gap = availableSpace / (sorted.length - 1);
    let curTop = firstTop + first.offsetHeight + gap;
    for (let i = 1; i < sorted.length - 1; i++) {
      sorted[i].style.top = snap(curTop) + 'px';
      curTop += sorted[i].offsetHeight + gap;
    }
  }

  /* --- Z-Index Layering --- */
  function bringToFront() {
    selectedObjects.forEach(o => canvasInner.appendChild(o));
  }

  function sendToBack() {
    selectedObjects.forEach(o => canvasInner.insertBefore(o, canvasInner.firstChild));
  }

  function updateStageDimensions() {
    if (!canvasStage || !canvasInner || !canvasEl) return;
    if (canvasInner.style.display === 'none') {
      canvasStage.style.width = '100%';
      canvasStage.style.height = '100%';
      return;
    }
    const w = canvasInner.offsetWidth || 1280;
    const h = canvasInner.offsetHeight || 800;
    const scaledW = Math.round(w * zoomLevel);
    const scaledH = Math.round(h * zoomLevel);
    canvasStage.style.width = Math.max(canvasEl.clientWidth, scaledW + 160) + 'px';
    canvasStage.style.height = Math.max(canvasEl.clientHeight, scaledH + 160) + 'px';
  }

  function setZoom(lvl, autoCenter = true) {
    zoomLevel = Math.max(0.2, Math.min(3.0, Math.round(lvl * 100) / 100));
    canvasInner.style.transform = `scale(${zoomLevel})`;
    updateStageDimensions();
    if (autoCenter) {
      centerScreen();
    }
    if (onZoomCallback) {
      onZoomCallback(zoomLevel);
    }
    return zoomLevel;
  }

  function zoomAround(newZoom, clientX, clientY) {
    const clamped = Math.max(0.2, Math.min(3.0, Math.round(newZoom * 100) / 100));
    if (Math.abs(clamped - zoomLevel) < 0.005) return zoomLevel;

    const rect = canvasEl.getBoundingClientRect();
    const viewportX = (clientX !== undefined && clientX !== null) ? (clientX - rect.left) : (canvasEl.clientWidth / 2);
    const viewportY = (clientY !== undefined && clientY !== null) ? (clientY - rect.top) : (canvasEl.clientHeight / 2);

    const prevScrollX = canvasEl.scrollLeft;
    const prevScrollY = canvasEl.scrollTop;

    const oldZoom = zoomLevel;
    zoomLevel = clamped;
    canvasInner.style.transform = `scale(${zoomLevel})`;
    updateStageDimensions();

    const ratio = zoomLevel / oldZoom;
    canvasEl.scrollLeft = (prevScrollX + viewportX) * ratio - viewportX;
    canvasEl.scrollTop = (prevScrollY + viewportY) * ratio - viewportY;

    if (onZoomCallback) {
      onZoomCallback(zoomLevel);
    }
    return zoomLevel;
  }

  function zoomToFit() {
    if (!canvasEl || !canvasInner || canvasInner.style.display === 'none') return;
    const availW = Math.max(200, canvasEl.clientWidth - 120);
    const availH = Math.max(150, canvasEl.clientHeight - 120);
    const w = canvasInner.offsetWidth || 1280;
    const h = canvasInner.offsetHeight || 800;
    const fit = Math.min(availW / w, availH / h, 1.25);
    const rounded = Math.max(0.25, Math.round(fit * 20) / 20);
    setZoom(rounded, true);
  }

  function centerScreen() {
    if (!canvasEl) return;
    if (canvasInner && canvasInner.style.display === 'none') return;
    updateStageDimensions();
    requestAnimationFrame(() => {
      canvasEl.scrollLeft = Math.max(0, (canvasEl.scrollWidth - canvasEl.clientWidth) / 2);
      canvasEl.scrollTop = Math.max(0, (canvasEl.scrollHeight - canvasEl.clientHeight) / 2);
    });
  }

  function getZoom() {
    return zoomLevel;
  }

  function toggleGridSnap(state) {
    isGridSnap = state !== undefined ? state : !isGridSnap;
    return isGridSnap;
  }

  return {
    init,
    snap,
    makeDraggable,
    selectObject,
    clearSelection,
    getSelected,
    getAllSelected,
    deleteSelected,
    duplicateSelected,
    nudge,
    alignLeft,
    alignRight,
    alignCenterH,
    alignTop,
    alignBottom,
    alignCenterV,
    distributeH,
    distributeV,
    bringToFront,
    sendToBack,
    setZoom,
    zoomAround,
    zoomToFit,
    centerScreen,
    updateStageDimensions,
    getZoom,
    toggleGridSnap
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CanvasEngine;
}

