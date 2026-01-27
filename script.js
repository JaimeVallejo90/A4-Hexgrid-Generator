'use strict';

const HEX_X = Math.cos(Math.PI / 3);
const HEX_Y = Math.sin(Math.PI / 3);
const A4_ASPECT = 1.41421356237;
const A4_MM = { width: 210, height: 297 };
const MM_PER_INCH = 25.4;
const EXPORT_DPI = 300;

const canvas = document.getElementById('hex-canvas');
const ctx = canvas.getContext('2d');

const elements = {
  mapHandedness: document.getElementById('map-handedness'),
  mapWidth: document.getElementById('map-width'),
  mapHeight: document.getElementById('map-height'),
  coordsY: document.getElementById('coords-y'),
  coordsDelimiter: document.getElementById('coords-delimiter'),
  pageOrientation: document.getElementById('page-orientation'),
  a4Wrapper: document.querySelector('.a4-wrapper'),
  a4Paper: document.querySelector('.a4-paper'),
  savePngBw: document.getElementById('save-png-bw'),
  savePngAlpha: document.getElementById('save-png-alpha'),
  savePdf: document.getElementById('save-pdf'),
  exportFilename: document.getElementById('export-filename'),
  hexCount: document.getElementById('hex-count'),
};

const state = {};

bindInput('hexSize', 'hex-size');
bindInput('hexOrientation', 'hex-orientation');
bindInput('hexMargin', 'hex-margin');

bindInput('lineShow', 'line-show');
bindInput('hexLineWidth', 'hex-line-width');
bindInput('hexLineDash', 'hex-line-dash');
bindInput('hexLineColor', 'hex-line-color');
bindInput('hexLineAlpha', 'hex-line-alpha');

bindInput('mapShape', 'map-shape');
bindInput('mapHandedness', 'map-handedness');
bindInput('mapWidth', 'map-width');
bindInput('mapHeight', 'map-height');

bindInput('pageOrientation', 'page-orientation', 'landscape');

bindInput('coordsShow', 'coords-show');
bindInput('coordsStyle', 'coords-style');
bindInput('coordsPosition', 'coords-position');
bindInput('coordsOffset', 'coords-offset');
bindInput('coordsFont', 'coords-font');
bindInput('coordsSize', 'coords-size');
bindInput('coordsBold', 'coords-bold');
bindInput('coordsItalic', 'coords-italic');
bindInput('coordsColor', 'coords-color');
bindInput('coordsAlpha', 'coords-alpha');
bindInput('coordsPrefix', 'coords-prefix');
bindInput('coordsXType', 'coords-x-type');
bindInput('coordsXStart', 'coords-x-start');
bindInput('coordsXPadding', 'coords-x-padding');
bindInput('coordsDelimiter', 'coords-delimiter');
bindInput('coordsYType', 'coords-y-type');
bindInput('coordsYStart', 'coords-y-start');
bindInput('coordsYPadding', 'coords-y-padding');

onChange();

elements.savePngBw?.addEventListener('click', () => exportPng({ mode: 'bw' }));
elements.savePngAlpha?.addEventListener('click', () => exportPng({ mode: 'alpha' }));
elements.savePdf?.addEventListener('click', exportPdf);
bindSteppers();
window.addEventListener('resize', () => {
  resizeA4Paper();
  drawHexes();
  runLayoutTests();
});

function bindInput(key, elementId, defaultValue = 1) {
  const elem = document.getElementById(elementId);
  if (!elem) {
    return;
  }

  const readValue = () => {
    let value = elem.value;

    if (elem.type === 'number' || elem.type === 'range') {
      value = parseFloat(value);
      if (Number.isNaN(value)) {
        value = defaultValue;
      }
    } else if (elem.type === 'checkbox') {
      value = elem.checked;
    }

    state[key] = value;

    const outputId = elem.dataset.output;
    if (outputId) {
      updateOutputForElement(elem, value);
    }
  };

  readValue();
  elem.addEventListener('input', () => {
    readValue();
    onChange();
  });
}

function formatOutputValue(value, format) {
  if (format === 'int') {
    return Math.round(value).toString();
  }
  if (format === 'one') {
    return value.toFixed(1);
  }
  return value.toFixed(2);
}

