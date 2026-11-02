/**
 * AI 모듈: 1칸씩 끊어지는 코딩형 명령도 아니고, "알아서 가"라고 했을 때 혼자 미로를 다 푸는 천재 AI도 아닌,
 * 유저가 자연어로 지시한 순서(절/문맥)와 위험 요소만 고지식하게 따라 연속 3D 경로(Maneuvers)로 움직이는 로봇 AI
 */

const API_TIMEOUT_MS = 3200;

export const DEFAULT_PROXY_URL = 'https://promptcarefully.asdfjiwoo.workers.dev';

const DIRS = [
  { dx: 0, dz: 1, name: '아래(+Z, 남쪽)', shortName: '남쪽', screenName: '화면 좌하단' },  // 0: Down (+Z)
  { dx: 1, dz: 0, name: '오른쪽(+X, 동쪽)', shortName: '동쪽', screenName: '화면 우하단' }, // 1: Right (+X)
  { dx: 0, dz: -1, name: '위(-Z, 북쪽)', shortName: '북쪽', screenName: '화면 우상단' },   // 2: Up (-Z)
  { dx: -1, dz: 0, name: '왼쪽(-X, 서쪽)', shortName: '서쪽', screenName: '화면 좌상단' }  // 3: Left (-X)
];

export const TILE_NAMES = {
  0: '낭떠러지',
  1: '일반 바닥',
  2: '토이 스톤 벽',
  3: '날카로운 가시',
  4: '네온 마법 용암',
  5: '스프링 점프대',
  6: '미끄러운 얼음판',
  7: '차원 워프 포탈',
  8: '컨베이어 벨트',
  9: '찬란한 승리 보석',
  10: '부서지는 균열 바닥',
  11: '경고 지뢰'
};

export const isHazardTile = (t) => t === 0 || t === 3 || t === 4 || t === 11;
export const isWalkableTile = (t) => t === 1 || t === 5 || t === 6 || t === 7 || t === 8 || t === 9 || t === 10;

export class RobotAI {
  constructor() {
    this.apiKey = this.cleanKey(localStorage.getItem('GEMINI_API_KEY') || '');
    this.proxyUrl = localStorage.getItem('GEMINI_PROXY_URL') || DEFAULT_PROXY_URL;
    this.preferredModel = null;
  }

  cleanKey(key) {
    if (!key) return '';
    return key.trim().replace(/^["']|["']$/g, '');
  }

  setApiKey(key) {
    this.apiKey = this.cleanKey(key);
    this.preferredModel = null;
    if (this.apiKey) {
      localStorage.setItem('GEMINI_API_KEY', this.apiKey);
    } else {
      localStorage.removeItem('GEMINI_API_KEY');
    }
  }

  getApiKey() {
    return this.apiKey;
  }

  setProxyUrl(url) {
    this.proxyUrl = (url || '').trim();
    if (this.proxyUrl) {
      localStorage.setItem('GEMINI_PROXY_URL', this.proxyUrl);
    } else {
      localStorage.removeItem('GEMINI_PROXY_URL');
      this.proxyUrl = DEFAULT_PROXY_URL;
    }
  }

  getProxyUrl() {
    return this.proxyUrl || DEFAULT_PROXY_URL;
  }

  hasApiCapability() {
    return Boolean(this.apiKey || this.proxyUrl);
  }

  /**
   * 로봇의 현재 위치와 시선 방향을 기준으로 상하좌우 및 반경 2칸(5x5 영역)의 지형, 위험물, 기믹을 정밀 스캔합니다.
   */
  scanSurroundings(mapInfo, robotState, range = 2) {
    const { size, grid, goal, portalPairs = [], conveyors = [] } = mapInfo;
    const rx = robotState.x;
    const rz = robotState.z;
    const curDir = robotState.dir ?? 0;
    const fwd = DIRS[curDir];
    const rightDir = DIRS[(curDir + 1) % 4];
    const backDir = DIRS[(curDir + 2) % 4];
    const leftDir = DIRS[(curDir + 3) % 4];

    const getTile = (x, z) => {
      if (x < 0 || x >= size || z < 0 || z >= size) return 0;
      return grid[z][x];
    };

    const getConveyorDesc = (x, z) => {
      const c = conveyors.find((item) => item.x === x && item.z === z);
      return c?.dir?.name ? `(${c.dir.name} 밀림)` : '';
    };

    // 직교 방향 상대 타일 (1칸, 2칸)
    const front1 = getTile(rx + fwd.dx, rz + fwd.dz);
    const front2 = getTile(rx + fwd.dx * 2, rz + fwd.dz * 2);
    const back1 = getTile(rx + backDir.dx, rz + backDir.dz);
    const back2 = getTile(rx + backDir.dx * 2, rz + backDir.dz * 2);
    const left1 = getTile(rx + leftDir.dx, rz + leftDir.dz);
    const left2 = getTile(rx + leftDir.dx * 2, rz + leftDir.dz * 2);
    const right1 = getTile(rx + rightDir.dx, rz + rightDir.dz);
    const right2 = getTile(rx + rightDir.dx * 2, rz + rightDir.dz * 2);

    // 5x5 반경 내 위험물 및 기믹 목록 수집
    const hazards = [];
    const gimmicks = [];

    for (let dz = -range; dz <= range; dz++) {
      for (let dx = -range; dx <= range; dx++) {
        if (dx === 0 && dz === 0) continue;
        const tx = rx + dx;
        const tz = rz + dz;
        const tile = getTile(tx, tz);

        // 로봇 기준 상대적 방향 설명 (자연스러운 '바로 앞에', '근처에' 어휘 사용)
        const relFwd = dx * fwd.dx + dz * fwd.dz;
        const relRight = dx * rightDir.dx + dz * rightDir.dz;

        let posText = '근처';
        if (relFwd === 1 && relRight === 0) posText = '바로 앞';
        else if (relFwd === 2 && relRight === 0) posText = '조금 앞';
        else if (relFwd === -1 && relRight === 0) posText = '바로 뒤';
        else if (relFwd === -2 && relRight === 0) posText = '조금 뒤';
        else if (relFwd === 0 && relRight === 1) posText = '바로 오른쪽';
        else if (relFwd === 0 && relRight === 2) posText = '조금 오른쪽';
        else if (relFwd === 0 && relRight === -1) posText = '바로 왼쪽';
        else if (relFwd === 0 && relRight === -2) posText = '조금 왼쪽';
        else if (relFwd > 0 && relRight > 0) posText = '오른쪽 앞';
        else if (relFwd > 0 && relRight < 0) posText = '왼쪽 앞';
        else if (relFwd < 0 && relRight > 0) posText = '오른쪽 뒤';
        else if (relFwd < 0 && relRight < 0) posText = '왼쪽 뒤';

        if (tile === 3) hazards.push(`${posText} [날카로운 가시]`);
        else if (tile === 4) hazards.push(`${posText} [네온 마법 용암]`);
        else if (tile === 11) hazards.push(`${posText} [경고 지뢰]`);
        else if (tile === 0 && Math.abs(dx) <= 1 && Math.abs(dz) <= 1) {
          hazards.push(`${posText} [낭떠러지]`);
        }

        if (tile === 5) gimmicks.push(`${posText} [스프링 점프대 (2칸 슈퍼 점프)]`);
        else if (tile === 6) gimmicks.push(`${posText} [미끄러운 얼음판 (1칸 추가 미끄러짐)]`);
        else if (tile === 7) gimmicks.push(`${posText} [차원 워프 포탈 (순간이동)]`);
        else if (tile === 8) gimmicks.push(`${posText} [컨베이어 벨트${getConveyorDesc(tx, tz)}]`);
        else if (tile === 10) gimmicks.push(`${posText} [부서지는 균열 바닥]`);
        else if (tile === 9) gimmicks.push(`${posText} [🏆 승리 보석(목적지)]`);
      }
    }

    // 골인 지점 상대 위치
    const distGoal = Math.abs(rx - goal.x) + Math.abs(rz - goal.z);
    const goalRel = [];
    if (goal.z > rz) goalRel.push(`남쪽(+Z) ${goal.z - rz}칸`);
    else if (goal.z < rz) goalRel.push(`북쪽(-Z) ${rz - goal.z}칸`);
    if (goal.x > rx) goalRel.push(`동쪽(+X) ${goal.x - rx}칸`);
    else if (goal.x < rx) goalRel.push(`서쪽(-X) ${rx - goal.x}칸`);

    const summaryText = [
      `로봇 현재 좌표: [X: ${rx}, Z: ${rz}], 시선 방향: ${DIRS[curDir].name}`,
      `시야 전방: 바로 앞 [${TILE_NAMES[front1]}], 조금 앞 [${TILE_NAMES[front2]}]`,
      `시야 좌우: 바로 왼쪽 [${TILE_NAMES[left1]}], 바로 오른쪽 [${TILE_NAMES[right1]}]`,
      `시야 후방: 바로 뒤 [${TILE_NAMES[back1]}], 조금 뒤 [${TILE_NAMES[back2]}]`,
      `목적지 보석: ${goalRel.join(', ')} (거리 ${distGoal}칸)`,
      hazards.length > 0 ? `근처에 감지된 위험물: ${hazards.join(', ')}` : '근처 위험물: 없음 (주변 안전)',
      gimmicks.length > 0 ? `근처에 감지된 기믹: ${gimmicks.join(', ')}` : '근처 특수 기믹: 없음'
    ].join('\n');

    return {
      front1,
      front2,
      back1,
      back2,
      left1,
      left2,
      right1,
      right2,
      hazards,
      gimmicks,
      distGoal,
      summaryText
    };
  }

  /**
   * 유저의 자연어 프롬프트를 분석하여
   * 1) 단계별 생각 과정(thoughts)과
   * 2) 1칸씩 끊기지 않는 연속 주행/도약 기동(maneuvers)을 생성합니다.
   */
  async parsePrompt(userPrompt, mapInfo, robotState, callbacks = {}) {
    // 1. 0ms 즉시 자연어 의도 분석 & 연속 3D 기동 경로 생성
    const localPlan = this.planFromNaturalLanguage(userPrompt, mapInfo, robotState);

    // 2. 기다리는 시간(0초) 없이 말풍선에 생각 과정을 순차 노출
    let apiAdopted = false;
    const progressiveTimer = this.startProgressiveThoughtTicker(
      localPlan,
      callbacks,
      () => apiAdopted
    );

    if (this.hasApiCapability()) {
      const startTime = performance.now();
      try {
        const apiResult = await this.callGeminiAPI(
          userPrompt,
          mapInfo,
          robotState,
          localPlan,
          (partial) => {
            if (partial.thoughts.length > 0) {
              apiAdopted = true;
              if (callbacks.onStreamUpdate) {
                callbacks.onStreamUpdate(partial);
              }
            }
          }
        );
        clearInterval(progressiveTimer);
        const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
        console.log(`⚡ Gemini 자연어 의도 분석 완료 (${elapsed}s)`, apiResult);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('ai-success', {
              detail: `${apiResult.model} 자연어 분석 완료 (${elapsed}초)`
            })
          );
        }
        return apiResult;
      } catch (err) {
        clearInterval(progressiveTimer);
        console.warn('⚡ API 지연/오류 → 즉시 내장 자연어 경로 엔진 사용:', err.message);
        return localPlan;
      }
    }

    await new Promise((r) =>
      setTimeout(r, Math.min(localPlan.thoughts.length * 220, 660))
    );
    clearInterval(progressiveTimer);
    return localPlan;
  }

