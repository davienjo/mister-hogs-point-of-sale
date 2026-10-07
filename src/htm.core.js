/* Minimal, self-contained tagged-template → h(type, props, ...children) compiler,
   covering exactly the syntax this app's templates use:
     <tag attr="x" attr={expr} bool ...>children</tag>
     <tag ... />                       (self-closing)
     <${Expr} ...>...<//>              (component via interpolated type, htm-style short close)
     ${expr} in text / attribute position
   No JSX build step and no external library — everything runs in the browser as-is. */
(function () {
  function parse(strings) {
    var buf = [];
    for (var i = 0; i < strings.length; i++) { buf.push(strings[i]); if (i < strings.length - 1) buf.push({ hole: i }); }
    var toks = [];
    buf.forEach(function (b) { if (typeof b === 'string') { if (b) toks.push({ t: 's', v: b }); } else toks.push({ t: 'h', i: b.hole }); });
    var ti = 0, ci = 0;
    function cur() { return ti < toks.length ? toks[ti] : null; }
    function atHole() { var c = cur(); return !!(c && c.t === 'h'); }
    function peekChar() { var c = cur(); if (!c || c.t === 'h') return null; return c.v[ci]; }
    function advanceChar() { var c = cur(); var ch = c.v[ci]; ci++; if (ci >= c.v.length) { ti++; ci = 0; } return ch; }
    function takeHole() { var c = cur(); ti++; return c.i; }
    function skipWs() { var ch; while ((ch = peekChar()) !== null && /\s/.test(ch)) advanceChar(); }
    function atEnd() { return !cur(); }
    function startsWith(s) { var c = cur(); if (!c || c.t !== 's') return false; return c.v.slice(ci, ci + s.length) === s; }
    function consumeLiteral(s) { for (var k = 0; k < s.length; k++) advanceChar(); }

    function readNodes(stopAtClose) {
      var kids = []; var text = '';
      function flush() { if (text !== '') { kids.push({ text: text }); text = ''; } }
      while (true) {
        if (atEnd()) { flush(); return kids; }
        if (stopAtClose && (startsWith('<//>') || startsWith('</'))) { flush(); return kids; }
        if (peekChar() === '<') { flush(); kids.push(readElement()); continue; }
        if (atHole()) { flush(); kids.push({ expr: takeHole() }); continue; }
        text += advanceChar();
      }
    }
    function readChildren() { return readNodes(true); }
    function readTagName() {
      if (atHole()) return { expr: takeHole() };
      var name = '';
      while (true) { var ch = peekChar(); if (ch === null || /[\s/>]/.test(ch)) break; name += advanceChar(); }
      return { lit: name };
    }
    function readAttrs() {
      var attrs = [];
      while (true) {
        skipWs();
        if (peekChar() === '/' || peekChar() === '>' || atEnd()) return attrs;
        var name = '';
        while (true) { var ch = peekChar(); if (ch === null || /[\s=/>]/.test(ch)) break; name += advanceChar(); }
        if (!name) { if (atHole()) { takeHole(); continue; } return attrs; }
        skipWs();
        if (peekChar() === '=') {
          advanceChar(); skipWs();
          var val; var q = peekChar();
          if (q === '"' || q === "'") { advanceChar(); var s2 = ''; while (peekChar() !== q) s2 += advanceChar(); advanceChar(); val = { lit: s2 }; }
          else if (atHole()) { val = { expr: takeHole() }; }
          else { val = { lit: '' }; }
          attrs.push({ name: name, value: val });
        } else { attrs.push({ name: name, value: { lit: true } }); }
      }
    }
    function readElement() {
      advanceChar();
      var tagName = readTagName();
      var attrs = readAttrs();
      skipWs();
      if (peekChar() === '/') { advanceChar(); if (peekChar() === '>') advanceChar(); return { tag: tagName, attrs: attrs, children: [] }; }
      if (peekChar() === '>') advanceChar();
      var children = readChildren();
      if (startsWith('<//>')) consumeLiteral('<//>');
      else if (startsWith('</')) { consumeLiteral('</'); while (peekChar() !== '>' && peekChar() !== null) advanceChar(); if (peekChar() === '>') advanceChar(); }
      return { tag: tagName, attrs: attrs, children: children };
    }
    skipWs();
    return readNodes(false);
  }

  function buildOne(h, node, values) {
    if (node.text !== undefined) return node.text;
    if (node.expr !== undefined) return values[node.expr];
    var type = node.tag.lit !== undefined ? node.tag.lit : values[node.tag.expr];
    var props = null;
    node.attrs.forEach(function (a) {
      var v = a.value.expr !== undefined ? values[a.value.expr] : a.value.lit;
      props = props || {};
      props[a.name] = v;
    });
    var kids = node.children.map(function (c) { return buildOne(h, c, values); }).filter(function (v) { return v !== '' && v !== null && v !== undefined; });
    return h.apply(null, [type, props].concat(kids));
  }

  function tag(strings) {
    var values = Array.prototype.slice.call(arguments, 1);
    var nodes = parse(strings).filter(function (n) { return n.text === undefined || n.text.trim() !== ''; });
    var built = nodes.map(function (n) { return buildOne(this, n, values); }, this);
    return built.length > 1 ? built : built[0];
  }

  window.htm = { bind: function (h) { return tag.bind(h); } };
})();
