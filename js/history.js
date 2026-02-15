/* ========================================
   DocToMD — History Module (localStorage)
   ======================================== */

window.DocToMD = window.DocToMD || {};

DocToMD.History = (function() {
  const STORAGE_KEY = 'doctomd_history';
  const MAX_ENTRIES = 50;
  const MAX_ENTRY_SIZE = 50 * 1024; // 50KB per entry

  function _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function _save(entries) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        // Remove oldest entries until it fits
        while (entries.length > 1) {
          entries.pop();
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
            return;
          } catch (e2) { /* keep trying */ }
        }
      }
    }
  }

  function add(fileName, markdown) {
    // Truncate if too large
    const content = markdown.length > MAX_ENTRY_SIZE
      ? markdown.slice(0, MAX_ENTRY_SIZE) + '\n\n[Truncated — original was ' + markdown.length + ' chars]'
      : markdown;

    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      fileName: fileName,
      markdown: content,
      charCount: markdown.length,
      date: new Date().toISOString()
    };

    const entries = _load();
    entries.unshift(entry);

    // Trim to max
    if (entries.length > MAX_ENTRIES) {
      entries.length = MAX_ENTRIES;
    }

    _save(entries);
    return entry;
  }

  function getAll() {
    return _load();
  }

  function getById(id) {
    return _load().find(e => e.id === id) || null;
  }

  function remove(id) {
    const entries = _load().filter(e => e.id !== id);
    _save(entries);
  }

  function clearAll() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function formatDate(isoString) {
    const d = new Date(isoString);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return diffMin + 'm ago';
    if (diffHr < 24) return diffHr + 'h ago';
    if (diffDay < 7) return diffDay + 'd ago';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return { add, getAll, getById, remove, clearAll, formatDate };
})();
