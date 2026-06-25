import { mkdir, rename, stat, unlink } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

const DAF_YOMI_PDF_URL_BASE =
  "https://daf-yomi.com/Data/UploadedFiles/DY_Page";

const pages = [
  { dafRef: "shabbat-2a", pageId: 126, label: "Shabbat 2a" },
  { dafRef: "shabbat-2b", pageId: 127, label: "Shabbat 2b" },
  { dafRef: "shabbat-3a", pageId: 128, label: "Shabbat 3a" },
  { dafRef: "shabbat-3b", pageId: 129, label: "Shabbat 3b" },
];

const outDir = path.resolve("public/fixtures/daf-yomi");
const tmpDir = path.resolve("scripts/.tmp/daf-yomi");
await mkdir(outDir, { recursive: true });
await mkdir(tmpDir, { recursive: true });

async function downloadPdf(pageId) {
  const pdfPath = path.join(tmpDir, `${pageId}.pdf`);
  const url = `${DAF_YOMI_PDF_URL_BASE}/${pageId}.pdf`;

  console.log("downloading", url);
  await execFileAsync("curl", ["-fsSL", "-o", pdfPath, url]);
  const { size } = await stat(pdfPath);
  console.log("saved", pdfPath, `(${size} bytes)`);
  return pdfPath;
}

async function convertPdfToPng(pdfPath, outfile) {
  const generated = `${pdfPath}.png`;

  console.log("converting", pdfPath);
  await execFileAsync("qlmanage", ["-t", "-s", "2000", "-o", tmpDir, pdfPath]);

  await unlink(outfile).catch(() => undefined);
  await rename(generated, outfile);

  const { size } = await stat(outfile);
  console.log("saved", outfile, `(${size} bytes)`);
  return size;
}

let captured = 0;

for (const entry of pages) {
  const pdfPath = await downloadPdf(entry.pageId);
  const outfile = path.join(outDir, `${entry.dafRef}.png`);
  await convertPdfToPng(pdfPath, outfile);
  console.log(`accepted ${entry.label} as ${entry.dafRef}.png`);
  captured += 1;
}

console.log(`captured ${captured}/${pages.length} daf-yomi fixture pages`);