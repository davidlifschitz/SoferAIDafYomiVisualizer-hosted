import { writeFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(".");
const halfPages = process.argv.slice(2);

if (halfPages.length === 0) {
  console.error("Usage: node scripts/fetch-sefaria-fixture.mjs Shabbat.3a Shabbat.3b");
  process.exit(1);
}

function stripHtml(value) {
  return String(value).replace(/<[^>]+>/g, "");
}

async function fetchHalfPage(ref) {
  const url = `https://www.sefaria.org/api/texts/${ref}?context=0&commentary=0&pad=0`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Sefaria request failed for ${ref} (${response.status})`);
  }

  const payload = await response.json();
  const english = Array.isArray(payload.text) ? payload.text : [payload.text];
  const hebrew = Array.isArray(payload.he) ? payload.he : [payload.he];

  return {
    ref: payload.ref,
    heRef: payload.heRef,
    source: url,
    versionTitle: payload.versionTitle,
    versionSource: payload.versionSource,
    heVersionTitle: payload.heVersionTitle,
    heVersionSource: payload.heVersionSource,
    segments: english.map((en, index) => ({
      ref: `${payload.ref}:${index + 1}`,
      en: stripHtml(en),
      he: stripHtml(hebrew[index] ?? ""),
    })),
  };
}

const pages = [];
for (const ref of halfPages) {
  pages.push(await fetchHalfPage(ref));
}

const slug = halfPages
  .map((ref) => ref.replace(/^Shabbat\./i, "").toLowerCase())
  .join("-");
const outPath = path.join(repoRoot, "fixtures", `sefaria-shabbat-${slug}.json`);
await writeFile(outPath, `${JSON.stringify(pages, null, 2)}\n`);
console.log(`wrote ${outPath}`);