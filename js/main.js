/* ========================================
   DocToMD — Main UI Controller
   ======================================== */

window.DocToMD = window.DocToMD || {};

(function() {
  'use strict';

  // --- Supported extensions ---
  const SUPPORTED_EXT = new Set([
    'pdf', 'docx', 'xlsx', 'pptx', 'html', 'htm', 'csv', 'epub',
    'txt', 'json', 'xml', 'md', 'rst', 'rtf', 'tsv'
  ]);

  // --- State ---
  let worker = null;
  let engineReady = false;
  let fileQueue = []; // { id, file, name, status, progress, markdown, error }
  let activeFileId = null;
  let convertQueue = []; // IDs waiting to convert

  // --- DOM refs ---
  const $engineStatus = document.getElementById('engineStatus');
  const $dropZone = document.getElementById('dropZone');
  const $fileInput = document.getElementById('fileInput');
  const $fileQueue = document.getElementById('fileQueue');
  const $fileList = document.getElementById('fileList');
  const $resultPanel = document.getElementById('resultPanel');
  const $resultFileName = document.getElementById('resultFileName');
  const $resultRaw = document.getElementById('resultRaw');
  const $resultPreview = document.getElementById('resultPreview');
  const $btnCopy = document.getElementById('btnCopy');
  const $btnDownloadSingle = document.getElementById('btnDownloadSingle');
  const $btnDownloadAll = document.getElementById('btnDownloadAll');
  const $btnClearQueue = document.getElementById('btnClearQueue');
  const $historySection = document.getElementById('historySection');
  const $historyList = document.getElementById('historyList');
  const $btnClearHistory = document.getElementById('btnClearHistory');
  const $toast = document.getElementById('toast');

  // --- Init worker ---
  function initWorker() {
    worker = new Worker('js/converter.worker.js');
    worker.onmessage = handleWorkerMessage;
    worker.onerror = function(e) {
      setEngineStatus('error', 'Engine error');
    };
    worker.postMessage({ type: 'init' });
  }

  function handleWorkerMessage(e) {
    const msg = e.data;

    switch (msg.type) {
      case 'init-progress':
        setEngineStatus('loading', msg.label);
        break;

      case 'ready':
        engineReady = true;
        setEngineStatus('ready', 'Ready');
        processNextInQueue();
        break;

      case 'convert-progress': {
        const item = fileQueue.find(f => f.id === msg.id);
        if (item) {
          item.progress = msg.percent;
          item.status = msg.percent >= 100 ? 'done' : 'converting';
          renderFileList();
        }
        break;
      }

      case 'result': {
        const item = fileQueue.find(f => f.id === msg.id);
        if (item) {
          item.status = 'done';
          item.progress = 100;
          item.markdown = msg.markdown;
          renderFileList();
          updateDownloadAllButton();

          // Auto-show first result
          if (!activeFileId || activeFileId === msg.id) {
            showResult(msg.id);
          }

          // Save to history
          DocToMD.History.add(msg.fileName, msg.markdown);
          renderHistory();
        }
        processNextInQueue();
        break;
      }

      case 'error': {
        if (msg.id) {
          const item = fileQueue.find(f => f.id === msg.id);
          if (item) {
            item.status = 'error';
            item.error = msg.error;
            renderFileList();
          }
          processNextInQueue();
        } else {
          setEngineStatus('error', 'Error: ' + msg.error);
        }
        break;
      }
    }
  }

  // --- Engine status ---
  function setEngineStatus(state, text) {
    $engineStatus.className = 'engine-status ' + state;
    $engineStatus.querySelector('.status-text').textContent = text;
    const dot = $engineStatus.querySelector('.status-dot');
    dot.className = 'status-dot' + (state === 'loading' ? ' loading' : '');
  }

  // --- File handling ---
  function addFiles(files) {
    const newItems = [];
    for (const file of files) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (!SUPPORTED_EXT.has(ext)) continue;

      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const item = {
        id,
        file,
        name: file.name,
        size: file.size,
        ext,
        status: 'pending',
        progress: 0,
        markdown: null,
        error: null
      };
      fileQueue.push(item);
      convertQueue.push(id);
      newItems.push(item);
    }

    if (newItems.length === 0) {
      showToast('No supported files found');
      return;
    }

    $fileQueue.hidden = false;
    renderFileList();
    processNextInQueue();
  }

  function processNextInQueue() {
    if (!engineReady) return;

    // Check if any file is currently converting
    const converting = fileQueue.find(f => f.status === 'converting');
    if (converting) return;

    // Get next pending
    const nextId = convertQueue.shift();
    if (!nextId) return;

    const item = fileQueue.find(f => f.id === nextId);
    if (!item || item.status !== 'pending') {
      processNextInQueue();
      return;
    }

    item.status = 'converting';
    item.progress = 5;
    renderFileList();

    const reader = new FileReader();
    reader.onload = function() {
      worker.postMessage({
        type: 'convert',
        id: item.id,
        fileName: item.name,
        fileBytes: reader.result
      }, [reader.result]);
    };
    reader.readAsArrayBuffer(item.file);
  }

  // --- Render file list ---
  function renderFileList() {
    $fileList.innerHTML = fileQueue.map(function(item) {
      const activeClass = item.id === activeFileId ? ' active' : '';
      const statusClass = item.status;
      const statusText = item.status === 'pending' ? 'Pending'
        : item.status === 'converting' ? item.progress + '%'
        : item.status === 'done' ? 'Done'
        : 'Error';

      const errorHtml = item.status === 'error' && item.error
        ? '<div class="file-item-error">' + escapeHtml(item.error.split('\n').pop().slice(0, 120)) + '</div>'
        : '';

      const progressHtml = item.status === 'converting'
        ? '<div class="progress-bar"><div class="progress-bar-fill" style="width:' + item.progress + '%"></div></div>'
        : '';

      return '<li class="file-item' + activeClass + '" data-id="' + item.id + '">'
        + '<div class="file-item-icon ' + extClass(item.ext) + '">' + item.ext + '</div>'
        + '<div class="file-item-info">'
        + '<div class="file-item-name">' + escapeHtml(item.name) + '</div>'
        + '<div class="file-item-meta">' + formatSize(item.size) + '</div>'
        + errorHtml
        + '</div>'
        + progressHtml
        + '<span class="file-item-status ' + statusClass + '">' + statusText + '</span>'
        + '</li>';
    }).join('');

    // Add click handlers
    $fileList.querySelectorAll('.file-item').forEach(function(el) {
      el.addEventListener('click', function() {
        showResult(el.dataset.id);
      });
    });
  }

  function extClass(ext) {
    if (['pdf', 'docx', 'xlsx', 'pptx', 'html', 'csv', 'epub'].includes(ext)) return ext;
    return 'default';
  }

  // --- Show result ---
  function showResult(id) {
    const item = fileQueue.find(f => f.id === id);
    if (!item) return;
    // Show errors in result panel too
    if (item.status === 'error' && item.error) {
      activeFileId = id;
      renderFileList();
      $resultPanel.hidden = false;
      $resultFileName.textContent = item.name + ' — Error';
      $resultRaw.textContent = item.error;
      document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'raw'));
      document.getElementById('tabRaw').classList.add('active');
      document.getElementById('tabPreview').classList.remove('active');
      return;
    }
    if (!item.markdown) return;

    activeFileId = id;
    renderFileList();

    $resultPanel.hidden = false;
    $resultFileName.textContent = item.name;
    $resultRaw.textContent = item.markdown;

    // Reset to Raw tab
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'raw'));
    document.getElementById('tabRaw').classList.add('active');
    document.getElementById('tabPreview').classList.remove('active');
    $resultPreview.innerHTML = '';
  }

  // --- Tabs ---
  document.querySelectorAll('.tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      const target = tab.dataset.tab;
      document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === target));
      document.getElementById('tabRaw').classList.toggle('active', target === 'raw');
      document.getElementById('tabPreview').classList.toggle('active', target === 'preview');

      // Lazy render preview
      if (target === 'preview' && activeFileId) {
        const item = fileQueue.find(f => f.id === activeFileId);
        if (item && item.markdown) {
          $resultPreview.innerHTML = DocToMD.Preview.render(item.markdown);
        }
      }
    });
  });

  // --- Copy ---
  $btnCopy.addEventListener('click', function() {
    const item = fileQueue.find(f => f.id === activeFileId);
    if (!item || !item.markdown) return;

    navigator.clipboard.writeText(item.markdown).then(function() {
      showToast('Copied to clipboard');
    }).catch(function() {
      showToast('Copy failed');
    });
  });

  // --- Download single ---
  $btnDownloadSingle.addEventListener('click', function() {
    const item = fileQueue.find(f => f.id === activeFileId);
    if (!item || !item.markdown) return;

    const baseName = item.name.replace(/\.[^.]+$/, '');
    downloadBlob(item.markdown, baseName + '.md', 'text/markdown');
  });

  // --- Download all (ZIP) ---
  $btnDownloadAll.addEventListener('click', async function() {
    const doneItems = fileQueue.filter(f => f.status === 'done' && f.markdown);
    if (doneItems.length === 0) return;

    const zip = new JSZip();
    doneItems.forEach(function(item) {
      const baseName = item.name.replace(/\.[^.]+$/, '');
      zip.file(baseName + '.md', item.markdown);
    });

    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, 'doctomd-export.zip', 'application/zip');
    showToast('ZIP downloaded');
  });

  function updateDownloadAllButton() {
    const doneCount = fileQueue.filter(f => f.status === 'done').length;
    $btnDownloadAll.hidden = doneCount < 2;
  }

  // --- Clear queue ---
  $btnClearQueue.addEventListener('click', function() {
    fileQueue = [];
    convertQueue = [];
    activeFileId = null;
    $fileQueue.hidden = true;
    $resultPanel.hidden = true;
    $btnDownloadAll.hidden = true;
    $fileList.innerHTML = '';
  });

  // --- Drop zone ---
  $dropZone.addEventListener('click', function() {
    $fileInput.click();
  });

  $fileInput.addEventListener('change', function() {
    if ($fileInput.files.length > 0) {
      addFiles(Array.from($fileInput.files));
      $fileInput.value = '';
    }
  });

  $dropZone.addEventListener('dragover', function(e) {
    e.preventDefault();
    $dropZone.classList.add('dragover');
  });

  $dropZone.addEventListener('dragleave', function(e) {
    e.preventDefault();
    $dropZone.classList.remove('dragover');
  });

  $dropZone.addEventListener('drop', function(e) {
    e.preventDefault();
    $dropZone.classList.remove('dragover');

    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      // Check for folder drops
      const entries = [];
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null;
        if (entry) entries.push(entry);
      }

      if (entries.some(en => en.isDirectory)) {
        readEntries(entries).then(function(files) {
          addFiles(files);
        });
        return;
      }
    }

    // Regular file drop
    if (e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  });

  // --- Folder reading (Phase 4) ---
  function readEntries(entries) {
    return new Promise(function(resolve) {
      const files = [];
      let pending = 0;

      function processEntry(entry) {
        pending++;
        if (entry.isFile) {
          entry.file(function(file) {
            const ext = file.name.split('.').pop().toLowerCase();
            if (SUPPORTED_EXT.has(ext)) {
              files.push(file);
            }
            pending--;
            if (pending === 0) resolve(files);
          }, function() {
            pending--;
            if (pending === 0) resolve(files);
          });
        } else if (entry.isDirectory) {
          const reader = entry.createReader();
          readAllEntries(reader, function(childEntries) {
            pending--;
            childEntries.forEach(processEntry);
            if (pending === 0) resolve(files);
          });
        } else {
          pending--;
          if (pending === 0) resolve(files);
        }
      }

      function readAllEntries(reader, callback) {
        const allEntries = [];
        (function readBatch() {
          reader.readEntries(function(batch) {
            if (batch.length === 0) {
              callback(allEntries);
            } else {
              allEntries.push.apply(allEntries, batch);
              readBatch(); // readEntries returns max 100 at a time
            }
          }, function() {
            callback(allEntries);
          });
        })();
      }

      entries.forEach(processEntry);
      if (pending === 0) resolve(files);
    });
  }

  // --- History ---
  function renderHistory() {
    const entries = DocToMD.History.getAll();
    $historySection.hidden = entries.length === 0;

    $historyList.innerHTML = entries.map(function(entry) {
      const charLabel = entry.charCount > 1000
        ? Math.round(entry.charCount / 1000) + 'k chars'
        : entry.charCount + ' chars';

      return '<li class="history-item" data-id="' + entry.id + '">'
        + '<div class="history-item-info">'
        + '<div class="history-item-name">' + escapeHtml(entry.fileName) + '</div>'
        + '<div class="history-item-meta">' + DocToMD.History.formatDate(entry.date) + ' · ' + charLabel + '</div>'
        + '</div>'
        + '<div class="history-item-actions">'
        + '<button class="btn btn-sm btn-outline history-restore">Restore</button>'
        + '<button class="btn btn-sm btn-outline history-delete">Delete</button>'
        + '</div>'
        + '</li>';
    }).join('');

    // Bind events
    $historyList.querySelectorAll('.history-item').forEach(function(el) {
      const id = el.dataset.id;

      el.querySelector('.history-restore').addEventListener('click', function(e) {
        e.stopPropagation();
        const entry = DocToMD.History.getById(id);
        if (!entry) return;

        // Show result directly
        $resultPanel.hidden = false;
        $resultFileName.textContent = entry.fileName + ' (restored)';
        $resultRaw.textContent = entry.markdown;

        // Reset to Raw tab
        document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'raw'));
        document.getElementById('tabRaw').classList.add('active');
        document.getElementById('tabPreview').classList.remove('active');
        $resultPreview.innerHTML = '';

        // Set a pseudo active for copy/download
        activeFileId = '__history__' + id;
        fileQueue.push({
          id: activeFileId,
          name: entry.fileName,
          markdown: entry.markdown,
          status: 'done'
        });

        showToast('Restored from history');
      });

      el.querySelector('.history-delete').addEventListener('click', function(e) {
        e.stopPropagation();
        DocToMD.History.remove(id);
        renderHistory();
      });
    });
  }

  $btnClearHistory.addEventListener('click', function() {
    DocToMD.History.clearAll();
    renderHistory();
  });

  // --- Toast ---
  let toastTimer = null;
  function showToast(msg) {
    $toast.textContent = msg;
    $toast.hidden = false;
    $toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function() {
      $toast.classList.remove('show');
      setTimeout(function() { $toast.hidden = true; }, 200);
    }, 2000);
  }

  // --- Utils ---
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function escapeHtml(str) {
    const el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }

  function downloadBlob(content, filename, mimeType) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // --- Boot ---
  renderHistory();
  initWorker();

})();