function updateOutputForElement(elem, value) {
  const outputId = elem.dataset.output;
  if (!outputId) {
    return;
  }
  const output = document.getElementById(outputId);
  if (!output) {
    return;
  }
  const numericValue = Number.isFinite(value) ? value : 0;
  const format = elem.dataset.outputFormat || 'two';
  output.textContent = formatOutputValue(numericValue, format);
}

function bindSteppers() {
  const buttons = document.querySelectorAll('.stepper-btn');
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const targetId = button.dataset.target;
      const direction = button.dataset.stepper;
      const input = document.getElementById(targetId);
      if (!input || input.disabled) {
        return;
      }
      if (direction === 'up') {
        input.stepUp();
      } else {
        input.stepDown();
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });
}

function toggleStepper(targetId, disabled) {
  const buttons = document.querySelectorAll(`.stepper-btn[data-target="${targetId}"]`);
  buttons.forEach((button) => {
    button.disabled = disabled;
  });
}

function onChange() {
  updateA4Orientation();
  resizeA4Paper();

  if (state.mapShape === 'hexagon') {
    elements.mapHandedness.disabled = true;
    elements.mapHeight.disabled = true;
    toggleStepper('map-height', true);

    if (state.mapWidth % 2 === 0) {
      const enforcedWidth = Math.max(1, state.mapWidth - 1);
      if (enforcedWidth !== state.mapWidth) {
        state.mapWidth = enforcedWidth;
        elements.mapWidth.value = enforcedWidth;
        updateOutputForElement(elements.mapWidth, enforcedWidth);
      }
    }

    const enforcedHeight = getMapWidth();
    if (state.mapHeight !== enforcedHeight) {
      state.mapHeight = enforcedHeight;
      elements.mapHeight.value = enforcedHeight;
      updateOutputForElement(elements.mapHeight, enforcedHeight);
    }
  } else {
    elements.mapHandedness.disabled = false;
    elements.mapHeight.disabled = false;
    toggleStepper('map-height', false);
  }

  if (state.coordsStyle === 'index') {
    elements.coordsY.disabled = true;
    elements.coordsDelimiter.disabled = true;
  } else {
    elements.coordsY.disabled = false;
    elements.coordsDelimiter.disabled = false;
  }

  drawHexes();
  runLayoutTests();
}

function updateA4Orientation() {
  if (!elements.a4Paper) {
    return;
  }

  const orientation = state.pageOrientation === 'portrait' ? 'portrait' : 'landscape';
  elements.a4Paper.dataset.orientation = orientation;
}

function getPageSizeMm() {
  const portrait = state.pageOrientation === 'portrait';
  return portrait
    ? { width: A4_MM.width, height: A4_MM.height }
    : { width: A4_MM.height, height: A4_MM.width };
}

function resizeA4Paper() {
  if (!elements.a4Wrapper || !elements.a4Paper) {
    return;
  }

  const wrapperWidth = elements.a4Wrapper.clientWidth;
  const wrapperHeight = elements.a4Wrapper.clientHeight;

  if (wrapperWidth === 0 || wrapperHeight === 0) {
    return;
  }

  const orientation = state.pageOrientation === 'portrait' ? 'portrait' : 'landscape';
  const aspect = orientation === 'portrait' ? 1 / A4_ASPECT : A4_ASPECT;
  const availableWidth = wrapperWidth * 0.95;
  const availableHeight = wrapperHeight * 0.95;

  let width = availableWidth;
  let height = width / aspect;

  if (height > availableHeight) {
    height = availableHeight;
    width = height * aspect;
  }

  elements.a4Paper.style.width = `${Math.floor(width)}px`;
  elements.a4Paper.style.height = `${Math.floor(height)}px`;
}

