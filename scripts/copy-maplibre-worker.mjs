// MapLibre runs its tile work in a module worker that imports a second file.
// Turbopack can't bundle that pair, so the map loads them from /maplibre/
// (see components/map/route-map.tsx `setWorkerUrl`). This copies the two files
// from node_modules, so they always match the installed version. Runs before
// `dev` and `build` (pnpm doesn't run pre-scripts), output is git-ignored.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const dist = join(dirname(require.resolve("maplibre-gl/package.json")), "dist");
const target = new URL("../public/maplibre/", import.meta.url).pathname;
mkdirSync(target, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(join(dist, file), join(target, file));
