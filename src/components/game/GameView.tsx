import { useEffect, useRef, useState } from "react";
import { Check, MapPin, Pause, Volume2, VolumeX, X, RotateCcw, Captions } from "lucide-react";
import { ReadyEngine, type HudState } from "@/lib/game/engine";
import { useGameStore } from "@/lib/game/store";
import { gameAudio } from "@/lib/game/audio";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function GameView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ReadyEngine | null>(null);
  const profile = useGameStore((s) => s.profile);
  const playerId = useGameStore((s) => s.playerId);
  const drill = useGameStore((s) => s.drill);
  const visualShell = useGameStore((s) => s.visualShell);
  const finishDrill = useGameStore((s) => s.finishDrill);
  const setScreen = useGameStore((s) => s.setScreen);
  const [hud, setHud] = useState<HudState | null>(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speakOn, setSpeakOn] = useState(false);
  const lastSpoken = useRef("");
  const stickId = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !profile || !playerId || !drill) return;
    const engine = new ReadyEngine(canvas, profile, playerId, drill, visualShell);
    engine.onHud = setHud;
    engine.onComplete = (stars, summary) => finishDrill(stars, summary);
    engineRef.current = engine;
    void engine.start();
    return () => {
      engine.stop();
      engineRef.current = null;
    };
  }, [profile, playerId, drill, visualShell, finishDrill]);

  useEffect(() => {
    engineRef.current?.resize();
  }, [paused]);

  useEffect(() => {
    const text = hud?.dialogue?.text ?? "";
    if (!speakOn || !text || text === lastSpoken.current) return;
    lastSpoken.current = text;
    gameAudio.speak(text);
  }, [hud?.dialogue?.text, speakOn]);

  const onStickStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    stickId.current = e.pointerId;
    moveStick(e);
  };
  const moveStick = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickId.current !== null && e.pointerId !== stickId.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let x = (e.clientX - cx) / (rect.width / 2);
    let y = (e.clientY - cy) / (rect.height / 2);
    const m = Math.hypot(x, y);
    // Far from the pad: drop to rest so the player never keeps walking on their own.
    if (m > 1.2) {
      stickId.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      engineRef.current?.setStick(0, 0);
      return;
    }
    if (m > 1) {
      x /= m;
      y /= m;
    }
    if (m < 0.18) {
      x = 0;
      y = 0;
    }
    engineRef.current?.setStick(x, y);
  };
  const endStick = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickId.current !== null && e.pointerId !== stickId.current) return;
    stickId.current = null;
    engineRef.current?.setStick(0, 0);
  };

  return (
    <div className="relative h-dvh overflow-hidden bg-night">
      <canvas
        ref={canvasRef}
        className="block size-full touch-none"
        tabIndex={0}
        onPointerDown={() => gameAudio.unlock()}
      />

      {hud ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            {!hud.cutIn ? (
              <Card className="pointer-events-auto ns-placard max-w-[min(100%,22rem)]">
                <CardContent className="px-3 py-2">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                    <MapPin className="size-3.5" />
                    {hud.roomName}
                  </p>
                  <p className="mt-1 text-sm leading-snug text-fg">{hud.hint}</p>
                </CardContent>
              </Card>
            ) : (
              <span />
            )}
            <div className="pointer-events-auto flex gap-2">
              <Button
                size="icon"
                variant="secondary"
                aria-label={speakOn ? "Turn off read-aloud" : "Read to me"}
                onClick={() => {
                  const next = !speakOn;
                  setSpeakOn(next);
                  gameAudio.setSpeakOn(next);
                  if (next && hud.dialogue?.text) gameAudio.speak(hud.dialogue.text);
                }}
              >
                <Captions />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                aria-label={muted ? "Unmute" : "Mute"}
                onClick={() => {
                  const next = !muted;
                  setMuted(next);
                  gameAudio.setMuted(next);
                }}
              >
                {muted ? <VolumeX /> : <Volume2 />}
              </Button>
              <Button
                size="icon"
                variant="secondary"
                aria-label="Pause"
                onClick={() => setPaused(true)}
              >
                <Pause />
              </Button>
            </div>
          </div>

          {!hud.cutIn ? (
            <div className="flex items-end justify-between gap-3">
              <ol className="ns-placard flex max-w-[9.5rem] flex-col gap-1 rounded-[var(--radius-xl)] border border-border p-2 text-fg shadow-[var(--shadow-soft)] sm:max-w-xs sm:p-3">
                {hud.steps.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 text-xs">
                    <span
                      className={cn(
                        "grid size-4 place-items-center rounded-full",
                        s.done ? "bg-primary text-primary-fg" : "bg-primary-soft text-primary",
                      )}
                    >
                      {s.done ? <Check className="size-3" /> : null}
                    </span>
                    <span className={s.done ? "text-muted line-through" : ""}>{s.label}</span>
                  </li>
                ))}
              </ol>
              <div className="flex flex-1 items-end justify-between sm:flex-none sm:justify-end">
                <div
                  className="pointer-events-auto relative size-28 rounded-full border border-primary-fg/15 bg-night/50 sm:hidden"
                  style={{ touchAction: "none" }}
                  onPointerDown={onStickStart}
                  onPointerMove={moveStick}
                  onPointerUp={endStick}
                  onPointerCancel={endStick}
                  onLostPointerCapture={endStick}
                  onPointerLeave={endStick}
                />
                <button
                  type="button"
                  className="pointer-events-auto grid size-16 place-items-center rounded-full bg-primary text-sm font-bold text-primary-fg shadow-[var(--shadow-soft)] sm:hidden"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    engineRef.current?.requestInteract();
                  }}
                >
                  Use
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {hud?.prompt && !hud.cutIn ? (
        <div className="pointer-events-none absolute bottom-28 left-1/2 hidden -translate-x-1/2 rounded-full bg-surface px-4 py-2 text-sm font-semibold text-fg sm:block">
          {hud.prompt}
          <span className="ml-2 text-muted">E / Space</span>
        </div>
      ) : null}

      {hud?.dialogue ? (
        <Card className="ns-placard absolute inset-x-3 bottom-3 z-20 overflow-hidden text-left sm:inset-x-auto sm:left-1/2 sm:w-[min(34rem,calc(100%-2rem))] sm:-translate-x-1/2">
          <svg
            className="pointer-events-none absolute right-3 top-3 size-16 text-[#6a5340] opacity-[0.16]"
            viewBox="0 0 400 400"
            aria-hidden="true"
          >
            <g fill="none" stroke="currentColor" strokeWidth="1.2">
              <circle cx="200" cy="200" r="168" />
              <circle cx="200" cy="200" r="148" />
              <path d="M200 32 V368 M32 200 H368" />
            </g>
            <path fill="currentColor" d="M200 48 L214 186 L200 200 L186 186 Z M200 352 L214 214 L200 200 L186 214 Z M48 200 L186 186 L200 200 L186 214 Z M352 200 L214 186 L200 200 L214 214 Z" />
          </svg>
          <CardContent className="relative p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">{hud.dialogue.speaker}</p>
            <p className="mt-1.5 font-display text-lg leading-relaxed text-fg">{hud.dialogue.text}</p>
            {hud.choices?.length ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {hud.choices.map((c) => (
                  <Button key={c.id} size="sm" onClick={() => engineRef.current?.chooseLesson(c.id)}>
                    {c.label}
                  </Button>
                ))}
              </div>
            ) : null}
            <div className="mt-3 flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                aria-label="Replay"
                onClick={() => gameAudio.speak(hud.dialogue!.text)}
              >
                <RotateCcw className="size-3.5" />
                Replay
              </Button>
              <Button
                size="sm"
                className="border border-transparent bg-[#2f8f4e] text-white hover:bg-[#278044]"
                onClick={() => engineRef.current?.dismissDialogue()}
              >
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {paused ? (
        <div className="absolute inset-0 z-30 grid place-items-center bg-night/70 px-4">
          <Card className="ns-placard w-full max-w-sm">
            <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-semibold">Paused</h2>
              <Button size="icon" variant="ghost" aria-label="Close" onClick={() => setPaused(false)}>
                <X />
              </Button>
            </div>
            <p className="mt-2 text-sm text-muted">Move with WASD or the stick. Press Use when you are near something.</p>
            <div className="mt-5 flex flex-col gap-2">
              <Button onClick={() => setPaused(false)}>Resume</Button>
              <Button variant="secondary" onClick={() => setScreen("drills")}>
                Leave drill
              </Button>
            </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
