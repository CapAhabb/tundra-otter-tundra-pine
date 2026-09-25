import { piperAvailable, synthesizePiper } from "./piper-tts.mjs";

/**
 * Dev-only Vite plugin: GET /api/tts-piper?text=... -> audio/wav.
 * Client-side gameAudio.speak() (src/lib/game/audio.ts) calls this first
 * and falls back to browser SpeechSynthesis if it 404s/fails (e.g. in a
 * deployed build, where this plugin isn't registered at all).
 */
export function piperTtsPlugin() {
  return {
    name: "app-builder:piper-tts",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const rawUrl = req.url ?? "";
          const pathOnly = rawUrl.split("?", 1)[0] ?? "";
          if (pathOnly !== "/api/tts-piper") {
            next();
            return;
          }
          if (!piperAvailable()) {
            res.statusCode = 503;
            res.end("piper not installed");
            return;
          }
          const url = new URL(rawUrl, "http://localhost");
          const text = url.searchParams.get("text") ?? "";
          if (!text.trim()) {
            res.statusCode = 400;
            res.end("missing text");
            return;
          }
          const wav = await synthesizePiper(text);
          res.statusCode = 200;
          res.setHeader("content-type", "audio/wav");
          res.setHeader("cache-control", "no-store");
          res.end(wav);
        } catch (err) {
          console.error("[piper-tts] synth failed:", err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.end("tts failed");
          }
        }
      });
    },
  };
}
