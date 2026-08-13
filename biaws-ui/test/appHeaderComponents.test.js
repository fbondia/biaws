import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import react from "@vitejs/plugin-react";
import { build } from "vite";

test("navigation menu section resolves its navigation button dependency", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "biaws-app-header-"));

  try {
    await build({
      configFile: false,
      logLevel: "silent",
      plugins: [react()],
      build: {
        emptyOutDir: false,
        lib: {
          entry: join(
            process.cwd(),
            "src/App/components/AppHeader/components/AppHeaderPanels.jsx",
          ),
          fileName: "app-header-panels",
          formats: ["es"],
        },
        outDir: outputDirectory,
      },
    });
    const { NavigationMenuSection } = await import(
      pathToFileURL(join(outputDirectory, "app-header-panels.js"))
    );
    assert.doesNotThrow(() =>
      NavigationMenuSection({
        activeView: "home",
        groupKey: "operational",
        onSelectView() {},
        section: {
          key: "main",
          label: "Principal",
          views: [{ key: "home", label: "Início" }],
        },
      }),
    );
  } finally {
    await rm(outputDirectory, { force: true, recursive: true });
  }
});
