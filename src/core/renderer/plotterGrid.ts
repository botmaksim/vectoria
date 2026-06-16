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
    const maxRadiusScreen = Math.max(width, height);
    const maxRadiusMath = maxRadiusScreen / camera.state.zoom;

    ctx.beginPath();
    for (let angle = 0; angle < 2 * Math.PI; angle += Math.PI / 12) {
      const endX = origin.x + maxRadiusScreen * Math.cos(angle);
      const endY = origin.y - maxRadiusScreen * Math.sin(angle);
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(endX, endY);
    }
    ctx.stroke();

    ctx.strokeStyle = colors.major;
    for (let r = step; r < maxRadiusMath + step; r += step) {
      ctx.beginPath();
      ctx.arc(origin.x, origin.y, r * camera.state.zoom, 0, 2 * Math.PI);
      ctx.stroke();

      if (r % (step * 5) < 1e-5) {
        ctx.fillText(
          Number(r.toPrecision(3)).toString(),
          origin.x + r * camera.state.zoom + 2,
          origin.y - 2,
        );
      }
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
  ctx.beginPath();

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let x = startX; x <= maxMath.x; x += stepX) {
    const fixedX = parseFloat(x.toPrecision(10));
    const screenX = camera.mathToScreen(fixedX, 0, width, height).x;
    ctx.moveTo(screenX, 0);
    ctx.lineTo(screenX, height);

    if (fixedX !== 0) {
      const labelY = Math.min(
        Math.max(camera.mathToScreen(0, 0, width, height).y + 5, 0),
        height - 20,
      );
      ctx.fillText(fixedX.toString(), screenX, labelY);
    }
  }

  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let y = startY; y <= maxMath.y; y += stepY) {
    const fixedY = parseFloat(y.toPrecision(10));
    const screenY = camera.mathToScreen(0, fixedY, width, height).y;
    ctx.moveTo(0, screenY);
    ctx.lineTo(width, screenY);

    if (fixedY !== 0) {
      const labelX = Math.min(
        Math.max(camera.mathToScreen(0, 0, width, height).x - 5, 20),
        width,
      );
      ctx.fillText(fixedY.toString(), labelX, screenY);
    }
  }
  ctx.stroke();

  ctx.lineWidth = 2;
  ctx.strokeStyle = colors.major;
  ctx.beginPath();

  const originScreen = camera.mathToScreen(0, 0, width, height);
  if (originScreen.y >= 0 && originScreen.y <= height) {
    ctx.moveTo(0, originScreen.y);
    ctx.lineTo(width, originScreen.y);
  }
  if (originScreen.x >= 0 && originScreen.x <= width) {
    ctx.moveTo(originScreen.x, 0);
    ctx.lineTo(originScreen.x, height);
  }
  ctx.stroke();

  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillText("0", originScreen.x - 5, originScreen.y + 5);
}
