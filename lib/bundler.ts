import type { ReactProject } from "./types";

/**
 * Builds the standalone HTML document that runs a generated project inside the
 * preview iframe: Babel Standalone for transpilation, a virtual module registry
 * for imports, and Tailwind + Lucide from CDN.
 *
 * Two design constraints shape everything here:
 *
 * 1. The code being executed is model-generated and therefore untrusted. The
 *    document is served into an iframe with an opaque origin (no
 *    `allow-same-origin`), so it cannot reach the host page, its storage, or its
 *    API routes. Browser APIs that an opaque origin denies are shimmed below so
 *    ordinary generated code still works.
 *
 * 2. Every failure must be reported to the host, not just painted. The host uses
 *    those reports to run an automatic repair pass, so a crash is a recoverable
 *    event rather than a dead end.
 */

/** Icon set used only if the Lucide CDN bundle fails to load. */
const FALLBACK_ICON_PATHS: Record<string, string> = {
  Sparkles:
    '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>',
  ArrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  ArrowLeft: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  Check: '<path d="M20 6 9 17l-5-5"/>',
  Menu: '<path d="M4 12h16"/><path d="M4 6h16"/><path d="M4 18h16"/>',
  X: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  Search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  Star:
    '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  Heart:
    '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  Eye:
    '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
  ChevronDown: '<path d="m6 9 6 6 6-6"/>',
  ChevronRight: '<path d="m9 18 6-6-6-6"/>',
  Plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  Minus: '<path d="M5 12h14"/>',
  Mail:
    '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
};

const LUCIDE_CDN = "https://unpkg.com/lucide@1.40.0/dist/umd/lucide.min.js";
const REACT_CDN = "https://unpkg.com/react@18.3.1/umd/react.production.min.js";
const REACT_DOM_CDN = "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js";
const BABEL_CDN = "https://unpkg.com/@babel/standalone@7/babel.min.js";

/**
 * Serialises data for embedding in a `<script>` block.
 *
 * Plain `JSON.stringify` is unsafe here: a generated file containing the literal
 * text `</script>` would terminate the block and corrupt the document.
 */
function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function generatePreviewHtml(project: ReactProject): string {
  const filesJson = safeJson(project.files || {});
  const entryFile = safeJson(project.entryFile || "src/App.tsx");
  const fallbackIcons = safeJson(FALLBACK_ICON_PATHS);

  return `<!DOCTYPE html>
<html lang="ar" dir="auto" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(project.title || "React Preview")}</title>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">

  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['Inter', 'IBM Plex Sans Arabic', 'system-ui', 'sans-serif'],
            arabic: ['IBM Plex Sans Arabic', 'Inter', 'system-ui', 'sans-serif'],
            mono: ['JetBrains Mono', 'monospace'],
          },
        },
      },
    };
  </script>

  <script src="${REACT_CDN}"></script>
  <script src="${REACT_DOM_CDN}"></script>
  <script src="${BABEL_CDN}"></script>
  <script src="${LUCIDE_CDN}"></script>

  <style>
    body { font-family: 'Inter', 'IBM Plex Sans Arabic', system-ui, sans-serif; margin: 0; min-height: 100vh; }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(150,150,150,.2); border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(150,150,150,.4); }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 antialiased">
  <div id="root"></div>
  <script>
${runtimeScript({ filesJson, entryFile, fallbackIcons })}
  </script>
</body>
</html>`;
}

interface RuntimeArgs {
  filesJson: string;
  entryFile: string;
  fallbackIcons: string;
}

function runtimeScript(args: RuntimeArgs): string {
  return `(function () {
  var VIRTUAL_FILES = ${args.filesJson};
  var ENTRY_FILE = ${args.entryFile};
  var FALLBACK_ICONS = ${args.fallbackIcons};

${REPORTING_BLOCK}

${STORAGE_SHIM_BLOCK}

${ICONS_BLOCK}

${SHIMS_BLOCK}

${RESOLVER_BLOCK}

${BOOTSTRAP_BLOCK}
})();`;
}

/**
 * Error channel to the host page.
 *
 * `parent.postMessage` with a wildcard target is required rather than sloppy: an
 * opaque-origin frame has no origin to name. Nothing sensitive travels this way —
 * only error text from code the host just sent in — and the host authenticates
 * messages by comparing `event.source` to its own iframe.
 */
