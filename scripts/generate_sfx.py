"""
PromptCarefully 사운드 효과 자동 생성 스크립트
AgentAudio (Stable Audio 3 Medium)를 호출하여 고품질 게임 효과음을 생성합니다.
"""

import sys
import os
import time
from pathlib import Path

# Windows 콘솔 인코딩 대응
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# AgentAudio 가상환경 및 모듈 경로 추가
AGENT_AUDIO_PATH = Path(r"C:\Users\copper\OneDrive\Desktop\Tools\AITools\AgentAudio")
AGENT_AUDIO_SRC = AGENT_AUDIO_PATH / "src"
sys.path.insert(0, str(AGENT_AUDIO_SRC))

from agent_audio.runtime import generate_audio

# 대상 사운드 디렉토리
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "assets" / "sounds"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# 생성할 효과음 목록 및 프롬프트 정의
SFX_LIST = {
    "jump": {
        "prompt": "Cute cartoon character jump, spring boing, arcade platformer jumping sound effect, clean, isolated, no music",
        "seconds": 1.5,
    },
    "land": {
        "prompt": "Soft cartoon landing thud on ground, cute character footstep landing, isolated sound effect, clean, no music",
        "seconds": 1.0,
    },
    "bonk": {
        "prompt": "Cartoon head bonk wooden knock, playful bump impact, clean isolated sound effect, no music",
        "seconds": 1.2,
    },
    "iceslide": {
        "prompt": "Fast ice skate swoosh slide on frozen ice, whoosh friction glide sound effect, isolated, clean",
        "seconds": 1.8,
    },
    "mine": {
        "prompt": "Punchy cartoon explosion, bomb blast with funny pop and bass impact, arcade game sound effect, isolated, clean",
        "seconds": 2.0,
    },
    "portal": {
        "prompt": "Magical teleport portal whoosh, mystical sci-fi warp shimmer sparkle, isolated sound effect, clean",
        "seconds": 2.0,
    },
    "goal": {
        "prompt": "Video game level complete victory chime, cheerful sparkling magic bell quest success arpeggio, isolated, clean",
        "seconds": 2.5,
    },
    "fall": {
        "prompt": "Cartoon comic slide whistle falling down pitch, funny drop tumble, isolated sound effect, clean",
        "seconds": 2.0,
    },
    "conveyor": {
        "prompt": "Mechanical conveyor belt motorized whir humming glide sound effect, factory machinery loop, clean, isolated",
        "seconds": 1.5,
    },
    "crumble": {
        "prompt": "Voxel rock stones crumbling falling collapse debris rubble sound effect, clean, isolated",
        "seconds": 1.8,
    },
    "spike": {
        "prompt": "Sharp metal trap spikes extending snap cartoon poke sting sound effect, clean, isolated",
        "seconds": 1.2,
    },
    "lava": {
        "prompt": "Lava sizzle flame steam fizz bubbling burn sound effect, clean, isolated",
        "seconds": 1.8,
    },
    "fanfare": {
        "prompt": "Joyful 8bit arcade brass victory fanfare, cute game win celebration, short brass jingle, clean",
        "seconds": 3.0,
    },
}

def generate_one(name: str):
    if name not in SFX_LIST:
        print(f"Unknown sound: {name}. Available: {list(SFX_LIST.keys())}")
        return
    info = SFX_LIST[name]
    out_file = OUTPUT_DIR / f"{name}.wav"
    print(f"=== Generating [{name}] ===")
    print(f"Prompt: {info['prompt']}")
    print(f"Duration: {info['seconds']}s -> {out_file}")
    t0 = time.time()
    result = generate_audio(
        prompt=info["prompt"],
        seconds=info["seconds"],
        output_path=str(out_file)
    )
    elapsed = round(time.time() - t0, 2)
    print(f"[OK] Saved {name}.wav ({elapsed}s)")

def main():
    targets = sys.argv[1:] if len(sys.argv) > 1 else list(SFX_LIST.keys())
    print(f"Target sounds: {targets}")
    for name in targets:
        generate_one(name)

if __name__ == "__main__":
    main()
