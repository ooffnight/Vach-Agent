// =====================================================
// visualizer.js — 3D-визуализатор интерьера типового жилого помещения
//
// Реализация по §3.1 диплома Петроченко:
//   - типовая сцена ~28 м²
//   - OrbitControls с вращением, перемещением (pan), приближением (zoom)
//   - авто-вращение при отсутствии действий
//   - WebGL fallback с сообщением
//   - контролы: стиль / цвет стен / тип пола / мебель
//   - кнопка «Сохранить сцену» → POST /api/visualizer/save
// =====================================================

// ── R-13: WebGL detection с fallback ───────────────────
function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch (e) { return false; }
}

if (!isWebGLAvailable()) {
  const container = document.getElementById('vizContainer');
  if (container) {
    container.innerHTML = `
      <div class="webgl-fallback" style="padding:60px 20px;text-align:center;background:var(--c-mist,#d4e0de);border-radius:12px;">
        <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
        <h3 style="margin:0 0 8px;color:var(--c-dark,#245358);">WebGL недоступен</h3>
        <p style="color:var(--c-sub,#6b7b7a);margin:0;">Для отображения 3D-визуализации требуется современный браузер с поддержкой WebGL.<br>Рекомендуем Chrome, Firefox, Edge, Safari или Яндекс Браузер актуальных версий.</p>
      </div>
    `;
  }
  // Прекращаем инициализацию модуля
  throw new Error('[viz] WebGL not available, fallback shown');
}

// ── Импорты Three.js (только после проверки WebGL) ─────
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── Палитра (соответствует CSS-переменным сайта) ───────
const PALETTE = {
  mist:  '#d4e0de',
  cream: '#e8ddd0',
  teal:  '#5e8281',
  dark:  '#245358',
  warm:  '#b8a589',
  white: '#f5f1ea',
  wood:  '#b29373',
};

// ── Стили (4 пресета по диплому Прил. В + getPresets API) ──
const STYLES = {
  modern:  { wallTint: '#e9e2d6', accent: '#5e8281', wood: '#b29373' },
  scandi:  { wallTint: '#f5f1ea', accent: '#d4e0de', wood: '#deb887' },
  loft:    { wallTint: '#8a8a8a', accent: '#3a3a3a', wood: '#5a4332' },
  classic: { wallTint: '#e8ddd0', accent: '#245358', wood: '#5a3a22' },
};

// ── Цвета стен (5 вариантов из палитры по диплому) ─────
const WALL_COLORS = {
  mist:  '#d4e0de',
  cream: '#e8ddd0',
  teal:  '#5e8281',
  warm:  '#b8a589',
  white: '#f5f1ea',
};

// ── Тип пола (3 варианта по диплому Прил. В) ───────────
const FLOORS = {
  parquet:  { color: '#deb887', roughness: 0.7 },
  tile:     { color: '#c4cbcb', roughness: 0.3 },
  laminate: { color: '#a89274', roughness: 0.5 },
};

// ── Состояние визуализатора ────────────────────────────
const state = {
  style:     'modern',
  wallColor: 'mist',
  floor:     'parquet',
  furniture: { sofa: true, table: true, wardrobe: true, tv: true },
  area:      28,  // §3.1: типовое помещение ~28 м²
};

// ── Сцена ──────────────────────────────────────────────
const canvas = document.getElementById('vizCanvas');
if (!canvas) {
  console.warn('[viz] #vizCanvas not found — skipping init');
  throw new Error('canvas missing');
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0);

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
camera.position.set(5, 4, 7);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
renderer.outputColorSpace  = THREE.SRGBColorSpace;
renderer.toneMapping       = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

// ── R-12: OrbitControls с pan + zoom + auto-rotate по диплому ──
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan   = true;   // R-12: «перемещать её»
controls.enableZoom  = true;   // R-12: «приближать колесом мыши»
controls.autoRotate  = true;   // §3.1: авто-вращение при простое
controls.autoRotateSpeed = 0.5;
controls.minPolarAngle = Math.PI / 6;
controls.maxPolarAngle = Math.PI / 2.1;
controls.minDistance = 4;
controls.maxDistance = 16;
controls.target.set(0, 1, 0);

// Любая активность пользователя — выключаем авто-вращение
['mousedown', 'touchstart', 'wheel'].forEach((ev) => {
  canvas.addEventListener(ev, () => { controls.autoRotate = false; }, { passive: true });
});
// Через 15 секунд бездействия — снова включаем
let idleTimer = null;
function scheduleAutoRotateResume() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { controls.autoRotate = true; }, 15000);
}
['mousedown', 'touchstart', 'wheel', 'mousemove'].forEach((ev) => {
  canvas.addEventListener(ev, scheduleAutoRotateResume, { passive: true });
});

