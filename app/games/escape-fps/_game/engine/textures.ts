const TEXTURE_SIZE = 64;

export type CanvasTexture = {
  canvas: HTMLCanvasElement;
  data: Uint8ClampedArray;
  size: number;
};

export type TextureSet = {
  ceiling: CanvasTexture;
  floor: CanvasTexture;
  walls: Record<number, CanvasTexture>;
};

type TextureDraw = (
  context: CanvasRenderingContext2D,
  size: number,
  floor: number,
) => void;

type ThemeDraws = {
  ceiling: TextureDraw;
  floor: TextureDraw;
  walls: Record<number, TextureDraw>;
};

const textureCache = new Map<number, TextureSet>();

function noise(x: number, y: number, salt: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;

  return value - Math.floor(value);
}

function createTexture(draw: TextureDraw, floor: number): CanvasTexture {
  const canvas = document.createElement("canvas");

  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to create texture canvas context.");
  }

  draw(context, TEXTURE_SIZE, floor);

  return {
    canvas,
    data: context.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE).data,
    size: TEXTURE_SIZE,
  };
}

function drawSpeckles(
  context: CanvasRenderingContext2D,
  size: number,
  color: string,
  count: number,
  salt: number,
): void {
  context.fillStyle = color;

  for (let index = 0; index < count; index += 1) {
    const x = Math.floor(noise(index, 3, salt) * size);
    const y = Math.floor(noise(index, 7, salt + 1) * size);
    const radius = 1 + noise(index, 11, salt + 2) * 1.6;

    context.globalAlpha = 0.22 + noise(index, 13, salt + 3) * 0.32;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  context.globalAlpha = 1;
}

function drawPanelGrid(
  context: CanvasRenderingContext2D,
  size: number,
  step: number,
  color: string,
): void {
  context.strokeStyle = color;
  context.lineWidth = 1;

  for (let line = 0; line <= size; line += step) {
    context.beginPath();
    context.moveTo(0, line);
    context.lineTo(size, line);
    context.moveTo(line, 0);
    context.lineTo(line, size);
    context.stroke();
  }
}

function drawWarehouseBrick(
  context: CanvasRenderingContext2D,
  size: number,
): void {
  context.fillStyle = "#817e76";
  context.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 16) {
    const offset = (y / 16) % 2 === 0 ? 0 : 16;

    for (let x = -offset; x < size; x += 32) {
      const tone = 105 + Math.floor(noise(x, y, 1) * 42);

      context.fillStyle = `rgb(${tone}, ${tone - 2}, ${tone - 8})`;
      context.fillRect(x + 1, y + 1, 30, 14);
    }
  }

  context.strokeStyle = "rgba(34, 31, 27, 0.55)";
  context.lineWidth = 2;

  for (let y = 0; y <= size; y += 16) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(size, y);
    context.stroke();
  }

  drawSpeckles(context, size, "#1f1b17", 28, 20);
}

function drawWarehouseWood(
  context: CanvasRenderingContext2D,
  size: number,
): void {
  context.fillStyle = "#5a3420";
  context.fillRect(0, 0, size, size);

  for (let x = 0; x < size; x += 8) {
    const tone = 72 + Math.floor(noise(x, 3, 2) * 36);

    context.fillStyle = `rgb(${tone + 30}, ${tone}, ${Math.max(18, tone - 34)})`;
    context.fillRect(x, 0, 7, size);
    context.fillStyle = "rgba(30, 16, 8, 0.5)";
    context.fillRect(x + 7, 0, 1, size);

    for (let y = 4; y < size; y += 9) {
      context.fillStyle = `rgba(255, 220, 155, ${0.08 + noise(x, y, 3) * 0.08})`;
      context.fillRect(x + 1, y + Math.floor(noise(x, y, 4) * 3), 5, 1);
    }
  }
}

function drawWarehouseFloor(
  context: CanvasRenderingContext2D,
  size: number,
): void {
  context.fillStyle = "#62523d";
  context.fillRect(0, 0, size, size);
  drawPanelGrid(context, size, 16, "rgba(30, 24, 18, 0.35)");
  drawSpeckles(context, size, "#c2a777", 30, 5);
}

function drawWarehouseCeiling(
  context: CanvasRenderingContext2D,
  size: number,
): void {
  context.fillStyle = "#2d2f2f";
  context.fillRect(0, 0, size, size);
  drawPanelGrid(context, size, 16, "rgba(0, 0, 0, 0.45)");
  drawSpeckles(context, size, "#8b8580", 16, 6);
}

function drawLabTile(
  context: CanvasRenderingContext2D,
  size: number,
): void {
  context.fillStyle = "#6aa38e";
  context.fillRect(0, 0, size, size);
  drawPanelGrid(context, size, 16, "rgba(12, 58, 49, 0.55)");
  context.strokeStyle = "rgba(210, 255, 230, 0.45)";
  context.lineWidth = 1;
  context.strokeRect(5, 5, size - 10, size - 10);
}

