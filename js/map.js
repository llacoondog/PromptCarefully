import * as THREE from 'three';

// 타일 타입 상수 (풍부한 신규 기믹 포함)
export const TILE_TYPE = {
  EMPTY: 0,       // 낭떠러지
  FLOOR: 1,       // 일반 바닥
  WALL: 2,        // 벽
  SPIKE: 3,       // 날카로운 가시 (사망)
  LAVA: 4,        // 네온 마법 용암 (사망)
  JUMP_PAD: 5,    // 스프링 점프대 (2칸 이상 전방 도약)
  ICE: 6,         // 🧊 얼음판 (가던 방향으로 1칸 추가 미끄러짐!)
  PORTAL: 7,      // 🌀 차원 워프 포탈 (연결된 다른 포탈로 순간이동!)
  CONVEYOR: 8,    // ⏩ 이동 컨베이어 벨트 (지정 방향으로 1칸 밀려남!)
  GOAL: 9,        // 🏆 승리 보석 (골인)
  CRUMBLE: 10,    // 💥 부서지는 균열 바닥 (1회 통과 후 낭떠러지로 붕괴!)
  MINE: 11        // 💣 경고 지뢰 (밟으면 대폭발!)
};

// 각 타일/기믹의 마우스 호버 상세 설명 메타데이터
export const TILE_INFO = {
  [TILE_TYPE.EMPTY]: {
    name: '낭떠러지',
    enName: 'Cliff Void',
    badge: '낙하 주의',
    badgeClass: 'badge-danger',
    color: '#94a3b8',
    icon: '🕳️',
    desc: '아무것도 없는 끝없는 공중입니다! 발을 헛디디면 아래로 영원히 추락합니다.',
    tip: '점프대나 2칸 이상 도약으로 뛰어넘어야 해.'
  },
  [TILE_TYPE.FLOOR]: {
    name: '안전한 바닥',
    enName: 'Safe Grass Floor',
    badge: '안전 구역',
    badgeClass: 'badge-safe',
    color: '#4ade80',
    icon: '🟩',
    desc: '상쾌한 잔디와 부유 섬 흙으로 된 안전 지대입니다. 자유롭게 이동할 수 있습니다.',
    tip: '기본적인 이동 통로로 활용해봐.'
  },
  [TILE_TYPE.WALL]: {
    name: '토이 스톤 벽',
    enName: 'Stone Wall Block',
    badge: '진행 불가',
    badgeClass: 'badge-warning',
    color: '#fde047',
    icon: '🧱',
    desc: '단단한 석재 벽 블록입니다. 부딪히면 콩! 소리와 함께 튕겨 나옵니다.',
    tip: '벽을 돌아갈 수 있도록 우회 경로를 지시해줘!'
  },
  [TILE_TYPE.SPIKE]: {
    name: '날카로운 가시',
    enName: 'Sharp Spikes',
    badge: '치명적 위험',
    badgeClass: 'badge-danger',
    color: '#f87171',
    icon: '📍',
    desc: '밟는 순간 뾰족한 가시에 찔려 로봇이 산산조각 폭발합니다.',
    tip: '점프로 뛰어넘거나 옆으로 돌아서 지나가야 해.'
  },
  [TILE_TYPE.LAVA]: {
    name: '네온 마법 용암',
    enName: 'Magic Lava Pool',
    badge: '치명적 위험',
    badgeClass: 'badge-danger',
    color: '#fb923c',
    icon: '🔥',
    desc: '부글부글 끓는 마법 용암입니다. 빠지는 즉시 불타 폭발합니다.',
    tip: '파란 점프대를 이용해 멀리 날아가서 건너봐!'
  },
  [TILE_TYPE.JUMP_PAD]: {
    name: '스프링 점프대',
    enName: 'Spring Jump Pad',
    badge: '기믹 발판',
    badgeClass: 'badge-info',
    color: '#38bdf8',
    icon: '⚡',
    desc: '밟으면 스프링이 튀어올라 전방으로 2칸 시원하게 슈퍼 점프합니다!',
    tip: '"파란 점프대를 밟고 용암을 뛰어넘어"처럼 명령해봐.'
  },
  [TILE_TYPE.ICE]: {
    name: '미끄러운 얼음판',
    enName: 'Slippery Ice Tile',
    badge: '미끄럼 주의',
    badgeClass: 'badge-cyan',
    color: '#67e8f9',
    icon: '🧊',
    desc: '매끄러운 마법 얼음 바닥입니다! 밟으면 가던 방향으로 1칸 더 쭈욱 미끄러집니다.',
    tip: '얼음판 끝에 가시나 낭떠러지가 없는지 계산해서 이동해!'
  },
  [TILE_TYPE.PORTAL]: {
    name: '차원 워프 포탈',
    enName: 'Warp Portal Gate',
    badge: '순간 이동',
    badgeClass: 'badge-purple',
    color: '#c084fc',
    icon: '🌀',
    desc: '신비로운 웜홀 게이트입니다! 밟으면 즉시 반대편 포탈로 순간이동합니다.',
    tip: '벽으로 막힌 공간을 순식간에 관통하는 지름길로 활용해봐!'
  },
  [TILE_TYPE.CONVEYOR]: {
    name: '이동 컨베이어 벨트',
    enName: 'Conveyor Belt',
    badge: '강제 이동',
    badgeClass: 'badge-warning',
    color: '#facc15',
    icon: '⏩',
    desc: '화살표 방향으로 빠르게 작동하는 벨트입니다. 밟으면 해당 방향으로 1칸 밀려납니다.',
    tip: '밀려나는 방향을 잘 계산해 드리프트 주행을 노려봐!'
  },
  [TILE_TYPE.GOAL]: {
    name: '찬란한 승리 보석',
    enName: 'Victory Gem',
    badge: '목적지 (골인)',
    badgeClass: 'badge-gold',
    color: '#facc15',
    icon: '💎',
    desc: '스테이지의 최종 목표입니다! 도달하면 라운드 승리 점수를 획득합니다.',
    tip: '모든 장애물을 돌파하고 여기에 닿으면 성공!'
  },
  [TILE_TYPE.CRUMBLE]: {
    name: '부서지는 균열 바닥',
    enName: 'Crumbling Floor',
    badge: '1회용 바닥',
    badgeClass: 'badge-orange',
    color: '#fbbf24',
    icon: '💥',
    desc: '금이 간 위태로운 바닥입니다! 밟고 지나가면 와르르 무너져 낭떠러지로 바뀝니다.',
    tip: '뒤돌아갈 수 없으니 한 번에 신중하게 통과해야 해!'
  },
  [TILE_TYPE.MINE]: {
    name: '경고 지뢰',
    enName: 'Explosive Mine',
    badge: '치명적 폭탄',
    badgeClass: 'badge-danger',
    color: '#ef4444',
    icon: '💣',
    desc: '붉은 불빛이 깜빡이는 지뢰입니다! 밟는 순간 삐-익 쾅! 대폭발합니다.',
    tip: '지뢰를 피해서 가거나 멀리 점프로 건너뛰어!'
  }
};

