import JSZip from "jszip";
import type { ReactProject } from "./types";

export async function createProjectZip(project: ReactProject): Promise<Blob> {
  const zip = new JSZip();

  const safeTitle = (project.title || "bannaa-react-app")
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "bannaa-react-app";

  // package.json
  const packageJson = {
    name: safeTitle,
    private: true,
    version: "0.1.0",
    type: "module",
    scripts: {
      dev: "vite",
      build: "tsc && vite build",
      preview: "vite preview"
    },
    dependencies: {
      react: "^18.3.1",
      "react-dom": "^18.3.1",
      "lucide-react": "^0.468.0",
      clsx: "^2.1.1",
      "tailwind-merge": "^2.5.5"
    },
    devDependencies: {
      "@types/react": "^18.3.12",
      "@types/react-dom": "^18.3.1",
      "@vitejs/plugin-react": "^4.3.4",
      autoprefixer: "^10.4.20",
      postcss: "^8.4.49",
      tailwindcss: "^3.4.16",
      typescript: "^5.6.3",
      vite: "^6.0.3"
    }
  };

  zip.file("package.json", JSON.stringify(packageJson, null, 2));

  // vite.config.ts
  const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
`;
  zip.file("vite.config.ts", viteConfig);

  // tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: "ES2020",
      useDefineForClassFields: true,
      lib: ["ES2020", "DOM", "DOM.Iterable"],
      module: "ESNext",
      skipLibCheck: true,
      moduleResolution: "bundler",
      allowImportingTsExtensions: true,
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
      jsx: "react-jsx",
      strict: false,
      noUnusedLocals: false,
      noUnusedParameters: false,
      noFallthroughCasesInSwitch: true,
      baseUrl: ".",
      paths: {
        "@/*": ["src/*"]
      }
    },
    include: ["src"]
  };
  zip.file("tsconfig.json", JSON.stringify(tsconfig, null, 2));

  // tailwind.config.js
  const tailwindConfig = `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'IBM Plex Sans Arabic', 'system-ui', 'sans-serif'],
        arabic: ['IBM Plex Sans Arabic', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
`;
  zip.file("tailwind.config.js", tailwindConfig);

  // postcss.config.js
  const postcssConfig = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`;
  zip.file("postcss.config.js", postcssConfig);

  // index.html
  const indexHtml = `<!doctype html>
<html lang="ar" dir="auto" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <title>${project.title || "React App"}</title>
  </head>
  <body class="bg-slate-950 text-slate-100 min-h-screen">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
  zip.file("index.html", indexHtml);

  // src/main.tsx
  const mainTsx = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;
  zip.file("src/main.tsx", mainTsx);

  // src/index.css
  const indexCss = `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-slate-950 text-slate-100;
    font-family: 'Inter', 'IBM Plex Sans Arabic', system-ui, sans-serif;
  }
}
`;
  if (!project.files["src/index.css"] && !project.files["index.css"]) {
    zip.file("src/index.css", indexCss);
  }

  // Add all project virtual files
  for (const [path, content] of Object.entries(project.files)) {
    const cleanPath = path.replace(/^\/+/, "");
    zip.file(cleanPath, content);
  }

  // README.md
  const readmeMd = `# ${project.title || "React Project"}

> ${project.description || "Generated with بنّاء (Lovable-style React Generator)"}

## 🚀 How to Run Locally

1. **Install dependencies:**
   \`\`\`bash
   npm install
   \`\`\`

2. **Start the development server:**
   \`\`\`bash
   npm run dev
   \`\`\`

3. Open [http://localhost:5173](http://localhost:5173) in your browser.

4. **Build for production:**
   \`\`\`bash
   npm run build
   \`\`\`

---
Built with React 18, TypeScript, Tailwind CSS & Lucide Icons.
`;
  zip.file("README.md", readmeMd);

  return await zip.generateAsync({ type: "blob" });
}

export function downloadProjectZip(project: ReactProject) {
  createProjectZip(project).then((blob) => {
    const safeTitle = (project.title || "react-project")
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "react-project";

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeTitle}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });
}