const REPORTING_BLOCK = `  var reported = Object.create(null);

  function report(payload) {
    // One report per distinct message: React can re-throw the same error on retry.
    var fingerprint = payload.kind + '|' + payload.message;
    if (reported[fingerprint]) return;
    reported[fingerprint] = true;
    try {
      parent.postMessage({ source: 'bannaa-preview', version: 1, payload: payload }, '*');
    } catch (e) {
      /* host went away */
    }
  }

  function describe(err) {
    if (!err) return 'Unknown error';
    if (typeof err === 'string') return err;
    return err.message ? String(err.message) : String(err);
  }

  function renderError(err, context) {
    var root = document.getElementById('root');
    if (!root) return;
    var msg = describe(err);
    var stack = err && err.stack ? String(err.stack) : '';
    root.innerHTML =
      '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#0b0f17;color:#f87171;font-family:ui-monospace,monospace;direction:ltr;text-align:left">' +
        '<div style="max-width:720px;width:100%;background:#161c28;border:1px solid rgba(239,68,68,.25);border-radius:16px;padding:24px">' +
          '<h2 style="font-size:15px;font-weight:700;color:#fca5a5;margin:0 0 12px">Runtime error in preview</h2>' +
          (context ? '<p style="font-size:12px;color:#94a3b8;margin:0 0 12px">' + escapeText(context) + '</p>' : '') +
          '<pre style="margin:0;padding:14px;background:#090d16;border-radius:8px;font-size:12.5px;color:#fca5a5;overflow-x:auto;white-space:pre-wrap;line-height:1.5">' + escapeText(msg) + '</pre>' +
          (stack ? '<details style="margin-top:12px;font-size:11.5px;color:#64748b"><summary style="cursor:pointer">Stack trace</summary><pre style="margin-top:8px;padding:12px;background:#090d16;border-radius:8px;overflow-x:auto;color:#94a3b8;white-space:pre-wrap">' + escapeText(stack) + '</pre></details>' : '') +
        '</div>' +
      '</div>';
  }

  function escapeText(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function fail(err, context, file) {
    report({
      kind: 'error',
      message: describe(err),
      stack: err && err.stack ? String(err.stack).slice(0, 4000) : undefined,
      file: file,
      context: context,
    });
    renderError(err, context);
  }

  window.onerror = function (msg, url, line, col, error) {
    fail(error || msg, 'Uncaught error at line ' + line);
    return true;
  };

  window.onunhandledrejection = function (event) {
    fail(event.reason || 'Unhandled promise rejection', 'Unhandled promise rejection');
  };`;

/**
 * Storage shims for the opaque origin.
 *
 * Dropping `allow-same-origin` is what stops generated code from reaching the
 * host page, but it also makes `localStorage` and `sessionStorage` throw on
 * access — and generated apps reach for them constantly (theme toggles, carts,
 * todo lists). These in-memory replacements keep that code working; state simply
 * does not survive a preview reload, which is correct for a preview.
 */
const STORAGE_SHIM_BLOCK = `  function memoryStorage() {
    var data = Object.create(null);
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
      setItem: function (k, v) { data[k] = String(v); },
      removeItem: function (k) { delete data[k]; },
      clear: function () { data = Object.create(null); },
      key: function (i) { return Object.keys(data)[i] != null ? Object.keys(data)[i] : null; },
      get length() { return Object.keys(data).length; },
    };
  }

  ['localStorage', 'sessionStorage'].forEach(function (name) {
    var usable = false;
    try {
      var store = window[name];
      store.setItem('__bannaa__', '1');
      store.removeItem('__bannaa__');
      usable = true;
    } catch (e) {
      usable = false;
    }
    if (!usable) {
      try {
        Object.defineProperty(window, name, { value: memoryStorage(), configurable: true });
      } catch (e) {
        /* nothing further we can do */
      }
    }
  });`;

/**
 * Lucide icons, from the real 2000-icon bundle.
 *
 * The previous implementation kept ~70 icon paths by hand, so every other icon
 * silently rendered a generic checkmark, and two of the hand-copied paths were
 * malformed. Reading Lucide's own icon data removes both problems.
 */
