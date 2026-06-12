import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

type HeroSceneHandle = {
  destroy: () => void;
};

type HeroSceneOptions = {
  lowPowerMode?: boolean;
  onReady?: () => void;
};

type FaceConfig = {
  index: string;
  key: string;
  title: string;
  description: string;
  detail: string;
  target: string;
  color: string;
  accent: string;
  videoSrc?: string;
};

type ShardConfig = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
};

type DisposableObject = THREE.Object3D & {
  geometry?: THREE.BufferGeometry;
  material?: THREE.Material | THREE.Material[];
};

type FaceMesh = THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> & {
  userData: {
    baseMap: THREE.Texture;
    face: FaceConfig;
    frame: THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial>;
    hoverMap: THREE.Texture;
    target: string;
    title: string;
  };
};

type FaceHitMesh = THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> & {
  userData: {
    faceMesh: FaceMesh;
  };
};

const FACE_SIZE = 2.08;
const FACE_HIT_SIZE = 2.48;
const FACE_DISTANCE = 1.25;
const CUBE_SHELL_SIZE = 2.62;
const DRAG_ROTATION_SPEED = 0.006;
const IDLE_ROTATION_DELAY_MS = 1200;
const CUBE_HINT_DISMISS_MS = 5000;
const SHOWCASE_TUMBLE_MS = 1200;
const SHOWCASE_HOLD_MS = 3500;
const SHOWCASE_IMPULSE = 0.038;
const INERTIA_DAMPING = 0.88;
const MIN_ROTATION_VELOCITY = 0.0008;
const FACE_SNAP_DELAY_MS = 260;
const FACE_SNAP_EASE = 0.14;
const FACE_SNAP_COMPLETE_ANGLE = 0.006;

const faces: FaceConfig[] = [
  {
    index: "01",
    key: "gtm",
    title: "GTM Reporting System",
    description: "30+ cycles replaced",
    detail: "Replaced recurring manual reporting with one operating surface for GTM execution and decision-making.",
    target: "#experience-gtm",
    color: "#a78bfa",
    accent: "#93c5fd",
  },
  {
    index: "02",
    key: "creator",
    title: "Creator Data Pipeline",
    description: "2,000+ profiles enriched",
    detail: "Structured creator sourcing, enrichment, and outreach data into a repeatable partnership pipeline.",
    target: "#experience-creator",
    color: "#93c5fd",
    accent: "#f0abfc",
  },
  {
    index: "03",
    key: "email",
    title: "ML Email Labeling",
    description: "10,000+ labels reviewed",
    detail: "Converted high-volume email queues into cleaner labeled signals for machine-learning workflows.",
    target: "#experience-ml",
    color: "#f0abfc",
    accent: "#93c5fd",
  },
  {
    index: "04",
    key: "inventory",
    title: "Inventory Reconciliation",
    description: "$30K+ surfaced",
    detail: "Built reconciliation reporting that exposed previously invisible inventory discrepancies.",
    target: "#experience-logistics",
    color: "#67e8f9",
    accent: "#a78bfa",
  },
  {
    index: "05",
    key: "supply",
    title: "Multi-vendor Operations",
    description: "One source of truth",
    detail: "Connected procurement, shipment, and inventory data so teams could resolve issues with clearer context.",
    target: "#experience-logistics",
    color: "#ddd6fe",
    accent: "#67e8f9",
  },
  {
    index: "06",
    key: "python",
    title: "Workflow Automation",
    description: "Repetitive work removed",
    detail: "Automated reconciliation, enrichment, and recurring operations tasks that previously lived in spreadsheets.",
    target: "#experience-python",
    color: "#c4b5fd",
    accent: "#67e8f9",
  },
];

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const wrapText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) => {
  const words = text.split(" ");
  let line = "";
  let nextY = y;

  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, nextY);
      line = word;
      nextY += lineHeight;
      return;
    }

    line = testLine;
  });

  if (line) {
    ctx.fillText(line, x, nextY);
  }
};