// 기본 맵 프리셋 (신규 기믹 테마 스테이지 포함)
export const MAP_PRESETS = {
  stage1: {
    name: "스테이지 1: 가시 피하기",
    size: 7,
    start: { x: 1, y: 0, z: 1, dir: 0 },
    goal: { x: 5, y: 0, z: 5 },
    grid: [
      [1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 2, 1, 1],
      [1, 3, 3, 1, 2, 1, 1],
      [1, 1, 1, 1, 1, 1, 1],
      [1, 2, 2, 3, 1, 1, 1],
      [1, 1, 1, 1, 1, 9, 1],
      [1, 1, 1, 1, 1, 1, 1]
    ]
  },
  stage2: {
    name: "스테이지 2: 점프대와 용암",
    size: 7,
    start: { x: 3, y: 0, z: 1, dir: 0 },
    goal: { x: 3, y: 0, z: 5 },
    grid: [
      [1, 1, 1, 1, 1, 1, 1],
      [1, 2, 1, 1, 1, 2, 1],
      [1, 2, 0, 5, 0, 2, 1],
      [1, 2, 4, 4, 4, 2, 1],
      [1, 2, 0, 1, 0, 2, 1],
      [1, 1, 1, 9, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1]
    ]
  },
  stage3: {
    name: "스테이지 3: 미로 탈출",
    size: 8,
    start: { x: 1, y: 0, z: 1, dir: 0 },
    goal: { x: 6, y: 0, z: 6 },
    grid: [
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 2, 1, 1, 3, 1, 1],
      [1, 1, 2, 1, 2, 2, 1, 1],
      [1, 1, 1, 1, 2, 1, 1, 1],
      [1, 2, 2, 1, 2, 1, 3, 1],
      [1, 3, 1, 1, 1, 1, 2, 1],
      [1, 1, 2, 2, 1, 1, 9, 1],
      [1, 1, 1, 1, 1, 1, 1, 1]
    ]
  },
  stage4: {
    name: "스테이지 4: 가시 다리와 점프",
    size: 7,
    start: { x: 1, y: 0, z: 1, dir: 0 },
    goal: { x: 5, y: 0, z: 5 },
    grid: [
      [1, 1, 1, 1, 1, 1, 1],
      [1, 1, 3, 1, 1, 2, 1],
      [1, 2, 2, 1, 3, 2, 1],
      [1, 1, 1, 1, 1, 1, 1],
      [1, 3, 2, 2, 3, 1, 1],
      [1, 1, 1, 1, 1, 9, 1],
      [1, 1, 1, 1, 1, 1, 1]
    ]
  },
  stage5: {
    name: "스테이지 5: 용암 협곡 우회로",
    size: 7,
    start: { x: 1, y: 0, z: 1, dir: 0 },
    goal: { x: 5, y: 0, z: 5 },
    grid: [
      [1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 2, 1, 1, 1],
      [1, 4, 4, 5, 1, 3, 1],
      [1, 4, 4, 4, 2, 1, 1],
      [1, 1, 3, 1, 1, 1, 1],
      [1, 1, 1, 1, 2, 9, 1],
      [1, 1, 1, 1, 1, 1, 1]
    ]
  },
  stage6: {
    name: "스테이지 6: 🧊 미끄러운 얼음 협곡",
    size: 7,
    start: { x: 1, y: 0, z: 1, dir: 0 },
    goal: { x: 5, y: 0, z: 5 },
    // 6: 얼음판, 밟으면 같은 방향으로 1칸 추가 미끄러짐!
    grid: [
      [1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 2, 1, 1, 1],
      [1, 6, 6, 1, 3, 1, 1],
      [1, 2, 2, 1, 6, 1, 1],
      [1, 3, 1, 6, 2, 1, 1],
      [1, 1, 1, 1, 1, 9, 1],
      [1, 1, 1, 1, 1, 1, 1]
    ]
  },
  stage7: {
    name: "스테이지 7: 🌀 차원 워프 포탈",
    size: 8,
    start: { x: 1, y: 0, z: 1, dir: 0 },
    goal: { x: 6, y: 0, z: 6 },
    portalPairs: [
      { from: { x: 2, z: 3 }, to: { x: 5, z: 3 } }
    ],
    grid: [
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 2, 2, 1, 1, 1],
      [1, 2, 1, 2, 2, 1, 2, 1],
      [1, 1, 7, 2, 2, 7, 1, 1],
      [1, 2, 2, 2, 2, 2, 2, 1],
      [1, 3, 1, 1, 1, 1, 3, 1],
      [1, 1, 1, 2, 1, 1, 9, 1],
      [1, 1, 1, 1, 1, 1, 1, 1]
    ]
  },
  stage8: {
    name: "스테이지 8: ⏩ 컨베이어와 지뢰밭",
    size: 8,
    start: { x: 1, y: 0, z: 1, dir: 0 },
    goal: { x: 6, y: 0, z: 6 },
    conveyors: [
      { x: 3, z: 2, dir: { dx: 1, dz: 0, name: '동쪽(+X)' } },
      { x: 4, z: 4, dir: { dx: 0, dz: 1, name: '남쪽(+Z)' } }
    ],
    grid: [
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 11, 1, 1, 1],
      [1, 1, 1, 8, 1, 1, 2, 1],
      [1, 2, 2, 1, 10, 1, 1, 1],
      [1, 11, 1, 1, 8, 1, 1, 1],
      [1, 1, 10, 1, 1, 11, 1, 1],
      [1, 1, 1, 2, 1, 1, 9, 1],
      [1, 1, 1, 1, 1, 1, 1, 1]
    ]
  }
};

