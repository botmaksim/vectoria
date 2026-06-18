import type { Camera } from "./camera";
import type { ThemeColors } from "./plotter";

function getNiceStep(range: number, targetLines: number): number {
  const idealStep = range / targetLines;
  const exponent = Math.floor(Math.log10(idealStep));
  const fraction = idealStep / Math.pow(10, exponent);

  let niceFraction;
  if (fraction < 1.5) niceFraction = 1;
  else if (fraction < 3) niceFraction = 2;
  else if (fraction < 7) niceFraction = 5;
  else niceFraction = 10;

  return niceFraction * Math.pow(10, exponent);
}

/**
 * @brief Renders the Cartesian coordinate grid, axes, and numerical labels.
 */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  width: number,
  height: number,
  colors: ThemeColors,
  gridType: string = "cartesian",
) {
  ctx.strokeStyle = colors.minor;
  ctx.lineWidth = 1;
  ctx.font = '12px "Inter", sans-serif';
  ctx.fillStyle = colors.text;

  const step = getNiceStep(
    camera.screenToMath(width, 0, width, height).x -
      camera.screenToMath(0, height, width, height).x,
    10,
  );

  if (gridType === "polar") {
    const origin = camera.mathToScreen(0, 0, width, height);
    
    const corners = [
        {x: 0, y: 0}, {x: width, y: 0}, {x: 0, y: height}, {x: width, y: height}
    ];
    let maxRadiusScreen = 0;
    for (let c of corners) {
        let dx = c.x - origin.x;
        let dy = c.y - origin.y;
        maxRadiusScreen = Math.max(maxRadiusScreen, Math.sqrt(dx*dx + dy*dy));
    }
    const maxRadiusMath = maxRadiusScreen / camera.state.zoom;

    ctx.beginPath();
    for (let angle = 0; angle < 2 * Math.PI; angle += Math.PI / 12) {
      const endX = origin.x + maxRadiusScreen * Math.cos(angle);
      const endY = origin.y - maxRadiusScreen * Math.sin(angle);
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(endX, endY);
    }
    ctx.stroke();

    ctx.strokeStyle = colors.minor;
    for (let r = step; r < maxRadiusMath + step; r += step) {
      ctx.beginPath();
      ctx.arc(origin.x, origin.y, r * camera.state.zoom, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.fillText(
        Number(r.toPrecision(3)).toString(),
        origin.x + r * camera.state.zoom + 2,
        origin.y - 2,
      );
    }
    return;
  }

  const minMath = camera.screenToMath(0, height, width, height);
  const maxMath = camera.screenToMath(width, 0, width, height);

  const mathWidth = maxMath.x - minMath.x;
  const mathHeight = maxMath.y - minMath.y;

  const stepX = getNiceStep(mathWidth, 10);
  const stepY = getNiceStep(mathHeight, 10);

  const startX = Math.floor(minMath.x / stepX) * stepX;
  const startY = Math.floor(minMath.y / stepY) * stepY;

  ctx.lineWidth = 1;
  ctx.font = "12px Inter, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillStyle = colors.text;

  ctx.strokeStyle = colors.minor;
  ctx.lineWidth = 1;
  ctx.strokeStyle = colors.minor;
  ctx.beginPath();
  
  const minMathY = camera.screenToMath(0, height, width, height).y;
  const maxMathY = camera.screenToMath(0, 0, width, height).y;
  const minMathX = camera.screenToMath(0, height, width, height).x;
  const maxMathX = camera.screenToMath(width, 0, width, height).x;

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let x = startX; x <= maxMath.x; x += stepX) {
    let fixedX = parseFloat(x.toPrecision(10));
    if (Math.abs(fixedX) < 1e-10) fixedX = 0;
    const p1 = camera.mathToScreen(fixedX, minMathY - (maxMathY - minMathY), width, height);
    const p2 = camera.mathToScreen(fixedX, maxMathY + (maxMathY - minMathY), width, height);
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);

    if (fixedX !== 0) {
      const origin = camera.mathToScreen(0, 0, width, height);
      const labelY = Math.min(Math.max(origin.y + 5, 0), height - 20);
      const labelP = camera.mathToScreen(fixedX, 0, width, height);
      ctx.fillText(fixedX.toString(), labelP.x, labelY);
    }
  }

  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let y = startY; y <= maxMath.y; y += stepY) {
    let fixedY = parseFloat(y.toPrecision(10));
    if (Math.abs(fixedY) < 1e-10) fixedY = 0;
    const p1 = camera.mathToScreen(minMathX - (maxMathX - minMathX), fixedY, width, height);
    const p2 = camera.mathToScreen(maxMathX + (maxMathX - minMathX), fixedY, width, height);
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);

    if (fixedY !== 0) {
      const origin = camera.mathToScreen(0, 0, width, height);
      const labelX = Math.min(Math.max(origin.x - 5, 20), width);
      const labelP = camera.mathToScreen(0, fixedY, width, height);
      ctx.fillText(fixedY.toString(), labelX, labelP.y);
    }
  }
  ctx.stroke();

  ctx.lineWidth = 2;
  ctx.strokeStyle = colors.major;
  ctx.beginPath();

  // Draw X axis
  const xAxisP1 = camera.mathToScreen(minMathX - (maxMathX - minMathX), 0, width, height);
  const xAxisP2 = camera.mathToScreen(maxMathX + (maxMathX - minMathX), 0, width, height);
  ctx.moveTo(xAxisP1.x, xAxisP1.y);
  ctx.lineTo(xAxisP2.x, xAxisP2.y);
  // Draw Y axis
  const yAxisP1 = camera.mathToScreen(0, minMathY - (maxMathY - minMathY), width, height);
  const yAxisP2 = camera.mathToScreen(0, maxMathY + (maxMathY - minMathY), width, height);
  ctx.moveTo(yAxisP1.x, yAxisP1.y);
  ctx.lineTo(yAxisP2.x, yAxisP2.y);
  ctx.stroke();

  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  const originScreen = camera.mathToScreen(0, 0, width, height);
  ctx.fillText("0", originScreen.x - 5, originScreen.y + 5);
}
