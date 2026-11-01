import * as THREE from 'three';

// 타일 타입 상수
export const TILE_TYPE = {
  EMPTY: 0,
  FLOOR: 1,
  WALL: 2,
  SPIKE: 3,
  LAVA: 4,
  JUMP_PAD: 5,
  GOAL: 9
};

// 기본 맵 프리셋
export const MAP_PRESETS = {
  stage1: {
    name: "스테이지 1: 가시 피하기",
    size: 7,
    start: { x: 1, y: 0, z: 1, dir: 0 }, // 0: +Z (아래쪽)
    goal: { x: 5, y: 0, z: 5 },
    // 7x7 타일맵 (0:빈곳, 1:바닥, 2:벽, 3:가시, 4:용암, 5:점프대, 9:골)
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
  }
};

export const STAGE_KEYS = Object.keys(MAP_PRESETS);

export class VoxelMap {
  constructor(scene) {
    this.scene = scene;
    this.mapGroup = new THREE.Group();
    this.scene.add(this.mapGroup);
    this.currentPreset = null;
    this.tileMeshes = [];
    this.goalObject = null;
  }

  loadStage(presetId) {
    const preset = MAP_PRESETS[presetId] || MAP_PRESETS.stage1;
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
    this.goalObject = null;
  }

  buildMap(preset) {
    const { size, grid } = preset;
    const offset = (size - 1) / 2;

    // 복셀 공통 재질
    const floorMat1 = new THREE.MeshLambertMaterial({ color: 0x334155 });
    const floorMat2 = new THREE.MeshLambertMaterial({ color: 0x1e293b });
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x64748b });
    const spikeMat = new THREE.MeshLambertMaterial({ color: 0xef4444 });
    const lavaMat = new THREE.MeshStandardMaterial({ 
      color: 0xf97316, 
      emissive: 0xe11d48, 
      emissiveIntensity: 0.8,
      roughness: 0.2
    });
    const jumpMat = new THREE.MeshLambertMaterial({ color: 0x38bdf8 });
    const goalMat = new THREE.MeshStandardMaterial({ 
      color: 0xfacc15, 
      emissive: 0xeab308, 
      emissiveIntensity: 0.6 
    });

    const boxGeo = new THREE.BoxGeometry(0.96, 0.4, 0.96);
    const wallGeo = new THREE.BoxGeometry(0.96, 1.0, 0.96);

    for (let z = 0; z < size; z++) {
      for (let x = 0; x < size; x++) {
        const type = grid[z][x];
        const posX = x - offset;
        const posZ = z - offset;

        if (type === TILE_TYPE.EMPTY) continue;

        // 바닥 타일 (체커보드 패턴)
        const isAlternate = (x + z) % 2 === 0;
        let floorTile;

        if (type === TILE_TYPE.LAVA) {
          floorTile = new THREE.Mesh(boxGeo, lavaMat);
          floorTile.position.set(posX, -0.3, posZ);
        } else {
          floorTile = new THREE.Mesh(boxGeo, isAlternate ? floorMat1 : floorMat2);
          floorTile.position.set(posX, -0.2, posZ);
          floorTile.receiveShadow = true;
        }
        this.mapGroup.add(floorTile);

        // 추가 오브젝트 배치
        if (type === TILE_TYPE.WALL) {
          const wall = new THREE.Mesh(wallGeo, wallMat);
          wall.position.set(posX, 0.5, posZ);
          wall.castShadow = true;
          wall.receiveShadow = true;
          this.mapGroup.add(wall);
        } else if (type === TILE_TYPE.SPIKE) {
          // 가시 3D 콘 피라미드들
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
            spikeGroup.add(cone);
          });
          this.mapGroup.add(spikeGroup);
        } else if (type === TILE_TYPE.JUMP_PAD) {
          const padGeo = new THREE.BoxGeometry(0.7, 0.1, 0.7);
          const pad = new THREE.Mesh(padGeo, jumpMat);
          pad.position.set(posX, 0.05, posZ);
          this.mapGroup.add(pad);
        } else if (type === TILE_TYPE.GOAL) {
          // 골인 지점 (황금빛 받침대 + 회전 크리스탈)
          const baseGeo = new THREE.BoxGeometry(0.8, 0.15, 0.8);
          const base = new THREE.Mesh(baseGeo, goalMat);
          base.position.set(posX, 0.08, posZ);
          this.mapGroup.add(base);

          const gemGeo = new THREE.OctahedronGeometry(0.35);
          const gem = new THREE.Mesh(gemGeo, goalMat);
          gem.position.set(posX, 0.8, posZ);
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

  update(delta) {
    if (this.goalObject) {
      this.goalObject.rotation.y += delta * 2;
      this.goalObject.position.y = 0.8 + Math.sin(Date.now() * 0.004) * 0.1;
    }
  }
}
