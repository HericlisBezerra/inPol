import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Config explícita (substitui o preset @lovable.dev/vite-tanstack-config).
// Alvo: Cloudflare Workers via @cloudflare/vite-plugin. SSR do TanStack Start.
export default defineConfig({
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tanstackStart({
      // Preserva o entry SSR customizado (src/server.ts — nosso wrapper de erro).
      server: { entry: "server" },
    }),
    viteReact(),
  ],
});
