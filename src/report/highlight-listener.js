(function() {
  var PADDING = 8;

  var phase = null; // 'before' or 'after', set on first highlight message

  var css = document.createElement('style');
  css.textContent = [
    '@keyframes vr-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }',
    '.vr-hl-overlay {',
    '  position: absolute; pointer-events: none; z-index: 2147483647;',
    '  border-radius: 4px; display: none;',
    '  border: 3px solid var(--vr-hl-color, #f59e0b);',
    '}',
    '.vr-hl-overlay.pulse {',
    '  animation: vr-pulse 2s ease-in-out infinite;',
    '}',
    '.vr-hl-label {',
    '  position: absolute; top: -22px; left: -3px;',
    '  font: 600 10px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
    '  padding: 3px 6px; border-radius: 3px 3px 0 0;',
    '  background: var(--vr-hl-color, #f59e0b); color: #fff;',
    '  white-space: nowrap; letter-spacing: 0.04em; text-transform: uppercase;',
    '}',
    '.vr-box-overlay {',
    '  position: absolute; pointer-events: none; z-index: 2147483646; display: none;',
    '}',
    '#vr-hl-msg {',
    '  position: absolute; pointer-events: none; z-index: 2147483647; display: none;',
    '  background: #1e293b; color: #fbbf24;',
    '  font: 600 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
    '  padding: 8px 14px; border-radius: 6px; border: 2px solid #f59e0b;',
    '  white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,.4);',
    '}',
  ].join('\n');
  document.head.appendChild(css);

  var msgEl = document.createElement('div');
  msgEl.id = 'vr-hl-msg';
  document.body.appendChild(msgEl);

  var overlays = [];
  var flashTimer = null;
  var pulseTimer = null;

  function clearTimers() {
    if (flashTimer) { clearTimeout(flashTimer); flashTimer = null; }
    if (pulseTimer) { clearTimeout(pulseTimer); pulseTimer = null; }
  }

  var TYPE_COLORS = {
    changed: '#f59e0b',
    added: '#3fb950',
    removed: '#f85149',
    moved: '#a371f7',
    'moved+changed': '#a371f7',
  };

  function hexToRgba(hex, alpha) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    var r = parseInt(hex.substring(0,2), 16);
    var g = parseInt(hex.substring(2,4), 16);
    var b = parseInt(hex.substring(4,6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  // ── Box model (padding/margin) overlays ──────────────────────

  var MARGIN_COLOR = 'rgba(246, 178, 107, 0.55)';
  var PADDING_COLOR = 'rgba(147, 196, 125, 0.55)';

  var PADDING_SIDES = ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'];
  var MARGIN_SIDES = ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'];

  var boxOverlays = [];

  function clearBoxOverlays() {
    for (var i = 0; i < boxOverlays.length; i++) {
      if (boxOverlays[i]) boxOverlays[i].style.display = 'none';
    }
  }

  function getOrCreateBoxOverlay(index) {
    if (boxOverlays[index]) return boxOverlays[index];
    var el = document.createElement('div');
    el.className = 'vr-box-overlay';
    document.body.appendChild(el);
    boxOverlays[index] = el;
    return el;
  }

  function drawBoxModelOverlays(el, changedProps) {
    if (!changedProps || !changedProps.length) return;
    var hasPadding = false, hasMargin = false;
    for (var i = 0; i < changedProps.length; i++) {
      if (PADDING_SIDES.indexOf(changedProps[i]) !== -1) hasPadding = true;
      if (MARGIN_SIDES.indexOf(changedProps[i]) !== -1) hasMargin = true;
    }
    if (!hasPadding && !hasMargin) return;

    var cs = getComputedStyle(el);
    var rect = el.getBoundingClientRect();
    var sx = window.scrollX;
    var sy = window.scrollY;
    var idx = 0;

    if (hasMargin) {
      var mt = parseFloat(cs.marginTop) || 0;
      var mr = parseFloat(cs.marginRight) || 0;
      var mb = parseFloat(cs.marginBottom) || 0;
      var ml = parseFloat(cs.marginLeft) || 0;

      // Top margin
      if (mt !== 0 && changedProps.indexOf('margin-top') !== -1) {
        var ov = getOrCreateBoxOverlay(idx++);
        ov.style.cssText = 'position:absolute;pointer-events:none;z-index:2147483646;display:block;'
          + 'left:' + (rect.left + sx - ml) + 'px;'
          + 'top:' + (rect.top + sy - Math.abs(mt)) + 'px;'
          + 'width:' + (rect.width + ml + mr) + 'px;'
          + 'height:' + Math.abs(mt) + 'px;'
          + 'background:' + MARGIN_COLOR + ';';
      }
      // Bottom margin
      if (mb !== 0 && changedProps.indexOf('margin-bottom') !== -1) {
        var ov = getOrCreateBoxOverlay(idx++);
        ov.style.cssText = 'position:absolute;pointer-events:none;z-index:2147483646;display:block;'
          + 'left:' + (rect.left + sx - ml) + 'px;'
          + 'top:' + (rect.bottom + sy) + 'px;'
          + 'width:' + (rect.width + ml + mr) + 'px;'
          + 'height:' + Math.abs(mb) + 'px;'
          + 'background:' + MARGIN_COLOR + ';';
      }
      // Left margin
      if (ml !== 0 && changedProps.indexOf('margin-left') !== -1) {
        var ov = getOrCreateBoxOverlay(idx++);
        ov.style.cssText = 'position:absolute;pointer-events:none;z-index:2147483646;display:block;'
          + 'left:' + (rect.left + sx - Math.abs(ml)) + 'px;'
          + 'top:' + (rect.top + sy) + 'px;'
          + 'width:' + Math.abs(ml) + 'px;'
          + 'height:' + rect.height + 'px;'
          + 'background:' + MARGIN_COLOR + ';';
      }
      // Right margin
      if (mr !== 0 && changedProps.indexOf('margin-right') !== -1) {
        var ov = getOrCreateBoxOverlay(idx++);
        ov.style.cssText = 'position:absolute;pointer-events:none;z-index:2147483646;display:block;'
          + 'left:' + (rect.right + sx) + 'px;'
          + 'top:' + (rect.top + sy) + 'px;'
          + 'width:' + Math.abs(mr) + 'px;'
          + 'height:' + rect.height + 'px;'
          + 'background:' + MARGIN_COLOR + ';';
      }
    }

    if (hasPadding) {
      var pt = parseFloat(cs.paddingTop) || 0;
      var pr = parseFloat(cs.paddingRight) || 0;
      var pb = parseFloat(cs.paddingBottom) || 0;
      var pl = parseFloat(cs.paddingLeft) || 0;

      // Top padding
      if (pt !== 0 && changedProps.indexOf('padding-top') !== -1) {
        var ov = getOrCreateBoxOverlay(idx++);
        ov.style.cssText = 'position:absolute;pointer-events:none;z-index:2147483646;display:block;'
          + 'left:' + (rect.left + sx) + 'px;'
          + 'top:' + (rect.top + sy) + 'px;'
          + 'width:' + rect.width + 'px;'
          + 'height:' + pt + 'px;'
          + 'background:' + PADDING_COLOR + ';';
      }
      // Bottom padding
      if (pb !== 0 && changedProps.indexOf('padding-bottom') !== -1) {
        var ov = getOrCreateBoxOverlay(idx++);
        ov.style.cssText = 'position:absolute;pointer-events:none;z-index:2147483646;display:block;'
          + 'left:' + (rect.left + sx) + 'px;'
          + 'top:' + (rect.bottom + sy - pb) + 'px;'
          + 'width:' + rect.width + 'px;'
          + 'height:' + pb + 'px;'
          + 'background:' + PADDING_COLOR + ';';
      }
      // Left padding
      if (pl !== 0 && changedProps.indexOf('padding-left') !== -1) {
        var ov = getOrCreateBoxOverlay(idx++);
        ov.style.cssText = 'position:absolute;pointer-events:none;z-index:2147483646;display:block;'
          + 'left:' + (rect.left + sx) + 'px;'
          + 'top:' + (rect.top + sy + pt) + 'px;'
          + 'width:' + pl + 'px;'
          + 'height:' + (rect.height - pt - pb) + 'px;'
          + 'background:' + PADDING_COLOR + ';';
      }
      // Right padding
      if (pr !== 0 && changedProps.indexOf('padding-right') !== -1) {
        var ov = getOrCreateBoxOverlay(idx++);
        ov.style.cssText = 'position:absolute;pointer-events:none;z-index:2147483646;display:block;'
          + 'left:' + (rect.right + sx - pr) + 'px;'
          + 'top:' + (rect.top + sy + pt) + 'px;'
          + 'width:' + pr + 'px;'
          + 'height:' + (rect.height - pt - pb) + 'px;'
          + 'background:' + PADDING_COLOR + ';';
      }
    }
  }

  // ── Standard highlight overlays ─────────────────────────────

  function getOrCreateOverlay(index) {
    if (overlays[index]) return overlays[index];
    var el = document.createElement('div');
    el.className = 'vr-hl-overlay';
    var label = document.createElement('span');
    label.className = 'vr-hl-label';
    el.appendChild(label);
    document.body.appendChild(el);
    overlays[index] = el;
    return el;
  }

  function getLabelText(type, rect) {
    if (!phase) return '';
    var prefix;
    if (type === 'removed') prefix = phase === 'before' ? 'removed' : '';
    else if (type === 'added') prefix = phase === 'after' ? 'added' : '';
    else if (type === 'moved' || type === 'moved+changed') prefix = 'moved';
    else prefix = phase === 'before' ? 'before' : 'after';
    if (!prefix) return '';
    if (rect) {
      var w = Math.round(rect.width);
      var h = Math.round(rect.height);
      return prefix + '  ' + w + ' × ' + h;
    }
    return prefix;
  }

  function positionOverlay(ov, rect, color) {
    var sx = window.scrollX;
    var sy = window.scrollY;
    ov.style.left = (rect.left + sx - PADDING) + 'px';
    ov.style.top = (rect.top + sy - PADDING) + 'px';
    ov.style.width = (rect.width + PADDING * 2) + 'px';
    ov.style.height = (rect.height + PADDING * 2) + 'px';
    ov.style.setProperty('--vr-hl-color', color);
  }

  function isHidden(el) {
    var s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return true;
    var rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return true;
    return false;
  }

  function findVisibleAncestor(el) {
    var cur = el.parentElement;
    while (cur && cur !== document.documentElement) {
      if (!isHidden(cur)) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  function highlightSingle(el, type, ovIndex, shouldScroll) {
    var color = TYPE_COLORS[type] || TYPE_COLORS.changed;
    var ov = getOrCreateOverlay(ovIndex);
    ov.className = 'vr-hl-overlay';
    ov.style.transition = 'none';
    var label = ov.querySelector('.vr-hl-label');

    if (isHidden(el)) {
      var ancestor = findVisibleAncestor(el);
      if (ancestor) {
        var aRect = ancestor.getBoundingClientRect();
        positionOverlay(ov, aRect, color);
        ov.style.background = 'transparent';
        ov.style.opacity = '0.5';
        ov.style.display = 'block';
        if (label) {
          label.textContent = getLabelText(type, null);
          label.style.display = '';
          var aLabelTop = aRect.top - PADDING - 22;
          if (aLabelTop < 0) {
            label.style.top = 'auto';
            label.style.bottom = '-22px';
            label.style.borderRadius = '0 0 3px 3px';
          } else {
            label.style.top = '-22px';
            label.style.bottom = 'auto';
            label.style.borderRadius = '3px 3px 0 0';
          }
        }

        if (ovIndex === 0) {
          msgEl.textContent = 'Element not visible at current zoom';
          var sx = window.scrollX;
          var sy = window.scrollY;
          msgEl.style.left = (aRect.left + sx) + 'px';
          msgEl.style.top = (aRect.bottom + sy + 6) + 'px';
          msgEl.style.display = 'block';
        }
      }
      return;
    }

    if (ovIndex === 0) msgEl.style.display = 'none';

    if (shouldScroll) {
      var NAV_HEIGHT = 80;
      var BOTTOM_MARGIN = 120;
      el.scrollIntoView({ behavior: 'instant', block: 'nearest' });
      var rect = el.getBoundingClientRect();
      if (rect.top < NAV_HEIGHT) {
        el.scrollIntoView({ behavior: 'instant', block: 'start' });
        window.scrollBy(0, -NAV_HEIGHT);
      } else if (rect.bottom > window.innerHeight - BOTTOM_MARGIN) {
        window.scrollBy(0, rect.bottom - (window.innerHeight - BOTTOM_MARGIN));
      }
    }

    var rect = el.getBoundingClientRect();
    var labelText = getLabelText(type, rect);
    if (label) {
      label.textContent = labelText;
      label.style.display = labelText ? '' : 'none';
    }
    positionOverlay(ov, rect, color);

    // Flip label below the overlay when it would clip off the top of the viewport
    if (label && labelText) {
      var labelTop = rect.top - PADDING - 22;
      if (labelTop < 0) {
        label.style.top = 'auto';
        label.style.bottom = '-22px';
        label.style.borderRadius = '0 0 3px 3px';
      } else {
        label.style.top = '-22px';
        label.style.bottom = 'auto';
        label.style.borderRadius = '3px 3px 0 0';
      }
    }

    ov.style.background = hexToRgba(color, 0.35);
    ov.style.opacity = '1';
    ov.style.display = 'block';
  }

  function clearHighlight() {
    clearTimers();
    for (var i = 0; i < overlays.length; i++) {
      if (overlays[i]) {
        overlays[i].className = 'vr-hl-overlay';
        overlays[i].style.transition = 'none';
        overlays[i].style.display = 'none';
        overlays[i].style.background = 'transparent';
      }
    }
    clearBoxOverlays();
    msgEl.style.display = 'none';
  }

  function startFadeAndPulse() {
    clearTimers();
    flashTimer = setTimeout(function() {
      for (var i = 0; i < overlays.length; i++) {
        if (overlays[i] && overlays[i].style.display !== 'none') {
          overlays[i].offsetHeight;
          overlays[i].style.transition = 'background 0.5s ease-out';
          overlays[i].style.background = 'transparent';
        }
      }
      pulseTimer = setTimeout(function() {
        for (var i = 0; i < overlays.length; i++) {
          if (overlays[i] && overlays[i].style.display !== 'none') {
            overlays[i].style.transition = 'none';
            overlays[i].className = 'vr-hl-overlay pulse';
          }
        }
      }, 550);
    }, 100);
  }

  window.addEventListener('message', function(e) {
    if (!e.data || e.data.source !== 'vr-report') return;

    if (e.data.action === 'clear') {
      clearHighlight();
      return;
    }

    if (e.data.action === 'highlight' && e.data.idx != null) {
      clearHighlight();
      if (e.data.phase) phase = e.data.phase;
      var el = document.querySelector('[data-vr-idx="' + e.data.idx + '"]');
      if (el) {
        highlightSingle(el, e.data.type || 'changed', 0, true);
        if (e.data.changedProps && e.data.changedProps.length) {
          drawBoxModelOverlays(el, e.data.changedProps);
        }
        startFadeAndPulse();
      }
      return;
    }

    if (e.data.action === 'highlight-multi' && e.data.indices) {
      clearHighlight();
      if (e.data.phase) phase = e.data.phase;
      var indices = e.data.indices;
      var type = e.data.type || 'changed';
      var scrolled = false;
      for (var i = 0; i < indices.length; i++) {
        var el = document.querySelector('[data-vr-idx="' + indices[i] + '"]');
        if (el) {
          highlightSingle(el, type, i, !scrolled);
          scrolled = true;
        }
      }
      startFadeAndPulse();
    }
  });
})();
