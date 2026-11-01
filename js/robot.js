import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// 방향: 0: +Z (남), 1: +X (동), 2: -Z (북), 3: -X (서)
export const DIRECTIONS = [
  { dx: 0, dz: 1, angle: 0 },             // 0: SOUTH (+Z)
  { dx: 1, dz: 0, angle: Math.PI / 2 },   // 1: EAST (+X)
  { dx: 0, dz: -1, angle: Math.PI },      // 2: NORTH (-Z)
  { dx: -1, dz: 0, angle: -Math.PI / 2 }  // 3: WEST (-X)
];

export class VoxelRobot {
  constructor(scene, voxelMap) {
    this.scene = scene;
    this.map = voxelMap;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.bodyGroup = new THREE.Group();
    this.headGroup = new THREE.Group();

    // 스킨 시스템: 'mini' (Meshy SD 미소녀) 또는 'voxel' (클래식 복셀)
    this.currentSkin = 'mini';
    this.glbLoaded = false;
    this.glbLoading = false;
    this.glbModel = null;
    this.glbWrapperGroup = new THREE.Group();
    this.voxelMeshGroup = new THREE.Group();

    this.gridPos = { x: 0, z: 0 };
    this.dirIndex = 0; // 0, 1, 2, 3
    this.isDead = false;
    this.isGoal = false;
    this.isAnimating = false;
    this.isThinking = false;
    this.lastFailReason = null;
    this.hitWall = false;
    this.stepPhase = 0;
    this.idleTimer = 0;
    this.idleQuirkOffset = Math.random() * 100;

    // 파티클 시스템
    this.particles = [];

    this.bodyMat = null;
    this.accentMat = null;
    this.eyeMat = null;

    this.buildMesh();
  }

  setColorTheme(bodyHex = 0x38bdf8, accentHex = 0xec4899) {
    if (this.bodyMat) this.bodyMat.color.setHex(bodyHex);
    if (this.accentMat) this.accentMat.color.setHex(accentHex);
    if (this.eyeMat) this.eyeMat.color.setHex(bodyHex);
  }

  buildMesh() {
    this.clearMesh();

    this.bodyGroup = new THREE.Group();
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.78, 0.02);

