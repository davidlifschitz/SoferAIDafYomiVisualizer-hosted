import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  SoferClient,
  extractSoferTranscriptText,
} from "../lib/services/sofer.ts";

const repoRoot = path.resolve(".");
const transcriptionId = process.env.SOFER_TRANSCRIPTION_ID;
const lectureId = process.env.YUTORAH_LECTURE_ID ?? "948127";
const outputPath =
  process.env.OUTPUT_PATH ??
  path.join(repoRoot, "fixtures", `transcript-${lectureId}.json`);

if (!transcriptionId) {
  console.error(
    "Set SOFER_TRANSCRIPTION_ID to fetch a completed Sofer transcript.",
  );
  console.error(
    "Submit a new job from the legacy MVP runner or workflow once audio URL resolution is wired.",
  );
  process.exit(1);
}

const apiKey = process.env.SOFER_API_KEY;
if (!apiKey) {
  console.error("Set SOFER_API_KEY before fetching a Sofer transcript.");
  process.exit(1);
}

const sofer = new SoferClient({ apiKey });
const transcription = await sofer.getTranscription(transcriptionId);
const text = extractSoferTranscriptText(transcription);

if (!text) {
  console.error(
    `Sofer transcription ${transcriptionId} has no text yet (status: ${transcription.info?.status ?? "unknown"}).`,
  );
  process.exit(1);
}

const payload = {
  source: "sofer",
  lectureUrl: `https://www.yutorah.org/lectures/lecture.cfm/${lectureId}`,
  title: process.env.LECTURE_TITLE ?? `YUTorah lecture ${lectureId}`,
  text,
  transcriptionId,
  status: transcription.info?.status ?? null,
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`wrote ${outputPath} (${text.length} chars)`);