function drawLabPanel(
  context: CanvasRenderingContext2D,
  size: number,
): void {
  context.fillStyle = "#1d4f58";
  context.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 16) {
    for (let x = 0; x < size; x += 16) {
      const tone = 42 + Math.floor(noise(x, y, 7) * 26);

      context.fillStyle = `rgb(${tone}, ${tone + 42}, ${tone + 48})`;
      context.fillRect(x + 1, y + 1, 14, 14);
      context.fillStyle = "rgba(142, 255, 218, 0.48)";
      context.beginPath();
      context.arc(x + 4, y + 4, 1.6, 0, Math.PI * 2);
      context.arc(x + 12, y + 12, 1.6, 0, Math.PI * 2);
      context.fill();
    }
  }
}

function drawLabFloor(
  context: CanvasRenderingContext2D,
  size: number,
): void {
  context.fillStyle = "#314c47";
  context.fillRect(0, 0, size, size);
  drawPanelGrid(context, size, 8, "rgba(140, 245, 210, 0.18)");
  drawPanelGrid(context, size, 32, "rgba(0, 0, 0, 0.35)");
}

function drawLabCeiling(
  context: CanvasRenderingContext2D,
  size: number,
): void {
  context.fillStyle = "#5b746f";
  context.fillRect(0, 0, size, size);
  drawPanelGrid(context, size, 16, "rgba(20, 50, 48, 0.32)");
  context.fillStyle = "rgba(190, 255, 230, 0.28)";
  context.fillRect(20, 0, 24, size);
}

function drawSewerWall(
  context: CanvasRenderingContext2D,
  size: number,
): void {
  context.fillStyle = "#2a3d3c";
  context.fillRect(0, 0, size, size);
  drawPanelGrid(context, size, 16, "rgba(0, 0, 0, 0.42)");
  drawSpeckles(context, size, "#7fa47b", 42, 30);
  context.strokeStyle = "rgba(70, 112, 102, 0.65)";
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(0, size * 0.28);
  context.bezierCurveTo(size * 0.3, size * 0.2, size * 0.7, size * 0.36, size, size * 0.24);
  context.stroke();
}

function drawSewerPipeWall(
  context: CanvasRenderingContext2D,
  size: number,
): void {
  drawSewerWall(context, size);
  context.strokeStyle = "rgba(38, 65, 68, 0.95)";
  context.lineWidth = 8;
  context.beginPath();
  context.moveTo(0, size * 0.68);
  context.lineTo(size, size * 0.68);
  context.stroke();
  context.strokeStyle = "rgba(125, 165, 155, 0.35)";
  context.lineWidth = 2;
  context.stroke();
}

function drawSewerFloor(
  context: CanvasRenderingContext2D,
  size: number,
): void {
  context.fillStyle = "#243a34";
  context.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 8) {
    context.strokeStyle = `rgba(80, 130, 112, ${0.18 + noise(1, y, 31) * 0.16})`;
    context.beginPath();
    context.moveTo(0, y + noise(y, 1, 32) * 3);
    context.lineTo(size, y + noise(y, 5, 32) * 3);
    context.stroke();
  }
}

function drawSewerCeiling(
  context: CanvasRenderingContext2D,
  size: number,
): void {
  context.fillStyle = "#182323";
  context.fillRect(0, 0, size, size);
  drawPanelGrid(context, size, 16, "rgba(70, 100, 92, 0.22)");
  drawSpeckles(context, size, "#5b7f72", 20, 33);
}

function drawInfectedWall(
  context: CanvasRenderingContext2D,
  size: number,
): void {
  context.fillStyle = "#352428";
  context.fillRect(0, 0, size, size);
  drawPanelGrid(context, size, 16, "rgba(0, 0, 0, 0.42)");

  for (let index = 0; index < 6; index += 1) {
    const y = noise(index, 4, 40) * size;

    context.strokeStyle = "rgba(150, 35, 55, 0.62)";
    context.lineWidth = 2 + noise(index, 2, 41) * 2;
    context.beginPath();
    context.moveTo(0, y);
    context.bezierCurveTo(size * 0.25, y - 20, size * 0.7, y + 20, size, y - 4);
    context.stroke();
  }

  drawSpeckles(context, size, "#d65155", 24, 42);
}

