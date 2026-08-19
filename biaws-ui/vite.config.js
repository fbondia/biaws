import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_BIAWS_API_URL || "http://127.0.0.1:3100";

  return {
    plugins: [react()],
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: "charts",
                test: /node_modules[\\/]recharts/,
              },
              {
                name: "topology",
                test: /node_modules[\\/]@xyflow[\\/]react/,
              },
            ],
          },
        },
      },
    },
    server: {
      fs: {
        allow: [".."],
      },
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