function resizePreviewCanvas() {
  if (!elements.a4Paper) {
    return;
  }
  const width = Math.floor(elements.a4Paper.clientWidth);
  const height = Math.floor(elements.a4Paper.clientHeight);
  if (width <= 0 || height <= 0) {
    return;
  }
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function runLayoutTests() {
  const rows = document.querySelectorAll('.control-row');
  let issues = 0;

  rows.forEach((row) => {
    const overflow = row.scrollWidth > row.clientWidth + 3;
    row.classList.toggle('layout-overflow', overflow);
    if (overflow) {
      issues += 1;
    }
  });

  if (elements.a4Wrapper && elements.a4Paper) {
    const paperOverflow = elements.a4Paper.offsetWidth > elements.a4Wrapper.clientWidth + 1
      || elements.a4Paper.offsetHeight > elements.a4Wrapper.clientHeight + 1;
    elements.a4Paper.classList.toggle('layout-overflow', paperOverflow);
    if (paperOverflow) {
      issues += 1;
    }
  }

  const docOverflow = document.documentElement.scrollWidth > window.innerWidth + 1
    || document.documentElement.scrollHeight > window.innerHeight + 1;

  if (docOverflow) {
    issues += 1;
  }

  if (issues > 0) {
    console.warn(`Layout test: ${issues} overflow issue(s) detected.`);
  }
}

function drawHexes() {
  resizePreviewCanvas();
  drawHexesOn(ctx, canvas, null, getPageSizeMm());
  updateMeta();
}

function drawHexesOn(context, targetCanvas, backgroundColor, pageMm) {
  const mapWidth = getMapWidth();
  const mapHeight = getMapHeight();
  const pageWidthMm = pageMm.width;
  const pageHeightMm = pageMm.height;

  const getPointyDimension = (u) => getHexRadius() * (u + 0.5) * HEX_X * 3 + state.hexLineWidth;
  const getFlatDimension = (u) => getHexRadius() * (u + 0.65) * HEX_Y * 2 + state.hexLineWidth;

  const gridWidthMm = state.hexOrientation === 'flat'
    ? getPointyDimension(mapWidth)
    : getFlatDimension(mapWidth);
  const gridHeightMm = state.hexOrientation === 'flat'
    ? getFlatDimension(mapHeight)
    : getPointyDimension(mapHeight);

  const offsetXmm = (pageWidthMm - gridWidthMm) / 2;
  const offsetYmm = (pageHeightMm - gridHeightMm) / 2;
  const pxPerMm = targetCanvas.width / pageWidthMm;

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, targetCanvas.width, targetCanvas.height);

  if (backgroundColor) {
    context.save();
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
    context.restore();
  }

  context.save();
  context.scale(pxPerMm, pxPerMm);
  context.translate(offsetXmm, offsetYmm);

  if (state.lineShow && state.hexLineWidth > 0) {
    drawLines(context);
  }

  if (state.coordsShow) {
    drawCoordinates(context);
  }

  context.restore();
}

function drawLines(context) {
  context.save();
  context.strokeStyle = state.hexLineColor;
  context.lineWidth = state.hexLineWidth;
  context.globalAlpha = state.hexLineAlpha;
  context.lineCap = state.hexLineDash === 'dotted' ? 'round' : 'butt';

  context.setLineDash(getLineDash());

  for (let x = 0; x < getMapWidth(); x += 1) {
    for (let y = 0; y < getMapHeight(); y += 1) {
      const coords = getHexCenter(x, y);

      if (!hexExists({ x, y })) {
        continue;
      }

      context.save();
      context.translate(coords.x, coords.y);
      context.beginPath();

      if (state.hexMargin !== 0) {
        drawHex(context, getHexRadius() - state.hexMargin / 2);
      } else {
        drawPartialHex(context, getHexRadius(), x, y);
        drawHexBorder(context, getHexRadius(), x, y);
      }

      context.stroke();
      context.restore();
    }
  }

  context.restore();
}

function drawCoordinates(context) {
  context.save();

  context.textAlign = 'center';

  let textY = 0;
  if (state.coordsPosition === 'top') {
    context.textBaseline = 'top';
    textY = getBaseTextY();
  } else if (state.coordsPosition === 'middle') {
    context.textBaseline = 'middle';
    textY = 0;
  } else {
    context.textBaseline = 'alphabetic';
    textY = -getBaseTextY();
  }

  let fontFamily = state.coordsFont;
  if (!(fontFamily === 'serif' || fontFamily === 'sans-serif' || fontFamily === 'monospace')) {
    fontFamily = `"${fontFamily}"`;
  }

  context.font = `${state.coordsBold ? 'bold ' : ''}${state.coordsItalic ? 'italic ' : ''}${state.coordsSize}px ${fontFamily}`;
  context.fillStyle = state.coordsColor;
  context.globalAlpha = state.coordsAlpha;

  for (let x = 0; x < getMapWidth(); x += 1) {
    for (let y = 0; y < getMapHeight(); y += 1) {
      if (!hexExists({ x, y })) {
        continue;
      }

      const coords = getHexCenter(x, y);
      let hexString = '';

      if (state.coordsStyle === 'xy') {
        hexString = state.coordsPrefix + processXCoord(x) + state.coordsDelimiter + processYCoord(y);
      } else if (state.coordsStyle === 'index') {
        if (state.mapShape === 'square') {
          const index = y * state.mapWidth + x;
          hexString = state.coordsPrefix + processXCoord(index);
        } else {
          const ri = hexagonRankIndex(x, y);
          hexString = state.coordsPrefix + processXCoord(ri.index);
        }
      }

      context.save();
      context.translate(coords.x, coords.y);
      context.fillText(hexString, 0, textY);
      context.restore();
    }
  }

  context.restore();
}

