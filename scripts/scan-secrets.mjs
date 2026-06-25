#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PATTERNS = [
  /sk_live_[0-9a-zA-Z]{8,}/,
  /rk_live_[0-9a-zA-Z]{8,}/,
  /whsec_[0-9a-zA-Z]{8,}/,
];

function trackedFiles() {
  const output = execSync("git ls-files", { cwd: ROOT, encoding: "utf8" });
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((file) => path.join(ROOT, file));
}

function walkDirectory(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const fullPath = path.join(directory, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...walkDirectory(fullPath));
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

function scanFile(filePath) {
  const content = readFileSync(filePath, "utf8");
  const hits = [];
  for (const pattern of PATTERNS) {
    if (pattern.test(content)) {
      hits.push(pattern.source);
    }
  }
  return hits;
}

const offenders = [];

for (const file of trackedFiles()) {
  if (!existsSync(file) || file.endsWith(".env.example")) {
    continue;
  }
  const hits = scanFile(file);
  if (hits.length > 0) {
    offenders.push({ file: path.relative(ROOT, file), hits });
  }
}

const buildDir = path.join(ROOT, ".next", "static");
if (existsSync(buildDir)) {
  for (const file of walkDirectory(buildDir)) {
    const hits = scanFile(file);
    if (hits.length > 0) {
      offenders.push({ file: path.relative(ROOT, file), hits });
    }
  }
}

if (offenders.length > 0) {
  console.error("Potential secrets found:");
  for (const offender of offenders) {
    console.error(`- ${offender.file}: ${offender.hits.join(", ")}`);
  }
  process.exit(1);
}

console.log("No obvious secrets found in tracked files or built static assets.");