const createWorkCardTexture = (face: FaceConfig, hovered = false, size = 512) => {
  const cardCanvas = document.createElement("canvas");
  cardCanvas.width = size;
  cardCanvas.height = size;

  const ctx = cardCanvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, cardCanvas.width, cardCanvas.height);
    const scale = size / 1024;
    ctx.scale(scale, scale);

    const background = ctx.createLinearGradient(0, 0, 1024, 1024);
    background.addColorStop(0, hovered ? "rgba(27,23,52,0.95)" : "rgba(12,14,28,0.94)");
    background.addColorStop(0.48, "rgba(7,9,20,0.98)");
    background.addColorStop(1, "rgba(3,5,13,0.99)");
    ctx.fillStyle = background;
    drawRoundedRect(ctx, 28, 28, 968, 968, 70);
    ctx.fill();

    ctx.save();
    drawRoundedRect(ctx, 72, 430, 880, 360, 46);
    ctx.clip();
    const visual = ctx.createLinearGradient(72, 430, 952, 790);
    visual.addColorStop(0, `${face.color}2a`);
    visual.addColorStop(0.52, "rgba(255,255,255,0.055)");
    visual.addColorStop(1, `${face.accent}24`);
    ctx.fillStyle = visual;
    ctx.fillRect(72, 430, 880, 360);

    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 2;
    for (let index = 0; index < 9; index += 1) {
      const y = 462 + index * 36;
      ctx.beginPath();
      ctx.moveTo(88, y);
      ctx.lineTo(936, y);
      ctx.stroke();
    }

    ctx.globalAlpha = hovered ? 0.32 : 0.26;
    ctx.strokeStyle = face.accent;
    ctx.lineWidth = 6;
    for (let index = 0; index < 4; index += 1) {
      const y = 508 + index * 54;
      ctx.beginPath();
      ctx.moveTo(104, y);
      ctx.bezierCurveTo(276, y - 58, 388, y + 72, 548, y + 4);
      ctx.bezierCurveTo(676, y - 52, 792, y + 28, 920, y - 18);
      ctx.stroke();
    }

    ctx.globalAlpha = hovered ? 0.32 : 0.26;
    ctx.fillStyle = "#ffffff";
    [150, 318, 486, 654, 822].forEach((x, index) => {
      const barHeight = 54 + index * 24;
      drawRoundedRect(ctx, x, 736 - barHeight, 58, barHeight, 18);
      ctx.fill();
    });

    ctx.restore();

    ctx.shadowColor = face.color;
    ctx.shadowBlur = hovered ? 24 : 22;
    ctx.strokeStyle = hovered ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.34)";
    ctx.lineWidth = hovered ? 4 : 2;
    drawRoundedRect(ctx, 28, 28, 968, 968, 70);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = face.color;
    ctx.font = "600 54px Inter, Arial, sans-serif";
    ctx.fillText(face.index, 72, 132);

    ctx.fillStyle = "rgba(245,243,255,0.96)";
    ctx.font = "600 82px Inter, Arial, sans-serif";
    wrapText(ctx, face.title, 72, 250, 860, 88);

    ctx.fillStyle = "rgba(245,243,255,0.64)";
    ctx.font = "500 42px Inter, Arial, sans-serif";
    wrapText(ctx, face.description, 72, 892, 860, 50);
  }

  const texture = new THREE.CanvasTexture(cardCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
};