  startProgressiveThoughtTicker(plan, callbacks, isApiAdoptedFn) {
    let stepIdx = 0;
    const badges = plan.maneuvers.map((m) => m.label);

    const emitStep = () => {
      if (isApiAdoptedFn()) return;
      stepIdx = Math.min(stepIdx + 1, plan.thoughts.length);
      const visibleThoughts = plan.thoughts.slice(0, stepIdx);
      const isLast = stepIdx >= plan.thoughts.length;
      const ratio = stepIdx / Math.max(1, plan.thoughts.length);
      const visibleBadgeCount = Math.max(1, Math.ceil(ratio * badges.length));

      if (callbacks.onStreamUpdate) {
        callbacks.onStreamUpdate({
          thoughts: visibleThoughts,
          thought: isLast ? plan.thought : '',
          actions: badges.slice(0, visibleBadgeCount)
        });
      }
    };

    emitStep();
    return setInterval(emitStep, 240);
  }

  async callGeminiAPI(userPrompt, mapInfo, robotState, fallbackPlan, onApiStreamUpdate) {
    const defaultCandidates = [
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash',
      'gemini-3.1-flash-lite'
    ];

    const candidateModels = this.preferredModel
      ? [
          this.preferredModel,
          ...defaultCandidates.filter((m) => m !== this.preferredModel)
        ]
      : defaultCandidates;

    const deadline = performance.now() + API_TIMEOUT_MS;
    const errors = [];

    for (const model of candidateModels) {
      const remainingMs = deadline - performance.now();
      if (remainingMs < 700) break;

      try {
        const res = await this.requestModelNaturalStream(
          model,
          userPrompt,
          mapInfo,
          robotState,
          fallbackPlan,
          onApiStreamUpdate,
          remainingMs
        );
        this.preferredModel = model;
        return { ...res, model };
      } catch (e) {
        errors.push(`${model}: ${e.message}`);
        if (e.name === 'AbortError' || e.message.includes('시간 초과')) {
          break;
        }
      }
    }

    throw new Error(errors.join(' | ') || 'API 응답 시간 초과');
  }

  buildThinkingConfig(modelName) {
    if (modelName === 'gemini-3.5-flash-lite') {
      return { thinkingLevel: 'MINIMAL' };
    }
    if (modelName.startsWith('gemini-3.8') || modelName.startsWith('gemini-4')) {
      return { thinkingLevel: 'LOW' };
    }
    return undefined;
  }

