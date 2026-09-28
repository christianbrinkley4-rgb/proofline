// Builds the browser extension for testers: renders its icons from app/icon.svg and
// packs extension/ into public/proofline-extension.zip, which the Connect page links
// to. Run with `npm run extension:build` after changing anything in extension/.
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import JSZip from "jszip";
import sharp from "sharp";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const extension = join(root, "extension");

const svg = await readFile(join(root, "app", "icon.svg"));
await mkdir(join(extension, "icons"), { recursive: true });
for (const size of [16, 32, 48, 128]) {
  await sharp(svg, { density: 512 }).resize(size, size).png().toFile(join(extension, "icons", `${size}.png`));
}

async function files(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await files(path)));
    else out.push(path);
  }
  return out;
}

const zip = new JSZip();
for (const path of await files(extension)) zip.file(relative(extension, path).replaceAll("\\", "/"), await readFile(path));
const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
await writeFile(join(root, "public", "proofline-extension.zip"), bytes);

const { version } = JSON.parse(await readFile(join(extension, "manifest.json"), "utf8"));
console.log(`Built Proofline extension ${version}: public/proofline-extension.zip (${(bytes.length / 1024).toFixed(1)} KB)`);
