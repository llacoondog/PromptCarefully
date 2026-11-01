/**
 * AI 모듈: 1칸씩 끊어지는 코딩형 명령도 아니고, "알아서 가"라고 했을 때 혼자 미로를 다 푸는 천재 AI도 아닌,
 * 유저가 자연어로 지시한 순서(절/문맥)와 위험 요소만 고지식하게 따라 연속 3D 경로(Maneuvers)로 움직이는 로봇 AI
 */

const API_TIMEOUT_MS = 3200;

export const DEFAULT_PROXY_URL = 'https://promptcarefully.asdfjiwoo.workers.dev';

const DIRS = [
  { dx: 0, dz: 1, name: '아래(+Z)' },  // 0: Down (+Z)
  { dx: 1, dz: 0, name: '오른쪽(+X)' }, // 1: Right (+X)
  { dx: 0, dz: -1, name: '위(-Z)' },   // 2: Up (-Z)
  { dx: -1, dz: 0, name: '왼쪽(-X)' }  // 3: Left (-X)
];

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

    const promptText = `당신은 3D 복셀 액션 게임 "Prompt Carefully"의 귀엽고 고지식한 길치 로봇입니다.
유저가 구체적인 방향(오른쪽/아래 등)과 장애물 대처법(가시 점프, 파란 점프대 밟기 등)을 순서대로 알려주면 그에 맞춰 생각하고 움직이지만,
만약 유저가 "알아서 가", "적당히 피해가", "안전하게 다 피해 가", "그냥 보석으로 가"처럼 대충 명령하면 어떻게 가야 할지 몰라 투덜대며 무작정 앞만 보고 돌진하다 함정에 빠집니다!

고민하지 말고 즉시 아래 줄 형식으로만 답하세요:
STEP: (유저의 명령을 듣고 로봇이 첫 번째로 한 생각 - 친근한 반말, 대충 명령했으면 투덜대기)
STEP: (구체적으로 어떻게 움직일지 또는 왜 무작정 직진할지 두 번째 생각 - 친근한 반말)
FINAL: (출발 직전 외치는 짧은 한마디!)

유저 명령: "${userPrompt}"`;

    const generationConfig = {
      maxOutputTokens: 180
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

    // 2. "알아서 가", "안전하게 다 피해", "보석으로 가" 등 너무 추상적이거나 떠넘기는 명령인지 판별
    const hasLazyDelegation =
      /(?:알아서|마음대로|맘대로|적당히|스스로|자동으로|대충|아무렇게나|네가\s*알아|니가\s*알아|혼자서|멋대로)/.test(
        text
      );
    const hasVagueCatchAll =
      /(?:모든\s*함정|다\s*피해|모두\s*피해|전부\s*피해|위험한\s*거\s*다|장애물\s*다)/.test(text);

    const hasExplicitDir =
      /(?:오른쪽|우측|동쪽|왼쪽|좌측|서쪽|아래|남쪽|내려|위쪽|위로|북쪽|올라)/.test(text);
    const hasJumpOrPadMechanic =
      /(?:점프|뛰어|폴짝|넘어|날아|도약|발판|파란|스프링|트램펄린|jump)/.test(text);
    const hasSpecificHazard = /(?:가시|뾰족|바늘|용암|불구덩이|낭떠러지)/.test(text);

    // 구체적인 방향 지시도 없고 점프/발판 지시도 없거나, "알아서 가"라고 떠넘긴 경우 → 허당 돌진!
    const isLazyPrompt =
      (hasLazyDelegation && clauses.length < 2) ||
      (hasVagueCatchAll && !hasExplicitDir && !hasJumpOrPadMechanic) ||
      (!hasExplicitDir && !hasJumpOrPadMechanic);

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
          runStyle
        }
      );
    }

    // 3. 정상적인 자연어 지시: 정찰 모션 후 절(Clause) 순서대로 경로 생성!
    maneuvers.push({
      type: 'EMOTE',
      emote: 'LOOK_AROUND',
      label: '👀 지형 스캔',
      thought: '어디 보자, 지시받은 순서대로 코스를 확인하는 중! 👀'
    });

    const rules = {
      isLazy: false,
      avoidSpike: /(?:가시|뾰족|바늘|찔리)/.test(text),
      jumpSpike: hasJumpOrPadMechanic,
      avoidWall: true,
      useJumpPad: /(?:점프대|발판|파란|스프링|트램펄린)/.test(text),
      runStyle
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
      thoughts.push('어느 쪽으로 돌지, 어디서 점프할지 안 알려주면 앞만 보고 달릴 수밖에 없어!');
    } else if (flags.hasVagueCatchAll) {
      thoughts.push('"다 피해서 안전하게"라고만 하면 어딜 어떻게 피하라는 거야?! 😵');
      thoughts.push('가시를 뛰어넘을지, 오른쪽이나 아래로 돌지 구체적으로 말해줘야지!');
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

    // 만약 가시만 언급하고 방향/점프를 전혀 안 알려준 경우:
    // 첫 번째 가시만 옆으로 1칸 피하는 척하다가 그대로 직진해서 다음 장애물에 걸리거나 멈춤!
    if (flags.hasSpecificHazard && !flags.hasLazyDelegation && !flags.hasVagueCatchAll) {
      const nextTile = getTile(curX + dir.dx, curZ + dir.dz);
      if (nextTile === 3) {
        // 오른쪽으로 살짝 비켜서 앞으로 직진 (결국 아래쪽 다른 가시나 벽에 막힘)
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
      /(?:오른쪽|우측|왼쪽|좌측|아래|위쪽|위로|앞으로|직진|점프|뛰어넘|발판|점프대|돌아|꺾어|내려|올라|달려|보석|목적지|골인|\d+\s*칸)/.test(
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

    const clauseManeuvers = [];
    const clauseThoughts = [];

    for (let i = 0; i < clauses.length; i++) {
      const clause = clauses[i];
      const nextClause = clauses[i + 1] || '';

      const explicitDir = this.extractDirectionFromClause(clause);
      const nextExplicitDir = this.extractDirectionFromClause(nextClause);

      const isPadClause = /(?:점프대|발판|파란|스프링|트램펄린)/.test(clause);
      const isJumpClause =
        !isPadClause && /(?:점프|뛰어|폴짝|넘어|날아|도약|jump)/.test(clause);
      const isGoalClause = /(?:보석|목적지|골인|끝까지)/.test(clause);
      const clauseAvoidSpike =
        /(?:가시|뾰족|바늘)/.test(clause) || rules.avoidSpike;

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

      // 2) 장애물(가시/용암) 점프 도약 절
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

          // 만약 1칸 앞은 일반 바닥(1)이고 2칸 앞이 가시(3)라면 1칸 먼저 접근 후 도약
          if (tile1 === 1 && (tile2 === 3 || tile2 === 4 || tile2 === 0)) {
            curX += d.dx;
            curZ += d.dz;
            clauseManeuvers.push({
              type: 'RUN_PATH',
              points: [{ x: curX, z: curZ }],
              style: rules.runStyle,
              label: '🏃 도약 지점 접근',
              thought: '장애물 바로 앞까지 도움닫기로 다가간다! 🏃'
            });
          }

          const numMatch = clause.match(/(\d+)\s*칸/);
          let jumpDist = numMatch ? Math.min(3, Math.max(2, parseInt(numMatch[1], 10))) : 2;
          if (
            !numMatch &&
            getTile(curX + d.dx * 2, curZ + d.dz * 2) === 3 &&
            getTile(curX + d.dx * 3, curZ + d.dz * 3) === 1
          ) {
            jumpDist = 3;
          }

          const landX = Math.max(0, Math.min(size - 1, curX + d.dx * jumpDist));
          const landZ = Math.max(0, Math.min(size - 1, curZ + d.dz * jumpDist));

          clauseManeuvers.push({
            type: 'LEAP',
            target: { x: landX, z: landZ },
            jumpHeight: 0.95,
            label: `🦘 ${jumpDist}칸 공중 도약`,
            thought: '앞의 가시밭을 힘차게 점프해서 단숨에 뛰어넘는다! 🦘✨'
          });
          clauseThoughts.push(`${ i + 1 }단계: 위험 구간을 점프로 뛰어넘기! 🦘`);
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

        const seg = this.traceDirectionalSegment(
          mapInfo,
          curX,
          curZ,
          curDir,
          maxSteps,
          {
            avoidSpike: clauseAvoidSpike,
            nextExplicitDir,
            stopAtGoalAxis: nextHasGoal || isGoalClause,
            hasExplicitTileCount: Boolean(numMatch)
          }
        );

        if (seg.points.length > 0) {
          clauseManeuvers.push({
            type: 'RUN_PATH',
            points: seg.points,
            style: rules.runStyle,
            label: seg.slidAroundWall
              ? `🏃 벽 돌아 ${DIRS[curDir].name} 주행`
              : `🏃 ${DIRS[curDir].name} 연속 주행`,
            thought: seg.slidAroundWall
              ? '앞에 벽이 막고 있으니 옆 통로로 부드럽게 돌아서 계속 진행할게! 💨'
              : `지시대로 ${DIRS[curDir].name} 방향으로 매끄럽게 달린다! 🏃💨`
          });
          clauseThoughts.push(
            seg.slidAroundWall
              ? `${i + 1}단계: 벽에 막히면 옆길로 자연스럽게 돌아서 ${DIRS[curDir].name} 이동! 🧱`
              : `${i + 1}단계: ${DIRS[curDir].name} 방향으로 연속 이동! 🏃`
          );
          curX = seg.endX;
          curZ = seg.endZ;
        }

        // 만약 같은 절 안에 "오른쪽 보석까지 달려가"처럼 목적지까지 포함됐고 아직 골인이 아니면 이어서 골인 직진
        if (isGoalClause && (curX !== goal.x || curZ !== goal.z)) {
          const goalSeg = this.traceCorridorToGoal(
            mapInfo,
            curX,
            curZ,
            curDir,
            clauseAvoidSpike
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
            clauseAvoidSpike
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
        }
      }
    }

    return { clauseManeuvers, clauseThoughts };
  }

  extractDirectionFromClause(clause) {
    if (!clause) return null;
    if (/(?:오른쪽|우측|동쪽|오른편)/.test(clause)) return 1; // +X
    if (/(?:왼쪽|좌측|서쪽|왼편)/.test(clause)) return 3; // -X
    if (/(?:아래|남쪽|내려)/.test(clause)) return 0; // +Z
    if (/(?:위쪽|위로|북쪽|올라)/.test(clause)) return 2; // -Z
    return null;
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
   * 특정 방향(dirIdx)으로 연속 이동하되,
   * 진행 방향 바로 앞을 벽(2)이 가로막으면 게임오버되지 않고
   * 벽 옆(1~2칸)의 열린 통로로 미끄러지듯 돌아서 원래 방향 이동을 이어갑니다!
   */
  traceDirectionalSegment(mapInfo, startX, startZ, dirIdx, maxSteps, opts = {}) {
    const { size, grid, goal } = mapInfo;
    const getTile = (x, z) => {
      if (x < 0 || x >= size || z < 0 || z >= size) return 0;
      return grid[z][x];
    };

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

      // 1) 앞에 벽(2)이 가로막고 있는 경우!
      if (nextTile === 2) {
        // 만약 이미 이동을 좀 했고, 다음 절에서 꺾을 방향(nextExplicitDir)이 현재 위치에서 열려 있다면 여기서 코너 회전 대기!
        if (stepsTaken > 0 && opts.nextExplicitDir !== null && opts.nextExplicitDir !== undefined) {
          const nd = DIRS[opts.nextExplicitDir];
          const turnTile = getTile(cx + nd.dx, cz + nd.dz);
          if (turnTile !== 2 && turnTile !== 0) {
            break;
          }
        }

        // 벽에 막혔을 때 옆으로 1~2칸 돌아서 원래 진행 방향(dirIdx)으로 계속 나아갈 수 있는지 탐색
        const slidePts = this.findLocalWallSlide(
          mapInfo,
          cx,
          cz,
          dirIdx,
          opts.avoidSpike
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
          // 더 이상 우회할 곳이 없는 외곽 벽이면 벽 앞까지만 이동
          break;
        }
      }

      // 2) 앞에 가시(3)가 있는 경우: 가시 회피를 지시받았으면 옆으로 1칸 곡선 회피!
      if (nextTile === 3 && opts.avoidSpike) {
        const spikeDetour = this.findLocalSpikeSidestep(mapInfo, cx, cz, dirIdx);
        if (spikeDetour && spikeDetour.length > 0) {
          for (const pt of spikeDetour) {
            points.push(pt);
            cx = pt.x;
            cz = pt.z;
          }
          stepsTaken += 2;
          continue;
        }
      }

      // 3) 일반 이동 (가시/용암 회피 지시가 없으면 그대로 밟고 사고 발생!)
      cx = nx;
      cz = nz;
      points.push({ x: cx, z: cz });
      stepsTaken++;

      if (nextTile === 3 || nextTile === 4 || nextTile === 0 || nextTile === 9) {
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
   * 좌/우 1~2칸 옆으로 비켜서 벽 너머로 전진하는 로컬 우회 경로를 찾습니다. (맵 전체 길찾기 아님!)
   */
  findLocalWallSlide(mapInfo, cx, cz, dirIdx, avoidSpike = false) {
    const { size, grid, goal } = mapInfo;
    const getTile = (x, z) => {
      if (x < 0 || x >= size || z < 0 || z >= size) return 0;
      return grid[z][x];
    };

    const isSafePass = (x, z) => {
      const t = getTile(x, z);
      if (t === 0 || t === 2 || t === 4) return false;
      if (t === 3 && avoidSpike) return false;
      return true;
    };

    const d = DIRS[dirIdx];
    const perpDirs = [
      { px: -d.dz, pz: d.dx },
      { px: d.dz, pz: -d.dx }
    ];

    // 골인 지점과 가까운 쪽 또는 더 짧은 우회로를 우선 탐색
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
          // 벽을 완전히 지나쳤다면 원래 라인 쪽으로 1칸 복귀 가능한지 확인
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
   * 진행 방향 바로 앞 칸이 가시(3)일 때 옆으로 1칸 비켜서 지나가는 로컬 곡선 경로
   */
  findLocalSpikeSidestep(mapInfo, cx, cz, dirIdx) {
    const { size, grid, goal } = mapInfo;
    const getTile = (x, z) => {
      if (x < 0 || x >= size || z < 0 || z >= size) return 0;
      return grid[z][x];
    };
    const isSafe = (x, z) => {
      const t = getTile(x, z);
      return t === 1 || t === 9;
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

        if (t === 3 && avoidSpike) {
          const sidestep = this.findLocalSpikeSidestep(mapInfo, cx, cz, cand.dirIdx);
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
