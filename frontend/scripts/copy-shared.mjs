import { promises as fs } from "fs";
import path from "path";

const frontendRoot = process.cwd();
const sourceDir = path.resolve(frontendRoot, "../shared");
const targetDir = path.resolve(frontendRoot, "./shared");

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

copyJsonFiles().catch((error) => {
  console.error("[copy-shared] failed:", error);
  process.exit(1);
});