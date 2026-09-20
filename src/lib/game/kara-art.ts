/** Shared Kara Wari mark: gold compass rose, cream face, teal star. */

export function drawKaraRose(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  opts?: { glow?: number; spin?: number },
) {
  const glow = opts?.glow ?? 0.4;
  const spin = opts?.spin ?? 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);

  const halo = ctx.createRadialGradient(0, 0, r * 0.15, 0, 0, r * 1.9);
  halo.addColorStop(0, `rgba(255, 220, 140, ${0.18 + glow * 0.28})`);
  halo.addColorStop(0.35, `rgba(80, 190, 170, ${0.12 + glow * 0.12})`);
  halo.addColorStop(1, "rgba(80, 190, 170, 0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.9, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  const brass = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  brass.addColorStop(0, "#f0d59a");
  brass.addColorStop(0.55, "#c9a45a");
  brass.addColorStop(1, "#8a6a32");
  ctx.fillStyle = brass;
  ctx.fill();
  ctx.strokeStyle = "#6e5424";
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2);
  ctx.fillStyle = "#f4ead4";
  ctx.fill();

  ctx.strokeStyle = "rgba(138, 106, 50, 0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
  ctx.stroke();

  // 8-point compass rose
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 8;
    const long = i % 4 === 0 ? r * 0.72 : i % 2 === 0 ? r * 0.5 : r * 0.28;
    const px = Math.cos(a) * long;
    const py = Math.sin(a) * long;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = "#b8893a";
  ctx.fill();

  // Cardinal gold blades
  ctx.fillStyle = "#e2c36a";
  for (let i = 0; i < 4; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72);
    ctx.lineTo(Math.cos(a + 0.22) * r * 0.16, Math.sin(a + 0.22) * r * 0.16);
    ctx.lineTo(Math.cos(a - 0.22) * r * 0.16, Math.sin(a - 0.22) * r * 0.16);
    ctx.closePath();
    ctx.fill();
  }

  // Teal inner star
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r * 0.32 : r * 0.13;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = Math.cos(a) * rad;
    const py = Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = "#3e8f82";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, r * 0.08, 0, Math.PI * 2);
  ctx.fillStyle = "#f7f1e4";
  ctx.fill();

  ctx.restore();
}
