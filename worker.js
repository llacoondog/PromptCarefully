export default {
  async fetch(request, env) {
    // 1. 브라우저 CORS Preflight 요청 허용
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (request.method !== "POST") {
      return new Response("PromptCarefully Gemini Proxy Worker is Running!", {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    try {
      const url = new URL(request.url);

      // 구글 Gemini API 원본 주소로 타겟팅 (모델 및 sse 스트리밍 쿼리 그대로 유지)
      const targetUrl = new URL(`https://generativelanguage.googleapis.com${url.pathname}${url.search}`);
      
      // Cloudflare Secret에 저장된 내 API 키 주입
      const apiKey = env?.GEMINI_API_KEY || (typeof GEMINI_API_KEY !== 'undefined' ? GEMINI_API_KEY : null);
      if (!apiKey) {
        const availableKeys = Object.keys(env || {}).join(', ');
        return new Response(JSON.stringify({ 
          error: "Worker 환경 변수에 GEMINI_API_KEY가 설정되지 않았습니다.",
          debugEnvKeys: availableKeys || "(empty)"
        }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
      targetUrl.searchParams.set("key", apiKey);

      // 브라우저에서 보낸 프롬프트 본문을 그대로 구글로 전달
      const geminiResponse = await fetch(targetUrl.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: request.body,
      });

      // 브라우저로 실시간 스트리밍 응답을 그대로 통과시키면서 CORS 헤더 부착
      const responseHeaders = new Headers(geminiResponse.headers);
      responseHeaders.set("Access-Control-Allow-Origin", "*");
      responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

      return new Response(geminiResponse.body, {
        status: geminiResponse.status,
        statusText: geminiResponse.statusText,
        headers: responseHeaders,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  },
};
