#!/usr/bin/env node
/**
 * Download CC0 PBR textures from ambientCG for floor plans.
 *
 * Textures downloaded (1K JPG, CC0 license):
 *   - WoodFloor051: warm oak/honey wood floor
 *   - Tiles074: white/cream ceramic tiles
 *   - PaintedPlaster017: smooth off-white plaster walls
 *
 * Output: public/textures/{wood,tile,plaster}-{color,normal}.jpg
 *
 * Usage:
 *   node scripts/download-textures.js
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const { execSync } = require("child_process");

const OUT_DIR = path.join(__dirname, "..", "public", "textures");

const TEXTURES = [
  {
    name: "WoodFloor051",
    url: "https://ambientcg.com/get?file=WoodFloor051_1K-JPG.zip",
    files: {
      "WoodFloor051_1K-JPG_Color.jpg": "wood-color.jpg",
      "WoodFloor051_1K-JPG_NormalGL.jpg": "wood-normal.jpg",
    },
  },
  {
    name: "Tiles074",
    url: "https://ambientcg.com/get?file=Tiles074_1K-JPG.zip",
    files: {
      "Tiles074_1K-JPG_Color.jpg": "tile-color.jpg",
      "Tiles074_1K-JPG_NormalGL.jpg": "tile-normal.jpg",
    },
  },
  {
    name: "PaintedPlaster017",
    url: "https://ambientcg.com/get?file=PaintedPlaster017_1K-JPG.zip",
    files: {
      "PaintedPlaster017_1K-JPG_Color.jpg": "plaster-color.jpg",
      "PaintedPlaster017_1K-JPG_NormalGL.jpg": "plaster-normal.jpg",
    },
  },
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const follow = (url2) => {
      https.get(url2, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          follow(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url2}`));
          return;
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on("finish", () => { file.close(); resolve(); });
        file.on("error", reject);
      }).on("error", reject);
    };
    follow(url);
  });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const tmpDir = path.join(OUT_DIR, ".tmp-download");
  fs.mkdirSync(tmpDir, { recursive: true });

  console.log("=".repeat(50));
  console.log("BuildFlow Texture Downloader (ambientCG CC0)");
  console.log("Output:", OUT_DIR);
  console.log("=".repeat(50));

  for (const tex of TEXTURES) {
    const zipPath = path.join(tmpDir, `${tex.name}.zip`);
    const extractDir = path.join(tmpDir, tex.name);

    console.log(`\n  Downloading ${tex.name}...`);
    await download(tex.url, zipPath);

    const stats = fs.statSync(zipPath);
    console.log(`  Downloaded: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);

    // Extract
    fs.mkdirSync(extractDir, { recursive: true });
    execSync(`unzip -o -q "${zipPath}" -d "${extractDir}"`);

    // Copy & rename the files we need
    for (const [srcName, destName] of Object.entries(tex.files)) {
      // Find the file recursively (some zips have subdirectories)
      const srcPath = findFile(extractDir, srcName);
      if (srcPath) {
        const destPath = path.join(OUT_DIR, destName);
        fs.copyFileSync(srcPath, destPath);
        const sz = fs.statSync(destPath).size;
        console.log(`  ${destName} — ${(sz / 1024).toFixed(0)} KB`);
      } else {
        console.warn(`  WARNING: ${srcName} not found in ${tex.name}.zip`);
        // List what's actually in the zip
        const files = listFiles(extractDir);
        console.log(`  Available files: ${files.join(", ")}`);
      }
    }
  }

  // Cleanup temp files
  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log("\n" + "=".repeat(50));
  console.log("Done! Textures saved to public/textures/");
  console.log("Next: node scripts/upload-textures-to-r2.js");
  console.log("=".repeat(50));
}

function findFile(dir, name) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFile(full, name);
      if (found) return found;
    } else if (entry.name === name) {
      return full;
    }
  }
  return null;
}

function listFiles(dir) {
  const result = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      result.push(...listFiles(path.join(dir, entry.name)));
    } else {
      result.push(entry.name);
    }
  }
  return result;
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