const ICONS_BLOCK = `  var ICON_DATA = (window.lucide && window.lucide.icons) || {};
  var iconCache = Object.create(null);
  var MISSING_ICON = [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'm9 12 2 2 4-4' }]];

  // Generated code writes both <Eye /> and <EyeIcon />; Lucide's data uses the
  // bare name, so the alias is normalised away before lookup.
  function iconNodes(name) {
    if (ICON_DATA[name]) return ICON_DATA[name];
    var bare = name.replace(/Icon$/, '');
    if (ICON_DATA[bare]) return ICON_DATA[bare];
    if (FALLBACK_ICONS[name] || FALLBACK_ICONS[bare]) return FALLBACK_ICONS[name] || FALLBACK_ICONS[bare];
    return null;
  }

  function createLucideIcon(name) {
    return function LucideIcon(props) {
      var p = props || {};
      var size = p.size == null ? 24 : p.size;
      var rest = {};
      for (var k in p) {
        if (k !== 'size' && k !== 'color' && k !== 'strokeWidth' && k !== 'absoluteStrokeWidth') rest[k] = p[k];
      }

      var svgProps = Object.assign(
        {
          xmlns: 'http://www.w3.org/2000/svg',
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: p.color || 'currentColor',
          strokeWidth: p.strokeWidth == null ? 2 : p.strokeWidth,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': p['aria-label'] ? undefined : 'true',
        },
        rest
      );

      var nodes = iconNodes(name);

      // The hand-written fallback set stores raw markup, not node tuples.
      if (typeof nodes === 'string') {
        svgProps.dangerouslySetInnerHTML = { __html: nodes };
        return React.createElement('svg', svgProps);
      }

      var children = (nodes || MISSING_ICON).map(function (node, i) {
        return React.createElement(node[0], Object.assign({ key: i }, node[1]));
      });
      return React.createElement('svg', svgProps, children);
    };
  }

  var lucideProxy = new Proxy(
    {},
    {
      get: function (target, prop) {
        if (typeof prop !== 'string') return undefined;
        if (prop === '__esModule') return true;
        if (!iconCache[prop]) iconCache[prop] = createLucideIcon(prop);
        return iconCache[prop];
      },
      has: function () { return true; },
    }
  );`;

/**
 * Shims for the non-React packages generated code imports most often.
 *
 * `framer-motion` matters most: the old catch-all returned functions that render
 * `null`, so a page built from `motion.div` elements came out blank with no error
 * to explain it. A passthrough that drops the animation props renders the real
 * layout, unanimated.
 */
const SHIMS_BLOCK = `  function classNames() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) {
      var arg = arguments[i];
      if (!arg) continue;
      if (typeof arg === 'string' || typeof arg === 'number') out.push(arg);
      else if (Array.isArray(arg)) out.push(classNames.apply(null, arg));
      else if (typeof arg === 'object') {
        for (var key in arg) if (arg[key]) out.push(key);
      }
    }
    return out.filter(Boolean).join(' ');
  }

  var MOTION_PROPS = {
    initial: 1, animate: 1, exit: 1, transition: 1, variants: 1, whileHover: 1,
    whileTap: 1, whileInView: 1, whileFocus: 1, whileDrag: 1, viewport: 1,
    layout: 1, layoutId: 1, drag: 1, dragConstraints: 1, dragElastic: 1,
    onAnimationComplete: 1, onAnimationStart: 1, custom: 1, transformTemplate: 1,
  };

  function stripMotionProps(props) {
    var clean = {};
    for (var key in props) {
      if (MOTION_PROPS[key]) continue;
      if (key.indexOf('while') === 0 || key.indexOf('drag') === 0) continue;
      clean[key] = props[key];
    }
    return clean;
  }

  var motionCache = Object.create(null);
  var motion = new Proxy(
    {},
    {
      get: function (target, tag) {
        if (typeof tag !== 'string') return undefined;
        if (!motionCache[tag]) {
          motionCache[tag] = React.forwardRef(function MotionComponent(props, ref) {
            var clean = stripMotionProps(props || {});
            clean.ref = ref;
            return React.createElement(tag, clean);
          });
        }
        return motionCache[tag];
      },
    }
  );

  function Passthrough(props) {
    return React.createElement(React.Fragment, null, (props || {}).children);
  }

  var framerMotion = {
    __esModule: true,
    motion: motion,
    m: motion,
    AnimatePresence: Passthrough,
    LayoutGroup: Passthrough,
    MotionConfig: Passthrough,
    useAnimation: function () {
      return { start: function () { return Promise.resolve(); }, stop: function () {}, set: function () {} };
    },
    useInView: function () { return true; },
    useScroll: function () { return { scrollY: { get: function () { return 0; }, onChange: function () {} } }; },
    useMotionValue: function (v) { return { get: function () { return v; }, set: function () {} }; },
    useTransform: function () { return { get: function () { return 0; }, set: function () {} }; },
    useReducedMotion: function () { return false; },
  };

  // Minimal zustand: enough for a preview store, without middleware.
  function zustandCreate(initializer) {
    var state;
    var listeners = new Set();
    var setState = function (partial, replace) {
      var next = typeof partial === 'function' ? partial(state) : partial;
      state = replace ? next : Object.assign({}, state, next);
      listeners.forEach(function (l) { l(state); });
    };
    var getState = function () { return state; };
    state = initializer(setState, getState, { setState: setState, getState: getState });

    var useStore = function (selector) {
      var pick = selector || function (s) { return s; };
      var value = React.useState(function () { return pick(state); });
      var setValue = value[1];
      React.useEffect(function () {
        var listener = function (s) { setValue(pick(s)); };
        listeners.add(listener);
        listener(state);
        return function () { listeners.delete(listener); };
      }, []);
      return pick(state);
    };
    useStore.getState = getState;
    useStore.setState = setState;
    useStore.subscribe = function (l) { listeners.add(l); return function () { listeners.delete(l); }; };
    return useStore;
  }`;