export const STAGE_KEYS = Object.keys(MAP_PRESETS);

/**
 * 🎲 절차적 랜덤 맵 생성기 (Procedural Map Generator)
 * - 언제나 클리어 가능한(Solvable) 경로를 보장하며
 * - 가시, 용암, 점프대, 얼음판, 포탈, 컨베이어, 부서지는 바닥, 지뢰를 다채롭게 배치합니다.
 */
export function generateRandomMap(options = {}) {
  const size = 7; // 안정적인 7x7 격자
  const start = { x: 1, y: 0, z: 1, dir: 0 };
  const goal = { x: size - 2, y: 0, z: size - 2 };

  // 1. 기본 그리드를 일반 바닥(1)으로 채움
  const grid = Array.from({ length: size }, () => Array(size).fill(TILE_TYPE.FLOOR));

  // 2. 시작 지점과 골 지점 설정
  grid[start.z][start.x] = TILE_TYPE.FLOOR;
  grid[goal.z][goal.x] = TILE_TYPE.GOAL;

  // 3. 시작점부터 골까지 안전한 보장 경로(Guaranteed Path) 생성
  let curX = start.x;
  let curZ = start.z;
  const pathSet = new Set([`${curX},${curZ}`]);
  const mainPath = [{ x: curX, z: curZ }];
  let safetySteps = 0;

  while ((curX !== goal.x || curZ !== goal.z) && safetySteps < 25) {
    safetySteps++;
    const choices = [];
    if (curX < goal.x) choices.push({ x: curX + 1, z: curZ, weight: 3 });
    if (curZ < goal.z) choices.push({ x: curX, z: curZ + 1, weight: 3 });
    if (choices.length === 0 || Math.random() < 0.25) {
      if (curX > 1) choices.push({ x: curX - 1, z: curZ, weight: 1 });
      if (curZ > 1) choices.push({ x: curX, z: curZ - 1, weight: 1 });
    }

    if (choices.length === 0) {
      if (curX < goal.x) curX++;
      else if (curZ < goal.z) curZ++;
    } else {
      let totalW = choices.reduce((sum, c) => sum + c.weight, 0);
      let rand = Math.random() * totalW;
      let chosen = choices[0];
      for (const c of choices) {
        if (rand < c.weight) {
          chosen = c;
          break;
        }
        rand -= c.weight;
      }
      curX = chosen.x;
      curZ = chosen.z;
    }

    const key = `${curX},${curZ}`;
    if (!pathSet.has(key)) {
      pathSet.add(key);
      mainPath.push({ x: curX, z: curZ });
    }
  }

  // 혹시 골에 도달하지 못했으면 직선으로 연결
  while (curX !== goal.x || curZ !== goal.z) {
    if (curX < goal.x) curX++;
    else if (curZ < goal.z) curZ++;
    pathSet.add(`${curX},${curZ}`);
    mainPath.push({ x: curX, z: curZ });
  }

  // 4. 경로 주변 및 빈 공간에 장애물과 기믹 무작위 배치
  const portalPairs = [];
  const conveyors = [];

  // 4-1. 메인 경로에 점프 기믹 배치 (2칸 이상 직선 구간에 가시나 얼음판 배치)
  for (let i = 2; i < mainPath.length - 2; i++) {
    const pt = mainPath[i];
    const prev = mainPath[i - 1];
    const next = mainPath[i + 1];

    // 직선 방향인지 확인
    if (prev.x === next.x || prev.z === next.z) {
      if (Math.random() < 0.25) {
        grid[pt.z][pt.x] = TILE_TYPE.ICE; // 얼음판으로 변환
      } else if (Math.random() < 0.15) {
        grid[pt.z][pt.x] = TILE_TYPE.CRUMBLE; // 1회용 균열 바닥
      }
    }
  }

  // 4-2. 메인 경로가 아닌 타일에 다채로운 장애물과 기믹 채우기
  const availableTiles = [];
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      if (pathSet.has(`${x},${z}`)) continue;
      // 시작점 및 골 바로 앞 타일 보호
      if (Math.abs(x - start.x) + Math.abs(z - start.z) <= 1) continue;
      if (Math.abs(x - goal.x) + Math.abs(z - goal.z) <= 1) continue;
      availableTiles.push({ x, z });
    }
  }

  // 셔플
  for (let i = availableTiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [availableTiles[i], availableTiles[j]] = [availableTiles[j], availableTiles[i]];
  }

  let tileIdx = 0;

  // 벽 (3~6개)
  const wallCount = Math.min(availableTiles.length, 3 + Math.floor(Math.random() * 4));
  for (let i = 0; i < wallCount && tileIdx < availableTiles.length; i++) {
    const t = availableTiles[tileIdx++];
    grid[t.z][t.x] = TILE_TYPE.WALL;
  }

  // 가시 (1~3개)
  const spikeCount = Math.min(availableTiles.length - tileIdx, 1 + Math.floor(Math.random() * 3));
  for (let i = 0; i < spikeCount && tileIdx < availableTiles.length; i++) {
    const t = availableTiles[tileIdx++];
    grid[t.z][t.x] = TILE_TYPE.SPIKE;
  }

  // 얼음판 (1~2개)
  const iceCount = Math.min(availableTiles.length - tileIdx, 1 + Math.floor(Math.random() * 2));
  for (let i = 0; i < iceCount && tileIdx < availableTiles.length; i++) {
    const t = availableTiles[tileIdx++];
    grid[t.z][t.x] = TILE_TYPE.ICE;
  }

  // 지뢰 (1~2개)
  const mineCount = Math.min(availableTiles.length - tileIdx, 1 + Math.floor(Math.random() * 2));
  for (let i = 0; i < mineCount && tileIdx < availableTiles.length; i++) {
    const t = availableTiles[tileIdx++];
    grid[t.z][t.x] = TILE_TYPE.MINE;
  }

  // 부서지는 바닥 (1~2개)
  const crumbleCount = Math.min(availableTiles.length - tileIdx, 1 + Math.floor(Math.random() * 2));
  for (let i = 0; i < crumbleCount && tileIdx < availableTiles.length; i++) {
    const t = availableTiles[tileIdx++];
    grid[t.z][t.x] = TILE_TYPE.CRUMBLE;
  }

  // 포탈 쌍 (50% 확률로 2개 생성)
  if (availableTiles.length - tileIdx >= 2 && Math.random() > 0.35) {
    const p1 = availableTiles[tileIdx++];
    const p2 = availableTiles[tileIdx++];
    grid[p1.z][p1.x] = TILE_TYPE.PORTAL;
    grid[p2.z][p2.x] = TILE_TYPE.PORTAL;
    portalPairs.push({
      from: { x: p1.x, z: p1.z },
      to: { x: p2.x, z: p2.z }
    });
  }

  // 컨베이어 벨트 (1개)
  if (availableTiles.length - tileIdx >= 1 && Math.random() > 0.4) {
    const c = availableTiles[tileIdx++];
    grid[c.z][c.x] = TILE_TYPE.CONVEYOR;
    const dirs = [
      { dx: 1, dz: 0, name: '동쪽(+X)' },
      { dx: 0, dz: 1, name: '남쪽(+Z)' },
      { dx: -1, dz: 0, name: '서쪽(-X)' },
      { dx: 0, dz: -1, name: '북쪽(-Z)' }
    ];
    conveyors.push({
      x: c.x,
      z: c.z,
      dir: dirs[Math.floor(Math.random() * dirs.length)]
    });
  }

  const mapSeed = Math.floor(Math.random() * 900 + 100);
  const mapObj = {
    id: `random_${Date.now()}_${mapSeed}`,
    name: `🎲 랜덤 스테이지 #${mapSeed}`,
    size,
    start,
    goal,
    grid,
    portalPairs,
    conveyors
  };
  MAP_PRESETS[mapObj.id] = mapObj;
  return mapObj;
}

