const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const sizes = [16, 32, 48, 64, 128, 180, 192, 256, 512];
const src = path.join(__dirname, "..", "multimedia");

async function main() {
  // ---- favicon PNGs (square) ----
  const favSvg = fs.readFileSync(path.join(src, "favicon.svg"), "utf8");
  for (const s of sizes) {
    await sharp(Buffer.from(favSvg)).resize(s, s).png().toFile(path.join(src, `favicon-${s}x${s}.png`));
    console.log(`favicon-${s}x${s}.png`);
  }

  // ---- favicon.ico (contains 16, 32, 48) ----
  // Build ICO with embedded PNG data (Windows 7+ supports PNG in ICO)
  const icoSizes = [16, 32, 48];
  const pngBuffers = [];
  for (const s of icoSizes) {
    pngBuffers.push(await sharp(Buffer.from(favSvg)).resize(s, s).png().toBuffer());
  }

  // ICO format: header + directory + image data
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);       // reserved
  header.writeUInt16LE(1, 2);       // ICO type = 1
  header.writeUInt16LE(icoSizes.length, 4);

  const dirEntrySize = 16;
  let offset = 6 + icoSizes.length * dirEntrySize;
  const dirEntries = [];
  for (let i = 0; i < icoSizes.length; i++) {
    const b = pngBuffers[i];
    const w = icoSizes[i] >= 256 ? 0 : icoSizes[i];
    const h = icoSizes[i] >= 256 ? 0 : icoSizes[i];
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(w, 0);
    entry.writeUInt8(h, 1);
    entry.writeUInt8(0, 2);  // colors
    entry.writeUInt8(0, 3);  // reserved
    entry.writeUInt16LE(1, 4);  // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(b.length, 8);
    entry.writeUInt32LE(offset, 12);
    dirEntries.push(entry);
    offset += b.length;
  }

  const ico = Buffer.concat([header, ...dirEntries, ...pngBuffers]);
  fs.writeFileSync(path.join(src, "favicon.ico"), ico);
  console.log("favicon.ico");

  // ---- logo PNGs (flexible width, fixed height) ----
  const logoSvg = fs.readFileSync(path.join(src, "logo.svg"), "utf8");
  // logo viewBox is 360×100
  for (const h of [45, 60, 100, 200]) {
    const w = Math.round(h * 360 / 100);
    await sharp(Buffer.from(logoSvg)).resize(w, h).png().toFile(path.join(src, `logo-${h}px.png`));
    console.log(`logo-${h}px.png`);
  }

  console.log("Done.");
}

main().catch(e => { console.error(e); process.exit(1); });
