/**
 * HMI Designer Studio - Industrial Undo/Redo Engine
 */

const UndoRedoManager = (function() {
  const undoStack = [];
  const redoStack = [];
  const MAX_HISTORY = 50;

  function push(action) {
    undoStack.push(action);
    if (undoStack.length > MAX_HISTORY) {
      undoStack.shift();
    }
    redoStack.length = 0; // Clear redo on new action
  }

  function canUndo() {
    return undoStack.length > 0;
  }

  function canRedo() {
    return redoStack.length > 0;
  }

  function clear() {
    undoStack.length = 0;
    redoStack.length = 0;
  }

  function popUndo() {
    if (!canUndo()) return null;
    const action = undoStack.pop();
    redoStack.push(action);
    return action;
  }

  function popRedo() {
    if (!canRedo()) return null;
    const action = redoStack.pop();
    undoStack.push(action);
    return action;
  }

  return {
    push,
    canUndo,
    canRedo,
    clear,
    popUndo,
    popRedo
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = UndoRedoManager;
}