export class VoxelMap {
  constructor(scene) {
    this.scene = scene;
    this.mapGroup = new THREE.Group();
    this.envGroup = new THREE.Group();
    this.scene.add(this.envGroup);
    this.scene.add(this.mapGroup);

    this.currentPreset = null;
    this.tileMeshes = []; // Raycasting 검출용 타일 메쉬 배열
    this.interactiveObjects = []; // 애니메이션/업데이트용 오브젝트 배열
    this.goalObject = null;
    this.clouds = [];
    this.floatingIslands = [];
    this.pollenParticles = null;

    // 호버 하이라이트 박스 메쉬
    this.hoverMesh = null;
    this.initHoverMesh();

    // 스카이 아일랜드 환경 배경 초기화
    this.initEnvironment();
  }

  initHoverMesh() {
    const geo = new THREE.BoxGeometry(1.02, 0.48, 1.02);
    const edges = new THREE.EdgesGeometry(geo);
    this.hoverMesh = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 })
    );
    this.hoverMesh.visible = false;
    this.scene.add(this.hoverMesh);
  }

  initEnvironment() {
    // 1. 복셀 구름 생성 (5개)
    const cloudMat = new THREE.MeshLambertMaterial({ 
      color: 0xffffff,
      transparent: true,
      opacity: 0.92
    });

    const cloudConfigs = [
      { x: -14, y: 7, z: -10, speed: 0.45, scale: 1.2 },
      { x: 10, y: 8.5, z: -14, speed: 0.35, scale: 1.4 },
      { x: -8, y: 5, z: 12, speed: 0.5, scale: 0.9 },
      { x: 12, y: 6.5, z: 10, speed: 0.4, scale: 1.1 },
      { x: 0, y: 9, z: -18, speed: 0.3, scale: 1.5 }
    ];

    cloudConfigs.forEach(cfg => {
      const cloud = new THREE.Group();
      const numBlocks = 6 + Math.floor(Math.random() * 5);
      for (let i = 0; i < numBlocks; i++) {
        const sx = 1.0 + Math.random() * 1.5;
        const sy = 0.5 + Math.random() * 0.6;
        const sz = 1.0 + Math.random() * 1.5;
        const geo = new THREE.BoxGeometry(sx, sy, sz);
        const mesh = new THREE.Mesh(geo, cloudMat);
        mesh.position.set(
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 0.8,
          (Math.random() - 0.5) * 2.5
        );
        mesh.castShadow = true;
        cloud.add(mesh);
      }
      cloud.position.set(cfg.x, cfg.y, cfg.z);
      cloud.scale.setScalar(cfg.scale);
      cloud.userData = { speed: cfg.speed, baseY: cfg.y, seed: Math.random() * 100 };
      this.envGroup.add(cloud);
      this.clouds.push(cloud);
    });

    // 2. 주변에 떠 있는 아기자기한 미니 부유 섬
    const islandConfigs = [
      { x: -11, y: -2, z: -8, scale: 1.1 },
      { x: 12, y: -1.5, z: -9, scale: 0.9 },
      { x: -10, y: -3, z: 9, scale: 0.85 },
      { x: 11, y: -2.5, z: 8, scale: 1.0 }
    ];

    islandConfigs.forEach((cfg, idx) => {
      const island = this.createMiniFloatingIsland();
      island.position.set(cfg.x, cfg.y, cfg.z);
      island.scale.setScalar(cfg.scale);
      island.userData = { baseY: cfg.y, seed: idx * 2.5 };
      this.envGroup.add(island);
      this.floatingIslands.push(island);
    });

    // 3. 햇살을 받아 반짝이는 공중 파티클
    const particleCount = 45;
    const pGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 26;
      positions[i + 1] = Math.random() * 12 + 0.5;
      positions[i + 2] = (Math.random() - 0.5) * 26;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const pMat = new THREE.PointsMaterial({
      color: 0xfff3a0,
      size: 0.22,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });

    this.pollenParticles = new THREE.Points(pGeo, pMat);
    this.envGroup.add(this.pollenParticles);
  }

  createMiniFloatingIsland() {
    const group = new THREE.Group();
    const grassMat = new THREE.MeshLambertMaterial({ color: 0x4ade80 });
    const dirtMat = new THREE.MeshLambertMaterial({ color: 0x854d0e });
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x78350f });
    const leavesMat = new THREE.MeshLambertMaterial({ color: 0x22c55e });

    const topGeo = new THREE.BoxGeometry(2.4, 0.5, 2.4);
    const topMesh = new THREE.Mesh(topGeo, grassMat);
    topMesh.castShadow = true;
    topMesh.receiveShadow = true;
    group.add(topMesh);

    const dirt1 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 1.8), dirtMat);
    dirt1.position.y = -0.55;
    group.add(dirt1);

    const dirt2 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 1.1), dirtMat);
    dirt2.position.y = -1.2;
    group.add(dirt2);

    const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.1, 0.35), trunkMat);
    trunk.position.set(0.3, 0.75, 0.3);
    trunk.castShadow = true;
    group.add(trunk);

    const leaves = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 1.1), leavesMat);
    leaves.position.set(0.3, 1.6, 0.3);
    leaves.castShadow = true;
    group.add(leaves);

    return group;
  }

  loadStage(presetOrId) {
    let preset;
    if (typeof presetOrId === 'string') {
      preset = MAP_PRESETS[presetOrId] || MAP_PRESETS.stage1;
    } else if (presetOrId && typeof presetOrId === 'object') {
      preset = presetOrId;
    } else {
      preset = MAP_PRESETS.stage1;
    }

    this.currentPreset = preset;
    this.clear();
    this.buildMap(preset);
  }

  clear() {
    while (this.mapGroup.children.length > 0) {
      const obj = this.mapGroup.children[0];
      this.mapGroup.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    }
    this.tileMeshes = [];
    this.interactiveObjects = [];
    this.goalObject = null;
    if (this.hoverMesh) this.hoverMesh.visible = false;
  }

  buildMap(preset) {
    const { size, grid, portalPairs = [], conveyors = [] } = preset;
    const offset = (size - 1) / 2;

    // 공통 재질들
    const grassMat1 = new THREE.MeshLambertMaterial({ color: 0x4ade80 });
    const grassMat2 = new THREE.MeshLambertMaterial({ color: 0x22c55e });
    const dirtSubMat = new THREE.MeshLambertMaterial({ color: 0x92400e });
    const wallMat = new THREE.MeshLambertMaterial({ color: 0xfef08a });
    const wallCapMat = new THREE.MeshLambertMaterial({ color: 0xf59e0b });
    const spikeMat = new THREE.MeshStandardMaterial({ color: 0xf87171, metalness: 0.35, roughness: 0.4 });
    const lavaMat = new THREE.MeshStandardMaterial({ color: 0xfb923c, emissive: 0xf97316, emissiveIntensity: 0.85, roughness: 0.15 });
    const jumpMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.45, roughness: 0.25 });
    const goalMat = new THREE.MeshStandardMaterial({ color: 0xfde047, emissive: 0xeab308, emissiveIntensity: 0.75, roughness: 0.15, metalness: 0.3 });

    // 🧊 신규 기믹 재질: 얼음판 (반투명 아쿠아)
    const iceMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x0891b2,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.88,
      roughness: 0.05,
      metalness: 0.1
    });

    // 🌀 신규 기믹 재질: 포탈 (신비로운 바이올렛/마젠타)
    const portalBaseMat = new THREE.MeshStandardMaterial({ color: 0x7e22ce, roughness: 0.3 });
    const portalRingMat = new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      emissive: 0xa855f7,
      emissiveIntensity: 0.9,
      roughness: 0.2
    });

    // ⏩ 신규 기믹 재질: 컨베이어 벨트 (경고 스트라이프 앰버)
    const conveyorMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 });
    const conveyorArrowMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

    // 💥 신규 기믹 재질: 부서지는 바닥 (금이 간 노란 흙)
    const crumbleMat = new THREE.MeshLambertMaterial({ color: 0xd97706 });
    const crackMat = new THREE.MeshBasicMaterial({ color: 0x78350f });

    // 💣 신규 기믹 재질: 지뢰 (다크 메탈 + 빨간 LED)
    const mineMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.3 });
    const mineLedMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.0 });

    const boxGeo = new THREE.BoxGeometry(0.96, 0.4, 0.96);
    const subDirtGeo = new THREE.BoxGeometry(0.96, 0.2, 0.96);
    const wallGeo = new THREE.BoxGeometry(0.96, 0.9, 0.96);
    const wallCapGeo = new THREE.BoxGeometry(1.0, 0.15, 1.0);

    for (let z = 0; z < size; z++) {
      for (let x = 0; x < size; x++) {
        const type = grid[z][x];
        const posX = x - offset;
        const posZ = z - offset;

        if (type === TILE_TYPE.EMPTY) continue;

        const isAlternate = (x + z) % 2 === 0;
        let floorTile;

        // 1. 바닥 타일 생성
        if (type === TILE_TYPE.LAVA) {
          floorTile = new THREE.Mesh(boxGeo, lavaMat);
          floorTile.position.set(posX, -0.28, posZ);
          this.mapGroup.add(floorTile);
        } else if (type === TILE_TYPE.ICE) {
          // 🧊 얼음판 바닥
          floorTile = new THREE.Mesh(boxGeo, iceMat);
          floorTile.position.set(posX, -0.18, posZ);
          floorTile.receiveShadow = true;
          this.mapGroup.add(floorTile);

          // 얼음 모서리 서리 테두리
          const frostGeo = new THREE.BoxGeometry(0.98, 0.04, 0.98);
          const frostMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
          const frost = new THREE.Mesh(frostGeo, frostMat);
          frost.position.set(posX, 0.02, posZ);
          this.mapGroup.add(frost);
        } else if (type === TILE_TYPE.CRUMBLE) {
          // 💥 부서지는 바닥
          floorTile = new THREE.Mesh(boxGeo, crumbleMat);
          floorTile.position.set(posX, -0.2, posZ);
          floorTile.receiveShadow = true;
          this.mapGroup.add(floorTile);

          // 표면 균열 조각들
          const crack1 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.06), crackMat);
          crack1.position.set(posX, 0.01, posZ);
          crack1.rotation.y = 0.4;
          this.mapGroup.add(crack1);
          const crack2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.06), crackMat);
          crack2.position.set(posX + 0.1, 0.01, posZ - 0.1);
          crack2.rotation.y = -0.6;
          this.mapGroup.add(crack2);
        } else {
          // 일반 잔디 바닥
          floorTile = new THREE.Mesh(boxGeo, isAlternate ? grassMat1 : grassMat2);
          floorTile.position.set(posX, -0.2, posZ);
          floorTile.receiveShadow = true;
          this.mapGroup.add(floorTile);

          // 타일 하단 흙 베이스
          const subDirt = new THREE.Mesh(subDirtGeo, dirtSubMat);
          subDirt.position.set(posX, -0.48, posZ);
          this.mapGroup.add(subDirt);
        }

        // 호버 Raycast용 메타데이터 부여 및 등록
        floorTile.userData = { gridX: x, gridZ: z, type };
        this.tileMeshes.push(floorTile);

        // 2. 타일 상단 오브젝트 배치
        if (type === TILE_TYPE.WALL) {
          const wallGroup = new THREE.Group();
          const wall = new THREE.Mesh(wallGeo, wallMat);
          wall.position.set(posX, 0.45, posZ);
          wall.castShadow = true;
          wall.receiveShadow = true;
          wallGroup.add(wall);

          const cap = new THREE.Mesh(wallCapGeo, wallCapMat);
          cap.position.set(posX, 0.95, posZ);
          cap.castShadow = true;
          wallGroup.add(cap);

          wall.userData = { gridX: x, gridZ: z, type };
          this.tileMeshes.push(wall);
          this.mapGroup.add(wallGroup);
        } else if (type === TILE_TYPE.SPIKE) {
          const spikeGroup = new THREE.Group();
          const coneGeo = new THREE.ConeGeometry(0.18, 0.45, 4);
          const subPositions = [
            [-0.22, -0.22], [0.22, -0.22],
            [-0.22, 0.22], [0.22, 0.22]
          ];
          subPositions.forEach(([sx, sz]) => {
            const cone = new THREE.Mesh(coneGeo, spikeMat);
            cone.position.set(posX + sx, 0.22, posZ + sz);
            cone.castShadow = true;
            cone.userData = { gridX: x, gridZ: z, type };
            this.tileMeshes.push(cone);
            spikeGroup.add(cone);
          });
          this.mapGroup.add(spikeGroup);
        } else if (type === TILE_TYPE.JUMP_PAD) {
          const padGroup = new THREE.Group();
          const padGeo = new THREE.BoxGeometry(0.72, 0.12, 0.72);
          const pad = new THREE.Mesh(padGeo, jumpMat);
          pad.position.set(posX, 0.06, posZ);
          pad.castShadow = true;
          pad.userData = { gridX: x, gridZ: z, type };
          this.tileMeshes.push(pad);
          padGroup.add(pad);

          const arrowGeo = new THREE.BoxGeometry(0.3, 0.14, 0.3);
          const arrowMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
          const arrow = new THREE.Mesh(arrowGeo, arrowMat);
          arrow.position.set(posX, 0.08, posZ);
          padGroup.add(arrow);
          this.mapGroup.add(padGroup);
        } else if (type === TILE_TYPE.PORTAL) {
          // 🌀 차원 워프 포탈
          const portalGroup = new THREE.Group();
          const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.1, 16), portalBaseMat);
          baseMesh.position.set(posX, 0.05, posZ);
          baseMesh.userData = { gridX: x, gridZ: z, type };
          this.tileMeshes.push(baseMesh);
          portalGroup.add(baseMesh);

          // 회전하는 웜홀 링
          const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.07, 8, 20), portalRingMat);
          ringMesh.position.set(posX, 0.42, posZ);
          ringMesh.rotation.x = Math.PI / 2.8;
          portalGroup.add(ringMesh);

          // 중앙 빛나는 코어
          const coreMesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), portalRingMat);
          coreMesh.position.set(posX, 0.42, posZ);
          portalGroup.add(coreMesh);

          this.interactiveObjects.push({
            type: 'portal',
            ring: ringMesh,
            core: coreMesh,
            seed: posX + posZ
          });

          this.mapGroup.add(portalGroup);
        } else if (type === TILE_TYPE.CONVEYOR) {
          // ⏩ 컨베이어 벨트
          const convGroup = new THREE.Group();
          const convBase = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.08, 0.85), conveyorMat);
          convBase.position.set(posX, 0.04, posZ);
          convBase.userData = { gridX: x, gridZ: z, type };
          this.tileMeshes.push(convBase);
          convGroup.add(convBase);

          // 화살표 방향 설정
          const cCfg = conveyors.find(c => c.x === x && c.z === z) || { dir: { dx: 1, dz: 0 } };
          const angle = Math.atan2(cCfg.dir.dx, cCfg.dir.dz);

          const arrow1 = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.3, 3), conveyorArrowMat);
          arrow1.rotation.x = Math.PI / 2;
          arrow1.rotation.z = -angle;
          arrow1.position.set(posX, 0.09, posZ);
          convGroup.add(arrow1);

          this.interactiveObjects.push({
            type: 'conveyor',
            arrow: arrow1,
            basePos: { x: posX, z: posZ },
            dir: cCfg.dir
          });

          this.mapGroup.add(convGroup);
        } else if (type === TILE_TYPE.MINE) {
          // 💣 지뢰
          const mineGroup = new THREE.Group();
          const mDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.09, 12), mineMat);
          mDisc.position.set(posX, 0.05, posZ);
          mDisc.userData = { gridX: x, gridZ: z, type };
          this.tileMeshes.push(mDisc);
          mineGroup.add(mDisc);

          const led = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), mineLedMat);
          led.position.set(posX, 0.12, posZ);
          mineGroup.add(led);

          this.interactiveObjects.push({
            type: 'mine',
            ledMat: led.material,
            seed: posX * 2 + posZ
          });

          this.mapGroup.add(mineGroup);
        } else if (type === TILE_TYPE.GOAL) {
          // 🏆 승리 보석
          const baseGeo = new THREE.BoxGeometry(0.85, 0.18, 0.85);
          const base = new THREE.Mesh(baseGeo, goalMat);
          base.position.set(posX, 0.09, posZ);
          base.castShadow = true;
          base.userData = { gridX: x, gridZ: z, type };
          this.tileMeshes.push(base);
          this.mapGroup.add(base);

          const gemGeo = new THREE.OctahedronGeometry(0.38);
          const gem = new THREE.Mesh(gemGeo, goalMat);
          gem.position.set(posX, 0.85, posZ);
          gem.castShadow = true;
          gem.userData = { gridX: x, gridZ: z, type };
          this.tileMeshes.push(gem);
          this.mapGroup.add(gem);
          this.goalObject = gem;
        }
      }
    }
  }

  getTileType(gridX, gridZ) {
    if (!this.currentPreset) return TILE_TYPE.EMPTY;
    const { size, grid } = this.currentPreset;
    if (gridX < 0 || gridX >= size || gridZ < 0 || gridZ >= size) {
      return TILE_TYPE.EMPTY;
    }
    return grid[gridZ][gridX];
  }

  setTileType(gridX, gridZ, type) {
    if (!this.currentPreset) return;
    const { size, grid } = this.currentPreset;
    if (gridX >= 0 && gridX < size && gridZ >= 0 && gridZ < size) {
      grid[gridZ][gridX] = type;
    }
  }

  // 부서지는 바닥(10)이 밟혔을 때 애니메이션과 함께 EMPTY로 전환
  crumbleTile(gridX, gridZ) {
    const tileType = this.getTileType(gridX, gridZ);
    if (tileType !== TILE_TYPE.CRUMBLE) return;

    this.setTileType(gridX, gridZ, TILE_TYPE.EMPTY);

    // 해당 좌표의 메쉬들을 아래로 떨어뜨리는 연출
    const offset = (this.currentPreset.size - 1) / 2;
    const targetX = gridX - offset;
    const targetZ = gridZ - offset;

    const matched = this.mapGroup.children.filter(child => {
      return Math.hypot(child.position.x - targetX, child.position.z - targetZ) < 0.45;
    });

    const startTime = performance.now();
    const animate = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      matched.forEach(mesh => {
        mesh.position.y -= 9.8 * elapsed * 0.15;
        mesh.rotation.x += 0.08;
      });
      if (elapsed < 0.6) {
        requestAnimationFrame(animate);
      } else {
        matched.forEach(mesh => {
          this.mapGroup.remove(mesh);
          if (mesh.geometry) mesh.geometry.dispose();
        });
      }
    };
    requestAnimationFrame(animate);
  }

  gridToWorld(gridX, gridZ) {
    const offset = (this.currentPreset.size - 1) / 2;
    return {
      x: gridX - offset,
      z: gridZ - offset
    };
  }

  worldToGrid(worldX, worldZ) {
    const offset = (this.currentPreset.size - 1) / 2;
    return {
      x: Math.round(worldX + offset),
      z: Math.round(worldZ + offset)
    };
  }

  // 마우스 위치(Raycaster)로부터 타일 검출
  raycastTile(raycaster) {
    if (!this.tileMeshes || this.tileMeshes.length === 0) return null;

    const intersects = raycaster.intersectObjects(this.tileMeshes, false);
    if (intersects.length > 0) {
      const hit = intersects[0];
      if (hit.object && hit.object.userData && hit.object.userData.gridX !== undefined) {
        const { gridX, gridZ, type } = hit.object.userData;
        const currentType = this.getTileType(gridX, gridZ);
        const info = TILE_INFO[currentType] || TILE_INFO[TILE_TYPE.FLOOR];
        return {
          gridX,
          gridZ,
          type: currentType,
          info,
          point: hit.point
        };
      }
    }
    return null;
  }

  // 호버 하이라이트 박스 표시
  setHoverHighlight(gridX, gridZ) {
    if (!this.hoverMesh) return;
    if (gridX === null || gridZ === null) {
      this.hoverMesh.visible = false;
      return;
    }
    const worldPos = this.gridToWorld(gridX, gridZ);
    this.hoverMesh.position.set(worldPos.x, 0.05, worldPos.z);
    this.hoverMesh.visible = true;
  }

  update(delta) {
    const time = Date.now() * 0.001;

    // 1. 회전하는 승리 보석 애니메이션
    if (this.goalObject) {
      this.goalObject.rotation.y += delta * 2.2;
      this.goalObject.position.y = 0.85 + Math.sin(time * 3.5) * 0.12;
    }

    // 2. 신규 기믹 애니메이션 (포탈, 컨베이어, 지뢰)
    this.interactiveObjects.forEach(obj => {
      if (obj.type === 'portal') {
        if (obj.ring) {
          obj.ring.rotation.z += delta * 3.5;
        }
        if (obj.core) {
          obj.core.scale.setScalar(0.9 + Math.sin(time * 6 + obj.seed) * 0.2);
        }
      } else if (obj.type === 'conveyor') {
        if (obj.arrow) {
          const shift = (Math.sin(time * 6) + 1) * 0.08;
          obj.arrow.position.x = obj.basePos.x + obj.dir.dx * (shift - 0.04);
          obj.arrow.position.z = obj.basePos.z + obj.dir.dz * (shift - 0.04);
        }
      } else if (obj.type === 'mine') {
        if (obj.ledMat) {
          const blink = Math.sin(time * 8 + obj.seed) > 0.3;
          obj.ledMat.emissiveIntensity = blink ? 1.4 : 0.15;
        }
      }
    });

    // 3. 둥둥 떠다니는 구름 애니메이션
    this.clouds.forEach(cloud => {
      const spd = cloud.userData.speed || 0.4;
      cloud.position.x += delta * spd;
      cloud.position.y = cloud.userData.baseY + Math.sin(time * 0.8 + cloud.userData.seed) * 0.25;

      if (cloud.position.x > 22) {
        cloud.position.x = -22;
      }
    });

    // 4. 미니 부유 섬 둥실둥실
    this.floatingIslands.forEach(island => {
      island.position.y = island.userData.baseY + Math.sin(time * 1.2 + island.userData.seed) * 0.18;
      island.rotation.y = Math.sin(time * 0.3 + island.userData.seed) * 0.08;
    });

    // 5. 햇살 반짝이 파티클
    if (this.pollenParticles) {
      this.pollenParticles.rotation.y += delta * 0.03;
      const positions = this.pollenParticles.geometry.attributes.position.array;
      for (let i = 1; i < positions.length; i += 3) {
        positions[i] += Math.sin(time + i) * 0.003;
      }
      this.pollenParticles.geometry.attributes.position.needsUpdate = true;
    }
  }
}
