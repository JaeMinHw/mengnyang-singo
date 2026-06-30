import { promises as fs, watch } from "fs";
import path from "path";

const frontendRoot = process.cwd();
const sourceDir = path.resolve(frontendRoot, "../shared");
const targetDir = path.resolve(frontendRoot, "./shared");
const isWatch = process.argv.includes("--watch");

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function copyJsonFiles() {
  await ensureDir(targetDir);

  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  const jsonFiles = entries.filter(
    (entry) => entry.isFile() && entry.name.endsWith(".json")
  );

  for (const file of jsonFiles) {
    const sourcePath = path.join(sourceDir, file.name);
    const targetPath = path.join(targetDir, file.name);

    await fs.copyFile(sourcePath, targetPath);
    console.log(`[copy-shared] copied: ${file.name}`);
  }

  if (jsonFiles.length === 0) {
    console.log("[copy-shared] no json files found in shared/");
  }
}

function startWatch() {
  console.log("[copy-shared] watching ../shared/*.json for changes...");

  let debounceTimer;

  const scheduleCopy = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      copyJsonFiles().catch((error) => {
        console.error("[copy-shared] watch copy failed:", error);
      });
    }, 200);
  };

  watch(sourceDir, { recursive: true }, (_event, filename) => {
    if (!filename || !filename.endsWith(".json")) {
      return;
    }

    scheduleCopy();
  });
}

async function main() {
  await copyJsonFiles();

  if (isWatch) {
    startWatch();
  }
}

main().catch((error) => {
  console.error("[copy-shared] failed:", error);
  process.exit(1);
});
