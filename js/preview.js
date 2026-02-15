/* ========================================
   DocToMD — Preview Module (marked + hljs)
   ======================================== */

window.DocToMD = window.DocToMD || {};

DocToMD.Preview = (function() {
  let _initialized = false;

  function _init() {
    if (_initialized) return;
    _initialized = true;

    marked.setOptions({
      breaks: true,
      gfm: true,
      highlight: function(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
          try { return hljs.highlight(code, { language: lang }).value; } catch (e) { /* fall through */ }
        }
        try { return hljs.highlightAuto(code).value; } catch (e) { /* fall through */ }
        return code;
      }
    });
  }

  function render(markdown) {
    _init();
    try {
      return marked.parse(markdown);
    } catch (e) {
      return '<pre>' + _escapeHtml(markdown) + '</pre>';
    }
  }

  function _escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  return { render };
})();