function getLineDash() {
  if (state.hexLineDash === 'dashed') {
    const dash = Math.max(2, state.hexLineWidth * 4);
    const gap = Math.max(1.5, state.hexLineWidth * 3);
    return [dash, gap];
  }
  if (state.hexLineDash === 'dotted') {
    const dot = Math.max(0.4, state.hexLineWidth * 1.2);
    const gap = Math.max(1.2, state.hexLineWidth * 3);
    return [dot, gap];
  }
  return [];
}

function drawHex(context, radius) {
  const hx = HEX_X * radius;
  const hy = HEX_Y * radius;

  context.save();
  if (state.hexOrientation === 'pointy') {
    context.rotate(Math.PI * 0.5);
  }

  context.moveTo(0, -hy);
  context.lineTo(-hx, -hy);
  context.lineTo(-radius, 0);
  context.lineTo(-hx, hy);
  context.lineTo(hx, hy);
  context.lineTo(radius, 0);
  context.lineTo(hx, -hy);
  context.lineTo(0, -hy);
  context.restore();
}

function drawPartialHex(context, radius, x, y) {
  const hx = HEX_X * radius;
  const hy = HEX_Y * radius;

  context.save();
  if (state.hexOrientation === 'pointy') {
    context.rotate(-Math.PI / 2);
    context.scale(-1, 1);
  }

  if (hexExists(getNeighbor(x, y, 0))) {
    context.moveTo(radius, 0);
    context.lineTo(hx, -hy);
  }
  if (hexExists(getNeighbor(x, y, 1))) {
    context.moveTo(hx, -hy);
    context.lineTo(-hx, -hy);
  }
  if (hexExists(getNeighbor(x, y, 2))) {
    context.moveTo(-hx, -hy);
    context.lineTo(-radius, 0);
  }

  context.restore();
}

function drawHexBorder(context, radius, x, y) {
  const hx = HEX_X * radius;
  const hy = HEX_Y * radius;
  const hx2 = (hx + radius) / 2;
  const hy2 = hy / 2;

  const neighbors = [];
  for (let i = 0; i < 6; i += 1) {
    neighbors.push(!hexExists(getNeighbor(x, y, i)));
  }

  const coords = [
    [radius, 0],
    [hx2, -hy2],
    [hx, -hy],
    [0, -hy],
    [-hx, -hy],
    [-hx2, -hy2],
    [-radius, 0],
    [-hx2, hy2],
    [-hx, hy],
    [0, hy],
    [hx, hy],
    [hx2, hy2],
  ];

  let prev = false;
  context.save();
  for (let i = 0; i < 6; i += 1) {
    const c1 = coords[(i * 2 + 1) % 12];
    const c2 = coords[(i * 2 + 2) % 12];
    const c3 = coords[(i * 2 + 3) % 12];

    const n1 = neighbors[i];
    const n2 = neighbors[(i + 1) % 6];

    context.save();
    if (state.hexOrientation === 'pointy') {
      context.rotate(-Math.PI / 2);
      context.scale(-1, 1);
    }

    if (n1 && n2) {
      if (!prev) {
        context.moveTo(c1[0], c1[1]);
      }
      context.lineTo(c2[0], c2[1]);
      context.lineTo(c3[0], c3[1]);
      prev = true;
    } else if (n1 && !n2) {
      if (!prev) {
        context.moveTo(c1[0], c1[1]);
      }
      context.lineTo(c2[0], c2[1]);
      prev = false;
    } else if (!n1 && n2) {
      if (!prev) {
        context.moveTo(c2[0], c2[1]);
      }
      context.lineTo(c3[0], c3[1]);
      prev = true;
    } else {
      prev = false;
    }

    context.restore();
  }
  context.restore();
}