// ── Освещение ──────────────────────────────────────────
const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);

const directional = new THREE.DirectionalLight(0xffffff, 0.8);
directional.position.set(10, 10, 5);
directional.castShadow = true;
directional.shadow.mapSize.set(1024, 1024);
directional.shadow.camera.left = -10;
directional.shadow.camera.right = 10;
directional.shadow.camera.top = 10;
directional.shadow.camera.bottom = -10;
scene.add(directional);

const point = new THREE.PointLight(0xfff6e6, 0.5, 12);
point.position.set(0, 2.8, 0);
scene.add(point);

// ── Контейнер сцены (вся комната + мебель) ─────────────
const room = new THREE.Group();
scene.add(room);

// ── Helpers ────────────────────────────────────────────
function disposeObj(obj) {
  if (!obj) return;
  obj.traverse((c) => {
    if (c.isMesh) {
      c.geometry?.dispose();
      if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
      else c.material?.dispose();
    }
  });
}

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: opts.roughness ?? 0.85,
    metalness: opts.metalness ?? 0.05,
  });
}

function box(w, h, d, color, opts = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ── Построение комнаты ~28 м² (по §3.1 диплома) ────────
// Габариты: 7 × 4 м = 28 м²
const ROOM_W = 7.0;
const ROOM_D = 4.0;
const ROOM_H = 2.7;

let floorMesh = null;
let walls = [];

function buildShell() {
  // Удалить старые
  if (floorMesh) { room.remove(floorMesh); disposeObj(floorMesh); }
  walls.forEach((w) => { room.remove(w); disposeObj(w); });
  walls = [];

  const floorCfg = FLOORS[state.floor];
  floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_W, ROOM_D),
    mat(floorCfg.color, { roughness: floorCfg.roughness })
  );
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  room.add(floorMesh);

  const wallColor = WALL_COLORS[state.wallColor];

  // Задняя стена
  const back = box(ROOM_W, ROOM_H, 0.1, wallColor);
  back.position.set(0, ROOM_H / 2, -ROOM_D / 2);
  room.add(back); walls.push(back);

  // Левая стена
  const left = box(0.1, ROOM_H, ROOM_D, wallColor);
  left.position.set(-ROOM_W / 2, ROOM_H / 2, 0);
  room.add(left); walls.push(left);

  // Правая стена
  const right = box(0.1, ROOM_H, ROOM_D, wallColor);
  right.position.set(ROOM_W / 2, ROOM_H / 2, 0);
  room.add(right); walls.push(right);
}

// ── Мебель ─────────────────────────────────────────────
const furniture = {
  sofa: null, table: null, wardrobe: null, tv: null,
};

function buildFurniture() {
  const styleCfg = STYLES[state.style];

  // Sofa
  if (state.furniture.sofa && !furniture.sofa) {
    const g = new THREE.Group();
    const base = box(2.2, 0.4, 0.9, styleCfg.accent);
    base.position.y = 0.2;
    g.add(base);
    const back = box(2.2, 0.6, 0.2, styleCfg.accent);
    back.position.set(0, 0.65, -0.35);
    g.add(back);
    for (let i = -1; i <= 1; i++) {
      const c = box(0.65, 0.18, 0.7, PALETTE.cream);
      c.position.set(i * 0.72, 0.49, 0.05);
      g.add(c);
    }
    g.position.set(-1.5, 0, 1.0);
    g.rotation.y = Math.PI / 8;
    furniture.sofa = g;
    room.add(g);
  } else if (!state.furniture.sofa && furniture.sofa) {
    room.remove(furniture.sofa); disposeObj(furniture.sofa); furniture.sofa = null;
  }

  // Table
  if (state.furniture.table && !furniture.table) {
    const g = new THREE.Group();
    const top = box(1.2, 0.06, 0.7, styleCfg.wood);
    top.position.y = 0.5;
    g.add(top);
    const legGeo = new THREE.BoxGeometry(0.06, 0.5, 0.06);
    const legMat = mat(PALETTE.dark);
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx, sz]) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(sx * 0.55, 0.25, sz * 0.31);
      leg.castShadow = true;
      g.add(leg);
    });
    g.position.set(1.5, 0, 0.5);
    furniture.table = g;
    room.add(g);
  } else if (!state.furniture.table && furniture.table) {
    room.remove(furniture.table); disposeObj(furniture.table); furniture.table = null;
  }

  // Wardrobe
  if (state.furniture.wardrobe && !furniture.wardrobe) {
    const g = new THREE.Group();
    const body = box(1.4, 2.0, 0.55, styleCfg.wood);
    body.position.y = 1.0;
    g.add(body);
    const divider = box(0.03, 1.9, 0.02, PALETTE.dark);
    divider.position.set(0, 1.0, 0.29);
    g.add(divider);
    g.position.set(-2.5, 0, -1.5);
    furniture.wardrobe = g;
    room.add(g);
  } else if (!state.furniture.wardrobe && furniture.wardrobe) {
    room.remove(furniture.wardrobe); disposeObj(furniture.wardrobe); furniture.wardrobe = null;
  }

  // TV
  if (state.furniture.tv && !furniture.tv) {
    const g = new THREE.Group();
    const screen = box(1.4, 0.8, 0.05, '#202020', { metalness: 0.3, roughness: 0.2 });
    screen.position.y = 1.3;
    g.add(screen);
    const stand = box(1.6, 0.4, 0.4, styleCfg.wood);
    stand.position.y = 0.2;
    g.add(stand);
    g.position.set(2.5, 0, -1.7);
    g.rotation.y = -Math.PI / 6;
    furniture.tv = g;
    room.add(g);
  } else if (!state.furniture.tv && furniture.tv) {
    room.remove(furniture.tv); disposeObj(furniture.tv); furniture.tv = null;
  }
}

