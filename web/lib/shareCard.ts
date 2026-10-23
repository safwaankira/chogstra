// Draws a 1200x630 share card for a confirmed performance, entirely from real
// data: the Chog's portrait and name, its role, the exact onchain loop, the
// Movement's setting and the transaction hash. Browser only (canvas).

import { decodePattern } from "./music";

export type ShareCardInput = {
  imageUrl: string;
  chogName: string;
  role: string;
  gel: string; // resolved CSS colour, e.g. "#ff6f9c"
  pattern: bigint;
  movement: number;
  settingText: string; // e.g. "Ab dorian · 105 bpm · mood Dream"
  txHash: string;
};

const W = 1200;
const H = 630;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // the gateway sends Access-Control-Allow-Origin: *
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load the Chog portrait"));
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export async function renderShareCard(input: ShareCardInput): Promise<Blob> {
  const display = getComputedStyle(document.documentElement).getPropertyValue("--font-display-face").trim() || "Impact";
  const ui = getComputedStyle(document.documentElement).getPropertyValue("--font-geist-sans").trim() || "system-ui";
  const mono = getComputedStyle(document.documentElement).getPropertyValue("--font-geist-mono").trim() || "monospace";
  await document.fonts.ready;
  const portrait = await loadImage(input.imageUrl);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // House and rig light.
  ctx.fillStyle = "#0b0814";
  ctx.fillRect(0, 0, W, H);
  const wash = ctx.createRadialGradient(W * 0.3, -60, 0, W * 0.3, -60, 700);
  wash.addColorStop(0, "rgba(131,110,249,0.45)");
  wash.addColorStop(1, "rgba(131,110,249,0)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);
  // Spotlight cone onto the portrait.
  const cone = ctx.createLinearGradient(0, 0, 0, 470);
  cone.addColorStop(0, "rgba(255,243,224,0)");
  cone.addColorStop(1, "rgba(255,243,224,0.18)");
  ctx.fillStyle = cone;
  ctx.beginPath();
  ctx.moveTo(870, 0);
  ctx.lineTo(950, 0);
  ctx.lineTo(1150, 470);
  ctx.lineTo(670, 470);
  ctx.closePath();
  ctx.fill();
  // Floor.
  const floor = ctx.createLinearGradient(0, 470, 0, H);
  floor.addColorStop(0, "#181029");
  floor.addColorStop(1, "#08060f");
  ctx.fillStyle = floor;
  ctx.fillRect(0, 470, W, H - 470);

  // Floor pool in the role gel, then the portrait.
  const pool = ctx.createRadialGradient(910, 500, 0, 910, 500, 220);
  pool.addColorStop(0, input.gel);
  pool.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = pool;
  ctx.fillRect(690, 440, 440, 120);
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 18;
  roundRect(ctx, 750, 150, 320, 320, 32);
  ctx.fillStyle = "#1b1333";
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, 750, 150, 320, 320, 32);
  ctx.clip();
  ctx.drawImage(portrait, 750, 150, 320, 320);
  ctx.restore();
  ctx.strokeStyle = input.gel;
  ctx.lineWidth = 4;
  roundRect(ctx, 744, 144, 332, 332, 36);
  ctx.stroke();

  // Words.
  ctx.fillStyle = "#a796ff";
  ctx.font = `900 34px ${display}`;
  ctx.letterSpacing = "8px";
  ctx.fillText("CHOGSTRA", 72, 92);
  ctx.letterSpacing = "0px";
  ctx.fillStyle = "#f4efff";
  ctx.font = `900 108px ${display}`;
  ctx.fillText(`MOVEMENT ${input.movement}`, 68, 220);
  ctx.font = `600 30px ${ui}`;
  ctx.fillStyle = "#c9bfe6";
  ctx.fillText(`${input.chogName} is playing ${input.role}`, 72, 282);
  ctx.font = `400 22px ${ui}`;
  ctx.fillStyle = "#9a8fbd";
  ctx.fillText(input.settingText, 72, 320);

  // The loop, exactly as written onchain: 16 steps, lit steps raised by scale degree.
  const steps = decodePattern(input.pattern);
  const x0 = 72;
  const cell = 34;
  const gap = 6;
  const baseY = 470;
  steps.forEach((s, i) => {
    const x = x0 + i * (cell + gap) + Math.floor(i / 4) * 6;
    ctx.fillStyle = "#1b1333";
    roundRect(ctx, x, baseY - cell, cell, cell, 7);
    ctx.fill();
    if (s.on) {
      const lift = s.degree * 12;
      ctx.save();
      ctx.shadowColor = input.gel;
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = input.gel;
      roundRect(ctx, x, baseY - cell - lift, cell, cell, 7);
      ctx.fill();
      ctx.restore();
    }
  });

  ctx.font = `400 18px ${mono}`;
  ctx.fillStyle = "#9a8fbd";
  ctx.fillText(`tx ${input.txHash.slice(0, 18)}…${input.txHash.slice(-8)}`, 72, 570);
  ctx.font = `700 22px ${display}`;
  ctx.letterSpacing = "4px";
  ctx.textAlign = "right";
  ctx.fillText("1,969 CHOGS · ONE LIVE ONCHAIN SONG", W - 72, 570);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't draw the card"))), "image/png"));
}
