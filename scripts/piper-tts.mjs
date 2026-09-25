import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Local Piper TTS (dev-only, free). Kara's dialogue is synthesized with a
 * neural voice instead of the browser's espeak-backed SpeechSynthesis,
 * which is what makes her sound robotic on Linux. Not wired into
 * production: Piper is a native binary, not something a Vercel serverless
 * function can run, so deployed builds fall back to browser
 * SpeechSynthesis (see audio.ts).
 */

const PIPER_BIN = process.env.PIPER_BIN || join(process.env.HOME ?? "", ".local/piper-tts/venv/bin/piper");
const PIPER_MODEL =
  process.env.PIPER_MODEL || join(process.env.HOME ?? "", ".local/piper-tts/voices/en_GB-jenny_dioco-medium.onnx");
const CACHE_DIR = join(process.cwd(), ".piper-cache");

export function piperAvailable() {
  return existsSync(PIPER_BIN) && existsSync(PIPER_MODEL);
}

function cacheKey(text) {
  return createHash("sha1").update(`${PIPER_MODEL}|${text}`).digest("hex");
}

export async function synthesizePiper(text) {
  if (!text || !text.trim()) throw new Error("empty text");
  await mkdir(CACHE_DIR, { recursive: true });
  const key = cacheKey(text);
  const cachedPath = join(CACHE_DIR, `${key}.wav`);
  if (existsSync(cachedPath)) {
    return readFile(cachedPath);
  }

  const tmpPath = join(tmpdir(), `piper-${key}-${process.pid}.wav`);
  await new Promise((resolve, reject) => {
    const child = spawn(PIPER_BIN, ["-m", PIPER_MODEL, "-f", tmpPath, "--volume", "3.0"], {
      stdio: ["pipe", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`piper exited ${code}: ${stderr.slice(-500)}`));
    });
    child.stdin.write(text);
    child.stdin.end();
  });

  const buf = await readFile(tmpPath);
  await rm(tmpPath, { force: true });
  // Best-effort cache write; a race with another request just means two
  // synths of the same line, not a correctness problem.
  await import("node:fs/promises").then(({ writeFile }) => writeFile(cachedPath, buf).catch(() => {}));
  return buf;
}
