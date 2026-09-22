/** Kara Wari mark: round compass with a tight neon bloom — no rays. */

export function drawKaraRose(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  opts?: { glow?: number; spin?: number },
) {
  const spin = opts?.spin ?? 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);

  // tight neon — bright, dies within a few pixels of the rim
  ctx.shadowColor = "#ffd56a";
  ctx.shadowBlur = Math.max(7, r * 0.85);
  ctx.fillStyle = "#ffe9a0";
  ctx.beginPath();
  ctx.arc(0, 0, r + 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = "#ffcc4a";
  ctx.shadowBlur = Math.max(5, r * 0.55);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  const brass = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  brass.addColorStop(0, "#fff4c8");
  brass.addColorStop(0.45, "#e2c36a");
  brass.addColorStop(1, "#9a7428");
  ctx.fillStyle = brass;
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";

  ctx.beginPath();
  ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
  ctx.fillStyle = "#f7f1e4";
  ctx.fill();

  // small inner star only — not radiating blades
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rad = i % 2 === 0 ? r * 0.34 : r * 0.14;
    const a = -Math.PI / 2 + (i * Math.PI) / 4;
    const px = Math.cos(a) * rad;
    const py = Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = "#d4a017";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, r * 0.09, 0, Math.PI * 2);
  ctx.fillStyle = "#fffaf0";
  ctx.fill();

  ctx.restore();
}