    this.voxelMeshGroup = new THREE.Group();

    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x38bdf8 }); // 시안/블루
    const accentMat = new THREE.MeshLambertMaterial({ color: 0xec4899 }); // 핑크
    const faceMat = new THREE.MeshBasicMaterial({ color: 0x0f172a }); // 다크 스크린
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 }); // 눈동자 발광
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x334155 });

    this.bodyMat = bodyMat;
    this.accentMat = accentMat;
    this.eyeMat = eyeMat;

    // 1. 몸통 (Body)
    const bodyGeo = new THREE.BoxGeometry(0.5, 0.45, 0.45);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.4;
    body.castShadow = true;
    this.voxelMeshGroup.add(body);

    // 귀여운 양팔 추가
    const armGeo = new THREE.BoxGeometry(0.1, 0.26, 0.12);
    this.leftArm = new THREE.Mesh(armGeo, accentMat);
    this.leftArm.position.set(-0.31, 0.42, 0);
    this.rightArm = new THREE.Mesh(armGeo, accentMat);
    this.rightArm.position.set(0.31, 0.42, 0);
    this.voxelMeshGroup.add(this.leftArm);
    this.voxelMeshGroup.add(this.rightArm);

    // 2. 머리 (Head - 독립 회전 가능)
    const headGeo = new THREE.BoxGeometry(0.42, 0.35, 0.38);
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.castShadow = true;
    this.headGroup.add(head);

    // 3. 얼굴 스크린 (Face Screen)
    const screenGeo = new THREE.PlaneGeometry(0.34, 0.22);
    const screen = new THREE.Mesh(screenGeo, faceMat);
    screen.position.set(0, 0, 0.195);
    this.headGroup.add(screen);

    // 4. 귀여운 디지털 눈 (Eyes)
    const eyeGeo = new THREE.BoxGeometry(0.07, 0.07, 0.02);
    this.leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    this.leftEye.position.set(-0.09, 0, 0.2);
    this.rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    this.rightEye.position.set(0.09, 0, 0.2);
    this.headGroup.add(this.leftEye);
    this.headGroup.add(this.rightEye);

    // 5. 시그니처 핑크 안테나 (Antenna)
    const antStemGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.15);
    const antStem = new THREE.Mesh(antStemGeo, wheelMat);
    antStem.position.set(0, 0.24, -0.02);
    this.headGroup.add(antStem);

    const antBallGeo = new THREE.SphereGeometry(0.06, 8, 8);
    this.antBall = new THREE.Mesh(antBallGeo, accentMat);
    this.antBall.position.set(0, 0.34, -0.02);
    this.headGroup.add(this.antBall);

    // 6. 바퀴 트랙 (Wheels)
    const wheelGeo = new THREE.BoxGeometry(0.12, 0.22, 0.45);
    const leftWheel = new THREE.Mesh(wheelGeo, wheelMat);
    leftWheel.position.set(-0.28, 0.18, 0);
    const rightWheel = new THREE.Mesh(wheelGeo, wheelMat);
    rightWheel.position.set(0.28, 0.18, 0);
    this.voxelMeshGroup.add(leftWheel);
    this.voxelMeshGroup.add(rightWheel);

    this.voxelMeshGroup.add(this.headGroup);
    this.bodyGroup.add(this.voxelMeshGroup);
    this.bodyGroup.add(this.glbWrapperGroup);
    this.group.add(this.bodyGroup);

    this.applySkin(this.currentSkin);

    if (!this.glbLoaded && !this.glbLoading) {
      this.loadGlbModel('assets/models/sd_girl.glb');
    }
  }

  loadGlbModel(url = 'assets/models/sd_girl.glb') {
    this.glbLoading = true;
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        this.glbLoading = false;
        this.glbLoaded = true;
        this.glbModel = gltf.scene;

        this.glbModel.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
              child.material.roughness = Math.max(0.45, child.material.roughness || 0.5);
            }
          }
        });

        // 1타일(1.0) 규격에 맞게 앙증맞은 키(0.96)로 정규화
        const box = new THREE.Box3().setFromObject(this.glbModel);
        const size = box.getSize(new THREE.Vector3());
        const targetHeight = 0.96;
        const scale = targetHeight / (size.y || 2.0);
        this.glbModel.scale.set(scale, scale, scale);

        // 중심 및 발바닥(Y=0) 안착
        box.setFromObject(this.glbModel);
        this.glbModel.position.x = -(box.min.x + box.max.x) / 2;
        this.glbModel.position.z = -(box.min.z + box.max.z) / 2;
        this.glbModel.position.y = -box.min.y;

        while (this.glbWrapperGroup.children.length > 0) {
          this.glbWrapperGroup.remove(this.glbWrapperGroup.children[0]);
        }
        this.glbWrapperGroup.add(this.glbModel);

        this.applySkin(this.currentSkin);
        console.log('✨ [Mini] SD 미소녀 3D 캐릭터 로드 완료!');
      },
      undefined,
      (err) => {
        this.glbLoading = false;
        console.warn('⚠️ [Mini] GLB 모델 로드 실패, 기본 복셀 로봇으로 대체:', err);
        this.applySkin('voxel');
      }
    );
  }

  applySkin(skinName) {
    this.currentSkin = skinName;
    if (this.currentSkin === 'mini' && this.glbLoaded) {
      if (this.voxelMeshGroup) this.voxelMeshGroup.visible = false;
      if (this.glbWrapperGroup) this.glbWrapperGroup.visible = true;
    } else {
      if (this.voxelMeshGroup) this.voxelMeshGroup.visible = true;
      if (this.glbWrapperGroup) this.glbWrapperGroup.visible = false;
    }
  }

  toggleSkin() {
    const nextSkin = this.currentSkin === 'mini' ? 'voxel' : 'mini';
    this.applySkin(nextSkin);
    return this.currentSkin;
  }

  clearMesh() {
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
    }
  }

  reset(startConfig) {
    this.isDead = false;
    this.isGoal = false;
    this.isAnimating = false;
    this.isThinking = false;
    this.lastFailReason = null;
    this.hitWall = false;
    this.stepPhase = 0;
    this.clearParticles();

    this.group.visible = true;
    this.gridPos = { x: startConfig.x, z: startConfig.z };
    this.dirIndex = startConfig.dir || 0;

    const world = this.map.gridToWorld(this.gridPos.x, this.gridPos.z);
    this.group.position.set(world.x, 0, world.z);
    this.group.rotation.set(0, DIRECTIONS[this.dirIndex].angle, 0);
    this.resetPose();
  }

  resetPose() {
    if (!this.bodyGroup || !this.headGroup) return;
    this.bodyGroup.position.set(0, 0, 0);
    this.bodyGroup.rotation.set(0, 0, 0);
    this.bodyGroup.scale.set(1, 1, 1);
    this.headGroup.rotation.set(0, 0, 0);
    if (this.glbWrapperGroup) {
      this.glbWrapperGroup.rotation.set(0, 0, 0);
    }
    if (this.leftArm && this.rightArm) {
      this.leftArm.rotation.set(0, 0, 0);
      this.rightArm.rotation.set(0, 0, 0);
    }
  }

  setThinking(thinking) {
    this.isThinking = thinking;
    if (!thinking && !this.isDead) {
      this.resetPose();
    }
  }

  // 다양한 개성 동작을 지원하는 액션 실행 인터페이스
  async executeAction(actionType) {
    if (this.isDead || this.isGoal) return false;

    this.isAnimating = true;
    this.resetPose();

    switch (actionType) {
      case 'FORWARD':
        await this.step(1, 'normal');
        break;
      case 'BACKWARD':
        await this.step(-1, 'backward');
        break;
      case 'DASH':
        await this.step(1, 'dash');
        break;
      case 'SNEAK':
        await this.step(1, 'sneak');
        break;
      case 'ZIGZAG':
        await this.step(1, 'zigzag');
        break;
      case 'HOP':
        await this.jump(1, 0.55); // 1칸 가볍게 폴짝!
        break;
      case 'JUMP':
        await this.jump(2, 0.92); // 장애물 넘어 2칸 힘차게 도약!
        break;
      case 'TURN_LEFT':
        await this.rotate(1);
        break;
      case 'TURN_RIGHT':
        await this.rotate(-1);
        break;
      case 'SPIN':
        await this.spinTwirl();
        break;
      case 'DANCE':
        await this.wiggleDance();
        break;
      case 'LOOK_AROUND':
        await this.lookAround();
        break;
      case 'BACKFLIP':
        await this.backflip();
        break;
      case 'WAIT':
      default:
        await this.idleWait();
        break;
    }

    this.resetPose();
    this.isAnimating = false;
    return !this.isDead;
  }

  /**
   * 1칸씩 끊어지지 않고 곡선 경로(waypoints)나 도약(leap)을 연속적인 3D 움직임으로 수행합니다.
   */
  async executeManeuver(maneuver) {
    if (this.isDead || this.isGoal) return false;

    this.isAnimating = true;
    this.resetPose();

    if (maneuver.type === 'EMOTE') {
      await this.executeAction(maneuver.emote || 'LOOK_AROUND');
      return !this.isDead;
    }

    if (maneuver.type === 'LEAP' && maneuver.target) {
      await this.leapToPoint(maneuver.target, maneuver.jumpHeight || 0.95);
    } else if (maneuver.type === 'RUN_PATH' && Array.isArray(maneuver.points) && maneuver.points.length > 0) {
      await this.runContinuousPath(maneuver.points, maneuver.style || 'normal');
    }

    this.resetPose();
    this.isAnimating = false;
    return !this.isDead;
  }

  lerpAngle(a, b, t) {
    let diff = b - a;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    return a + diff * t;
  }

  syncDirIndexFromYaw(yaw) {
    // 가장 가까운 4방위 인덱스로 동기화 (자유 각도 회전 유지)
    let norm = yaw;
    while (norm < -Math.PI) norm += Math.PI * 2;
    while (norm > Math.PI) norm -= Math.PI * 2;
    if (Math.abs(norm) < Math.PI / 4) this.dirIndex = 0; // +Z
    else if (Math.abs(norm - Math.PI / 2) <= Math.PI / 4) this.dirIndex = 1; // +X
    else if (Math.abs(norm + Math.PI / 2) <= Math.PI / 4) this.dirIndex = 3; // -X
    else this.dirIndex = 2; // -Z
  }

  async leapToPoint(targetGrid, jumpHeight = 0.95) {
    const startPos = this.group.position.clone();
    const endWorld = this.map.gridToWorld(targetGrid.x, targetGrid.z);
    const dxWorld = endWorld.x - startPos.x;
    const dzWorld = endWorld.z - startPos.z;
    const targetYaw = Math.atan2(dxWorld, dzWorld);

    if (this.map.getTileType(targetGrid.x, targetGrid.z) === 2) {
      this.hitWall = true;
      await this.bonkWall(targetGrid.x, targetGrid.z);
      return;
    }

    const startYaw = this.group.rotation.y;
    const dist = Math.hypot(dxWorld, dzWorld);
    const duration = Math.max(0.34, Math.min(0.55, dist * 0.22));
    const doSpin = Math.random() > 0.35;
    const startTime = performance.now();

    this.spawnTrailParticles(8, 0xec4899);

    return new Promise((resolve) => {
      const animate = async (currentTime) => {
        const elapsed = (currentTime - startTime) / 1000;
        const progress = Math.min(elapsed / duration, 1);

        this.group.rotation.y = this.lerpAngle(startYaw, targetYaw, Math.min(1, progress * 2.5));
        this.group.position.x = THREE.MathUtils.lerp(startPos.x, endWorld.x, progress);
        this.group.position.z = THREE.MathUtils.lerp(startPos.z, endWorld.z, progress);
        this.group.position.y = Math.sin(progress * Math.PI) * jumpHeight;

        this.leftArm.rotation.z = -Math.sin(progress * Math.PI) * 2.3;
        this.rightArm.rotation.z = Math.sin(progress * Math.PI) * 2.3;
        if (doSpin) {
          this.bodyGroup.rotation.y = progress * Math.PI * 2;
        } else {
          this.bodyGroup.rotation.x = Math.cos(progress * Math.PI) * 0.35;
        }

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          this.group.position.set(endWorld.x, 0, endWorld.z);
          this.group.rotation.y = targetYaw;
          this.syncDirIndexFromYaw(targetYaw);
          this.resetPose();
          this.spawnTrailParticles(5, 0x38bdf8);
          this.gridPos = { x: targetGrid.x, z: targetGrid.z };
          await this.checkTileCollision();
          resolve();
        }
      };
      requestAnimationFrame(animate);
    });
  }

  async runContinuousPath(points, style = 'normal') {
    const startVec = new THREE.Vector3(this.group.position.x, 0, this.group.position.z);
    const curvePoints = [startVec];

    // 경로 상에 실제 벽 타일(2)이 포함되어 있으면 벽 앞까지만 이동 후 벽에 콩 부딪혀서 우회 신호 전달!
    let firstWallPoint = null;
    const validPoints = [];
    for (const pt of points) {
      if (this.map.getTileType(pt.x, pt.z) === 2) {
        firstWallPoint = pt;
        break;
      }
      validPoints.push(pt);
      const w = this.map.gridToWorld(pt.x, pt.z);
      const v = new THREE.Vector3(w.x, 0, w.z);
      if (v.distanceTo(curvePoints[curvePoints.length - 1]) > 0.05) {
        curvePoints.push(v);
      }
    }

    if (curvePoints.length < 2 && firstWallPoint) {
      this.hitWall = true;
      await this.bonkWall(firstWallPoint.x, firstWallPoint.z);
      return;
    }

    if (curvePoints.length < 2) return;

    const curve = new THREE.CatmullRomCurve3(curvePoints, false, 'centripetal', 0.15);
    const totalLength = curve.getLength();
    const speed = style === 'dash' ? 4.6 : style === 'sneak' ? 2.4 : 3.6;
    const duration = Math.max(0.22, totalLength / speed);
    const startTime = performance.now();
    let lastParticleDist = 0;

    return new Promise((resolve) => {
      const animate = async (currentTime) => {
        if (this.isDead || this.isGoal) {
          resolve();
          return;
        }

        const elapsed = (currentTime - startTime) / 1000;
        const rawProgress = Math.min(elapsed / duration, 1);
        const eased =
          rawProgress < 0.15
            ? (rawProgress / 0.15) * rawProgress * 0.5 + rawProgress * 0.5
            : rawProgress > 0.85
            ? 1 - Math.pow(1 - rawProgress, 1.5)
            : rawProgress;
        const t = Math.min(1, Math.max(0, eased));

        const pos = curve.getPointAt(t);
        const tangent = curve.getTangentAt(t);
        const targetYaw = Math.atan2(tangent.x, tangent.z);

        let yawDiff = targetYaw - this.group.rotation.y;
        while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
        while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;

        this.group.rotation.y = this.lerpAngle(this.group.rotation.y, targetYaw, 0.28);
        this.syncDirIndexFromYaw(this.group.rotation.y);

        const distTraveled = t * totalLength;
        const stride = distTraveled * Math.PI * 2.4;
        const bankAngle = THREE.MathUtils.clamp(-yawDiff * 0.45, -0.32, 0.32);

        if (style === 'sneak') {
          this.bodyGroup.scale.y = 0.8;
          this.bodyGroup.position.y = Math.abs(Math.sin(stride)) * 0.06;
          this.bodyGroup.rotation.x = 0.16;
          this.bodyGroup.rotation.z = bankAngle + Math.sin(stride) * 0.08;
          this.headGroup.rotation.y = Math.sin(distTraveled * 3.5) * 0.45;
        } else if (style === 'dash') {
          this.bodyGroup.position.y = Math.abs(Math.sin(stride * 1.2)) * 0.14;
          this.bodyGroup.rotation.x = 0.3;
          this.bodyGroup.rotation.z = bankAngle;
          this.leftArm.rotation.x = -0.75;
          this.rightArm.rotation.x = -0.75;
        } else {
          this.bodyGroup.position.y = Math.abs(Math.sin(stride)) * 0.16;
          this.bodyGroup.rotation.x = 0.14;
          this.bodyGroup.rotation.z = bankAngle + Math.sin(stride) * 0.11;
          this.headGroup.rotation.y = Math.sin(stride * 0.5) * 0.18 - bankAngle * 0.6;
          this.leftArm.rotation.x = Math.sin(stride) * 0.55;
          this.rightArm.rotation.x = -Math.sin(stride) * 0.55;
        }

        if (distTraveled - lastParticleDist > 0.65) {
          lastParticleDist = distTraveled;
          this.spawnTrailParticles(style === 'dash' ? 4 : 2, style === 'dash' ? 0x38bdf8 : 0x94a3b8);
        }

        // 코너를 돌 때 벽 모서리에 닿으면 멈추지 않고 벽을 타고 자연스럽게 미끄러지며 진행!
        const curGrid = this.map.worldToGrid(pos.x, pos.z);
        const tileCenter = this.map.gridToWorld(curGrid.x, curGrid.z);
        const tileType = this.map.getTileType(curGrid.x, curGrid.z);

        if (tileType === 2) {
          const pushDx = pos.x - tileCenter.x;
          const pushDz = pos.z - tileCenter.z;
          if (Math.abs(pushDx) > Math.abs(pushDz)) {
            pos.x = tileCenter.x + Math.sign(pushDx || 1) * 0.52;
          } else {
            pos.z = tileCenter.z + Math.sign(pushDz || 1) * 0.52;
          }
        } else {
          const distToTileCenter = Math.hypot(pos.x - tileCenter.x, pos.z - tileCenter.z);
          if (distToTileCenter < 0.42) {
            this.gridPos = { x: curGrid.x, z: curGrid.z };

            if (tileType === 0) {
              this.group.position.set(pos.x, 0, pos.z);
              this.lastFailReason = 'cliff';
              this.triggerFall();
              resolve();
              return;
            }
            if (tileType === 3 || tileType === 4) {
              this.group.position.set(pos.x, 0, pos.z);
              this.lastFailReason = tileType === 4 ? 'lava' : 'spike';
              this.triggerExplode(this.lastFailReason);
              resolve();
              return;
            }
            if (tileType === 5) {
              // 점프대는 유저가 점프대 사용/도약 기동(LEAP)을 지시해 멈춘 지점일 때만 다음 LEAP 기동으로 연결
              const finalPt = validPoints[validPoints.length - 1] || points[points.length - 1];
              if (finalPt && finalPt.x === curGrid.x && finalPt.z === curGrid.z) {
                this.group.position.set(tileCenter.x, 0, tileCenter.z);
                resolve();
                return;
              }
            }
            if (tileType === 9) {
              this.group.position.set(tileCenter.x, 0, tileCenter.z);
              this.gridPos = { x: curGrid.x, z: curGrid.z };
              this.lastFailReason = null;
              this.triggerGoal();
              resolve();
              return;
            }
          }
        }

        this.group.position.x = pos.x;
        this.group.position.z = pos.z;

        if (rawProgress < 1) {
          requestAnimationFrame(animate);
        } else {
          const finalPt = validPoints[validPoints.length - 1];
          if (finalPt) {
            const finalW = this.map.gridToWorld(finalPt.x, finalPt.z);
            this.group.position.set(finalW.x, 0, finalW.z);
            this.gridPos = { x: finalPt.x, z: finalPt.z };
          }
          this.resetPose();
          await this.checkTileCollision();

          // 만약 경로가 벽에 가로막혔다면 벽에 살짝 콩 부딪힌 뒤 멈추지 않고 우회 신호(hitWall) 발송!
          if (!this.isDead && !this.isGoal && firstWallPoint) {
            this.hitWall = true;
            await this.bonkWall(firstWallPoint.x, firstWallPoint.z);
          }
          resolve();
        }
      };
      requestAnimationFrame(animate);
    });
  }

  spawnTrailParticles(count = 4, colorHex = 0x38bdf8) {
    const geo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshLambertMaterial({ color: colorHex });
      const p = new THREE.Mesh(geo, mat);
      p.position.copy(this.group.position);
      p.position.x += (Math.random() - 0.5) * 0.3;
      p.position.y += 0.1 + Math.random() * 0.2;
      p.position.z += (Math.random() - 0.5) * 0.3;

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 1.5,
        Math.random() * 1.8 + 0.5,
        (Math.random() - 0.5) * 1.5
      );
      this.scene.add(p);
      this.particles.push({ mesh: p, velocity, rotSpeed: Math.random() * 6, life: 0.45 });
    }
  }

  async step(distance = 1, style = 'normal') {
    const dir = DIRECTIONS[this.dirIndex];
    const targetGridX = this.gridPos.x + dir.dx * distance;
    const targetGridZ = this.gridPos.z + dir.dz * distance;

    // 만약 이동하려는 칸이 벽(2)이면 벽에 쿵 부딪혔다가 튕겨 나오는 리얼한 모션 실행!
    if (this.map.getTileType(targetGridX, targetGridZ) === 2) {
      await this.bonkWall(targetGridX, targetGridZ);
      return;
    }

    this.stepPhase++;
    const waddleSign = this.stepPhase % 2 === 0 ? 1 : -1;
    const randomVariation = 0.85 + Math.random() * 0.3;

    const startPos = this.group.position.clone();
    const endWorld = this.map.gridToWorld(targetGridX, targetGridZ);

    const duration =
      style === 'dash' ? 0.17 : style === 'sneak' ? 0.36 : style === 'zigzag' ? 0.3 : 0.24;
    const startTime = performance.now();

    if (style === 'dash') {
      this.spawnTrailParticles(6, 0x38bdf8);
    } else {
      this.spawnTrailParticles(2, 0x94a3b8);
    }

    // 좌우 방향 벡터 (지그재그/기울기용)
    const perpX = -dir.dz;
    const perpZ = dir.dx;

    return new Promise((resolve) => {
      const animate = async (currentTime) => {
        const elapsed = (currentTime - startTime) / 1000;
        const progress = Math.min(elapsed / duration, 1);
        const ease =
          style === 'dash'
            ? 1 - Math.pow(1 - progress, 4)
            : 1 - Math.pow(1 - progress, 2.5);

        let curX = THREE.MathUtils.lerp(startPos.x, endWorld.x, ease);
        let curZ = THREE.MathUtils.lerp(startPos.z, endWorld.z, ease);

        if (style === 'zigzag') {
          const sway = Math.sin(progress * Math.PI * 2) * 0.22 * waddleSign;
          curX += perpX * sway;
          curZ += perpZ * sway;
          this.bodyGroup.rotation.z = Math.sin(progress * Math.PI * 2) * 0.25 * waddleSign;
          this.headGroup.rotation.y = Math.cos(progress * Math.PI * 2) * 0.35;
        } else if (style === 'sneak') {
          // 납작 숙이고 좌우 눈치 보기
          this.bodyGroup.scale.y = 0.78;
          this.bodyGroup.position.y = Math.sin(progress * Math.PI) * 0.05;
          this.headGroup.rotation.y = Math.sin(progress * Math.PI * 2) * 0.45 * waddleSign;
          this.bodyGroup.rotation.x = 0.15;
        } else if (style === 'dash') {
          // 앞으로 확 숙이며 부스터 질주
          this.bodyGroup.rotation.x = 0.32;
          this.bodyGroup.position.y = Math.sin(progress * Math.PI) * 0.08;
          this.leftArm.rotation.x = -0.8;
          this.rightArm.rotation.x = -0.8;
        } else {
          // 기본 걸음도 매 걸음마다 뒤뚱거림, 고개 각도, 팔 흔들기가 살아있음
          this.bodyGroup.position.y = Math.sin(progress * Math.PI) * 0.16 * randomVariation;
          this.bodyGroup.rotation.z = Math.sin(progress * Math.PI) * 0.12 * waddleSign * randomVariation;
          this.bodyGroup.rotation.x = Math.sin(progress * Math.PI) * (distance > 0 ? 0.1 : -0.1);
          this.headGroup.rotation.y = Math.sin(progress * Math.PI) * 0.15 * waddleSign;
          this.leftArm.rotation.x = Math.sin(progress * Math.PI) * 0.45 * waddleSign;
          this.rightArm.rotation.x = -Math.sin(progress * Math.PI) * 0.45 * waddleSign;
        }

        this.group.position.x = curX;
        this.group.position.z = curZ;

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          this.group.position.x = endWorld.x;
          this.group.position.z = endWorld.z;
          this.group.position.y = 0;
          this.resetPose();
          this.gridPos.x = targetGridX;
          this.gridPos.z = targetGridZ;
          await this.checkTileCollision();
          resolve();
        }
      };
      requestAnimationFrame(animate);
    });
  }

  async bonkWall(wallGridX, wallGridZ) {
    const startPos = this.group.position.clone();
    const wallWorld = this.map.gridToWorld(wallGridX, wallGridZ);
    const hitPos = new THREE.Vector3(
      THREE.MathUtils.lerp(startPos.x, wallWorld.x, 0.42),
      0,
      THREE.MathUtils.lerp(startPos.z, wallWorld.z, 0.42)
    );
    const duration = 0.32;
    const startTime = performance.now();
    this.spawnTrailParticles(6, 0xfacc15);

    return new Promise((resolve) => {
      const animate = (currentTime) => {
        const elapsed = (currentTime - startTime) / 1000;
        const progress = Math.min(elapsed / duration, 1);

        if (progress < 0.35) {
          const p = progress / 0.35;
          this.group.position.lerpVectors(startPos, hitPos, p);
          this.bodyGroup.rotation.x = 0.25 * p;
        } else {
          const p = (progress - 0.35) / 0.65;
          this.group.position.lerpVectors(hitPos, startPos, p);
          // 뒤로 튕기며 어지러워하는 모션
          this.bodyGroup.rotation.x = -0.3 * Math.sin(p * Math.PI);
          this.headGroup.rotation.z = Math.sin(p * Math.PI * 4) * 0.25;
        }

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          this.group.position.copy(startPos);
          this.resetPose();
          resolve();
        }
      };
      requestAnimationFrame(animate);
    });
  }

  async rotate(dirChange) {
    // dirChange: 1 = 좌회전, -1 = 우회전
    this.dirIndex = (this.dirIndex + (dirChange === 1 ? -1 : 1) + 4) % 4;
    const targetAngle = DIRECTIONS[this.dirIndex].angle;

    const startAngle = this.group.rotation.y;
    let diff = targetAngle - startAngle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    const endAngle = startAngle + diff;

    const duration = 0.2;
    const startTime = performance.now();

    return new Promise((resolve) => {
      const animate = (currentTime) => {
        const elapsed = (currentTime - startTime) / 1000;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 2);

        this.group.rotation.y = THREE.MathUtils.lerp(startAngle, endAngle, ease);
        // 돌 때 살짝 폴짝 뛰며 고개를 먼저 돌리는 자연스러운 모션
        this.bodyGroup.position.y = Math.sin(progress * Math.PI) * 0.1;
        this.headGroup.rotation.y = Math.sin(progress * Math.PI) * (dirChange * 0.25);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          this.group.rotation.y = targetAngle;
          this.resetPose();
          resolve();
        }
      };
      requestAnimationFrame(animate);
    });
  }

  async jump(distance = 2, jumpHeight = 0.9) {
    const dir = DIRECTIONS[this.dirIndex];
    const targetGridX = this.gridPos.x + dir.dx * distance;
    const targetGridZ = this.gridPos.z + dir.dz * distance;

    if (this.map.getTileType(targetGridX, targetGridZ) === 2) {
      await this.bonkWall(targetGridX, targetGridZ);
      return;
    }

    const startPos = this.group.position.clone();
    const endWorld = this.map.gridToWorld(targetGridX, targetGridZ);
    const duration = distance > 1 ? 0.42 : 0.3;
    const doTwirl = distance > 1 && Math.random() > 0.35; // 도약 시 신나게 공중 회전이나 만세 포즈!
    const startTime = performance.now();

    this.spawnTrailParticles(6, 0xec4899);

    return new Promise((resolve) => {
      const animate = async (currentTime) => {
        const elapsed = (currentTime - startTime) / 1000;
        const progress = Math.min(elapsed / duration, 1);

        this.group.position.x = THREE.MathUtils.lerp(startPos.x, endWorld.x, progress);
        this.group.position.z = THREE.MathUtils.lerp(startPos.z, endWorld.z, progress);
        this.group.position.y = Math.sin(progress * Math.PI) * jumpHeight;

        // 점프 중 만세 포즈 & 역동적인 공중 기울기
        this.leftArm.rotation.z = -Math.sin(progress * Math.PI) * 2.2;
        this.rightArm.rotation.z = Math.sin(progress * Math.PI) * 2.2;
        if (doTwirl) {
          this.bodyGroup.rotation.y = progress * Math.PI * 2;
        } else {
          this.bodyGroup.rotation.x = Math.cos(progress * Math.PI) * 0.3;
        }

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          this.group.position.y = 0;
          this.resetPose();
          this.spawnTrailParticles(4, 0x38bdf8);
          this.gridPos.x = targetGridX;
          this.gridPos.z = targetGridZ;
          await this.checkTileCollision();
          resolve();
        }
      };
      requestAnimationFrame(animate);
    });
  }

  async spinTwirl() {
    const duration = 0.38;
    const startTime = performance.now();
    this.spawnTrailParticles(5, 0xec4899);

    return new Promise((resolve) => {
      const animate = (currentTime) => {
        const elapsed = (currentTime - startTime) / 1000;
        const progress = Math.min(elapsed / duration, 1);
        this.bodyGroup.rotation.y = progress * Math.PI * 2;
        this.bodyGroup.position.y = Math.sin(progress * Math.PI) * 0.28;
        this.leftArm.rotation.z = -1.2;
        this.rightArm.rotation.z = 1.2;

        if (progress < 1) requestAnimationFrame(animate);
        else {
          this.resetPose();
          resolve();
        }
      };
      requestAnimationFrame(animate);
    });
  }

  async wiggleDance() {
    const duration = 0.48;
    const startTime = performance.now();
    this.spawnTrailParticles(6, 0x38bdf8);

    return new Promise((resolve) => {
      const animate = (currentTime) => {
        const elapsed = (currentTime - startTime) / 1000;
        const progress = Math.min(elapsed / duration, 1);
        const wave = Math.sin(progress * Math.PI * 4);
        this.bodyGroup.rotation.z = wave * 0.25;
        this.bodyGroup.position.y = Math.abs(Math.sin(progress * Math.PI * 4)) * 0.18;
        this.headGroup.rotation.y = -wave * 0.4;
        this.leftArm.rotation.z = -1.5 + wave * 0.6;
        this.rightArm.rotation.z = 1.5 + wave * 0.6;

        if (progress < 1) requestAnimationFrame(animate);
        else {
          this.resetPose();
          resolve();
        }
      };
      requestAnimationFrame(animate);
    });
  }

  async lookAround() {
    const duration = 0.42;
    const startTime = performance.now();

    return new Promise((resolve) => {
      const animate = (currentTime) => {
        const elapsed = (currentTime - startTime) / 1000;
        const progress = Math.min(elapsed / duration, 1);
        this.headGroup.rotation.y = Math.sin(progress * Math.PI * 2) * 0.75;
        this.headGroup.rotation.z = Math.cos(progress * Math.PI * 2) * 0.12;
        this.bodyGroup.scale.y = 1 - Math.sin(progress * Math.PI) * 0.08;

        if (progress < 1) requestAnimationFrame(animate);
        else {
          this.resetPose();
          resolve();
        }
      };
      requestAnimationFrame(animate);
    });
  }

  async backflip() {
    const duration = 0.44;
    const startTime = performance.now();
    this.spawnTrailParticles(8, 0xec4899);

    return new Promise((resolve) => {
      const animate = (currentTime) => {
        const elapsed = (currentTime - startTime) / 1000;
        const progress = Math.min(elapsed / duration, 1);
        this.bodyGroup.position.y = Math.sin(progress * Math.PI) * 0.75;
        this.bodyGroup.rotation.x = -progress * Math.PI * 2;
        this.leftArm.rotation.z = -2.0;
        this.rightArm.rotation.z = 2.0;

        if (progress < 1) requestAnimationFrame(animate);
        else {
          this.resetPose();
          resolve();
        }
      };
      requestAnimationFrame(animate);
    });
  }

  async idleWait() {
    const startTime = performance.now();
    return new Promise((resolve) => {
      const animate = (currentTime) => {
        const elapsed = (currentTime - startTime) / 1000;
        const progress = Math.min(elapsed / 0.25, 1);
        this.bodyGroup.rotation.z = Math.sin(progress * Math.PI * 2) * 0.15;
        this.headGroup.rotation.y = Math.sin(progress * Math.PI * 2) * 0.3;
        if (progress < 1) requestAnimationFrame(animate);
        else {
          this.resetPose();
          resolve();
        }
      };
      requestAnimationFrame(animate);
    });
  }

  async checkTileCollision() {
    const tileType = this.map.getTileType(this.gridPos.x, this.gridPos.z);

    if (tileType === 0) {
      this.lastFailReason = 'cliff';
      this.triggerFall();
    } else if (tileType === 2) {
      this.hitWall = true;
      await this.idleWait();
    } else if (tileType === 3 || tileType === 4) {
      this.lastFailReason = tileType === 4 ? 'lava' : 'spike';
      this.triggerExplode(this.lastFailReason);
    } else if (tileType === 5) {
      // 점프대 위에 멈춘 경우: 다음 기동(LEAP)에서 뛸 수 있도록 대기
      return;
    } else if (tileType === 9) {
      this.lastFailReason = null;
      this.triggerGoal();
    }
  }

  triggerExplode(reason = 'spike') {
    this.isDead = true;
    this.group.visible = false;

    const particleCount = 28;
    const colors =
      reason === 'lava'
        ? [0xf97316, 0xef4444, 0x38bdf8]
        : [0x38bdf8, 0xec4899, 0x334155];
    const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);

    for (let i = 0; i < particleCount; i++) {
      const mat = new THREE.MeshLambertMaterial({
        color: colors[Math.floor(Math.random() * colors.length)]
      });
      const p = new THREE.Mesh(geo, mat);
      p.position.copy(this.group.position);
      p.position.y += 0.4;

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        Math.random() * 5 + 2,
        (Math.random() - 0.5) * 4
      );

      this.scene.add(p);
      this.particles.push({ mesh: p, velocity, rotSpeed: Math.random() * 10 });
    }
  }

  triggerFall() {
    this.isDead = true;
    const startY = this.group.position.y;
    const startTime = performance.now();

    const animate = (time) => {
      const elapsed = (time - startTime) / 1000;
      this.group.position.y = startY - 0.5 * 9.8 * elapsed * elapsed;
      this.group.rotation.x += 0.12;
      this.group.rotation.z += 0.12;

      if (this.group.position.y > -5) {
        requestAnimationFrame(animate);
      } else {
        this.group.visible = false;
      }
    };
    requestAnimationFrame(animate);
  }

  triggerGoal() {
    this.isGoal = true;
  }

  clearParticles() {
    this.particles.forEach((p) => {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    });
    this.particles = [];
  }

  update(delta) {
    this.idleTimer += delta;

    // 파티클 물리 업데이트
    if (this.particles.length > 0) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.velocity.y -= 9.8 * delta;
        p.mesh.position.addScaledVector(p.velocity, delta);
        p.mesh.rotation.x += p.rotSpeed * delta;
        p.mesh.rotation.y += p.rotSpeed * delta;

        if (p.life !== undefined) {
          p.life -= delta;
          if (p.life <= 0) {
            this.scene.remove(p.mesh);
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
            this.particles.splice(i, 1);
            continue;
          }
        }

        if (p.mesh.position.y < -0.2) {
          p.mesh.position.y = -0.2;
          p.velocity.y *= -0.4;
          p.velocity.x *= 0.8;
          p.velocity.z *= 0.8;
        }

        if (p.mesh.position.y < -3) {
          this.scene.remove(p.mesh);
          this.particles.splice(i, 1);
        }
      }
    }

    // 생각 중일 때 고개 갸우뚱 & 양팔 꼼지락 모션
    if (this.isThinking && !this.isDead && !this.isAnimating) {
      const t = performance.now() * 0.01;
      this.headGroup.rotation.z = Math.sin(t) * 0.18;
      this.headGroup.rotation.y = Math.cos(t * 0.7) * 0.35;
      this.bodyGroup.position.y = Math.abs(Math.sin(t * 1.3)) * 0.07;
      if (this.currentSkin === 'mini' && this.glbWrapperGroup) {
        this.glbWrapperGroup.rotation.z = Math.sin(t * 1.2) * 0.12;
      }
      this.leftArm.rotation.z = -0.4 - Math.sin(t * 1.5) * 0.3;
      this.rightArm.rotation.z = 0.4 + Math.cos(t * 1.5) * 0.3;
    } else if (!this.isAnimating && !this.isDead && !this.isGoal) {
      // 가만히 대기 중일 때도 살아있는 것처럼 숨쉬기 + 주변 두리번거리기 + 가끔 기지개!
      const t = this.idleTimer + this.idleQuirkOffset;
      this.bodyGroup.position.y = Math.sin(t * 2.5) * 0.025;
      this.headGroup.rotation.y = Math.sin(t * 0.9) * 0.22 + Math.sin(t * 2.1) * 0.08;
      this.headGroup.rotation.z = Math.cos(t * 1.3) * 0.05;
      if (this.currentSkin === 'mini' && this.glbWrapperGroup) {
        this.glbWrapperGroup.rotation.z = Math.sin(t * 1.5) * 0.04;
        this.glbWrapperGroup.rotation.y = Math.sin(t * 0.8) * 0.08;
      }
      this.leftArm.rotation.x = Math.sin(t * 1.8) * 0.1;
      this.rightArm.rotation.x = -Math.sin(t * 1.8) * 0.1;
    }

    // 골인 댄스
    if (this.isGoal) {
      this.group.rotation.y += delta * 6;
      this.bodyGroup.position.y = Math.abs(Math.sin(Date.now() * 0.01)) * 0.35;
      this.leftArm.rotation.z = -2.2;
      this.rightArm.rotation.z = 2.2;
    }
  }
}
