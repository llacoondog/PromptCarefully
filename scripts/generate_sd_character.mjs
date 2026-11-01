import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// .env 파일이 있으면 간이 파싱
function loadEnv() {
  const envPath = path.join(projectRoot, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnv();

// 기본 설정 및 프리셋
const MESHY_BASE_URL = 'https://api.meshy.ai/openapi/v2/text-to-3d';

const DEFAULT_PROMPT = 
  'A cute chibi anime girl, SD stylized character, big expressive eyes, adorable colorful outfit, futuristic casual jacket, 2.5 head proportions, clean game-ready asset, cel-shaded style, A-pose, standing';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    apiKey: process.env.MESHY_API_KEY || '',
    prompt: DEFAULT_PROMPT,
    output: path.join(projectRoot, 'assets', 'models', 'sd_girl.glb'),
    skipRefine: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--api-key' || arg === '-k') {
      options.apiKey = args[++i];
    } else if (arg === '--prompt' || arg === '-p') {
      options.prompt = args[++i];
    } else if (arg === '--output' || arg === '-o') {
      options.output = path.resolve(projectRoot, args[++i]);
    } else if (arg === '--skip-refine') {
      options.skipRefine = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
======================================================
  🎀 Meshy API - SD 미소녀 3D 캐릭터 모델 자동 생성기 🎀
======================================================
사용법:
  node scripts/generate_sd_character.mjs [옵션]

옵션:
  -k, --api-key <KEY>     Meshy API Key (또는 환경변수 MESHY_API_KEY)
  -p, --prompt <PROMPT>   생성 프롬프트 (기본: SD 치비 미소녀 프리셋)
  -o, --output <PATH>     저장할 .glb 경로 (기본: assets/models/sd_girl.glb)
      --skip-refine       Refine(텍스처링) 단계를 건너뛰고 Preview GLB만 다운로드
  -h, --help              도움말 출력

예시:
  node scripts/generate_sd_character.mjs -k msy_xxxxxx
  node scripts/generate_sd_character.mjs -k msy_xxxxxx -p "chibi anime girl with deep blue hair and pink inner hair, cute techwear"
  `);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchMeshy(endpoint, apiKey, method = 'GET', body = null) {
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };

  const response = await fetch(endpoint, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Meshy API 오류 (${response.status}): ${errText}`);
  }

  return await response.json();
}

async function pollTask(taskId, apiKey, stageName = '작업') {
  console.log(`\n⏳ [${stageName}] 생성 진행 중... (Task ID: ${taskId})`);
  const statusUrl = `${MESHY_BASE_URL}/${taskId}`;

  while (true) {
    const res = await fetchMeshy(statusUrl, apiKey);
    const status = res.status;
    const progress = res.progress !== undefined ? res.progress : 0;

    process.stdout.write(`\r👉 상태: ${status} | 진행률: ${progress}%  `);

    if (status === 'SUCCEEDED') {
      console.log(`\n✅ [${stageName}] 완료!`);
      return res;
    } else if (status === 'FAILED') {
      console.log(`\n❌ [${stageName}] 실패: ${res.task_error?.message || '알 수 없는 오류'}`);
      throw new Error(`Meshy 생성 실패: ${res.task_error?.message || ''}`);
    } else if (status === 'EXPIRED') {
      throw new Error('태스크가 만료되었습니다.');
    }

    await sleep(3500);
  }
}

async function downloadFile(url, destPath) {
  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  console.log(`📥 모델 다운로드 중: ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`다운로드 실패: ${res.statusText}`);

  const buffer = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(buffer));
  console.log(`✨ 저장 완료: ${path.relative(projectRoot, destPath)} (${(buffer.byteLength / (1024 * 1024)).toFixed(2)} MB)`);
}

async function main() {
  const options = parseArgs();

  if (!options.apiKey) {
    console.error(`\n❌ Meshy API 키가 설정되지 않았어!`);
    console.error(`다음 중 하나로 API 키를 전달해줘:`);
    console.error(`  1) node scripts/generate_sd_character.mjs --api-key <내_API_키>`);
    console.error(`  2) $env:MESHY_API_KEY="<내_API_키>" 설정 후 실행\n`);
    process.exit(1);
  }

  console.log(`\n🚀 SD 미소녀 3D 모델 생성을 시작할게!`);
  console.log(`📝 프롬프트: "${options.prompt}"`);
  console.log(`🎯 출력 경로: ${options.output}`);

  try {
    // 1단계: Preview (형상 지오메트리 생성)
    console.log(`\n[1/2] Preview 메시 생성 요청 중...`);
    const previewRes = await fetchMeshy(MESHY_BASE_URL, options.apiKey, 'POST', {
      mode: 'preview',
      prompt: options.prompt,
      ai_model: 'latest',
      pose_mode: 'a-pose'
    });

    const previewTaskId = previewRes.result;
    const previewTask = await pollTask(previewTaskId, options.apiKey, '1단계: Preview');

    let finalGlbUrl = previewTask.model_urls?.glb;

    // 2단계: Refine (고품질 텍스처링)
    if (!options.skipRefine) {
      console.log(`\n[2/2] Refine (텍스처링 및 디테일 완성) 요청 중...`);
      const refineRes = await fetchMeshy(MESHY_BASE_URL, options.apiKey, 'POST', {
        mode: 'refine',
        preview_task_id: previewTaskId
      });

      const refineTaskId = refineRes.result;
      const refineTask = await pollTask(refineTaskId, options.apiKey, '2단계: Refine');
      finalGlbUrl = refineTask.model_urls?.glb || finalGlbUrl;

      // 썸네일도 저장
      if (refineTask.thumbnail_url) {
        const thumbPath = options.output.replace(/\.glb$/i, '_thumb.png');
        try {
          await downloadFile(refineTask.thumbnail_url, thumbPath);
        } catch {
          // 썸네일 실패는 무시
        }
      }
    }

    if (!finalGlbUrl) {
      throw new Error('GLB 다운로드 URL을 찾을 수 없습니다.');
    }

    // 파일 다운로드
    await downloadFile(finalGlbUrl, options.output);

    console.log(`\n🎉 짜잔! SD 미소녀 3D 모델이 성공적으로 생성되었어!`);
    console.log(`경로: ${options.output}`);
    console.log(`이제 게임에서 이 모델을 불러와서 바로 쓸 수 있어.\n`);
  } catch (err) {
    console.error(`\n🚨 오류 발생:`, err.message);
    process.exit(1);
  }
}

main();
