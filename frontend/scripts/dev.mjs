import { spawn } from "child_process";

const isWindows = process.platform === "win32";

function spawnProcess(command, args, label) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: isWindows,
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      console.log(`[dev] ${label} stopped (${signal})`);
      return;
    }

    if (code && code !== 0) {
      console.log(`[dev] ${label} exited with code ${code}`);
    }

    shutdown(code ?? 0);
  });

  return child;
}

const watchShared = spawnProcess(
  "node",
  ["scripts/copy-shared.mjs", "--watch"],
  "copy-shared watch"
);
const nextDev = spawnProcess("npx", ["next", "dev"], "next dev");

let shuttingDown = false;

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  if (!watchShared.killed) {
    watchShared.kill();
  }

  if (!nextDev.killed) {
    nextDev.kill();
  }

  process.exit(exitCode);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