function getNeighbor(x, y, i) {
  let px = x;
  let py = y;

  if (state.hexOrientation === 'pointy') {
    const temp = px;
    px = py;
    py = temp;
  }

  let oddHand = px % 2 === 0;
  if (getMapHandedness() === 'odd') {
    oddHand = !oddHand;
  }

  let result = { x: 0, y: 0 };

  if (i === 0) {
    result = { x: px + 1, y: oddHand ? py - 1 : py };
  } else if (i === 1) {
    result = { x: px, y: py - 1 };
  } else if (i === 2) {
    result = { x: px - 1, y: oddHand ? py - 1 : py };
  } else if (i === 3) {
    result = { x: px - 1, y: oddHand ? py : py + 1 };
  } else if (i === 4) {
    result = { x: px, y: py + 1 };
  } else if (i === 5) {
    result = { x: px + 1, y: oddHand ? py : py + 1 };
  }

  if (state.hexOrientation === 'pointy') {
    const temp = result.x;
    result.x = result.y;
    result.y = temp;
  }

  return result;
}

function hexExists(coords) {
  const x = coords.x;
  const y = coords.y;

  if (state.mapShape === 'hexagon') {
    return isInHexagon(x, y);
  }

  return x >= 0 && x < getMapWidth() && y >= 0 && y < getMapHeight();
}

function getHexCenter(cx, cy) {
  let px = cx;
  let py = cy;

  if (state.hexOrientation === 'pointy') {
    const temp = px;
    px = py;
    py = temp;
  }

  let x = px * HEX_X * getHexRadius() * 3;

  if (getMapHandedness() === 'odd') {
    px += 1;
  }

  let y = (py + 0.5 * (px % 2)) * HEX_Y * getHexRadius() * 2;

  x += 0.75 * HEX_X * getHexRadius() * 3 + state.hexLineWidth / 2;
  y += 0.57 * HEX_Y * getHexRadius() * 2 + state.hexLineWidth / 2;

  if (state.hexOrientation === 'pointy') {
    const temp = x;
    x = y;
    y = temp;
  }

  return { x, y };
}

function hexagonRankIndex(x, y) {
  let px = x;
  let py = y;

  if (state.hexOrientation === 'pointy') {
    const temp = px;
    px = py;
    py = temp;
  }

  const cx = (getMapWidth() - 1) / 2;
  const cy = cx;
  const odd = cx % 2 === 1;

  let dx = px - cx;
  const adx = Math.abs(dx);
  const dy = py - cy;

  if (state.hexOrientation === 'pointy') {
    dx = -dx;
  }

  const minY = -Math.floor((adx + (odd ? 0 : 1)) / 2);
  const maxY = Math.floor((adx + (odd ? 1 : 0)) / 2);

  let index = 0;
  let rank = 0;

  if (dy >= minY && dy <= maxY) {
    rank = adx;

    if (dx < 0) {
      index = 4 * rank + (rank - dy + minY);
    } else {
      index = 1 * rank + (rank - maxY + dy);
    }
  } else if (dy < minY) {
    rank = adx + minY - dy;

    if (dx < 0) {
      index = 5 * rank + (rank + dx);
    } else {
      index = 0 * rank + dx;
    }
  } else {
    rank = adx + dy - maxY;

    if (dx < 0) {
      index = 3 * rank + -dx;
    } else {
      index = 2 * rank + (rank - dx);
    }
  }

  if (rank === 0) {
    index = 0;
  } else {
    index += 1 + 6 * (rank * (rank - 1)) / 2;
  }

  return { rank, index };
}

function isInHexagon(x, y) {
  const maxRank = (getMapWidth() - 1) / 2;
  const ri = hexagonRankIndex(x, y);
  return ri.rank <= maxRank;
}

function getBaseTextY() {
  return -getHexRadius() * HEX_Y + state.hexMargin / 2 + state.hexLineWidth / 2 + state.coordsOffset;
}

function getHexRadius() {
  return 0.5 * state.hexSize / HEX_Y;
}

function getMapHandedness() {
  return state.mapShape === 'hexagon' ? 'even' : state.mapHandedness;
}

function getMapWidth() {
  let width = state.mapWidth;
  if (state.mapShape === 'hexagon' && width % 2 === 0) {
    width -= 1;
  }
  return width;
}