const createCubeEdgeGeometry = (size: number) => {
  const half = size / 2;
  const corners = [
    [-half, -half, -half],
    [half, -half, -half],
    [half, half, -half],
    [-half, half, -half],
    [-half, -half, half],
    [half, -half, half],
    [half, half, half],
    [-half, half, half],
  ];
  const edgePairs = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ];
  const positions = new Float32Array(edgePairs.length * 2 * 3);

  edgePairs.forEach(([start, end], pairIndex) => {
    [corners[start], corners[end]].forEach((corner, cornerIndex) => {
      const offset = pairIndex * 6 + cornerIndex * 3;
      positions[offset] = corner[0];
      positions[offset + 1] = corner[1];
      positions[offset + 2] = corner[2];
    });
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return geometry;
};

const createParticleTexture = () => {
  const particleCanvas = document.createElement("canvas");
  particleCanvas.width = 64;
  particleCanvas.height = 64;
  const context = particleCanvas.getContext("2d");

  if (context) {
    const glow = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    glow.addColorStop(0, "rgba(255,255,255,1)");
    glow.addColorStop(0.16, "rgba(226,217,255,0.94)");
    glow.addColorStop(0.46, "rgba(167,139,250,0.34)");
    glow.addColorStop(1, "rgba(167,139,250,0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, 64, 64);
  }

  const texture = new THREE.CanvasTexture(particleCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

const disposeMaterial = (material: THREE.Material | THREE.Material[]) => {
  if (Array.isArray(material)) {
    material.forEach((item) => item.dispose());
    return;
  }

  material.dispose();
};

export function createHeroScene(
  canvas: HTMLCanvasElement,
  options: HeroSceneOptions = {},
): HeroSceneHandle {
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: light)");
  let prefersReducedMotion = motionQuery.matches;
  let prefersLightMode = colorSchemeQuery.matches;
  const lowPowerMode = Boolean(options.lowPowerMode);
  const textureSize = lowPowerMode ? 256 : 512;
  const frameIntervalMs = lowPowerMode ? 66 : 42;
  let hasReportedReady = false;
  const facePanel = canvas
    .closest<HTMLElement>(".hero-right")
    ?.querySelector<HTMLElement>("[data-face-panel]");
  const facePanelIndex = facePanel?.querySelector<HTMLElement>("[data-face-index]");
  const facePanelTitle = facePanel?.querySelector<HTMLElement>("[data-face-title]");
  const facePanelCopy = facePanel?.querySelector<HTMLElement>("[data-face-copy]");
  const facePanelLink = facePanel?.querySelector<HTMLAnchorElement>("[data-face-link]");
  const facePanelDots = facePanel?.querySelector<HTMLElement>("[data-face-dots]");
  const cubeHint = canvas
    .closest<HTMLElement>(".hero-right")
    ?.querySelector<HTMLElement>("[data-cube-hint]");

  const dispatchCubeEvent = (eventName: string, face?: FaceConfig) => {
    window.dispatchEvent(
      new CustomEvent("portfolio:cube_event", {
        detail: {
          eventName,
          face: face?.key ?? null,
          label: face?.title ?? null,
        },
      }),
    );
  };

  const faceDotElements = faces.map(() => {
    const dot = document.createElement("i");
    facePanelDots?.append(dot);
    return dot;
  });

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(prefersLightMode ? 0xdce7f2 : 0x080912, 0.052);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !lowPowerMode,
    alpha: true,
    powerPreference: lowPowerMode ? "low-power" : "default",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPowerMode ? 0.75 : 1));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;

  const camera = new THREE.PerspectiveCamera(
    34,
    Math.max(canvas.clientWidth, 1) / Math.max(canvas.clientHeight, 1),
    0.1,
    100,
  );
  camera.position.set(0.22, 1.0, 7.7);

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = environment;

  const root = new THREE.Group();
  root.position.set(0.28, 0.08, 0);
  root.rotation.set(-0.03, -0.1, 0.01);
  root.scale.setScalar(0.84);
  scene.add(root);

  const ambient = new THREE.AmbientLight(prefersLightMode ? 0x7c6fbd : 0x8b7cff, prefersLightMode ? 0.38 : 0.5);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xffffff, prefersLightMode ? 1.9 : 1.75);
  keyLight.position.set(-3.8, 4.4, 4.2);
  scene.add(keyLight);

  const violetLight = new THREE.PointLight(0xa78bfa, 4.8, 12);
  violetLight.position.set(1.8, 1.35, 2.5);
  scene.add(violetLight);

  const blueLight = new THREE.PointLight(0x93c5fd, 2.6, 10);
  blueLight.position.set(-2.6, -0.35, 3.1);
  scene.add(blueLight);

  const underGlow = new THREE.PointLight(0x8b5cf6, 4.8, 8);
  underGlow.position.set(0.24, -0.62, 1.3);
  scene.add(underGlow);

  const cubeGroup = new THREE.Group();
  cubeGroup.position.set(0.45, 0.58, 0);
  cubeGroup.scale.setScalar(0.72);
  cubeGroup.quaternion.setFromEuler(new THREE.Euler(-0.18, 0.34, 0.06));
  root.add(cubeGroup);

  const faceTextures: THREE.Texture[] = [];
  const videos: HTMLVideoElement[] = [];
  const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);

  const createFaceMaps = (face: FaceConfig) => {
    if (face.videoSrc && !lowPowerMode) {
      const video = document.createElement("video");
      video.src = face.videoSrc;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.crossOrigin = "anonymous";
      const videoTexture = new THREE.VideoTexture(video);
      videoTexture.colorSpace = THREE.SRGBColorSpace;
      videoTexture.anisotropy = anisotropy;
      faceTextures.push(videoTexture);
      videos.push(video);
      void video.play().catch(() => undefined);
      return { baseMap: videoTexture, hoverMap: videoTexture };
    }

    const baseMap = createWorkCardTexture(face, false, textureSize);
    const hoverMap = createWorkCardTexture(face, true, textureSize);
    baseMap.anisotropy = anisotropy;
    hoverMap.anisotropy = anisotropy;
    faceTextures.push(baseMap, hoverMap);
    return { baseMap, hoverMap };
  };

  const faceGeometry = new THREE.PlaneGeometry(FACE_SIZE, FACE_SIZE);
  const faceHitGeometry = new THREE.PlaneGeometry(FACE_HIT_SIZE, FACE_HIT_SIZE);
  const frameGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-FACE_SIZE / 2, -FACE_SIZE / 2, 0.012),
    new THREE.Vector3(FACE_SIZE / 2, -FACE_SIZE / 2, 0.012),
    new THREE.Vector3(FACE_SIZE / 2, FACE_SIZE / 2, 0.012),
    new THREE.Vector3(-FACE_SIZE / 2, FACE_SIZE / 2, 0.012),
    new THREE.Vector3(-FACE_SIZE / 2, -FACE_SIZE / 2, 0.012),
  ]);
  const faceMeshes: FaceMesh[] = [];
  const faceHitMeshes: FaceHitMesh[] = [];
  const faceHitMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const addFace = (
    face: FaceConfig,
    position: THREE.Vector3Tuple,
    rotation: THREE.Euler,
  ) => {
    const { baseMap, hoverMap } = createFaceMaps(face);
    const material = new THREE.MeshBasicMaterial({
      map: baseMap,
      transparent: true,
      opacity: 0.94,
      side: THREE.FrontSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(faceGeometry, material) as FaceMesh;
    mesh.position.set(...position);
    mesh.rotation.copy(rotation);
    mesh.renderOrder = 3;

    const frame = new THREE.LineLoop(
      frameGeometry,
      new THREE.LineBasicMaterial({
        color: new THREE.Color(face.color),
        transparent: true,
        opacity: 0.32,
      }),
    );
    frame.renderOrder = 4;
    mesh.add(frame);

    mesh.userData = {
      baseMap,
      face,
      frame,
      hoverMap,
      target: face.target,
      title: face.title,
    };
    cubeGroup.add(mesh);
    faceMeshes.push(mesh);

    const hitMesh = new THREE.Mesh(faceHitGeometry, faceHitMaterial) as FaceHitMesh;
    hitMesh.position.copy(mesh.position);
    hitMesh.rotation.copy(mesh.rotation);
    hitMesh.userData = { faceMesh: mesh };
    cubeGroup.add(hitMesh);
    faceHitMeshes.push(hitMesh);
  };

  addFace(faces[0], [0, 0, FACE_DISTANCE], new THREE.Euler(0, 0, 0));
  addFace(faces[1], [FACE_DISTANCE, 0, 0], new THREE.Euler(0, Math.PI / 2, 0));
  addFace(faces[2], [-FACE_DISTANCE, 0, 0], new THREE.Euler(0, -Math.PI / 2, 0));
  addFace(faces[3], [0, FACE_DISTANCE, 0], new THREE.Euler(-Math.PI / 2, 0, 0));
  addFace(faces[4], [0, 0, -FACE_DISTANCE], new THREE.Euler(0, Math.PI, 0));
  addFace(faces[5], [0, -FACE_DISTANCE, 0], new THREE.Euler(Math.PI / 2, 0, 0));

  const shellGeometry = new RoundedBoxGeometry(CUBE_SHELL_SIZE, CUBE_SHELL_SIZE, CUBE_SHELL_SIZE, 6, 0.18);
  const shellMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xb7a7ff,
    roughness: 0.1,
    metalness: 0,
    transmission: 0.52,
    thickness: 1.05,
    transparent: true,
    opacity: 0.14,
    ior: 1.45,
    attenuationColor: 0x8b7cff,
    attenuationDistance: 1.8,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: 0.78,
    depthWrite: false,
  });
  const shell = new THREE.Mesh(shellGeometry, shellMaterial);
  shell.renderOrder = 1;
  cubeGroup.add(shell);

  const edgeMaterial = new THREE.LineBasicMaterial({
    color: 0xeee7ff,
    transparent: true,
    opacity: 0.24,
  });
  const edgeLines = new THREE.LineSegments(createCubeEdgeGeometry(CUBE_SHELL_SIZE), edgeMaterial);
  edgeLines.renderOrder = 5;
  cubeGroup.add(edgeLines);

  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xa78bfa,
    transparent: true,
    opacity: 0.76,
    depthWrite: false,
  });

  const orbit = new THREE.Mesh(
    new THREE.TorusGeometry(2.18, 0.008, 12, 220),
    glowMaterial,
  );
  orbit.position.set(0.3, -0.02, 0);
  orbit.rotation.set(Math.PI / 2.42, 0.06, -0.28);
  root.add(orbit);

  const shardMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xc4b5fd,
    roughness: 0.08,
    metalness: 0.02,
    transmission: 0.52,
    thickness: 0.42,
    transparent: true,
    opacity: 0.5,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.4,
    depthWrite: false,
  });
  const shardGeometry = new RoundedBoxGeometry(1, 1, 1, 4, 0.08);
  const shardConfigs: ShardConfig[] = [
    {
      position: [-2.0, 1.15, -0.15],
      rotation: [0.28, 0.3, -0.68],
      scale: [0.16, 0.86, 0.035],
    },
    {
      position: [2.35, 0.42, -0.35],
      rotation: [-0.24, -0.4, 0.42],
      scale: [0.13, 0.98, 0.035],
    },
    {
      position: [-1.05, -0.1, 0.22],
      rotation: [0.44, 0.24, 1.3],
      scale: [0.12, 0.68, 0.03],
    },
  ];
  const shards = shardConfigs.map((config) => {
    const shard = new THREE.Mesh(shardGeometry, shardMaterial);
    shard.position.set(...config.position);
    shard.rotation.set(...config.rotation);
    shard.scale.set(...config.scale);
    root.add(shard);
    return shard;
  });

  const satelliteGeometry = new THREE.SphereGeometry(1, lowPowerMode ? 16 : 28, lowPowerMode ? 12 : 20);
  const satelliteMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xd9d2ff,
    roughness: 0.08,
    metalness: 0.12,
    transmission: 0.5,
    thickness: 0.55,
    transparent: true,
    opacity: 0.72,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    envMapIntensity: 1.6,
    depthWrite: false,
  });
  const satelliteConfigs = [
    { radius: 2.78, speed: 0.18, phase: 0.3, scale: 0.15, lift: 0.7 },
    { radius: 3.18, speed: -0.12, phase: 2.2, scale: 0.09, lift: -0.35 },
    { radius: 2.46, speed: 0.14, phase: 4.4, scale: 0.07, lift: 1.22 },
  ];
  const satellites = satelliteConfigs.map((config) => {
    const satellite = new THREE.Mesh(satelliteGeometry, satelliteMaterial);
    satellite.scale.setScalar(config.scale);
    root.add(satellite);
    return satellite;
  });

  const particleCount = lowPowerMode ? 24 : 88;
  const particlePositions = new Float32Array(particleCount * 3);
  for (let index = 0; index < particleCount; index += 1) {
    particlePositions[index * 3] = (Math.random() - 0.5) * 8.8;
    particlePositions[index * 3 + 1] = (Math.random() - 0.5) * 5.2;
    particlePositions[index * 3 + 2] = (Math.random() - 0.5) * 4.8;
  }
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(particlePositions, 3),
  );
  const particleTexture = createParticleTexture();
  const particleMaterial = new THREE.PointsMaterial({
    color: prefersLightMode ? 0x7657c8 : 0xd8ccff,
    map: particleTexture,
    size: lowPowerMode ? 0.035 : 0.052,
    sizeAttenuation: true,
    transparent: true,
    opacity: prefersLightMode ? 0.34 : 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  root.add(particles);

  const applyColorScheme = (lightMode: boolean) => {
    prefersLightMode = lightMode;
    scene.fog?.color.set(lightMode ? 0xdce7f2 : 0x080912);
    renderer.toneMappingExposure = lightMode ? 0.82 : 0.9;
    ambient.color.set(lightMode ? 0x7767b3 : 0x8b7cff);
    ambient.intensity = lightMode ? 0.38 : 0.5;
    keyLight.intensity = lightMode ? 1.9 : 1.75;
    violetLight.intensity = lightMode ? 3.4 : 4.8;
    blueLight.intensity = lightMode ? 2.1 : 2.6;
    underGlow.intensity = lightMode ? 3.2 : 4.8;
    shellMaterial.color.set(lightMode ? 0x8c7bd1 : 0xb7a7ff);
    shellMaterial.attenuationColor.set(lightMode ? 0x6651b5 : 0x8b7cff);
    edgeMaterial.color.set(lightMode ? 0x6c58b6 : 0xeee7ff);
    glowMaterial.color.set(lightMode ? 0x7657c8 : 0xa78bfa);
    shardMaterial.color.set(lightMode ? 0x8d7bc8 : 0xc4b5fd);
    satelliteMaterial.color.set(lightMode ? 0x7e6ac4 : 0xd9d2ff);
    particleMaterial.color.set(lightMode ? 0x7657c8 : 0xd8ccff);
    particleMaterial.opacity = lightMode ? 0.34 : 0.5;
  };
  applyColorScheme(prefersLightMode);

  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2(99, 99);
  let hoveredFace: FaceMesh | null = null;
  let pointerStart: { pointerId: number; x: number; y: number } | null = null;
  let scrollProgress = 0;
  let frameId = 0;
  let lastRenderTime = 0;
  let panelFaceKey = "";
  let panelIsActive = false;
  let lastViewedFaceKey = "";
  let isSceneVisible = true;
  let isDocumentVisible = document.visibilityState === "visible";
  let isSnapTargetActive = false;
  let hasSnappedSinceInteraction = true;
  const sceneStartTime = performance.now();
  const faceNormal = new THREE.Vector3();
  const facePosition = new THREE.Vector3();
  const viewDirection = new THREE.Vector3();
  const faceQuaternion = new THREE.Quaternion();
  const cubeWorldPosition = new THREE.Vector3();
  const rootWorldQuaternion = new THREE.Quaternion();
  const inverseRootWorldQuaternion = new THREE.Quaternion();
  const desiredParentDirection = new THREE.Vector3();
  const desiredParentUp = new THREE.Vector3();
  const faceLocalNormal = new THREE.Vector3();
  const faceLocalUp = new THREE.Vector3();
  const faceLocalRight = new THREE.Vector3();
  const targetParentUp = new THREE.Vector3();
  const targetParentRight = new THREE.Vector3();
  const sourceBasisMatrix = new THREE.Matrix4();
  const targetBasisMatrix = new THREE.Matrix4();
  const sourceBasisQuaternion = new THREE.Quaternion();
  const targetBasisQuaternion = new THREE.Quaternion();
  const inverseSourceBasisQuaternion = new THREE.Quaternion();
  const snapTargetQuaternion = new THREE.Quaternion();
  const horizontalDragAxis = new THREE.Vector3(0, 1, 0);
  const verticalDragAxis = new THREE.Vector3(1, 0, 0);
  const dragQuaternionX = new THREE.Quaternion();
  const dragQuaternionY = new THREE.Quaternion();
  const combinedDragQuaternion = new THREE.Quaternion();
  type ShowcasePhase = "idle" | "tumbling" | "snapping" | "holding";
  let showcasePhase: ShowcasePhase = "idle";
  let showcaseFaceIndex = 0;
  let showcasePhaseStart = performance.now();
  let showcaseManualOverride = false;
  const dragState = {
    isDragging: false,
    previousX: 0,
    previousY: 0,
    velocityX: 0,
    velocityY: 0,
    lastInteractionTime: performance.now(),
  };

  const applyCubeTumble = (velocityX: number, velocityY: number) => {
    dragQuaternionX.setFromAxisAngle(horizontalDragAxis, velocityX);
    dragQuaternionY.setFromAxisAngle(verticalDragAxis, velocityY);
    combinedDragQuaternion.multiplyQuaternions(dragQuaternionX, dragQuaternionY);
    cubeGroup.quaternion.premultiply(combinedDragQuaternion).normalize();
  };

  let cubeHintDismissTimer: number | null = null;

  const dismissCubeHint = () => {
    if (!cubeHint || cubeHint.classList.contains("is-dismissed")) return;
    cubeHint.classList.add("is-dismissed");
    if (cubeHintDismissTimer !== null) {
      window.clearTimeout(cubeHintDismissTimer);
      cubeHintDismissTimer = null;
    }
  };

  const scheduleCubeHintDismiss = () => {
    if (!cubeHint || prefersReducedMotion || window.innerWidth < 641) return;
    if (cubeHintDismissTimer !== null) return;
    cubeHintDismissTimer = window.setTimeout(dismissCubeHint, CUBE_HINT_DISMISS_MS);
  };

  const updateCubeHint = () => {
    if (!cubeHint) return;
    cubeHint.firstChild?.remove();
    cubeHint.prepend(
      hoveredFace
        ? "Click face to view system"
        : window.innerWidth < 700
          ? "Swipe cube to explore work"
          : "Drag cube to explore work",
    );
  };

  const applyShowcaseImpulse = () => {
    dragState.velocityX = (Math.random() - 0.5) * SHOWCASE_IMPULSE;
    dragState.velocityY = (Math.random() - 0.5) * SHOWCASE_IMPULSE;
  };

  const beginShowcaseTumble = () => {
    showcasePhase = "tumbling";
    showcasePhaseStart = performance.now();
    applyShowcaseImpulse();
  };

  const startFaceSnap = (targetFace?: FaceMesh) => {
    const faceMesh = targetFace ?? getPrimaryVisibleFace();
    cubeGroup.getWorldPosition(cubeWorldPosition);
    root.getWorldQuaternion(rootWorldQuaternion);
    inverseRootWorldQuaternion.copy(rootWorldQuaternion).invert();
    desiredParentDirection.copy(camera.position).sub(cubeWorldPosition).normalize();
    desiredParentDirection.applyQuaternion(inverseRootWorldQuaternion).normalize();

    desiredParentUp.set(0, 1, 0).applyQuaternion(inverseRootWorldQuaternion).normalize();
    targetParentUp
      .copy(desiredParentUp)
      .addScaledVector(
        desiredParentDirection,
        -desiredParentUp.dot(desiredParentDirection),
      )
      .normalize();

    if (targetParentUp.lengthSq() < 0.001) {
      targetParentUp.set(0, 1, 0);
    }

    targetParentRight.crossVectors(targetParentUp, desiredParentDirection).normalize();
    targetParentUp.crossVectors(desiredParentDirection, targetParentRight).normalize();

    faceLocalRight.set(1, 0, 0).applyQuaternion(faceMesh.quaternion).normalize();
    faceLocalUp.set(0, 1, 0).applyQuaternion(faceMesh.quaternion).normalize();
    faceLocalNormal.set(0, 0, 1).applyQuaternion(faceMesh.quaternion).normalize();

    sourceBasisMatrix.makeBasis(faceLocalRight, faceLocalUp, faceLocalNormal);
    targetBasisMatrix.makeBasis(targetParentRight, targetParentUp, desiredParentDirection);
    sourceBasisQuaternion.setFromRotationMatrix(sourceBasisMatrix);
    targetBasisQuaternion.setFromRotationMatrix(targetBasisMatrix);
    inverseSourceBasisQuaternion.copy(sourceBasisQuaternion).invert();
    snapTargetQuaternion
      .copy(targetBasisQuaternion)
      .multiply(inverseSourceBasisQuaternion)
      .normalize();

    isSnapTargetActive = true;
  };

  const updateFacePanel = (face: FaceConfig, active: boolean) => {
    if (panelFaceKey === face.key && panelIsActive === active) return;
    panelFaceKey = face.key;
    panelIsActive = active;
    if (facePanelIndex) {
      facePanelIndex.textContent = `${face.index} / ${String(faces.length).padStart(2, "0")}`;
    }
    if (facePanelTitle) facePanelTitle.textContent = face.title;
    if (facePanelCopy) facePanelCopy.textContent = face.detail;
    if (facePanelLink) facePanelLink.href = face.target;
    faceDotElements.forEach((dot, index) => {
      dot.classList.toggle("is-active", faces[index].key === face.key);
    });
    facePanel?.style.setProperty("--face-accent", face.color);
    facePanel?.classList.toggle("is-active", active);

    if (lastViewedFaceKey !== face.key) {
      lastViewedFaceKey = face.key;
      dispatchCubeEvent("cube_face_viewed", face);
    }
  };
  updateFacePanel(faces[0], false);
  updateCubeHint();

  const getPrimaryVisibleFace = () => {
    let bestFace = faceMeshes[0];
    let bestScore = -Infinity;

    faceMeshes.forEach((faceMesh) => {
      faceMesh.getWorldQuaternion(faceQuaternion);
      faceMesh.getWorldPosition(facePosition);
      faceNormal.set(0, 0, 1).applyQuaternion(faceQuaternion).normalize();
      viewDirection.copy(camera.position).sub(facePosition).normalize();
      const score = faceNormal.dot(viewDirection);

      if (score > bestScore) {
        bestScore = score;
        bestFace = faceMesh;
      }
    });

    return bestFace;
  };

  const setHoveredFace = (nextFace: FaceMesh | null) => {
    if (hoveredFace === nextFace) return;

    hoveredFace = nextFace;

    faceMeshes.forEach((faceMesh) => {
      const active = hoveredFace === faceMesh;
      faceMesh.material.map = active ? faceMesh.userData.hoverMap : faceMesh.userData.baseMap;
      faceMesh.material.opacity = hoveredFace ? (active ? 0.98 : 0.54) : 0.94;
      faceMesh.material.needsUpdate = true;
      faceMesh.userData.frame.material.opacity = hoveredFace ? (active ? 0.92 : 0.16) : 0.32;
      faceMesh.scale.setScalar(active ? 1.018 : 1);
    });

    updateFacePanel((hoveredFace ?? getPrimaryVisibleFace()).userData.face, Boolean(hoveredFace));

    canvas.style.cursor = dragState.isDragging ? "grabbing" : hoveredFace ? "pointer" : "grab";
    updateCubeHint();

    if (hoveredFace) {
      dispatchCubeEvent("cube_face_hovered", hoveredFace.userData.face);
    }
  };

  const getFaceHit = () => {
    raycaster.setFromCamera(pointerNdc, camera);
    return (
      raycaster.intersectObjects(faceHitMeshes, false)[0]?.object as FaceHitMesh | undefined
    )?.userData.faceMesh;
  };

  const updatePointer = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    setHoveredFace(getFaceHit() ?? null);
  };

  const scrollToTarget = (target: string) => {
    const element = document.querySelector<HTMLElement>(target);
    if (!element) return;
    element.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  const noteInteraction = () => {
    isSnapTargetActive = false;
    hasSnappedSinceInteraction = false;
    showcaseManualOverride = true;
    showcasePhase = "idle";
    dragState.lastInteractionTime = performance.now();
  };

  const onPointerMove = (event: PointerEvent) => {
    updatePointer(event);

    if (!dragState.isDragging) return;

    const deltaX = event.clientX - dragState.previousX;
    const deltaY = event.clientY - dragState.previousY;
    dragState.previousX = event.clientX;
    dragState.previousY = event.clientY;

    const velocityX = deltaX * DRAG_ROTATION_SPEED;
    const velocityY = deltaY * DRAG_ROTATION_SPEED;
    applyCubeTumble(velocityX, velocityY);
    dragState.velocityX = velocityX;
    dragState.velocityY = velocityY;
    noteInteraction();
  };

  const onPointerDown = (event: PointerEvent) => {
    dismissCubeHint();
    updatePointer(event);
    pointerStart = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    dragState.isDragging = true;
    dragState.previousX = event.clientX;
    dragState.previousY = event.clientY;
    dragState.velocityX = 0;
    dragState.velocityY = 0;
    noteInteraction();
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add("is-dragging");
    canvas.style.cursor = "grabbing";
    dispatchCubeEvent("cube_drag_started");
  };

  const endDrag = (event?: PointerEvent) => {
    const wasDragging = dragState.isDragging;
    dragState.isDragging = false;
    canvas.classList.remove("is-dragging");

    if (event && canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }

    if (event) {
      updatePointer(event);
    }

    if (wasDragging && event && pointerStart) {
      const deltaX = event.clientX - pointerStart.x;
      const deltaY = event.clientY - pointerStart.y;
      const traveled = Math.hypot(deltaX, deltaY);
      const clickedFace = getFaceHit();

      if (traveled < 8 && clickedFace) {
        dispatchCubeEvent("cube_face_clicked", clickedFace.userData.face);
        scrollToTarget(clickedFace.userData.target);
      }
    }

    pointerStart = null;
    noteInteraction();
    canvas.style.cursor = hoveredFace ? "pointer" : "grab";
  };

  const onPointerUp = (event: PointerEvent) => {
    endDrag(event);
  };

  const onPointerLeave = (event: PointerEvent) => {
    if (dragState.isDragging) {
      endDrag(event);
    }

    pointerNdc.set(99, 99);
    setHoveredFace(null);
  };

  const onPointerCancel = (event: PointerEvent) => {
    endDrag(event);
    pointerNdc.set(99, 99);
    setHoveredFace(null);
  };

  const onPointerLostCapture = () => {
    dragState.isDragging = false;
    pointerStart = null;
    canvas.classList.remove("is-dragging");
    canvas.style.cursor = hoveredFace ? "pointer" : "grab";
  };

  const onScroll = () => {
    const hero = canvas.closest<HTMLElement>(".hero");
    if (!hero) return;
    const rect = hero.getBoundingClientRect();
    const travel = Math.max(rect.height - window.innerHeight, 1);
    scrollProgress = Math.min(Math.max(-rect.top / travel, 0), 1);
  };

  const resizeRenderer = () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    const compact = width < 640;
    const stacked = width < 900;
    root.position.set(compact ? -0.02 : stacked ? 0.04 : 0.28, compact ? 0.02 : 0.08, 0);
    root.scale.setScalar(compact ? 0.58 : stacked ? 0.7 : 0.84);
    cubeGroup.position.x = compact ? 0.12 : stacked ? 0.22 : 0.45;
    camera.position.z = compact ? 8.9 : stacked ? 8.25 : 7.7;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPowerMode ? 0.75 : 1));
    renderer.setSize(width, height, false);
    updateCubeHint();
  };

  const onMotionPreferenceChange = (event: MediaQueryListEvent) => {
    prefersReducedMotion = event.matches;
  };

  const onColorSchemeChange = (event: MediaQueryListEvent) => {
    applyColorScheme(event.matches);
  };

  const onVisibilityChange = () => {
    isDocumentVisible = document.visibilityState === "visible";
  };

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("lostpointercapture", onPointerLostCapture);
  window.addEventListener("resize", resizeRenderer);
  window.addEventListener("scroll", onScroll, { passive: true });
  motionQuery.addEventListener("change", onMotionPreferenceChange);
  colorSchemeQuery.addEventListener("change", onColorSchemeChange);
  document.addEventListener("visibilitychange", onVisibilityChange);

  const sceneObserver = "IntersectionObserver" in window
    ? new IntersectionObserver(
      ([entry]) => {
        isSceneVisible = Boolean(entry?.isIntersecting);
      },
      { threshold: 0.05 },
    )
    : null;
  sceneObserver?.observe(canvas);

  const animate = (frameTime = performance.now()) => {
    const elapsed = (frameTime - sceneStartTime) / 1000;
    const shouldRender = isSceneVisible && isDocumentVisible;
    const shouldRenderFrame = shouldRender && frameTime - lastRenderTime >= frameIntervalMs;

    if (shouldRenderFrame) {
      lastRenderTime = frameTime;

      if (!prefersReducedMotion) {
        const cubeFloat = Math.sin(elapsed * 0.75);
        cubeGroup.position.y = 0.58 + cubeFloat * 0.08;
      }

      if (!dragState.isDragging) {
        const timeSinceInteraction = performance.now() - dragState.lastInteractionTime;
        const hasVelocity =
          Math.abs(dragState.velocityX) > MIN_ROTATION_VELOCITY ||
          Math.abs(dragState.velocityY) > MIN_ROTATION_VELOCITY;

        if (showcaseManualOverride) {
          if (isSnapTargetActive) {
            cubeGroup.quaternion.slerp(snapTargetQuaternion, FACE_SNAP_EASE);
            cubeGroup.quaternion.normalize();

            if (cubeGroup.quaternion.angleTo(snapTargetQuaternion) < FACE_SNAP_COMPLETE_ANGLE) {
              cubeGroup.quaternion.copy(snapTargetQuaternion);
              isSnapTargetActive = false;
              hasSnappedSinceInteraction = true;
              dragState.lastInteractionTime = performance.now();
            }
          } else if (hasVelocity) {
            applyCubeTumble(dragState.velocityX, dragState.velocityY);
            dragState.velocityX *= INERTIA_DAMPING;
            dragState.velocityY *= INERTIA_DAMPING;
          } else if (
            !hasSnappedSinceInteraction &&
            timeSinceInteraction > FACE_SNAP_DELAY_MS
          ) {
            startFaceSnap();
          } else if (timeSinceInteraction > IDLE_ROTATION_DELAY_MS) {
            showcaseManualOverride = false;
            beginShowcaseTumble();
          }
        } else {
          switch (showcasePhase) {
            case "idle":
              if (timeSinceInteraction > IDLE_ROTATION_DELAY_MS) {
                if (prefersReducedMotion) {
                  showcasePhase = "snapping";
                  startFaceSnap(faceMeshes[showcaseFaceIndex]);
                } else {
                  beginShowcaseTumble();
                }
              }
              break;
            case "tumbling": {
              const tumbleElapsed = performance.now() - showcasePhaseStart;
              if (hasVelocity) {
                applyCubeTumble(dragState.velocityX, dragState.velocityY);
                dragState.velocityX *= INERTIA_DAMPING;
                dragState.velocityY *= INERTIA_DAMPING;
              } else if (tumbleElapsed >= SHOWCASE_TUMBLE_MS) {
                showcasePhase = "snapping";
                startFaceSnap(faceMeshes[showcaseFaceIndex]);
              }
              break;
            }
            case "snapping":
              if (isSnapTargetActive) {
                cubeGroup.quaternion.slerp(snapTargetQuaternion, FACE_SNAP_EASE);
                cubeGroup.quaternion.normalize();

                if (cubeGroup.quaternion.angleTo(snapTargetQuaternion) < FACE_SNAP_COMPLETE_ANGLE) {
                  cubeGroup.quaternion.copy(snapTargetQuaternion);
                  isSnapTargetActive = false;
                  showcasePhase = "holding";
                  showcasePhaseStart = performance.now();
                  updateFacePanel(faceMeshes[showcaseFaceIndex].userData.face, false);
                  dragState.lastInteractionTime = performance.now();
                }
              }
              break;
            case "holding":
              if (performance.now() - showcasePhaseStart > SHOWCASE_HOLD_MS) {
                showcaseFaceIndex = (showcaseFaceIndex + 1) % faceMeshes.length;
                if (prefersReducedMotion) {
                  showcasePhase = "snapping";
                  startFaceSnap(faceMeshes[showcaseFaceIndex]);
                } else {
                  beginShowcaseTumble();
                }
              }
              break;
          }
        }
      }

      if (!prefersReducedMotion) {
        orbit.rotation.z = -0.34 + elapsed * 0.08;

        shards.forEach((shard, index) => {
          shard.position.y += Math.sin(elapsed * 0.76 + index) * 0.0007;
          shard.rotation.z += 0.0011 * (index % 2 === 0 ? 1 : -1);
        });

        satellites.forEach((satellite, index) => {
          const config = satelliteConfigs[index];
          const angle = elapsed * config.speed + config.phase;
          satellite.position.set(
            Math.cos(angle) * config.radius + 0.24,
            config.lift + Math.sin(angle * 1.7) * 0.22,
            Math.sin(angle) * 1.25 + 0.28,
          );
          satellite.rotation.y = angle * 1.8;
        });

        particles.rotation.y = elapsed * 0.01;
        particles.rotation.x = Math.sin(elapsed * 0.1) * 0.02;
        root.rotation.x += (-0.03 + scrollProgress * 0.03 - root.rotation.x) * 0.025;
        root.rotation.y += (-0.1 + scrollProgress * 0.08 - root.rotation.y) * 0.025;
      }
    }

    if (shouldRenderFrame) {
      if (hoveredFace) setHoveredFace(getFaceHit() ?? null);
      if (!hoveredFace) updateFacePanel(getPrimaryVisibleFace().userData.face, false);
      renderer.render(scene, camera);
    }

    if (!hasReportedReady) {
      hasReportedReady = true;
      scheduleCubeHintDismiss();
      options.onReady?.();
    }
    frameId = window.requestAnimationFrame(animate);
  };

  resizeRenderer();
  onScroll();
  animate();

  const destroy = () => {
    if (cubeHintDismissTimer !== null) {
      window.clearTimeout(cubeHintDismissTimer);
      cubeHintDismissTimer = null;
    }
    window.cancelAnimationFrame(frameId);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointerleave", onPointerLeave);
    canvas.removeEventListener("pointercancel", onPointerCancel);
    canvas.removeEventListener("lostpointercapture", onPointerLostCapture);
    window.removeEventListener("resize", resizeRenderer);
    window.removeEventListener("scroll", onScroll);
    motionQuery.removeEventListener("change", onMotionPreferenceChange);
    colorSchemeQuery.removeEventListener("change", onColorSchemeChange);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    sceneObserver?.disconnect();

    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material | THREE.Material[]>();
    scene.traverse((object) => {
      const disposable = object as DisposableObject;
      if (disposable.geometry) geometries.add(disposable.geometry);
      if (disposable.material) materials.add(disposable.material);
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach(disposeMaterial);
    faceTextures.forEach((texture) => texture.dispose());
    particleTexture.dispose();
    videos.forEach((video) => {
      video.pause();
      video.removeAttribute("src");
      video.load();
    });
    environment.dispose();
    pmremGenerator.dispose();
    renderer.dispose();
  };

  return { destroy };
}