const RESOLVER_BLOCK = `  var moduleRegistry = {
    react: React,
    'react-dom': ReactDOM,
    'react-dom/client': ReactDOM,
    'lucide-react': lucideProxy,
    clsx: Object.assign(classNames, { __esModule: true, default: classNames, clsx: classNames }),
    'class-variance-authority': { __esModule: true, cva: function () { return classNames; }, cx: classNames },
    'tailwind-merge': { __esModule: true, twMerge: classNames, twJoin: classNames, default: classNames },
    'framer-motion': framerMotion,
    motion: framerMotion,
    zustand: { __esModule: true, create: zustandCreate, default: zustandCreate },
  };

  var moduleCache = {};

  function normalizePath(rawPath, currentDir) {
    var p = rawPath.trim();
    if (p.indexOf('@/') === 0) {
      p = 'src/' + p.slice(2);
    } else if (p.indexOf('./') === 0 || p.indexOf('../') === 0) {
      var parts = (currentDir ? currentDir.split('/') : ['src']).concat(p.split('/'));
      var resolved = [];
      for (var i = 0; i < parts.length; i++) {
        var part = parts[i];
        if (!part || part === '.') continue;
        if (part === '..') resolved.pop();
        else resolved.push(part);
      }
      p = resolved.join('/');
    }

    var candidates = [
      p, p + '.tsx', p + '.ts', p + '.jsx', p + '.js',
      p + '/index.tsx', p + '/index.ts', p + '/index.jsx', p + '/index.js',
      'src/' + p, 'src/' + p + '.tsx', 'src/' + p + '.ts', 'src/' + p + '.jsx', 'src/' + p + '.js',
      'src/components/' + p.replace(/^components\\//, '') + '.tsx',
      'src/components/' + p.replace(/^components\\//, '') + '.ts',
    ];

    for (var c = 0; c < candidates.length; c++) {
      if (VIRTUAL_FILES[candidates[c]] !== undefined) return candidates[c];
    }

    // Last resort: match on basename, since models sometimes invent a directory.
    var base = p.split('/').pop().replace(/\\.(tsx|ts|jsx|js)$/, '').toLowerCase();
    for (var f in VIRTUAL_FILES) {
      var fBase = f.split('/').pop().replace(/\\.(tsx|ts|jsx|js)$/, '').toLowerCase();
      if (fBase === base) return f;
    }

    return p;
  }

  function unresolvedModule(moduleName) {
    // Reported but not thrown: an unused import must not blank the whole page,
    // and the host can offer a repair pass with this exact module name.
    report({ kind: 'missing-module', message: moduleName, module: moduleName });
    return new Proxy(
      {},
      {
        get: function (t, k) {
          if (k === '__esModule') return true;
          if (k === 'default') return function () { return null; };
          return function () { return null; };
        },
      }
    );
  }

  function requireModule(moduleName, currentFile) {
    if (moduleRegistry[moduleName]) return moduleRegistry[moduleName];
    if (moduleName.indexOf('lucide-react') === 0) return lucideProxy;
    if (moduleName.indexOf('react/') === 0) return React;

    var isRelative =
      moduleName.indexOf('.') === 0 || moduleName.indexOf('@/') === 0 || moduleName.indexOf('/') === 0;

    var currentDir = currentFile ? currentFile.split('/').slice(0, -1).join('/') : 'src';
    var targetPath = normalizePath(moduleName, currentDir);

    if (moduleCache[targetPath]) return moduleCache[targetPath].exports;
    if (VIRTUAL_FILES[targetPath] !== undefined) return executeVirtualFile(targetPath);

    // A relative import that resolves to nothing is a real bug in the generated
    // project — a component was imported but never written — so it is worth an
    // error the repair pass can act on directly.
    if (isRelative) {
      var err = new Error(
        'Cannot resolve "' + moduleName + '" from ' + (currentFile || 'entry') +
        '. The file was imported but never generated. Available files: ' + Object.keys(VIRTUAL_FILES).join(', ')
      );
      err.bannaaFile = currentFile;
      throw err;
    }

    return unresolvedModule(moduleName);
  }

  function injectCss(filePath, code) {
    var style = document.createElement('style');
    style.setAttribute('data-file', filePath);
    style.textContent = code;
    document.head.appendChild(style);
  }

  function executeVirtualFile(filePath) {
    if (moduleCache[filePath]) return moduleCache[filePath].exports;

    var code = VIRTUAL_FILES[filePath];
    if (typeof code !== 'string') throw new Error('Cannot find code for virtual file: ' + filePath);

    if (/\\.css$/.test(filePath)) {
      injectCss(filePath, code);
      moduleCache[filePath] = { exports: {} };
      return moduleCache[filePath].exports;
    }

    if (/\\.json$/.test(filePath)) {
      moduleCache[filePath] = { exports: JSON.parse(code) };
      return moduleCache[filePath].exports;
    }

    var transpiled;
    try {
      transpiled = Babel.transform(code, {
        presets: [
          ['react', { runtime: 'classic' }],
          ['typescript', { isTSX: true, allExtensions: true }],
        ],
        plugins: [['transform-modules-commonjs', { loose: true }]],
        filename: filePath,
      }).code;
    } catch (babelErr) {
      var compileError = new Error(
        'Syntax error in ' + filePath + ': ' + (babelErr.message || babelErr)
      );
      compileError.bannaaFile = filePath;
      throw compileError;
    }

    var mod = { exports: {} };
    moduleCache[filePath] = mod;

    var fn = new Function(
      'require', 'module', 'exports', 'React', 'ReactDOM',
      transpiled
    );
    fn(function (reqPath) { return requireModule(reqPath, filePath); }, mod, mod.exports, React, ReactDOM);

    return mod.exports;
  }`;