  async requestModelNaturalStream(
    modelName,
    userPrompt,
    mapInfo,
    robotState,
    fallbackPlan,
    onApiStreamUpdate,
    timeoutMs
  ) {
    let url;
    if (this.apiKey) {
      url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse&key=${this.apiKey}`;
    } else {
      const baseProxy = (this.proxyUrl || DEFAULT_PROXY_URL).replace(/\/+$/, '');
      url = `${baseProxy}/v1beta/models/${modelName}:streamGenerateContent?alt=sse`;
    }

    const sensor = this.scanSurroundings(mapInfo, robotState, 2);

    const promptText = `당신은 3D 복셀 액션 게임 "Prompt Carefully"의 귀엽고 고지식한 길치 로봇입니다.
로봇은 눈으로 주변 지형과 바로 앞/근처의 위험물(가시/용암/지뢰/낭떠러지), 특수 기믹(얼음판/점프대/포탈/컨베이어)을 직접 확인하고 있습니다.

[로봇이 눈으로 확인한 주변 지형 상황]
${sensor.summaryText}

[기믹 및 지형 규칙]
1. 날카로운 가시, 네온 마법 용암, 경고 지뢰, 낭떠러지: 닿거나 빠지면 즉시 사망/폭발! 반드시 도약(점프)으로 뛰어넘거나 우회해야 합니다.
2. 미끄러운 얼음판: 밟으면 이동 방향으로 1칸 더 쭈욱 미끄러집니다. 얼음판 끝에 가시나 벽이 있는지 확인하여 안전할 때 타거나 점프로 뛰어넘어야 합니다.
3. 스프링 점프대: 밟으면 바라보는 방향으로 2칸 이상 날아올라 용암/가시를 시원하게 도약합니다.
4. 차원 워프 포탈: 밟으면 즉시 연결된 다른 포탈로 순간이동합니다.
5. 이동 컨베이어 벨트: 밟으면 벨트 화살표 방향으로 1칸 밀려납니다.
6. 토이 스톤 벽: 막혀서 직진 불가. 옆 통로로 돌아가야 합니다.

[성격 및 절대 지침]
- ★절대 규칙★: '2칸 센서'나 '센서'라는 기계적인 단어를 대사에서 절대 직접 말하지 마세요!
  대신 반드시 '바로 앞에', '근처에', '눈앞에', '저기 바로 앞에', '바로 옆에', '주변에' 같은 친근하고 자연스러운 말을 사용하세요.
- ★시점 및 방향 판단 지침★:
  * 로봇 현재 시선 방향: ${DIRS[robotState.dir ?? 0]?.name || '남쪽(+Z)'}
  * 게임 화면은 쿼터뷰(아이소메트릭)로 대각선에서 내려다보고 있습니다.
  * 유저가 "오른쪽으로 돌아", "우회전", "로봇 기준", "앞으로 가다 꺾어"처럼 지시하면 [로봇 시점]으로, "화면 오른쪽", "위로 가"처럼 지시하면 [화면 시점]으로 유연하게 판단하세요.
  * 첫 번째 생각(STEP)에서 유저의 방향 명령을 어떤 시점(로봇 시점 우회전/좌회전 vs 화면 시점)으로 해석했는지 친근하고 똑똑한 반말로 자연스럽게 언급하세요!
- ★지능적 동선 추론 지침★:
  1. 유저의 문장이 2개 이상의 복합 행동("~하고 ~해서 ~로 가")일 때는 그 행동들의 순서를 정확히 인과관계로 연결하세요.
  2. 만약 눈앞이나 근처에 가시/지뢰/용암이 있다면, 그냥 달리는 대신 "바로 앞에 위험한 게 있으니까 도움닫기 후 점프로 뛰어넘고!"처럼 장애물 대처 행동을 명확히 짚어주세요.
  3. 얼음판이나 점프대, 포탈을 지시받았다면 해당 기믹의 특성(얼음판 미끄러짐, 점프대 2칸 슈퍼 도약, 포탈 순간이동)을 똑똑하게 활용하는 계획을 세우세요.
- 유저가 구체적인 방향(오른쪽/아래 등), 점프 도약, 또는 기믹 대처(얼음판 타기, 가시/지뢰 점프, 점프대 밟기, 포탈 타기 등)를 알려주면 그에 맞게 바로 앞이나 근처 지형을 확인하며 생각합니다.
- 만약 유저가 "알아서 가", "안전하게 다 피해", "그냥 보석으로 가"처럼 대충 명령하면 바로 앞이나 근처에 보이는 위험물(가시, 용암, 지뢰, 얼음판 등)을 보고 "바로 앞에 위험한 게 있는데 어딜 어떻게 피하라는 거야!" 하고 투덜댑니다.
- 근처에 실제로 보이는 타일과 기믹(가시, 얼음, 점프대, 지뢰 등)을 자연스러운 반말로 대사에 녹여내세요!

고민하지 말고 즉시 아래 줄 형식으로만 답하세요:
STEP: (유저의 명령과 시점 판단, 주변 상황을 보고 로봇이 첫 번째로 한 생각 - 친근한 반말, '센서'라는 말 쓰지 말고 '바로 앞에', '근처에' 쓰기)
STEP: (구체적인 지형/기믹 대처법이나 불평 - 친근한 반말)
FINAL: (출발 직전 외치는 짧은 한마디!)

유저 명령: "${userPrompt}"`;

    const generationConfig = {
      maxOutputTokens: 240
    };

    const thinkingConfig = this.buildThinkingConfig(modelName);
    if (thinkingConfig) {
      generationConfig.thinkingConfig = thinkingConfig;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      let response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
          generationConfig
        }),
        signal: controller.signal
      });

      if (!response.ok && response.status === 400 && generationConfig.thinkingConfig) {
        delete generationConfig.thinkingConfig;
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: promptText }] }],
            generationConfig
          }),
          signal: controller.signal
        });
      }

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        const message = errorJson.error?.message || response.statusText;
        throw new Error(`HTTP ${response.status} (${message})`);
      }

      if (!response.body) {
        throw new Error('스트림 응답 본문이 없습니다.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let sseBuffer = '';
      let rawText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split(/\r?\n/);
        sseBuffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;

          const dataStr = trimmed.slice(5).trim();
          if (!dataStr || dataStr === '[DONE]') continue;

          try {
            const chunk = JSON.parse(dataStr);
            const parts = chunk.candidates?.[0]?.content?.parts || [];
            for (const part of parts) {
              if (!part.thought && part.text) {
                rawText += part.text;
              }
            }

            const parsedStream = this.parseNaturalStreamText(rawText, fallbackPlan);
            if (onApiStreamUpdate && parsedStream.thoughts.length > 0) {
              onApiStreamUpdate({
                thoughts: parsedStream.thoughts,
                thought: parsedStream.thought,
                actions: parsedStream.maneuvers.map((m) => m.label)
              });
            }
          } catch (_) {
            // 스트림 조각 파싱 무시
          }
        }
      }

      return this.parseNaturalStreamText(rawText, fallbackPlan);
    } finally {
      clearTimeout(timer);
    }
  }

  parseNaturalStreamText(rawText, fallbackPlan) {
    const thoughts = [];
    let thought = '';

    const lines = rawText.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (/^STEP\s*:/i.test(trimmed)) {
        const s = trimmed.replace(/^STEP\s*:\s*/i, '').trim();
        if (s) thoughts.push(s);
      } else if (/^FINAL\s*:/i.test(trimmed)) {
        thought = trimmed.replace(/^FINAL\s*:\s*/i, '').trim();
      }
    }

    return {
      thoughts: thoughts.length > 0 ? thoughts.slice(0, 4) : fallbackPlan.thoughts,
      thought: thought || fallbackPlan.thought,
      maneuvers: fallbackPlan.maneuvers,
      actions: fallbackPlan.maneuvers.map((m) => m.label),
      rules: fallbackPlan.rules
    };
  }

  /**
   * 자연어 문장을 절(Clause) 단위로 쪼개어,
   * "알아서 가" 같은 대충 명령에는 허당처럼 돌진해 실패하고,
   * 구체적인 자연어 지시에는 그 순서대로 연속 곡선 주행(RUN_PATH)과 도약(LEAP)을 수행합니다.
   */
  planFromNaturalLanguage(userPrompt, mapInfo, robotState) {
    const text = userPrompt.toLowerCase().trim();

    const styleDash = /(?:힘차|빠르|전력|달려|돌진|질주|단숨에|논스톱|쭉|최단)/.test(text);
    const styleSneak = /(?:살금|조심|천천|몰래|살피)/.test(text);
    const runStyle = styleSneak ? 'sneak' : styleDash ? 'dash' : 'normal';

    const wantDance = /(?:춤|댄스|흔들|리듬|신나게)/.test(text);
    const wantFlip = /(?:백덤블링|공중제비|덤블링|화려하게|멋지게)/.test(text);
    const wantSpin = /(?:빙글|스핀|한\s*바퀴)/.test(text);

    const thoughts = [];
    const maneuvers = [];

    if (wantDance) {
      maneuvers.push({
        type: 'EMOTE',
        emote: 'DANCE',
        label: '💃 신나는 리듬 댄스',
        thought: '출발하기 전에 흥 좀 돋워볼까~ 둠칫둠칫! 💃'
      });
      thoughts.push('요청대로 먼저 신나게 몸풀기 댄스 한 판! 💃');
    }
    if (wantFlip) {
      maneuvers.push({
        type: 'EMOTE',
        emote: 'BACKFLIP',
        label: '🤸 화려한 백덤블링',
        thought: '내 특기인 공중 백덤블링부터 보여줄게! 🤸'
      });
      thoughts.push('가볍게 공중제비 한 바퀴 돌고 시작하자! ✨');
    }
    if (wantSpin) {
      maneuvers.push({
        type: 'EMOTE',
        emote: 'SPIN',
        label: '🌀 360도 빙글 스핀',
        thought: '빙그르르 한 바퀴 돌며 텐션 업! 🌀'
      });
    }

    const isOnlyEmote =
      (wantDance || wantFlip || wantSpin) &&
      !/(?:가|이동|달려|전진|직진|점프|넘어|피해|보석|목적지|골인|탈출|움직)/.test(text);
    if (isOnlyEmote) {
      return {
        thoughts: thoughts.length ? thoughts : ['신나게 개인기를 보여줄게! ✨'],
        thought: '짜잔~ 내 개인기 어때?! 🤖',
        maneuvers,
        actions: maneuvers.map((m) => m.label),
        rules: { isLazy: true, runStyle },
        model: '자연어 경로 AI'
      };
    }

    // 1. 유저의 문장을 순차적인 행동 절(Clauses)로 분리
    const clauses = this.splitIntoMovementClauses(text);
    const sensor = this.scanSurroundings(mapInfo, robotState, 2);

    // 2. "알아서 가", "안전하게 다 피해", "보석으로 가" 등 너무 추상적이거나 떠넘기는 명령인지 판별
    const hasLazyDelegation =
      /(?:알아서|마음대로|맘대로|적당히|스스로|자동으로|대충|아무렇게나|네가\s*알아|니가\s*알아|혼자서|멋대로)/.test(
        text
      );
    const hasVagueCatchAll =
      /(?:모든\s*함정|다\s*피해|모두\s*피해|전부\s*피해|위험한\s*거\s*다|장애물\s*다)/.test(text);

    const hasExplicitDir =
      /(?:오른쪽|우측|동쪽|왼쪽|좌측|서쪽|아래|남쪽|내려|위쪽|위로|북쪽|올라|앞으로|직진|전진)/.test(text);
    const hasJumpOrPadMechanic =
      /(?:점프|뛰어|폴짝|넘어|날아|도약|발판|파란|스프링|트램펄린|jump)/.test(text);
    const hasSpecificHazard = /(?:가시|뾰족|바늘|용암|불구덩이|낭떠러지|지뢰|폭탄)/.test(text);
    const hasGimmickCommand = /(?:점프대|발판|얼음|빙판|미끄러|포탈|워프|순간이동|컨베이어|벨트)/.test(text);
    const hasGoalCommand = /(?:보석|목적지|골인|도착|탈출|끝까지)/.test(text);

    // 구체적인 방향/점프/기믹/목적지 지시도 없거나, "알아서 가"라고 떠넘긴 경우만 허당 돌진!
    const isLazyPrompt =
      hasLazyDelegation ||
      (hasVagueCatchAll && !hasExplicitDir && !hasJumpOrPadMechanic && !hasGimmickCommand && !hasGoalCommand) ||
      (!hasExplicitDir && !hasJumpOrPadMechanic && !hasGimmickCommand && !hasGoalCommand);

    if (isLazyPrompt) {
      return this.buildLazyBlindPlan(
        text,
        mapInfo,
        robotState,
        maneuvers,
        thoughts,
        {
          hasLazyDelegation,
          hasVagueCatchAll,
          hasSpecificHazard,
          runStyle,
          sensor
        }
      );
    }

    // 3. 정상적인 자연어 지시: 주변 지형 살핀 후 절(Clause) 순서대로 경로 생성!
    const hazardAlert = sensor.hazards.length > 0 ? ` [위험: ${sensor.hazards[0]}]` : '';
    const gimmickAlert = sensor.gimmicks.length > 0 ? ` [발견: ${sensor.gimmicks[0]}]` : '';
    maneuvers.push({
      type: 'EMOTE',
      emote: 'LOOK_AROUND',
      label: '👀 주변 살피기',
      thought: `어디 보자... 두리번두리번!${hazardAlert || gimmickAlert || ' 근처 경로 확인 완료!'} 👀`
    });

    const rules = {
      isLazy: false,
      avoidHazard: /(?:가시|뾰족|바늘|찔리|지뢰|폭탄|마인|용암|불|마그마|낭떠러지|함정|위험|조심|피해)/.test(text),
      avoidSpike: /(?:가시|뾰족|바늘|찔리)/.test(text),
      avoidMine: /(?:지뢰|폭탄|마인)/.test(text),
      avoidLava: /(?:용암|불구덩이|마그마)/.test(text),
      avoidIce: /(?:얼음|빙판|미끄러).*?(?:피해|조심|말고|마)/.test(text),
      useIce:
        /(?:얼음|빙판|미끄러).*?(?:타고|밟고|이용|미끄러져|통해)/.test(text) ||
        (/(?:얼음|빙판)/.test(text) && !/(?:피해|말고|조심)/.test(text)),
      jumpSpike: hasJumpOrPadMechanic,
      jumpHazard: hasJumpOrPadMechanic,
      avoidWall: true,
      useJumpPad: /(?:점프대|발판|파란|스프링|트램펄린)/.test(text),
      usePortal: /(?:포탈|워프|순간이동|웜홀|차원문)/.test(text),
      useConveyor: /(?:컨베이어|벨트).*?(?:타고|밟고|이용)/.test(text),
      avoidConveyor: /(?:컨베이어|벨트).*?(?:피해|조심)/.test(text),
      runStyle,
      sensor
    };

    const { clauseManeuvers, clauseThoughts } = this.buildClauseByClauseTrajectory(
      clauses,
      mapInfo,
      robotState,
      rules
    );

    thoughts.push(...clauseThoughts);
    maneuvers.push(...clauseManeuvers);

    const finalThought = styleSneak
      ? '지시해 준 순서대로 조심조심 이동해볼게! 🕵️'
      : '알려준 코스 순서대로 부드럽게 달려간다! 출발! 🚀';

    return {
      thoughts: thoughts.slice(0, 4),
      thought: finalThought,
      maneuvers,
      actions: maneuvers.map((m) => m.label),
      rules,
      model: '자연어 경로 AI'
    };
  }

  /**
   * "알아서 가", "안전하게 다 피해", "가시 피해서 가(방향/점프 미지정)"처럼
   * 플레이어가 구체적인 방법이나 경로를 알려주지 않았을 때 허당처럼 행동하는 플랜
   */
  buildLazyBlindPlan(text, mapInfo, robotState, maneuvers, thoughts, flags) {
    const { size, grid } = mapInfo;
    const getTile = (x, z) => {
      if (x < 0 || x >= size || z < 0 || z >= size) return 0;
      return grid[z][x];
    };

    maneuvers.push({
      type: 'EMOTE',
      emote: 'SPIN',
      label: '😵 어리둥절 빙글',
      thought: '어라? 구체적으로 어디로 어떻게 가라고 안 알려줬잖아?! 😵'
    });

    if (flags.hasLazyDelegation) {
      thoughts.push('잠깐, 나보고 "알아서" 가라고?! 난 길치 로봇인데! 🤖💦');
      if (flags.sensor?.hazards?.length > 0) {
        thoughts.push(`근처에 [${flags.sensor.hazards[0]}] 위험물이 떡하니 보이는데 어딜 어떻게 피하라는 거야?! 😱`);
      } else {
        thoughts.push('어느 쪽으로 돌지, 어디서 점프할지 안 알려주면 앞만 보고 달릴 수밖에 없어!');
      }
    } else if (flags.hasVagueCatchAll) {
      thoughts.push('"다 피해서 안전하게"라고만 하면 어딜 어떻게 피하라는 거야?! 😵');
      if (flags.sensor?.hazards?.length > 0) {
        thoughts.push(`근처에 [${flags.sensor.hazards[0]}] 위험물이 있는데 점프를 할지 돌아서 갈지 구체적으로 말해줘!`);
      } else {
        thoughts.push('가시나 지뢰를 뛰어넘을지, 오른쪽이나 아래로 돌지 구체적으로 말해줘야지!');
      }
    } else if (flags.hasSpecificHazard) {
      thoughts.push('위험물을 조심하라고는 했는데… 점프를 할지 어느 방향으로 돌지 안 알려줬네? 🤔');
      thoughts.push('일단 눈앞만 살짝 비켜서 내 맘대로 직진해볼게! 💦');
    } else {
      thoughts.push('구체적인 방향이나 장애물 대처법이 없네? 그럼 앞만 보고 일직선 돌진! ⚡');
    }

    let curX = robotState.x;
    let curZ = robotState.z;
    const dir = DIRS[robotState.dir ?? 0] || DIRS[0];
    const blindPoints = [];

    // 만약 위험물(가시/지뢰/용암)만 언급하고 구체적 경로를 안 알려준 경우:
    // 첫 번째 장애물만 옆으로 1칸 피하는 척하다가 그대로 직진해서 다음 장애물에 걸리거나 멈춤!
    if (flags.hasSpecificHazard && !flags.hasLazyDelegation && !flags.hasVagueCatchAll) {
      const nextTile = getTile(curX + dir.dx, curZ + dir.dz);
      if (nextTile === 3 || nextTile === 11 || nextTile === 4) {
        // 오른쪽으로 살짝 비켜서 앞으로 직진
        const sideX = Math.min(size - 2, curX + 2);
        for (let x = curX + 1; x <= sideX; x++) {
          blindPoints.push({ x, z: curZ });
        }
        curX = sideX;
      }
    }

    // 만약 바로 앞이 점프대(5)인데 점프대 언급을 안 한 경우:
    // "저 파란 발판은 뭐지?" 하고 옆 칸(낭떠러지/벽)으로 비켜가거나 점프대 작동 없이 용암으로 직진!
    const frontTile = getTile(curX + dir.dx, curZ + dir.dz);
    if (frontTile === 5) {
      const leftTile = getTile(curX - 1, curZ + dir.dz);
      if (leftTile === 0) {
        blindPoints.push({ x: curX - 1, z: curZ + dir.dz });
        maneuvers.push({
          type: 'RUN_PATH',
          points: blindPoints,
          style: flags.runStyle,
          label: '🤪 멋대로 발판 피해 돌진',
          thought: '앞에 수상한 파란 판이 있네? 옆으로 비켜서 내 맘대로 가야지~ 🤪'
        });
        return {
          thoughts: thoughts.slice(0, 4),
          thought: '에라 모르겠다! 내 맘대로 간다~ 🤪',
          maneuvers,
          actions: maneuvers.map((m) => m.label),
          rules: { isLazy: true, runStyle: flags.runStyle },
          model: '자연어 경로 AI'
        };
      }
    }

    // 기본적으로 바라보는 방향(+Z 등)으로 3~4칸 무작정 직진!
    for (let step = 1; step <= 4; step++) {
      const nx = curX + dir.dx * step;
      const nz = curZ + dir.dz * step;
      if (nx < 0 || nx >= size || nz < 0 || nz >= size) break;
      blindPoints.push({ x: nx, z: nz });
      const t = getTile(nx, nz);
      if (t === 2 || t === 3 || t === 4 || t === 0) {
        break;
      }
    }

    if (blindPoints.length > 0) {
      maneuvers.push({
        type: 'RUN_PATH',
        points: blindPoints,
        style: flags.runStyle,
        label: '🤪 앞만 보고 무작정 돌진',
        thought: '어떻게 갈지 자세히 안 알려줬으니 일단 앞만 보고 무작정 돌진한다!! ⚡'
      });
    }

    return {
      thoughts: thoughts.slice(0, 4),
      thought: flags.hasLazyDelegation
        ? '나보고 알아서 가라니! 에라 모르겠다 앞만 보고 돌진~ 🤪'
        : '어디로 돌아갈지 안 알려줬으니 일단 앞으로 무작정 달린다! ⚡',
      maneuvers,
      actions: maneuvers.map((m) => m.label),
      rules: { isLazy: true, runStyle: flags.runStyle },
      model: '자연어 경로 AI'
    };
  }

  /**
   * 자연어 문장을 순서대로 실행할 절(Clause) 배열로 분리합니다.
   * 수식어 절("가시를 피해서" 등)이 단독으로 분리되면 바로 뒤 행동 절과 결합합니다.
   */
  splitIntoMovementClauses(text) {
    const delimited = text
      .replace(
        /(점프하고|뛰어넘고|뛰어넘어서|넘고|넘어서|밟고|밟아서|건너고|건너서|돌아서|돌고|꺾어서|꺾고|내려가고|내려가서|올라가고|올라가서|움직이고|이동하고|가고|가서|달려가고|달려가서|직진하고|직진해서|전진하고|전진해서|가다가|간\s*다음|간\s*뒤|움직인\s*다음|움직인\s*뒤|내려간\s*다음|내려간\s*뒤|올라간\s*다음|올라간\s*뒤|돌아간\s*다음|돌아간\s*뒤|한\s*다음|한\s*뒤)/g,
        '$1|'
      )
      .replace(
        /(?:그리고|그\s*다음에?|다음에?|그\s*후에?|그\s*뒤에?|이어서|그런\s*뒤|그런\s*다음|[,.!]+)/g,
        '|'
      );

    const rawParts = delimited
      .split('|')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (rawParts.length <= 1) {
      return rawParts.length === 1 ? rawParts : [text];
    }

    // 방향이나 이동/점프 동사가 없는 단순 수식 절("가시를 피해서")은 다음 절에 합침
    const merged = [];
    let pendingModifier = '';

    const hasActionOrDir = (str) =>
      /(?:오른쪽|우측|왼쪽|좌측|아래|위쪽|위로|앞으로|직진|점프|뛰어넘|발판|점프대|얼음|얼음판|미끄러|포탈|워프|순간이동|컨베이어|지뢰|폭탄|돌아|꺾어|내려|올라|달려|보석|목적지|골인|\d+\s*칸)/.test(
        str
      );

    for (const part of rawParts) {
      if (!hasActionOrDir(part)) {
        pendingModifier = pendingModifier ? `${pendingModifier} ${part}` : part;
      } else {
        const combined = pendingModifier ? `${pendingModifier} ${part}` : part;
        merged.push(combined);
        pendingModifier = '';
      }
    }

    if (pendingModifier) {
      if (merged.length > 0) {
        merged[merged.length - 1] += ` ${pendingModifier}`;
      } else {
        merged.push(pendingModifier);
      }
    }

    return merged;
  }

  /**
   * 분리된 각 자연어 절(Clause)을 순서대로 시뮬레이션하여
   * 연속 곡선 이동(RUN_PATH) 및 장애물 도약(LEAP) 시퀀스를 생성합니다.
   */
  buildClauseByClauseTrajectory(clauses, mapInfo, robotState, rules) {
    const { size, grid, goal } = mapInfo;
    const getTile = (x, z) => {
      if (x < 0 || x >= size || z < 0 || z >= size) return 0;
      return grid[z][x];
    };

    let curX = robotState.x;
    let curZ = robotState.z;
    let curDir = robotState.dir ?? 0;
    let justUsedJumpPad = false;
    let prevContext = { wasForward: false, lastDir: curDir, lastPerspective: null };

    const clauseManeuvers = [];
    const clauseThoughts = [];

    for (let i = 0; i < clauses.length; i++) {
      const clause = clauses[i];
      const nextClause = clauses[i + 1] || '';

      const dirResolution = this.resolveClauseDirection(clause, curDir, prevContext);
      const explicitDir = dirResolution ? dirResolution.dir : null;

      const nextDirRes = this.resolveClauseDirection(
        nextClause,
        explicitDir ?? curDir,
        { wasForward: Boolean(explicitDir !== null || /(?:직진|앞으로|전진)/.test(clause)) }
      );
      const nextExplicitDir = nextDirRes ? nextDirRes.dir : null;

      const isPadClause = /(?:점프대|발판|파란|스프링|트램펄린)/.test(clause);
      const isJumpClause =
        !isPadClause && /(?:점프|뛰어|폴짝|넘어|날아|도약|jump)/.test(clause);
      const isGoalClause = /(?:보석|목적지|골인|끝까지)/.test(clause);
      const clauseAvoidHazard =
        /(?:가시|뾰족|바늘|지뢰|폭탄|마인|용암|불|마그마|낭떠러지|함정|위험|조심|피해)/.test(clause) ||
        rules.avoidHazard;
      const clauseAvoidSpike =
        clauseAvoidHazard || /(?:가시|뾰족|바늘)/.test(clause) || rules.avoidSpike;

      // 1) 파란 점프대(5) 진입 및 도약 절
      if (isPadClause) {
        if (explicitDir !== null) curDir = explicitDir;
        const padPlan = this.planJumpPadSegment(
          mapInfo,
          curX,
          curZ,
          curDir,
          rules.runStyle
        );
        if (padPlan) {
          clauseManeuvers.push(...padPlan.maneuvers);
          clauseThoughts.push('파란 점프대를 밟고 용암 위를 시원하게 날아오르자! 🚀');
          curX = padPlan.endX;
          curZ = padPlan.endZ;
          curDir = padPlan.endDir;
          justUsedJumpPad = true;
          continue;
        }
      }

      // 1-2) 차원 워프 포탈(7) 진입 절
      const isPortalClause = /(?:포탈|워프|순간이동|웜홀|차원문)/.test(clause);
      if (isPortalClause) {
        const portalPlan = this.planPortalSegment(mapInfo, curX, curZ, rules.runStyle);
        if (portalPlan) {
          clauseManeuvers.push(...portalPlan.maneuvers);
          clauseThoughts.push('신비로운 차원 포탈을 타고 반대편으로 순간이동! 🌀✨');
          curX = portalPlan.endX;
          curZ = portalPlan.endZ;
          continue;
        }
      }

      // 1-3) 얼음판(6) 기믹 활용 절 (예: "얼음판 타고", "미끄러져서", "빙판 건너")
      const isIceClause =
        /(?:얼음|빙판|미끄러).*?(?:타|밟|미끄러져|통해)/.test(clause) ||
        (/(?:얼음|빙판)/.test(clause) && !/(?:피해|말고|조심)/.test(clause));
      if (isIceClause && !isJumpClause) {
        const icePlan = this.planIceSegment(mapInfo, curX, curZ, curDir, rules.runStyle);
        if (icePlan) {
          clauseManeuvers.push(...icePlan.maneuvers);
          clauseThoughts.push('미끄러운 얼음판을 밟고 빠르게 미끄러져 전진! 🧊💨');
          curX = icePlan.endX;
          curZ = icePlan.endZ;
          continue;
        }
      }

      // 2) 장애물(가시/용암/지뢰/낭떠러지) 점프 도약 절
      if (isJumpClause) {
        // 직전 절에서 이미 점프대로 용암을 건넜는데 "용암을 뛰어넘어서"가 이어진 경우 중복 도약 방지
        if (justUsedJumpPad && /(?:용암|불|구멍|건너)/.test(clause)) {
          justUsedJumpPad = false;
          if (!isGoalClause && explicitDir === null) {
            continue;
          }
        } else {
          justUsedJumpPad = false;
          if (explicitDir !== null) curDir = explicitDir;

          const d = DIRS[curDir];
          const tile1 = getTile(curX + d.dx, curZ + d.dz);
          const tile2 = getTile(curX + d.dx * 2, curZ + d.dz * 2);
          const tile3 = getTile(curX + d.dx * 3, curZ + d.dz * 3);

          const isHaz = (t) => t === 0 || t === 3 || t === 4 || t === 11;

          // 2칸 센서 분석: 만약 1칸 앞은 디딜 수 있는 안전 바닥이고 2칸 앞이 위험물이라면 1칸 먼저 접근 후 도약
          if (!isHaz(tile1) && tile1 !== 2 && isHaz(tile2)) {
            curX += d.dx;
            curZ += d.dz;
            clauseManeuvers.push({
              type: 'RUN_PATH',
              points: [{ x: curX, z: curZ }],
              style: rules.runStyle,
              label: '🏃 도약 지점 접근',
              thought: '장애물 1칸 앞까지 도움닫기로 다가간다! 🏃'
            });
          }

          const targetHaz = isHaz(tile1) ? tile1 : tile2;
          const hazName =
            targetHaz === 11
              ? '지뢰'
              : targetHaz === 4
              ? '용암'
              : targetHaz === 0
              ? '낭떠러지'
              : '가시밭';

          const numMatch = clause.match(/(\d+)\s*칸/);
          let jumpDist = numMatch ? Math.min(3, Math.max(2, parseInt(numMatch[1], 10))) : 2;
          if (!numMatch && isHaz(getTile(curX + d.dx * 2, curZ + d.dz * 2)) && !isHaz(tile3)) {
            jumpDist = 3;
          }

          let landX = Math.max(0, Math.min(size - 1, curX + d.dx * jumpDist));
          let landZ = Math.max(0, Math.min(size - 1, curZ + d.dz * jumpDist));

          // 지능형 착지 보정: 2칸 착지 지점이 위험물이거나 벽이고 3칸 앞이 안전하면 3칸 도약으로 자동 연장!
          if (!numMatch && (isHaz(getTile(landX, landZ)) || getTile(landX, landZ) === 2)) {
            const alt3X = Math.max(0, Math.min(size - 1, curX + d.dx * 3));
            const alt3Z = Math.max(0, Math.min(size - 1, curZ + d.dz * 3));
            if (!isHaz(getTile(alt3X, alt3Z)) && getTile(alt3X, alt3Z) !== 2) {
              jumpDist = 3;
              landX = alt3X;
              landZ = alt3Z;
            }
          }

          clauseManeuvers.push({
            type: 'LEAP',
            target: { x: landX, z: landZ },
            jumpHeight: 0.95,
            label: `🦘 ${jumpDist}칸 공중 도약`,
            thought: `앞의 ${hazName}을(를) 힘차게 점프해서 단숨에 뛰어넘는다! 🦘✨`
          });
          clauseThoughts.push(`${i + 1}단계: 바로 앞 위험 구간(${hazName})을 점프로 뛰어넘기! 🦘`);
          curX = landX;
          curZ = landZ;
          continue;
        }
      }

      justUsedJumpPad = false;

      // 3) 방향 이동 절 (예: "아래로 5칸 움직인 다음", "오른쪽으로 돌아서", "아래로 내려가")
      if (explicitDir !== null && (!isGoalClause || i < clauses.length - 1)) {
        curDir = explicitDir;
        const numMatch = clause.match(/(\d+)\s*칸/);
        const isShort = /(?:살짝|조금|한\s*발짝|잠깐)/.test(clause);
        const maxSteps = numMatch
          ? Math.min(size - 1, parseInt(numMatch[1], 10))
          : isShort
          ? 1
          : size - 2;

        const nextHasGoal = /(?:보석|목적지|골인)/.test(nextClause);

        const stopBeforeObstacle = /(?:벽|장애물|가시|지뢰)\s*(?:닿기\s*전에|앞까지|앞에서|보이면|직전에)/.test(clause);

        const seg = this.traceDirectionalSegment(
          mapInfo,
          curX,
          curZ,
          curDir,
          maxSteps,
          {
            avoidSpike: clauseAvoidSpike,
            avoidHazard: clauseAvoidHazard,
            nextExplicitDir,
            stopAtGoalAxis: nextHasGoal || isGoalClause,
            hasExplicitTileCount: Boolean(numMatch),
            stopBeforeObstacle
          }
        );

        if (seg.points.length > 0) {
          const defaultLabel = seg.slidAroundWall
            ? `🏃 벽 돌아 ${DIRS[curDir].name} 주행`
            : `🏃 ${DIRS[curDir].name} 연속 주행`;
          const runLabel = dirResolution?.label || defaultLabel;

          let stepThoughtText = '';
          let actionThoughtText = '';

          if (dirResolution?.perspective === 'robot') {
            stepThoughtText = seg.slidAroundWall
              ? `${i + 1}단계: [로봇 시점] ${dirResolution.explanation}으로 벽을 우회 주행! 🤖🧱`
              : `${i + 1}단계: [로봇 시점] ${dirResolution.explanation}으로 방향 전환 주행! 🤖↪️`;
            actionThoughtText = seg.slidAroundWall
              ? `앞에 벽이 있어 내 시선 기준 ${dirResolution.explanation} 옆길로 돌아갈게! 💨`
              : `내 시선 기준 ${dirResolution.explanation}으로 꺾어서 시원하게 달린다! 🏃💨`;
          } else if (dirResolution?.perspective === 'screen') {
            stepThoughtText = seg.slidAroundWall
              ? `${i + 1}단계: [화면 시점] ${dirResolution.explanation} 방향 벽을 돌아 이동! 🖥️🧱`
              : `${i + 1}단계: [화면 시점] ${dirResolution.explanation} 방향으로 연속 이동! 🖥️➡️`;
            actionThoughtText = seg.slidAroundWall
              ? `화면 기준 ${dirResolution.explanation} 쪽에 벽이 막고 있으니 옆으로 돌게! 💨`
              : `화면에서 보이는 ${dirResolution.explanation} 방향으로 달려갈게! 🏃💨`;
          } else {
            stepThoughtText = seg.slidAroundWall
              ? `${i + 1}단계: 벽에 막히면 옆길로 자연스럽게 돌아서 ${DIRS[curDir].name} 이동! 🧱`
              : `${i + 1}단계: ${DIRS[curDir].name} 방향으로 연속 이동! 🏃`;
            actionThoughtText = seg.slidAroundWall
              ? '앞에 벽이 막고 있으니 옆 통로로 부드럽게 돌아서 계속 진행할게! 💨'
              : `지시대로 ${DIRS[curDir].name} 방향으로 매끄럽게 달린다! 🏃💨`;
          }

          clauseManeuvers.push({
            type: 'RUN_PATH',
            points: seg.points,
            style: rules.runStyle,
            label: runLabel,
            thought: actionThoughtText
          });
          clauseThoughts.push(stepThoughtText);
          curX = seg.endX;
          curZ = seg.endZ;
        }

        prevContext = {
          wasForward: true,
          lastDir: curDir,
          lastPerspective: dirResolution?.perspective || 'screen'
        };

        // 만약 같은 절 안에 "오른쪽 보석까지 달려가"처럼 목적지까지 포함됐고 아직 골인이 아니면 이어서 골인 직진
        if (isGoalClause && (curX !== goal.x || curZ !== goal.z)) {
          const goalSeg = this.traceCorridorToGoal(
            mapInfo,
            curX,
            curZ,
            curDir,
            clauseAvoidHazard || clauseAvoidSpike
          );
          if (goalSeg.points.length > 0) {
            clauseManeuvers.push({
              type: 'RUN_PATH',
              points: goalSeg.points,
              style: rules.runStyle,
              label: '🎯 보석 향해 골인 질주',
              thought: '보석이 바로 저기야! 멈추지 않고 골인 지점까지 달린다! 🌟'
            });
            curX = goalSeg.endX;
            curZ = goalSeg.endZ;
          }
        }
        continue;
      }

      // 4) 목적지/보석 직진 절 (예: "그대로 목적지까지 바라보고 직진", "가시를 피해 보석까지 달려가")
      if (isGoalClause || /(?:앞으로|직진|그대로|달려|전진|가)/.test(clause)) {
        if (isGoalClause) {
          const goalSeg = this.traceCorridorToGoal(
            mapInfo,
            curX,
            curZ,
            curDir,
            clauseAvoidHazard || clauseAvoidSpike
          );
          if (goalSeg.points.length > 0) {
            clauseManeuvers.push({
              type: 'RUN_PATH',
              points: goalSeg.points,
              style: rules.runStyle,
              label: '🎯 목적지까지 연속 주행',
              thought: '이제 목적지 보석을 바라보고 쭉 달려간다! 🎯💨'
            });
            clauseThoughts.push(`${i + 1}단계: 목적지 보석을 향해 직진 주행! 🎯`);
            curX = goalSeg.endX;
            curZ = goalSeg.endZ;
          }
        } else {
          const numMatch = clause.match(/(\d+)\s*칸/);
          const maxSteps = numMatch ? Math.min(size - 1, parseInt(numMatch[1], 10)) : 3;
          const seg = this.traceDirectionalSegment(
            mapInfo,
            curX,
            curZ,
            curDir,
            maxSteps,
            {
              avoidSpike: clauseAvoidSpike,
              avoidHazard: clauseAvoidHazard,
              nextExplicitDir,
              stopAtGoalAxis: false,
              hasExplicitTileCount: Boolean(numMatch)
            }
          );
          if (seg.points.length > 0) {
            clauseManeuvers.push({
              type: 'RUN_PATH',
              points: seg.points,
              style: rules.runStyle,
              label: '🏃 앞으로 연속 주행',
              thought: '바라보는 방향으로 쭉 달려간다! 🏃💨'
            });
            clauseThoughts.push(`${i + 1}단계: 바라보는 방향으로 전진! 🏃`);
            curX = seg.endX;
            curZ = seg.endZ;
          }
          prevContext = { wasForward: true, lastDir: curDir, lastPerspective: 'robot' };
        }
      }
    }

    return { clauseManeuvers, clauseThoughts };
  }

  /**
   * 자연어 절(Clause)과 현재 로봇 방향(curDir)을 바탕으로,
   * 좌표로 고정하지 않고 문맥에 따라 '로봇 기준(상대 회전)'인지 '화면 기준'인지 동적으로 판단합니다.
   *
   * @param {string} clause - 자연어 절 (예: "오른쪽으로 돌아", "화면 위로", "우회전해서")
   * @param {number} curDir - 로봇의 현재 시선 방향 인덱스 (0~3)
   * @param {object} prevContext - 직전 절 문맥 ({ wasForward: boolean, lastDir: number, lastPerspective: string })
   * @returns {object|null} { dir, perspective, actionType, label, explanation }
   */
  resolveClauseDirection(clause, curDir = 0, prevContext = {}) {
    if (!clause) return null;
    const text = clause.toLowerCase().trim();

    // 1) 명시적 로봇 기준 키워드 검출
    const explicitRobot = /(?:로봇|너|자신|본인|내\s*몸|주인공|기체)\s*(?:기준|시점|방향|시선|입장)/.test(text);
    // 2) 명시적 화면/플레이어 기준 키워드 검출
    const explicitScreen = /(?:화면|내\s*기준|보는\s*기준|모니터|카메라|시점|유저|플레이어)\s*(?:기준|시점|방향)/.test(text);

    // 3) 회전 동사 검출 ("돌아", "돌아서", "꺾어", "꺾어서", "틀어", "틀어서", "우회전", "좌회전", "유턴")
    const hasTurnVerb = /(?:돌아|돌아서|돌고|꺾어|꺾어서|꺾고|틀어|틀어서|틀고|우회전|좌회전|유턴)/.test(text);

    // 4) 직진/앞/뒤/후진 검출
    const isForward = /(?:앞으로|직진|전진|바라보는|보던\s*방향|정면)/.test(text);
    const isBackward = /(?:뒤로|후진|퇴각|뒤돌|유턴|뒤쪽)/.test(text);

    // 5) 대각선 (화면 아이소메트릭 사분면 명시)
    if (/(?:우상단|우측\s*상단|오른쪽\s*위)/.test(text)) {
      return {
        dir: 2, // 북(-Z)
        perspective: 'screen',
        actionType: 'screen_diag',
        label: '↗️ 화면 우상단(북쪽) 이동',
        explanation: '화면 우상단(북쪽, -Z)'
      };
    }
    if (/(?:우하단|우측\s*하단|오른쪽\s*아래)/.test(text)) {
      return {
        dir: 1, // 동(+X)
        perspective: 'screen',
        actionType: 'screen_diag',
        label: '↘️ 화면 우하단(동쪽) 이동',
        explanation: '화면 우하단(동쪽, +X)'
      };
    }
    if (/(?:좌상단|좌측\s*상단|왼쪽\s*위)/.test(text)) {
      return {
        dir: 3, // 서(-X)
        perspective: 'screen',
        actionType: 'screen_diag',
        label: '↖️ 화면 좌상단(서쪽) 이동',
        explanation: '화면 좌상단(서쪽, -X)'
      };
    }
    if (/(?:좌하단|좌측\s*하단|왼쪽\s*아래)/.test(text)) {
      return {
        dir: 0, // 남(+Z)
        perspective: 'screen',
        actionType: 'screen_diag',
        label: '↙️ 화면 좌하단(남쪽) 이동',
        explanation: '화면 좌하단(남쪽, +Z)'
      };
    }

    // 6) 절대 방위 (동/서/남/북)
    if (/(?:동쪽|동편)/.test(text)) {
      return { dir: 1, perspective: 'compass', actionType: 'compass', label: '🧭 동쪽(+X) 이동', explanation: '절대 방위 동쪽(+X)' };
    }
    if (/(?:서쪽|서편)/.test(text)) {
      return { dir: 3, perspective: 'compass', actionType: 'compass', label: '🧭 서쪽(-X) 이동', explanation: '절대 방위 서쪽(-X)' };
    }
    if (/(?:남쪽|남편)/.test(text)) {
      return { dir: 0, perspective: 'compass', actionType: 'compass', label: '🧭 남쪽(+Z) 이동', explanation: '절대 방위 남쪽(+Z)' };
    }
    if (/(?:북쪽|북편)/.test(text)) {
      return { dir: 2, perspective: 'compass', actionType: 'compass', label: '🧭 북쪽(-Z) 이동', explanation: '절대 방위 북쪽(-Z)' };
    }

    // 7) 전진 / 후진 처리
    if (isForward && !/(?:오른쪽|우측|왼쪽|좌측|위|아래)/.test(text)) {
      return {
        dir: curDir,
        perspective: 'robot',
        actionType: 'forward',
        label: '⬆️ 정면 직진 주행',
        explanation: `현재 시선 앞쪽(${DIRS[curDir]?.shortName || DIRS[curDir]?.name})`
      };
    }
    if (isBackward) {
      const backDir = (curDir + 2) % 4;
      return {
        dir: backDir,
        perspective: 'robot',
        actionType: 'backward',
        label: '🔄 180도 뒤돌아 주행',
        explanation: `뒤로 180도 돌아서 ${DIRS[backDir]?.shortName || DIRS[backDir]?.name}`
      };
    }

    // 8) 오른쪽 / 왼쪽 판단 (핵심: 로봇 기준 vs 화면 기준 동적 분기)
    const hasRight = /(?:오른쪽|우측|오른편|우회전)/.test(text);
    const hasLeft = /(?:왼쪽|좌측|왼편|좌회전)/.test(text);

    if (hasRight || hasLeft) {
      // 로봇 기준으로 판단하는 조건:
      // 1. "로봇 기준", "너 기준", "내 몸 기준" 등 명시
      // 2. "우회전", "좌회전" 단어 사용
      // 3. "돌아", "돌아서", "꺾어", "꺾어서", "틀어", "틀어서" 등 회전 동작 동사 포함
      // 4. "화면 기준"이 아니고 직전 절이 직진/전진이었을 때
      const isRobotRelative =
        explicitRobot ||
        hasTurnVerb ||
        /(?:우회전|좌회전)/.test(text) ||
        (!explicitScreen && prevContext.wasForward);

      if (isRobotRelative) {
        if (hasRight) {
          const targetDir = (curDir + 1) % 4;
          return {
            dir: targetDir,
            perspective: 'robot',
            actionType: 'turn_right',
            label: `↪️ [로봇 우회전] ${DIRS[targetDir]?.shortName || DIRS[targetDir]?.name}`,
            explanation: `현재 시선(${DIRS[curDir]?.shortName || DIRS[curDir]?.name}) 기준 오른쪽(우회전)인 ${DIRS[targetDir]?.shortName || DIRS[targetDir]?.name}`
          };
        } else {
          const targetDir = (curDir + 3) % 4;
          return {
            dir: targetDir,
            perspective: 'robot',
            actionType: 'turn_left',
            label: `↩️ [로봇 좌회전] ${DIRS[targetDir]?.shortName || DIRS[targetDir]?.name}`,
            explanation: `현재 시선(${DIRS[curDir]?.shortName || DIRS[curDir]?.name}) 기준 왼쪽(좌회전)인 ${DIRS[targetDir]?.shortName || DIRS[targetDir]?.name}`
          };
        }
      } else {
        // 화면/좌표 기준
        if (hasRight) {
          return {
            dir: 1, // 동(+X)
            perspective: 'screen',
            actionType: 'screen_right',
            label: '➡️ [화면 시점] 오른쪽 주행',
            explanation: '화면 오른쪽(동쪽, +X)'
          };
        } else {
          return {
            dir: 3, // 서(-X)
            perspective: 'screen',
            actionType: 'screen_left',
            label: '⬅️ [화면 시점] 왼쪽 주행',
            explanation: '화면 왼쪽(서쪽, -X)'
          };
        }
      }
    }

    // 9) 위 / 아래 판단 (화면/맵 수직 축)
    if (/(?:위쪽|위로|올라|북쪽)/.test(text)) {
      return {
        dir: 2, // 북(-Z)
        perspective: 'screen',
        actionType: 'screen_up',
        label: '⬆️ [화면 시점] 위쪽 주행',
        explanation: '화면 위쪽(북쪽, -Z)'
      };
    }
    if (/(?:아래|아래쪽|내려|남쪽)/.test(text)) {
      return {
        dir: 0, // 남(+Z)
        perspective: 'screen',
        actionType: 'screen_down',
        label: '⬇️ [화면 시점] 아래쪽 주행',
        explanation: '화면 아래쪽(남쪽, +Z)'
      };
    }

    return null;
  }

  extractDirectionFromClause(clause, curDir = 0, prevContext = {}) {
    const res = this.resolveClauseDirection(clause, curDir, prevContext);
    return res ? res.dir : null;
  }

  /**
   * 파란 점프대(5)까지 이동한 뒤 점프대 방향으로 2칸 슈퍼 도약하는 기동 생성
   */
  planJumpPadSegment(mapInfo, startX, startZ, curDir, runStyle) {
    const { size, grid } = mapInfo;
    const getTile = (x, z) => {
      if (x < 0 || x >= size || z < 0 || z >= size) return 0;
      return grid[z][x];
    };

    // 맵 내의 점프대(5) 찾기
    let padPos = null;
    for (let z = 0; z < size; z++) {
      for (let x = 0; x < size; x++) {
        if (grid[z][x] === 5) {
          padPos = { x, z };
          break;
        }
      }
      if (padPos) break;
    }
    if (!padPos) return null;

    const approachPoints = [];
    let cx = startX;
    let cz = startZ;

    while (cx !== padPos.x || cz !== padPos.z) {
      if (cz !== padPos.z) {
        cz += Math.sign(padPos.z - cz);
      } else if (cx !== padPos.x) {
        cx += Math.sign(padPos.x - cx);
      }
      approachPoints.push({ x: cx, z: cz });
      if (approachPoints.length > size * 2) break;
    }

    // 점프대 진입 방향 계산 (기본: 아래 +Z 또는 직전 이동 방향)
    let jumpDir = curDir;
    if (approachPoints.length >= 1) {
      const prev =
        approachPoints.length >= 2
          ? approachPoints[approachPoints.length - 2]
          : { x: startX, z: startZ };
      const dx = padPos.x - prev.x;
      const dz = padPos.z - prev.z;
      if (dz > 0) jumpDir = 0;
      else if (dx > 0) jumpDir = 1;
      else if (dz < 0) jumpDir = 2;
      else if (dx < 0) jumpDir = 3;
    }

    // 만약 진입 방향 2칸 앞이 막혀 있거나 용암 건너편 바닥이 다른 방향이면 용암(4)을 건너는 방향 선택
    for (let dIdx = 0; dIdx < 4; dIdx++) {
      const cand = DIRS[(jumpDir + dIdx) % 4];
      const midTile = getTile(padPos.x + cand.dx, padPos.z + cand.dz);
      const landTile = getTile(padPos.x + cand.dx * 2, padPos.z + cand.dz * 2);
      if (midTile === 4 && (landTile === 1 || landTile === 9)) {
        jumpDir = (jumpDir + dIdx) % 4;
        break;
      }
    }

    const d = DIRS[jumpDir];
    const landX = Math.max(0, Math.min(size - 1, padPos.x + d.dx * 2));
    const landZ = Math.max(0, Math.min(size - 1, padPos.z + d.dz * 2));

    const maneuvers = [];
    if (approachPoints.length > 0) {
      maneuvers.push({
        type: 'RUN_PATH',
        points: approachPoints,
        style: runStyle,
        label: '🏃 파란 점프대 진입',
        thought: '파란 점프대 발판 위로 달려간다! 🏃💨'
      });
    }
    maneuvers.push({
      type: 'LEAP',
      target: { x: landX, z: landZ },
      jumpHeight: 1.25,
      label: '🚀 점프대 슈퍼 도약',
      thought: '파란 점프대를 밟고 뜨거운 용암 위를 날아오른다! 🚀✨'
    });

    return {
      maneuvers,
      endX: landX,
      endZ: landZ,
      endDir: jumpDir
    };
  }

  /**
   * 차원 워프 포탈(7)까지 접근한 뒤 반대편 연결 포탈로 순간이동하는 기동 생성
   */
  planPortalSegment(mapInfo, startX, startZ, runStyle) {
    const { size, grid, portalPairs = [] } = mapInfo;

    // 현재 위치에서 가장 가까운 포탈(7) 찾기
    const portals = [];
    for (let z = 0; z < size; z++) {
      for (let x = 0; x < size; x++) {
        if (grid[z][x] === 7) {
          portals.push({ x, z, dist: Math.hypot(x - startX, z - startZ) });
        }
      }
    }
    if (portals.length === 0) return null;

    portals.sort((a, b) => a.dist - b.dist);
    const targetPortal = portals[0];

    // 반대편 포탈 찾기
    let destPortal = null;
    const pair = portalPairs.find(
      (p) =>
        (p.from.x === targetPortal.x && p.from.z === targetPortal.z) ||
        (p.to.x === targetPortal.x && p.to.z === targetPortal.z)
    );

    if (pair) {
      destPortal = pair.from.x === targetPortal.x && pair.from.z === targetPortal.z ? pair.to : pair.from;
    } else {
      destPortal = portals.find((p) => p.x !== targetPortal.x || p.z !== targetPortal.z) || targetPortal;
    }

    const approachPoints = [];
    let cx = startX;
    let cz = startZ;

    while (cx !== targetPortal.x || cz !== targetPortal.z) {
      if (cx !== targetPortal.x) {
        cx += Math.sign(targetPortal.x - cx);
      } else if (cz !== targetPortal.z) {
        cz += Math.sign(targetPortal.z - cz);
      }
      approachPoints.push({ x: cx, z: cz });
      if (approachPoints.length > size * 2) break;
    }

    const maneuvers = [];
    if (approachPoints.length > 0) {
      maneuvers.push({
        type: 'RUN_PATH',
        points: approachPoints,
        style: runStyle,
        label: '🌀 차원 포탈 접근',
        thought: '차원 워프 포탈 속으로 뛰어든다! 🌀'
      });
    }

    return {
      maneuvers,
      endX: destPortal.x,
      endZ: destPortal.z
    };
  }

  /**
   * 미끄러운 얼음판(6)까지 접근한 뒤 가던 방향으로 1칸 추가 미끄러지는 기동 생성
   */
  planIceSegment(mapInfo, startX, startZ, curDir, runStyle) {
    const { size, grid } = mapInfo;
    const getTile = (x, z) => {
      if (x < 0 || x >= size || z < 0 || z >= size) return 0;
      return grid[z][x];
    };

    // 현재 위치 주변 2칸 내 또는 맵 내 가장 가까운 얼음판(6) 찾기
    const ices = [];
    for (let z = 0; z < size; z++) {
      for (let x = 0; x < size; x++) {
        if (grid[z][x] === 6) {
          ices.push({ x, z, dist: Math.hypot(x - startX, z - startZ) });
        }
      }
    }
    if (ices.length === 0) return null;

    ices.sort((a, b) => a.dist - b.dist);
    const targetIce = ices[0];

    const approachPoints = [];
    let cx = startX;
    let cz = startZ;

    while (cx !== targetIce.x || cz !== targetIce.z) {
      if (cx !== targetIce.x) {
        cx += Math.sign(targetIce.x - cx);
      } else if (cz !== targetIce.z) {
        cz += Math.sign(targetIce.z - cz);
      }
      approachPoints.push({ x: cx, z: cz });
      if (approachPoints.length > size * 2) break;
    }

    // 얼음판에 도달한 후, 진입 방향으로 1칸 더 쭈욱 미끄러짐!
    let slideDir = DIRS[curDir];
    if (approachPoints.length >= 2) {
      const prev = approachPoints[approachPoints.length - 2];
      const dx = targetIce.x - prev.x;
      const dz = targetIce.z - prev.z;
      if (dx !== 0 || dz !== 0) {
        slideDir = { dx: Math.sign(dx), dz: Math.sign(dz) };
      }
    }

    const slideX = Math.max(0, Math.min(size - 1, targetIce.x + slideDir.dx));
    const slideZ = Math.max(0, Math.min(size - 1, targetIce.z + slideDir.dz));
    const slideTile = getTile(slideX, slideZ);

    const maneuvers = [];
    if (approachPoints.length > 0) {
      maneuvers.push({
        type: 'RUN_PATH',
        points: approachPoints,
        style: runStyle,
        label: '🧊 얼음판 진입',
        thought: '미끄러운 얼음판 위로 올라탄다! 🧊'
      });
    }

    if (slideTile !== 2 && (slideX !== targetIce.x || slideZ !== targetIce.z)) {
      maneuvers.push({
        type: 'RUN_PATH',
        points: [{ x: slideX, z: slideZ }],
        style: 'dash',
        label: '🧊 쭈욱 미끄러지기',
        thought: '얼음판 물리 효과로 가던 방향으로 1칸 쭈욱 미끄러진다! 💨'
      });
      return {
        maneuvers,
        endX: slideX,
        endZ: slideZ
      };
    }

    return {
      maneuvers,
      endX: targetIce.x,
      endZ: targetIce.z
    };
  }

  /**
   * 특정 방향(dirIdx)으로 연속 이동하되,
   * 진행 방향 바로 앞을 벽(2)이나 위험물(가시/용암/지뢰)이 가로막으면 2칸 센서로 감지하여 안전하게 우회하거나,
   * 얼음판/컨베이어 기믹에 올라탔을 때 물리 효과를 경로에 정확히 반영합니다.
   */
  traceDirectionalSegment(mapInfo, startX, startZ, dirIdx, maxSteps, opts = {}) {
    const { size, grid, goal } = mapInfo;
    const getTile = (x, z) => {
      if (x < 0 || x >= size || z < 0 || z >= size) return 0;
      return grid[z][x];
    };

    const isHazard = (t) => t === 0 || t === 3 || t === 4 || t === 11;
    const d = DIRS[dirIdx];
    const points = [];
    let cx = startX;
    let cz = startZ;
    let slidAroundWall = false;
    let stepsTaken = 0;

    while (stepsTaken < maxSteps) {
      // 다음 절이 목적지 직진이거나 수직 방향 전환일 때, 골인 라인과 정렬되었으면 자연스럽게 정지
      if (opts.stopAtGoalAxis && stepsTaken > 0) {
        if (d.dz !== 0 && cz === goal.z) break;
        if (d.dx !== 0 && cx === goal.x) break;
      }

      const nx = cx + d.dx;
      const nz = cz + d.dz;

      // 맵 가장자리 도달 시 정지
      if (nx < 0 || nx >= size || nz < 0 || nz >= size) break;

      const nextTile = getTile(nx, nz);

      // 조건부 정지 키워드("벽 닿기 전에", "가시 앞까지만" 등) 감지 시 장애물 바로 앞에서 정지
      if (opts.stopBeforeObstacle) {
        if (nextTile === 2 || isHazard(nextTile)) {
          break;
        }
      }

      // 1) 앞에 벽(2)이 가로막고 있는 경우: 1~2칸 옆으로 돌아서 전진!
      if (nextTile === 2) {
        if (stepsTaken > 0 && opts.nextExplicitDir !== null && opts.nextExplicitDir !== undefined) {
          const nd = DIRS[opts.nextExplicitDir];
          const turnTile = getTile(cx + nd.dx, cz + nd.dz);
          if (turnTile !== 2 && turnTile !== 0) {
            break;
          }
        }

        const slidePts = this.findLocalWallSlide(
          mapInfo,
          cx,
          cz,
          dirIdx,
          opts.avoidHazard || opts.avoidSpike
        );
        if (slidePts && slidePts.length > 0) {
          slidAroundWall = true;
          for (const pt of slidePts) {
            points.push(pt);
            cx = pt.x;
            cz = pt.z;
          }
          stepsTaken += 2;
          continue;
        } else {
          break;
        }
      }

      // 2) 앞에 위험물(가시 3, 용암 4, 지뢰 11, 낭떠러지 0)이 있는 경우:
      // 회피 지시(avoidHazard / avoidSpike)가 있으면 센서로 감지하고 옆으로 안전하게 1칸 곡선 우회!
      if (isHazard(nextTile) && (opts.avoidHazard || opts.avoidSpike)) {
        const hazardDetour = this.findLocalHazardSidestep(mapInfo, cx, cz, dirIdx);
        if (hazardDetour && hazardDetour.length > 0) {
          for (const pt of hazardDetour) {
            points.push(pt);
            cx = pt.x;
            cz = pt.z;
          }
          stepsTaken += 2;
          continue;
        } else {
          // 우회로가 없는 경우 위험물 바로 앞에서 정지
          break;
        }
      }

      // 3) 2칸 앞 위험물 사전 감지:
      // 유저가 구체적 칸 수를 말하지 않았고, 1칸 앞은 안전하지만 2칸 앞이 위험물인 경우 위험물 1칸 앞까지만 가고 대기
      if (!opts.hasExplicitTileCount && stepsTaken > 0) {
        const tileAhead2 = getTile(nx + d.dx, nz + d.dz);
        if (isHazard(tileAhead2) && (opts.avoidHazard || opts.avoidSpike)) {
          cx = nx;
          cz = nz;
          points.push({ x: cx, z: cz });
          stepsTaken++;
          break;
        }
      }

      // 4) 🧊 얼음판(6) 기믹 처리: 밟으면 이동 방향으로 1칸 더 쭈욱 미끄러짐!
      if (nextTile === 6) {
        cx = nx;
        cz = nz;
        points.push({ x: cx, z: cz });
        stepsTaken++;

        const slideX = cx + d.dx;
        const slideZ = cz + d.dz;
        const slideTile = getTile(slideX, slideZ);
        if (slideTile !== 2 && slideX >= 0 && slideX < size && slideZ >= 0 && slideZ < size) {
          // 지능형 얼음판 생존: 미끄러져 들어간 곳이 위험물이고 회피 지시가 있으면 얼음판 위에서 감속 정지!
          if (isHazard(slideTile) && (opts.avoidHazard || opts.avoidSpike)) {
            break;
          }
          cx = slideX;
          cz = slideZ;
          points.push({ x: cx, z: cz });
          stepsTaken++;
          if (isHazard(slideTile) || slideTile === 9) {
            break;
          }
        }
        continue;
      }

      // 5) ⏩ 컨베이어 벨트(8) 기믹 처리: 벨트 방향으로 1칸 밀려남!
      if (nextTile === 8) {
        cx = nx;
        cz = nz;
        points.push({ x: cx, z: cz });
        stepsTaken++;

        const conveyors = mapInfo.conveyors || [];
        const cCfg = conveyors.find((c) => c.x === cx && c.z === cz);
        const cDir = cCfg?.dir || { dx: 1, dz: 0 };
        const pushX = cx + cDir.dx;
        const pushZ = cz + cDir.dz;
        const pushTile = getTile(pushX, pushZ);
        if (pushTile !== 2 && pushX >= 0 && pushX < size && pushZ >= 0 && pushZ < size) {
          cx = pushX;
          cz = pushZ;
          points.push({ x: cx, z: cz });
          stepsTaken++;
          if (isHazard(pushTile) || pushTile === 9) {
            break;
          }
        }
        continue;
      }

      // 6) 일반 바닥 이동
      cx = nx;
      cz = nz;
      points.push({ x: cx, z: cz });
      stepsTaken++;

      if (isHazard(nextTile) || nextTile === 9) {
        break;
      }
    }

    return {
      points,
      endX: cx,
      endZ: cz,
      slidAroundWall
    };
  }

  /**
   * 진행 방향(dirIdx) 바로 앞이 벽(2)일 때,
   * 좌/우 1~2칸 옆으로 비켜서 벽 너머로 전진하는 로컬 우회 경로를 찾습니다.
   */
  findLocalWallSlide(mapInfo, cx, cz, dirIdx, avoidHazard = false) {
    const { size, grid, goal } = mapInfo;
    const getTile = (x, z) => {
      if (x < 0 || x >= size || z < 0 || z >= size) return 0;
      return grid[z][x];
    };

    const isSafePass = (x, z) => {
      const t = getTile(x, z);
      if (t === 0 || t === 2 || t === 4 || t === 11) return false;
      if (t === 3 && avoidHazard) return false;
      return true;
    };

    const d = DIRS[dirIdx];
    const perpDirs = [
      { px: -d.dz, pz: d.dx },
      { px: d.dz, pz: -d.dx }
    ];

    let bestPath = null;
    let bestScore = Infinity;

    for (const { px, pz } of perpDirs) {
      for (let sideDist = 1; sideDist <= 2; sideDist++) {
        const sidePoints = [];
        let sideClear = true;
        for (let s = 1; s <= sideDist; s++) {
          const sx = cx + px * s;
          const sz = cz + pz * s;
          if (!isSafePass(sx, sz)) {
            sideClear = false;
            break;
          }
          sidePoints.push({ x: sx, z: sz });
        }
        if (!sideClear) continue;

        const lastSide = sidePoints[sidePoints.length - 1];
        const pass1 = { x: lastSide.x + d.dx, z: lastSide.z + d.dz };
        if (!isSafePass(pass1.x, pass1.z)) continue;

        const candidate = [...sidePoints, pass1];
        const pass2 = { x: pass1.x + d.dx, z: pass1.z + d.dz };
        if (isSafePass(pass2.x, pass2.z)) {
          candidate.push(pass2);
          const back = { x: pass2.x - px, z: pass2.z - pz };
          if (isSafePass(back.x, back.z)) {
            candidate.push(back);
          }
        }

        const endPt = candidate[candidate.length - 1];
        const score =
          sideDist * 2 +
          Math.abs(endPt.x - goal.x) * 0.2 +
          Math.abs(endPt.z - goal.z) * 0.2;
        if (score < bestScore) {
          bestScore = score;
          bestPath = candidate;
        }
      }
    }

    return bestPath;
  }

  /**
   * 진행 방향 바로 앞 칸이 위험물(가시 3, 용암 4, 지뢰 11, 낭떠러지 0)일 때
   * 좌우 2칸 센서로 안전한 바닥을 찾아 옆으로 1칸 비켜서 지나가는 로컬 곡선 경로
   */
  findLocalHazardSidestep(mapInfo, cx, cz, dirIdx) {
    const { size, grid, goal } = mapInfo;
    const getTile = (x, z) => {
      if (x < 0 || x >= size || z < 0 || z >= size) return 0;
      return grid[z][x];
    };
    const isSafe = (x, z) => {
      const t = getTile(x, z);
      return t === 1 || t === 6 || t === 7 || t === 8 || t === 9 || t === 10;
    };

    const d = DIRS[dirIdx];
    const perpDirs = [
      { px: -d.dz, pz: d.dx },
      { px: d.dz, pz: -d.dx }
    ];

    // 골인 지점에 더 가까운 옆 방향 우선
    perpDirs.sort((a, b) => {
      const da = Math.abs(cx + a.px - goal.x) + Math.abs(cz + a.pz - goal.z);
      const db = Math.abs(cx + b.px - goal.x) + Math.abs(cz + b.pz - goal.z);
      return da - db;
    });

    for (const { px, pz } of perpDirs) {
      const s1 = { x: cx + px, z: cz + pz };
      const s2 = { x: s1.x + d.dx, z: s1.z + d.dz };
      if (isSafe(s1.x, s1.z) && isSafe(s2.x, s2.z)) {
        const res = [s1, s2];
        const s3 = { x: s2.x + d.dx, z: s2.z + d.dz };
        if (isSafe(s3.x, s3.z)) {
          res.push(s3);
        }
        return res;
      }
    }
    return null;
  }

  /** 하위 호환용 alias */
  findLocalSpikeSidestep(mapInfo, cx, cz, dirIdx) {
    return this.findLocalHazardSidestep(mapInfo, cx, cz, dirIdx);
  }

  /**
   * 앞선 절들을 통해 이동한 현재 위치(startX, startZ)에서
   * 목적지 보석(goal)을 향해 뻗은 통로를 따라 이동합니다.
   */
  traceCorridorToGoal(mapInfo, startX, startZ, curDir, avoidSpike = false) {
    const { size, grid, goal } = mapInfo;
    const getTile = (x, z) => {
      if (x < 0 || x >= size || z < 0 || z >= size) return 0;
      return grid[z][x];
    };

    let cx = startX;
    let cz = startZ;
    const points = [];
    const visited = new Set([`${cx},${cz}`]);

    for (let step = 0; step < size * 2; step++) {
      if (cx === goal.x && cz === goal.z) break;

      const dxGoal = Math.sign(goal.x - cx);
      const dzGoal = Math.sign(goal.z - cz);

      // 현재 위치에서 골인 방향으로 줄어드는 후보 방향들
      const candidates = [];
      if (dxGoal !== 0) candidates.push({ dx: dxGoal, dz: 0, dirIdx: dxGoal > 0 ? 1 : 3 });
      if (dzGoal !== 0) candidates.push({ dx: 0, dz: dzGoal, dirIdx: dzGoal > 0 ? 0 : 2 });

      // 현재 바라보는 방향과 일치하는 축을 먼저 시도
      candidates.sort((a, b) => (a.dirIdx === curDir ? -1 : b.dirIdx === curDir ? 1 : 0));

      let moved = false;
      for (const cand of candidates) {
        const nx = cx + cand.dx;
        const nz = cz + cand.dz;
        const t = getTile(nx, nz);

        if (t === 2) {
          // 직진 통로에 벽 1개가 막고 있으면 로컬 벽 미끄러짐 시도
          const slide = this.findLocalWallSlide(mapInfo, cx, cz, cand.dirIdx, avoidSpike);
          if (slide && slide.length > 0) {
            for (const pt of slide) {
              points.push(pt);
              cx = pt.x;
              cz = pt.z;
              visited.add(`${cx},${cz}`);
            }
            moved = true;
            break;
          }
          continue;
        }

        const isHaz = (tile) => tile === 0 || tile === 3 || tile === 4 || tile === 11;
        if (isHaz(t) && avoidSpike) {
          const sidestep = this.findLocalHazardSidestep(mapInfo, cx, cz, cand.dirIdx);
          if (sidestep && sidestep.length > 0) {
            for (const pt of sidestep) {
              points.push(pt);
              cx = pt.x;
              cz = pt.z;
              visited.add(`${cx},${cz}`);
            }
            moved = true;
            break;
          }
          continue;
        }

        if (!visited.has(`${nx},${nz}`)) {
          cx = nx;
          cz = nz;
          points.push({ x: cx, z: cz });
          visited.add(`${cx},${cz}`);
          moved = true;
          if (t === 3 || t === 4 || t === 0 || t === 9) {
            return { points, endX: cx, endZ: cz };
          }
          break;
        }
      }

      if (!moved) break;
    }

    return { points, endX: cx, endZ: cz };
  }

  /**
   * 주행 도중 미처 예상치 못한 벽에 부딪혔을 때:
   * 절대 맵 전체의 골인 지점까지 혼자 길을 다 찾지 않고,
   * 오직 눈앞의 벽 블록 1개만 옆으로 살짝 비켜가는 짧은 우회 기동만 반환합니다.
   */
  rerouteAfterWallBump(mapInfo, robotState, prevRules = {}) {
    if (prevRules.isLazy) {
      return [];
    }

    const slidePts = this.findLocalWallSlide(
      mapInfo,
      robotState.x,
      robotState.z,
      robotState.dir ?? 0,
       Boolean(prevRules.avoidSpike)
    );

    if (!slidePts || slidePts.length === 0) {
      return [];
    }

    return [
      {
        type: 'RUN_PATH',
        points: slidePts,
        style: prevRules.runStyle || 'normal',
        label: '🔄 눈앞 벽 살짝 비켜가기',
        thought: '앗, 앞에 벽이 있네! 바로 옆 칸으로 살짝 돌아서 이어서 가볼게! 🧱💨'
      }
    ];
  }
}
