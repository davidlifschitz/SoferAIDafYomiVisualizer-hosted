import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const repoRoot = path.resolve(".");
const apiKey = process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY;
const model =
  process.env.MARKER_VISION_MODEL ?? "nvidia/nemotron-nano-12b-v2-vl:free";

const FIXTURE_SETS = {
  "shabbat-2": {
    outputPath: "lib/fixtures/shabbat-2-markers.json",
    targets: [
      {
        dafRef: "Shabbat 2a",
        segmentRef: "Shabbat 2a:1",
        imagePath: "public/fixtures/daf-yomi/shabbat-2a.png",
        hebrewSnippet: "יְצִיאוֹת",
        verticalHint:
          "the LARGE emphasized opening word of the mishna at the very top of the center column",
        kind: "start",
      },
      {
        dafRef: "Shabbat 2b",
        segmentRef: "Shabbat 2b:14",
        imagePath: "public/fixtures/daf-yomi/shabbat-2b.png",
        hebrewSnippet: "רָבָא אָמַר, ״רְשׁוּיוֹת״ קָתָנֵי",
        verticalHint:
          "in the upper-middle of the center gemara column — never in Tosafot or Rashi",
        kind: "end",
      },
    ],
  },
  "shabbat-3": {
    outputPath: "lib/fixtures/shabbat-3-markers.json",
    targets: [
      {
        dafRef: "Shabbat 2b",
        segmentRef: "Shabbat 2b:15",
        imagePath: "public/fixtures/daf-yomi/shabbat-2b.png",
        hebrewSnippet: "אֲמַר לֵיהּ רַב מַתְנָה לְאַבָּיֵי",
        verticalHint:
          "Rav Mattana near the bottom of the center gemara column where Daf 3 continues from Daf 2",
        kind: "start",
      },
      {
        dafRef: "Shabbat 3b",
        segmentRef: "Shabbat 3b:3",
        imagePath: "public/fixtures/daf-yomi/shabbat-3b.png",
        hebrewSnippet: "אָמַר אַבָּיֵי: פְּשִׁיטָא לִי יָדוֹ שֶׁל אָדָם",
        verticalHint:
          "Abaye's opening statement in the upper-middle center gemara column — never in Tosafot or Rashi",
        kind: "end",
      },
    ],
  },
};

const fixtureSetName = process.env.MARKER_FIXTURE_SET ?? "shabbat-2";
const fixtureSet = FIXTURE_SETS[fixtureSetName];

if (!fixtureSet) {
  console.error(
    `Unknown MARKER_FIXTURE_SET "${fixtureSetName}". Expected one of: ${Object.keys(FIXTURE_SETS).join(", ")}`,
  );
  process.exit(1);
}

const targets = fixtureSet.targets;

if (!apiKey) {
  console.error(
    "Set OPENROUTER_API_KEY (preferred) or OPENAI_API_KEY before running locate-markers.",
  );
  process.exit(1);
}

const GEMARA_BOUNDS = { left: 290, right: 930, top: 260, bottom: 1880 };

function buildPrompt({
  imageWidth,
  imageHeight,
  dafRef,
  segmentRef,
  hebrewSnippet,
  verticalHint,
}) {
  return [
    "Locate Hebrew text on a Vilna-style Talmud page image.",
    `Image size: ${imageWidth}x${imageHeight} pixels.`,
    `Daf: ${dafRef}`,
    `Segment: ${segmentRef}`,
    "",
    "The image is cropped to the center gemara/mishna column only.",
    "Find the FIRST occurrence of this Hebrew phrase in the crop.",
    `Phrase: ${hebrewSnippet}`,
    `Vertical hint: ${verticalHint}`,
    "",
    'Return ONLY JSON: {"columnX": <0-1 from left of crop>, "columnY": <0-1 from top of crop>, "confidence": <0-1>}',
    "",
    "Place the point at the start of the phrase in the center column.",
    "For RTL text, columnX is where the phrase begins horizontally — often mid-column.",
  ].join("\n");
}

function extractJsonObject(raw) {
  if (!raw) {
    throw new Error("Vision response was empty");
  }

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) return raw.slice(start, end + 1);
  throw new Error("Vision response did not include JSON");
}

function normalizeCoordinate(value, max) {
  if (value >= 0 && value <= 1) return Math.round(value * max);
  return Math.round(value);
}

function clampUnit(value) {
  return Math.max(0, Math.min(1, value));
}

function toPageCoordinates(columnX, columnY) {
  return {
    columnX: clampUnit(columnX),
    columnY: clampUnit(columnY),
    x: Math.round(
      GEMARA_BOUNDS.left +
        clampUnit(columnX) * (GEMARA_BOUNDS.right - GEMARA_BOUNDS.left),
    ),
    y: Math.round(
      GEMARA_BOUNDS.top +
        clampUnit(columnY) * (GEMARA_BOUNDS.bottom - GEMARA_BOUNDS.top),
    ),
  };
}