const BOOTSTRAP_BLOCK = `  for (var cssFile in VIRTUAL_FILES) {
    if (/\\.css$/.test(cssFile)) injectCss(cssFile, VIRTUAL_FILES[cssFile]);
  }

  function resolveEntry() {
    if (VIRTUAL_FILES[ENTRY_FILE] !== undefined) return ENTRY_FILE;
    var preferred = ['src/App.tsx', 'src/App.jsx', 'App.tsx', 'App.jsx', 'src/main.tsx', 'src/index.tsx'];
    for (var i = 0; i < preferred.length; i++) {
      if (VIRTUAL_FILES[preferred[i]] !== undefined) return preferred[i];
    }
    for (var f in VIRTUAL_FILES) {
      if (/\\.(tsx|jsx)$/.test(f)) return f;
    }
    return null;
  }

  function ErrorBoundaryFactory() {
    function ErrorBoundary(props) {
      React.Component.call(this, props);
      this.state = { error: null };
    }
    ErrorBoundary.prototype = Object.create(React.Component.prototype);
    ErrorBoundary.prototype.constructor = ErrorBoundary;
    ErrorBoundary.getDerivedStateFromError = function (error) { return { error: error }; };
    ErrorBoundary.prototype.componentDidCatch = function (error, info) {
      report({
        kind: 'error',
        message: describe(error),
        stack: (error && error.stack ? String(error.stack) : '').slice(0, 2000),
        componentStack: info && info.componentStack ? String(info.componentStack).slice(0, 1500) : undefined,
        context: 'React render',
      });
    };
    ErrorBoundary.prototype.render = function () {
      if (this.state.error) {
        renderError(this.state.error, 'React render');
        return null;
      }
      return this.props.children;
    };
    return ErrorBoundary;
  }

  var entry = resolveEntry();
  if (!entry) {
    fail(
      new Error('No React entry file found. Files: ' + Object.keys(VIRTUAL_FILES).join(', ')),
      'Entry point resolution'
    );
    return;
  }

  try {
    var appModule = executeVirtualFile(entry);
    var App = appModule.default || appModule.App || appModule.Main;

    if (typeof App !== 'function') {
      throw new Error(
        entry + ' does not export a React component as its default export (got ' + typeof App + ').'
      );
    }

    ReactDOM.createRoot(document.getElementById('root')).render(
      React.createElement(ErrorBoundaryFactory(), null, React.createElement(App, null))
    );

    report({ kind: 'ready', message: 'ok' });
  } catch (execErr) {
    fail(execErr, 'Application bootstrap', execErr && execErr.bannaaFile);
  }`;
