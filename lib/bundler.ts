import type { ReactProject } from "./types";

/**
 * Builds a standalone HTML document that executes the multi-file React project
 * live in the browser iframe using Babel Standalone, Tailwind CSS CDN, and a
 * virtual module resolver with Lucide icons.
 */
export function generatePreviewHtml(project: ReactProject): string {
  const filesJson = JSON.stringify(project.files || {});
  const entryFile = project.entryFile || "src/App.tsx";

  return `<!DOCTYPE html>
<html lang="ar" dir="auto" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(project.title || "React Preview")}</title>
  
  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  
  <!-- Tailwind CSS -->
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
          colors: {
            brand: {
              50: '#fdf4f0',
              100: '#fbe8df',
              200: '#f6d1be',
              300: '#efa78a',
              400: '#e57a53',
              500: '#d95a2b',
              600: '#cb4320',
              700: '#a8321a',
              800: '#862a1b',
              900: '#6d261a',
              950: '#3b100b',
            }
          }
        }
      }
    }
  </script>

  <!-- React 18 & ReactDOM & Babel Standalone -->
  <script src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone@7/babel.min.js"></script>

  <style>
    body {
      font-family: 'Inter', 'IBM Plex Sans Arabic', system-ui, sans-serif;
      margin: 0;
      padding: 0;
      min-height: 100vh;
    }
    /* Custom scrollbars */
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(150, 150, 150, 0.2); border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(150, 150, 150, 0.4); }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 antialiased selection:bg-rose-500 selection:text-white">
  <div id="root"></div>

  <script>
    (function() {
      // Store virtual files
      const VIRTUAL_FILES = ${filesJson};
      const ENTRY_FILE = "${entryFile}";

      // Error UI renderer
      function renderError(err, context) {
        const root = document.getElementById('root');
        if (!root) return;
        const msg = err && err.message ? err.message : String(err);
        const stack = err && err.stack ? err.stack : '';
        root.innerHTML = \`
          <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; background: #0b0f17; color: #f87171; font-family: ui-monospace, monospace; direction: ltr; text-align: left;">
            <div style="max-width: 720px; width: 100%; background: #161c28; border: 1px solid #ef444440; border-radius: 16px; padding: 24px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <h2 style="font-size: 16px; font-weight: 700; color: #fca5a5; margin: 0;">React Runtime / Compilation Error</h2>
              </div>
              \${context ? \`<p style="font-size: 13px; color: #94a3b8; margin: 0 0 12px 0;">Context: <strong>\${context}</strong></p>\` : ''}
              <pre style="margin: 0; padding: 14px; background: #090d16; border-radius: 8px; font-size: 13px; color: #fca5a5; overflow-x: auto; white-space: pre-wrap; line-height: 1.5;">\${msg}</pre>
              \${stack ? \`<details style="margin-top: 14px; font-size: 12px; color: #64748b;"><summary style="cursor: pointer;">View stack trace</summary><pre style="margin-top: 8px; padding: 12px; background: #090d16; border-radius: 8px; overflow-x: auto; color: #94a3b8;">\${stack}</pre></details>\` : ''}
            </div>
          </div>
        \`;
      }

      window.onerror = function(msg, url, line, col, error) {
        renderError(error || msg, "Window Error at line " + line);
        return true;
      };
      window.onunhandledrejection = function(event) {
        renderError(event.reason || "Unhandled Promise Rejection", "Promise Rejection");
      };

      // Lucide Icon SVG definitions & generic proxy generator
      const ICON_PATHS = {
        Sparkles: '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>',
        ArrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
        ArrowLeft: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
        ArrowUp: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
        ArrowDown: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
        Check: '<path d="M20 6 9 17l-5-5"/>',
        CheckCircle: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
        Menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
        X: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
        Search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
        Star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
        Shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>',
        Zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
        Heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
        ShoppingCart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
        User: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
        Users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
        Plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
        Minus: '<path d="M5 12h14"/>',
        Trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
        Trash2: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
        Eye: '<path d="2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
        EyeOff: '<path d="9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>',
        Lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
        Unlock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
        Mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
        Phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
        Globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
        ChevronDown: '<path d="m6 9 6 6 6-6"/>',
        ChevronUp: '<path d="m18 15-6-6-6 6"/>',
        ChevronRight: '<path d="m9 18 6-6-6-6"/>',
        ChevronLeft: '<path d="m15 18-6-6 6-6"/>',
        Download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
        Upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
        Play: '<polygon points="6 3 20 12 6 21 6 3"/>',
        Pause: '<rect width="4" height="16" x="6" y="4"/><rect width="4" height="16" x="14" y="4"/>',
        Clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
        Calendar: '<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>',
        DollarSign: '<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
        Activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
        BarChart: '<line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/>',
        BarChart2: '<line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/>',
        TrendingUp: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
        TrendingDown: '<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>',
        Layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
        Settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
        Sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
        Moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
        HelpCircle: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" x2="12.01" y1="17" y2="17"/>',
        Info: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/>',
        AlertCircle: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
        Filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
        Sliders: '<line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="1" x2="7" y1="14" y2="14"/><line x1="9" x2="15" y1="8" y2="8"/><line x1="17" x2="23" y1="16" y2="16"/>',
        Share2: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>',
        Copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
        ExternalLink: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
        Code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
        Send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
        MessageSquare: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
        Cpu: '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/>',
        Compass: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
        Award: '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
        Bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
        Grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
        SlidersHorizontal: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
      };

      function createLucideIcon(name) {
        return function LucideIconComponent(props) {
          const {
            size = 20,
            className = "",
            color = "currentColor",
            strokeWidth = 2,
            ...rest
          } = props || {};

          const innerHtml = ICON_PATHS[name] || '<circle cx="12" cy="12" r="9"/><path d="m9 12 2 2 4-4"/>';
          
          return React.createElement("svg", {
            xmlns: "http://www.w3.org/2000/svg",
            width: size,
            height: size,
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: color,
            strokeWidth: strokeWidth,
            strokeLinecap: "round",
            strokeLinejoin: "round",
            className: className,
            dangerouslySetInnerHTML: { __html: innerHtml },
            ...rest
          });
        };
      }

      const lucideProxy = new Proxy({}, {
        get(target, prop) {
          if (typeof prop === "string") {
            if (!target[prop]) {
              target[prop] = createLucideIcon(prop);
            }
            return target[prop];
          }
          return undefined;
        }
      });

      // Module registry & resolver
      const moduleRegistry = {
        'react': React,
        'react-dom': ReactDOM,
        'react-dom/client': ReactDOM,
        'lucide-react': lucideProxy,
        'clsx': function() {
          var args = Array.prototype.slice.call(arguments);
          return args.filter(Boolean).join(' ');
        },
        'tailwind-merge': {
          twMerge: function() {
            var args = Array.prototype.slice.call(arguments);
            return args.filter(Boolean).join(' ');
          }
        }
      };

      const moduleCache = {};

      function normalizePath(rawPath, currentDir) {
        let p = rawPath.trim();
        // Remove leading @/
        if (p.startsWith('@/')) {
          p = 'src/' + p.slice(2);
        } else if (p.startsWith('./') || p.startsWith('../')) {
          const parts = (currentDir ? currentDir.split('/') : ['src']).concat(p.split('/'));
          const resolved = [];
          for (const part of parts) {
            if (!part || part === '.') continue;
            if (part === '..') {
              resolved.pop();
            } else {
              resolved.push(part);
            }
          }
          p = resolved.join('/');
        }

        // Try exact match or with extensions
        const candidates = [
          p,
          p + '.tsx',
          p + '.ts',
          p + '.jsx',
          p + '.js',
          p + '/index.tsx',
          p + '/index.ts',
          'src/' + p,
          'src/' + p + '.tsx',
          'src/' + p + '.ts',
          'src/' + p + '.jsx',
          'src/' + p + '.js',
          'src/components/' + p.replace(/^components\\//, '') + '.tsx',
          'src/components/' + p.replace(/^components\\//, '') + '.ts',
        ];

        for (const cand of candidates) {
          if (VIRTUAL_FILES[cand] !== undefined) {
            return cand;
          }
        }

        // Fallback: search by filename without directory
        const base = p.split('/').pop().replace(/\\.(tsx|ts|jsx|js)$/, '');
        for (const f in VIRTUAL_FILES) {
          const fBase = f.split('/').pop().replace(/\\.(tsx|ts|jsx|js)$/, '');
          if (fBase.toLowerCase() === base.toLowerCase()) {
            return f;
          }
        }

        return p;
      }

      function requireModule(moduleName, currentFile) {
        if (moduleRegistry[moduleName]) {
          return moduleRegistry[moduleName];
        }

        if (moduleName.startsWith('lucide-react')) {
          return lucideProxy;
        }

        // Check if relative or virtual file
        const currentDir = currentFile ? currentFile.split('/').slice(0, -1).join('/') : 'src';
        const targetPath = normalizePath(moduleName, currentDir);

        if (moduleCache[targetPath]) {
          return moduleCache[targetPath].exports;
        }

        if (VIRTUAL_FILES[targetPath] !== undefined) {
          return executeVirtualFile(targetPath);
        }

        // Return empty module / proxy as safe fallback
        console.warn("Module not found: " + moduleName + ", providing mock.");
        return new Proxy({}, {
          get: function(t, k) {
            if (k === '__esModule') return true;
            if (k === 'default') return function() { return null; };
            return function() { return null; };
          }
        });
      }

      function executeVirtualFile(filePath) {
        if (moduleCache[filePath]) {
          return moduleCache[filePath].exports;
        }

        const code = VIRTUAL_FILES[filePath];
        if (typeof code !== 'string') {
          throw new Error("Cannot find code for virtual file: " + filePath);
        }

        // If it's a CSS file, inject it into document head
        if (filePath.endsWith('.css')) {
          const style = document.createElement('style');
          style.setAttribute('data-file', filePath);
          style.innerHTML = code;
          document.head.appendChild(style);
          const mod = { exports: {} };
          moduleCache[filePath] = mod;
          return mod.exports;
        }

        // Transpile with Babel
        let transpiled;
        try {
          transpiled = Babel.transform(code, {
            presets: [
              ['react', { runtime: 'classic' }],
              ['typescript', { isTSX: true, allExtensions: true }]
            ],
            plugins: [
              ['transform-modules-commonjs', { loose: true }]
            ],
            filename: filePath
          }).code;
        } catch (babelErr) {
          throw new Error("Babel compilation failed in " + filePath + ": " + (babelErr.message || babelErr));
        }

        const mod = { exports: {} };
        moduleCache[filePath] = mod;

        const customRequire = function(reqPath) {
          return requireModule(reqPath, filePath);
        };

        const fn = new Function('require', 'module', 'exports', 'React', 'ReactDOM', transpiled);
        fn(customRequire, mod, mod.exports, React, ReactDOM);

        return mod.exports;
      }

      // Inject any CSS files found in VIRTUAL_FILES
      for (const f in VIRTUAL_FILES) {
        if (f.endsWith('.css')) {
          const style = document.createElement('style');
          style.setAttribute('data-file', f);
          style.innerHTML = VIRTUAL_FILES[f];
          document.head.appendChild(style);
        }
      }

      // Find entry file (App.tsx / App.jsx)
      let resolvedEntry = ENTRY_FILE;
      if (VIRTUAL_FILES[resolvedEntry] === undefined) {
        const potentialEntries = [
          'src/App.tsx',
          'src/App.jsx',
          'App.tsx',
          'App.jsx',
          'src/main.tsx',
          'src/index.tsx',
        ];
        for (const pe of potentialEntries) {
          if (VIRTUAL_FILES[pe] !== undefined) {
            resolvedEntry = pe;
            break;
          }
        }
      }

      // If still not found, pick first .tsx/.jsx file
      if (VIRTUAL_FILES[resolvedEntry] === undefined) {
        for (const f in VIRTUAL_FILES) {
          if (f.endsWith('.tsx') || f.endsWith('.jsx')) {
            resolvedEntry = f;
            break;
          }
        }
      }

      if (!resolvedEntry || VIRTUAL_FILES[resolvedEntry] === undefined) {
        renderError(new Error("No React entry file found in project. Files available: " + Object.keys(VIRTUAL_FILES).join(", ")), "Entry point resolution");
        return;
      }

      try {
        const appModule = executeVirtualFile(resolvedEntry);
        const AppComponent = appModule.default || appModule.App || appModule.Main || appModule;

        if (typeof AppComponent !== 'function' && typeof AppComponent !== 'object') {
          throw new Error("Entry file " + resolvedEntry + " does not export a valid React component. (Exported: " + typeof AppComponent + ")");
        }

        // Error boundary component
        class ErrorBoundary extends React.Component {
          constructor(props) {
            super(props);
            this.state = { hasError: false, error: null };
          }
          static getDerivedStateFromError(error) {
            return { hasError: true, error: error };
          }
          componentDidCatch(error, errorInfo) {
            console.error("React Error caught:", error, errorInfo);
          }
          render() {
            if (this.state.hasError) {
              return React.createElement("div", {
                className: "min-h-screen flex items-center justify-center p-6 bg-slate-950 text-red-400 font-mono"
              }, React.createElement("div", {
                className: "max-w-lg w-full bg-slate-900 border border-red-500/30 rounded-2xl p-6 shadow-2xl"
              }, [
                React.createElement("h2", { key: "h", className: "text-lg font-bold text-red-300 mb-2" }, "Component Render Error"),
                React.createElement("p", { key: "p", className: "text-sm text-slate-300 mb-4" }, this.state.error ? this.state.error.message : "An error occurred during rendering."),
                React.createElement("button", {
                  key: "btn",
                  onClick: () => this.setState({ hasError: false, error: null }),
                  className: "px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold"
                }, "Try again")
              ]));
            }
            return this.props.children;
          }
        }

        const rootEl = document.getElementById('root');
        const reactRoot = ReactDOM.createRoot(rootEl);
        reactRoot.render(
          React.createElement(ErrorBoundary, null, React.createElement(AppComponent, null))
        );
      } catch (execErr) {
        console.error("Execution error:", execErr);
        renderError(execErr, "React Application Bootstrap");
      }
    })();
  </script>
</body>
</html>`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