function drawInfectedFlesh(
  context: CanvasRenderingContext2D,
  size: number,
): void {
  context.fillStyle = "#4a1e28";
  context.fillRect(0, 0, size, size);

  for (let index = 0; index < 10; index += 1) {
    const x = noise(index, 1, 43) * size;
    const y = noise(index, 2, 44) * size;
    const radius = 8 + noise(index, 3, 45) * 14;

    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);

    gradient.addColorStop(0, "rgba(210, 62, 72, 0.55)");
    gradient.addColorStop(1, "rgba(60, 8, 18, 0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
}

function drawInfectedFloor(
  context: CanvasRenderingContext2D,
  size: number,
): void {
  context.fillStyle = "#2b1d22";
  context.fillRect(0, 0, size, size);
  drawPanelGrid(context, size, 16, "rgba(0, 0, 0, 0.38)");
  drawSpeckles(context, size, "#9b263a", 34, 46);
}

function drawInfectedCeiling(
  context: CanvasRenderingContext2D,
  size: number,
): void {
  context.fillStyle = "#1d171a";
  context.fillRect(0, 0, size, size);
  drawSpeckles(context, size, "#762231", 28, 47);
}

function drawHiveMembrane(
  context: CanvasRenderingContext2D,
  size: number,
): void {
  context.fillStyle = "#32121b";
  context.fillRect(0, 0, size, size);

  for (let index = 0; index < 9; index += 1) {
    const x = noise(index, 1, 50) * size;
    const y = noise(index, 2, 51) * size;
    const radius = 10 + noise(index, 3, 52) * 15;

    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);

    gradient.addColorStop(0, "rgba(230, 130, 86, 0.55)");
    gradient.addColorStop(0.55, "rgba(115, 35, 48, 0.48)");
    gradient.addColorStop(1, "rgba(26, 4, 10, 0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  context.strokeStyle = "rgba(245, 155, 98, 0.26)";
  context.lineWidth = 2;
  for (let line = 0; line < size; line += 12) {
    context.beginPath();
    context.moveTo(0, line);
    context.bezierCurveTo(size * 0.3, line - 10, size * 0.65, line + 10, size, line - 4);
    context.stroke();
  }
}

function drawHiveFloor(
  context: CanvasRenderingContext2D,
  size: number,
): void {
  drawHiveMembrane(context, size);
  context.fillStyle = "rgba(20, 3, 8, 0.3)";
  drawPanelGrid(context, size, 32, "rgba(255, 145, 95, 0.12)");
}

function drawHiveCeiling(
  context: CanvasRenderingContext2D,
  size: number,
): void {
  context.fillStyle = "#15080d";
  context.fillRect(0, 0, size, size);
  drawSpeckles(context, size, "#a44736", 42, 53);
}

function drawExit(
  context: CanvasRenderingContext2D,
  size: number,
  floor: number,
): void {
  const hue = floor >= 4 ? "rgba(150, 255, 160, 0.72)" : "rgba(125, 240, 140, 0.62)";

  context.fillStyle = "#134a2a";
  context.fillRect(0, 0, size, size);

  for (let x = -size; x < size * 2; x += 12) {
    context.fillStyle = hue;
    context.beginPath();
    context.moveTo(x, size);
    context.lineTo(x + 6, size);
    context.lineTo(x + size + 6, 0);
    context.lineTo(x + size, 0);
    context.closePath();
    context.fill();
  }

  context.fillStyle = "rgba(0, 0, 0, 0.45)";
  context.fillRect(8, 22, 48, 20);
  context.fillStyle = "#d9ffe1";
  context.font = "bold 13px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("EXIT", size / 2, size / 2);
}

const THEMES: Record<number, ThemeDraws> = {
  1: {
    ceiling: drawWarehouseCeiling,
    floor: drawWarehouseFloor,
    walls: {
      1: drawWarehouseBrick,
      2: drawWarehouseWood,
      3: drawWarehouseBrick,
      4: drawExit,
    },
  },
  2: {
    ceiling: drawLabCeiling,
    floor: drawLabFloor,
    walls: {
      1: drawLabTile,
      2: drawLabPanel,
      3: drawLabPanel,
      4: drawExit,
    },
  },
  3: {
    ceiling: drawSewerCeiling,
    floor: drawSewerFloor,
    walls: {
      1: drawSewerWall,
      2: drawSewerWall,
      3: drawSewerPipeWall,
      4: drawExit,
    },
  },
  4: {
    ceiling: drawInfectedCeiling,
    floor: drawInfectedFloor,
    walls: {
      1: drawInfectedWall,
      2: drawInfectedFlesh,
      3: drawInfectedWall,
      4: drawExit,
    },
  },
  5: {
    ceiling: drawHiveCeiling,
    floor: drawHiveFloor,
    walls: {
      1: drawHiveMembrane,
      2: drawHiveMembrane,
      3: drawHiveMembrane,
      4: drawExit,
    },
  },
};

export function getTextureSet(floor = 1): TextureSet {
  const safeFloor = Math.max(1, Math.min(5, Math.floor(floor)));
  const cached = textureCache.get(safeFloor);

  if (cached) {
    return cached;
  }

  const theme = THEMES[safeFloor] ?? THEMES[1];
  const textures = {
    ceiling: createTexture(theme.ceiling, safeFloor),
    floor: createTexture(theme.floor, safeFloor),
    walls: {
      1: createTexture(theme.walls[1], safeFloor),
      2: createTexture(theme.walls[2], safeFloor),
      3: createTexture(theme.walls[3], safeFloor),
      4: createTexture(theme.walls[4], safeFloor),
    },
  };

  textureCache.set(safeFloor, textures);

  return textures;
}