function applyStyleToFurniture() {
  // При смене стиля удаляем все предметы и пересобираем
  Object.keys(furniture).forEach((k) => {
    if (furniture[k]) { room.remove(furniture[k]); disposeObj(furniture[k]); furniture[k] = null; }
  });
  buildFurniture();
}

// ── Первичная сборка ───────────────────────────────────
buildShell();
buildFurniture();

// ── Resize ─────────────────────────────────────────────
function resize() {
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(rect.width, 320);
  const h = Math.max(rect.height, 320);
  renderer.setSize(w, h, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
resize();
new ResizeObserver(resize).observe(canvas);
window.addEventListener('resize', resize);

// ── Animation loop ─────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

// ── Публичный API (для UI-контролов) ───────────────────
window.vizSetStyle = function (style) {
  if (!STYLES[style]) return;
  state.style = style;
  applyStyleToFurniture();
  updatePriceEstimate();
};

window.vizSetWallColor = function (color) {
  if (!WALL_COLORS[color]) return;
  state.wallColor = color;
  buildShell();  // стены пересоздать
};

window.vizSetFloor = function (floor) {
  if (!FLOORS[floor]) return;
  state.floor = floor;
  buildShell();
  updatePriceEstimate();
};

window.vizToggleFurniture = function (key) {
  if (!(key in state.furniture)) return;
  state.furniture[key] = !state.furniture[key];
  buildFurniture();
  updatePriceEstimate();
};

// ── Расчёт стоимости (вызов серверного API через формулу) ─
async function updatePriceEstimate() {
  const priceEl = document.getElementById('vizPrice');
  if (!priceEl) return;
  try {
    // Используем k=1.8 (капитальный) как базу для дизайнерской визуализации
    const typeMap = { modern: 'capital', scandi: 'capital', loft: 'designer', classic: 'designer' };
    const response = await fetch('/api/orders/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: typeMap[state.style] || 'capital', area: state.area }),
    });
    if (!response.ok) throw new Error('calc failed');
    const data = await response.json();
    priceEl.textContent = (data.price || 0).toLocaleString('ru-RU') + ' ₽';
  } catch (e) {
    priceEl.textContent = '—';
  }
}
updatePriceEstimate();

// ── Сохранение конфигурации сцены ──────────────────────
window.vizSaveScene = async function () {
  const nameInput = document.getElementById('vizSceneName');
  const sceneName = (nameInput?.value || '').trim() || ('Конфигурация ' + new Date().toLocaleString('ru-RU'));
  const statusEl  = document.getElementById('vizSaveStatus');

  if (statusEl) { statusEl.textContent = 'Сохраняем...'; statusEl.className = 'viz-status viz-status--pending'; }

  try {
    const response = await fetch('/api/visualizer/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:      sceneName,
        style:     state.style,
        wallColor: state.wallColor,
        floor:     state.floor,
        furniture: state.furniture,
        area:      state.area,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'save failed');
    if (statusEl) {
      statusEl.textContent = 'Сохранено! ID: ' + data.configId;
      statusEl.className = 'viz-status viz-status--ok';
    }
  } catch (err) {
    if (statusEl) {
      statusEl.textContent = 'Ошибка: ' + err.message;
      statusEl.className = 'viz-status viz-status--err';
    }
  }
};

// Сигнал готовности
window.dispatchEvent(new CustomEvent('viz-ready'));