function parseResponse(raw, imageWidth, imageHeight, cropped = false) {
  const parsed = JSON.parse(extractJsonObject(raw));
  let x;
  let y;
  let columnX;
  let columnY;

  if (parsed.columnX !== undefined && parsed.columnY !== undefined) {
    const mapped = toPageCoordinates(parsed.columnX, parsed.columnY);
    columnX = mapped.columnX;
    columnY = mapped.columnY;
    x = mapped.x;
    y = mapped.y;
  } else if (cropped && parsed.x !== undefined && parsed.y !== undefined) {
    columnX = clampUnit(normalizeCoordinate(parsed.x, imageWidth) / imageWidth);
    columnY = clampUnit(normalizeCoordinate(parsed.y, imageHeight) / imageHeight);
    const mapped = toPageCoordinates(columnX, columnY);
    x = mapped.x;
    y = mapped.y;
  } else {
    x = normalizeCoordinate(parsed.x, imageWidth);
    y = normalizeCoordinate(parsed.y, imageHeight);
    if (x < 0 || y < 0 || x > imageWidth || y > imageHeight) {
      throw new Error(`Coordinates out of bounds: (${x}, ${y})`);
    }
    if (
      x < GEMARA_BOUNDS.left ||
      x > GEMARA_BOUNDS.right ||
      y < GEMARA_BOUNDS.top ||
      y > GEMARA_BOUNDS.bottom
    ) {
      throw new Error(
        `Coordinates (${x}, ${y}) are outside gemara column bounds`,
      );
    }
  }

  return {
    x,
    y,
    columnX,
    columnY,
    confidence:
      typeof parsed.confidence === "number"
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0.5,
  };
}

async function cropGemaraColumn(imagePath) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const absolutePath = path.resolve(imagePath);
  const imageBuffer = await readFile(absolutePath);
  const base64 = imageBuffer.toString("base64");

  const croppedBase64 = await page.evaluate(
    async ({ base64Image, bounds }) => {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = `data:image/png;base64,${base64Image}`;
      });

      const canvas = document.createElement("canvas");
      const width = bounds.right - bounds.left;
      const height = bounds.bottom - bounds.top;
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      context.drawImage(
        image,
        bounds.left,
        bounds.top,
        width,
        height,
        0,
        0,
        width,
        height,
      );

      const dataUrl = canvas.toDataURL("image/png");
      return dataUrl.split(",")[1];
    },
    { base64Image: base64, bounds: GEMARA_BOUNDS },
  );

  await browser.close();
  return croppedBase64;
}

async function locateMarker(
  target,
  imageBase64,
  imageWidth,
  imageHeight,
  attempt = 1,
) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 256,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildPrompt({
                imageWidth,
                imageHeight,
                dafRef: target.dafRef,
                segmentRef: target.segmentRef,
                hebrewSnippet: target.hebrewSnippet,
                verticalHint: target.verticalHint,
              }),
            },
            {
              type: "image_url",
              image_url: { url: `data:image/png;base64,${imageBase64}` },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Vision request failed (${response.status}): ${await response.text()}`,
    );
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  const raw =
    typeof content === "string"
      ? content
      : content?.map((part) => part.text ?? "").join("\n").trim();

  let coordinates;
  try {
    coordinates = parseResponse(raw, imageWidth, imageHeight, true);
  } catch (error) {
    if (attempt < 3) {
      console.warn(
        `retrying ${target.segmentRef} after parse failure (${attempt}/3): ${error.message}`,
      );
      return locateMarker(target, imageBase64, imageWidth, imageHeight, attempt + 1);
    }
    throw error;
  }

  console.log(
    `located ${target.segmentRef} -> (${coordinates.x}, ${coordinates.y}) conf=${coordinates.confidence}`,
  );

  return {
    kind: target.kind,
    dafRef: target.dafRef,
    segmentRef: target.segmentRef,
    hebrewSnippet: target.hebrewSnippet,
    source: "vision",
    model,
    ...coordinates,
  };
}

async function locateMarkerFromCrop(target, croppedBase64, attempt = 1) {
  const cropWidth = GEMARA_BOUNDS.right - GEMARA_BOUNDS.left;
  const cropHeight = GEMARA_BOUNDS.bottom - GEMARA_BOUNDS.top;
  return locateMarker(
    target,
    croppedBase64,
    cropWidth,
    cropHeight,
    attempt,
  );
}

const output = {
  imageWidth: 1296,
  imageHeight: 2000,
  generatedAt: new Date().toISOString(),
  markers: [],
};

for (const target of targets) {
  const imagePath = path.join(repoRoot, target.imagePath);
  const croppedBase64 = await cropGemaraColumn(imagePath);
  const marker = await locateMarkerFromCrop(target, croppedBase64);
  output.markers.push(marker);
}

const outPath = path.join(repoRoot, fixtureSet.outputPath);
await writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`wrote ${outPath}`);