function getMapHeight() {
  if (state.mapShape === 'hexagon') {
    return getMapWidth();
  }
  return state.mapHeight;
}

function letterize(value) {
  let result = '';
  let i = value;

  if (i === 0) {
    return 'A';
  }

  while (i > 0) {
    result = String.fromCharCode((i % 26) + 65) + result;
    i = Math.floor(i / 26);
  }

  return result;
}

function processXCoord(x) {
  let res = '';
  let value = x + state.coordsXStart;

  if (state.coordsXType === 'number') {
    res = value.toString();
  } else if (state.coordsXType === 'letter-upper-case') {
    res = letterize(value);
  } else if (state.coordsXType === 'letter-lower-case') {
    res = letterize(value).toLowerCase();
  }

  res = res.padStart(state.coordsXPadding.length, state.coordsXPadding);
  return res;
}

function processYCoord(y) {
  let res = '';
  let value = y + state.coordsYStart;

  if (state.coordsYType === 'number') {
    res = value.toString();
  } else if (state.coordsYType === 'letter-upper-case') {
    res = letterize(value);
  } else if (state.coordsYType === 'letter-lower-case') {
    res = letterize(value).toLowerCase();
  }

  res = res.padStart(state.coordsYPadding.length, state.coordsYPadding);
  return res;
}

function exportPng(options) {
  const mode = options?.mode || 'bw';
  const { canvas: exportCanvas } = renderExportCanvas(mode);
  const filename = buildFilename('png');
  downloadDataUrl(exportCanvas.toDataURL('image/png', 1.0), filename);
}

function exportPdf() {
  const { canvas: exportCanvas } = renderExportCanvas('color');
  const dataUrl = exportCanvas.toDataURL('image/png', 1.0);
  const filename = buildFilename('pdf');
  const orientation = state.pageOrientation === 'portrait' ? 'portrait' : 'landscape';
  const pageSize = orientation === 'portrait' ? 'A4 portrait' : 'A4 landscape';

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>${filename}</title>
    <style>
      @page { size: ${pageSize}; margin: 0; }
      html, body { margin: 0; padding: 0; background: #fff; }
      body { display: flex; align-items: center; justify-content: center; height: 100vh; }
      img { max-width: 100%; max-height: 100%; }
    </style>
  </head>
  <body>
    <img id="page" src="${dataUrl}" alt="A4 export">
    <script>
      const img = document.getElementById('page');
      img.onload = () => { window.focus(); window.print(); };
    <\/script>
  </body>
</html>`;

  iframe.srcdoc = html;
  iframe.onload = () => {
    setTimeout(() => iframe.remove(), 5000);
  };

  document.body.appendChild(iframe);
}

function renderExportCanvas(mode) {
  const pageMm = getPageSizeMm();
  const exportCanvas = document.createElement('canvas');
  const scale = EXPORT_DPI / MM_PER_INCH;
  exportCanvas.width = Math.round(pageMm.width * scale);
  exportCanvas.height = Math.round(pageMm.height * scale);
  const exportCtx = exportCanvas.getContext('2d');
  const snapshot = { ...state };
  const overrides = {};
  let background = null;

  if (mode === 'bw') {
    overrides.hexLineColor = '#000000';
    overrides.coordsColor = '#000000';
    overrides.hexLineAlpha = 1;
    overrides.coordsAlpha = 1;
    background = '#ffffff';
  } else if (mode === 'alpha') {
    background = null;
  } else if (mode === 'color') {
    background = '#ffffff';
  }

  Object.assign(state, overrides);
  drawHexesOn(exportCtx, exportCanvas, background, pageMm);
  Object.assign(state, snapshot);

  return { canvas: exportCanvas };
}

function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function buildFilename(extension) {
  const raw = elements.exportFilename.value.trim() || 'hexmap.png';
  const base = raw.replace(/\.[^/.]+$/, '');
  return `${base}.${extension}`;
}

function updateMeta() {
  if (elements.hexCount) {
    elements.hexCount.textContent = countHexes().toString();
  }
}

function countHexes() {
  let total = 0;

  for (let x = 0; x < getMapWidth(); x += 1) {
    for (let y = 0; y < getMapHeight(); y += 1) {
      if (hexExists({ x, y })) {
        total += 1;
      }
    }
  }

  return total;
}
