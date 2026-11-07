"""
오늘의 편지 - FastAPI 백엔드

- POST /api/diary : 일기를 받아 AI(Codyssey 또는 Gemini) 답장 + 감정 요약을 돌려줌
                    body: { diary, user_id, memory_consent }
                    응답: { reply, memory(요약 또는 null) }
                    · users/{user_id} 문서가 없으면 만들고, memory_consent로 동의 여부 갱신
                    · 동의한 사용자는 최근 감정 기록 5개를 시스템 프롬프트에 넣어 편지에 반영
                    · 동의한 사용자만 감정 요약을 memories에 저장 (일기 원문은 저장하지 않음)
- GET  /          : index.html 제공
- /css, /js       : 정적 파일 제공 (Vercel에서는 빌드 시 CDN으로 옮겨짐)

로컬 실행: uvicorn api.index:app --reload --port 8000
"""

import json
import os
import re
import time
from pathlib import Path

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool

# Firestore(기억 기능) 모듈
# uvicorn api.index:app / Vercel(entrypoint api.index:app)에서는 api.memory_store로,
# api 폴더 안에서 직접 실행할 때는 memory_store로 import
try:
    from api import memory_store
except ImportError:
    import memory_store


# ==============================
# 경로 / 환경변수
# ==============================

# 프로젝트 루트 (api 폴더의 상위 폴더)
BASE_DIR = Path(__file__).resolve().parent.parent

# .env.local과 .env 둘 다 읽기
# override=False 이므로 우선순위: 시스템 환경변수(Vercel 등) > .env.local > .env
load_dotenv(BASE_DIR / ".env.local")
load_dotenv(BASE_DIR / ".env")


# AI 제공자 기본값 (Codyssey). .env의 AI_BASE_URL / AI_MODEL로 바꿀 수 있음
# 예) Gemini: AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
DEFAULT_AI_BASE_URL = "https://copa.codyssey.kr/v1"
DEFAULT_AI_MODEL = "gpt-5-mini"


def get_ai_config():
    """환경변수에서 (주소, 키, 모델)을 읽음. 값이 비어 있으면 기본값 사용"""
    base_url = (os.environ.get("AI_BASE_URL") or DEFAULT_AI_BASE_URL).strip().rstrip("/")
    # AI_API_KEY가 없으면 예전 이름 CODYSSEY_API_KEY를 읽음
    api_key = (os.environ.get("AI_API_KEY") or os.environ.get("CODYSSEY_API_KEY") or "").strip()
    model = (os.environ.get("AI_MODEL") or DEFAULT_AI_MODEL).strip()
    return base_url, api_key, model

SYSTEM_PROMPT = """
당신은 '오늘의 편지' 서비스의 따뜻한 편지 작성자입니다.

사용자가 작성한 일기를 읽고,
그 사람에게 보내는 짧고 따뜻한 답장을 작성해주세요.

규칙:
1. 일기의 내용을 먼저 이해하고 공감해주세요.
2. 사용자의 감정을 존중해주세요.
3. 판단하거나 훈계하지 마세요.
4. 너무 과장된 위로나 표현은 사용하지 마세요.
5. 자연스러운 한국어로 작성해주세요.
6. 약 5~8문단 정도의 편지 형식으로 작성해주세요.
7. 마지막에는 오늘 하루를 잘 보낸 사용자를 응원해주세요.

응답 형식 (반드시 지킬 것):
- 아래 JSON 객체 하나만 출력하세요. JSON 앞뒤에 다른 설명이나 문장을 쓰지 마세요.
- 편지의 문단 구분은 "letter" 문자열 안에서 \\n 으로 표현하세요.

{
  "letter": "편지 본문",
  "memory": {
    "emotion": "기쁨/설렘/평온/감사/피곤/불안/슬픔/화남/외로움/복잡함 중 하나",
    "intensity": 1~5 사이의 정수 (감정의 세기),
    "situation": "일기의 상황을 30자 이내 한 줄로 요약",
    "keywords": ["키워드", "최대 3개"]
  }
}
"""

# 감정 목록 (목록에 없는 값은 "복잡함"으로 보정)
EMOTIONS = ["기쁨", "설렘", "평온", "감사", "피곤", "불안", "슬픔", "화남", "외로움", "복잡함"]
DEFAULT_EMOTION = "복잡함"

# 프론트엔드가 30초 뒤 요청을 끊으므로, 서버 쪽 AI 호출 전체 시간을 그 안으로 제한
AI_TOTAL_BUDGET = 27     # 첫 요청 + 재요청 전체 제한 (초)
AI_RETRY_MIN_TIME = 8    # 남은 시간이 이보다 적으면 재요청하지 않음 (초)

# Gemini 출력 토큰 한도 (편지 5~8문단 + 감정 요약 JSON + thinking 토큰까지 넉넉하게)
AI_MAX_TOKENS = 4096

# Gemini 추론 강도 (낮을수록 빠름)
GEMINI_REASONING_EFFORT = "low"


MEMORY_PROMPT_HEADER = "아래는 이 사용자의 최근 감정 기록입니다."

MEMORY_PROMPT_RULES = """
과거 감정 기록 사용 규칙:
1. 과거 기록은 오늘 일기와 자연스럽게 이어질 때만 한두 번 언급하세요.
2. 과거 기록을 나열하거나 분석하지 마세요.
3. 오늘 일기와 관계없으면 언급하지 않아도 됩니다.
4. 감정 요약("memory")은 과거 기록이 아니라 오늘 일기만 보고 작성하세요.
"""


def format_memory_line(memory: dict):
    """감정 기록 한 개를 "- 11/05 피곤(3): 과제가 많아 잠을 못 잠" 형식으로. 쓸 수 없으면 None"""
    date = memory.get("date")
    emotion = memory.get("emotion")
    if not isinstance(date, str) or not isinstance(emotion, str):
        return None

    # "2026-11-05" → "11/05"
    parts = date.split("-")
    short_date = f"{parts[1]}/{parts[2]}" if len(parts) == 3 else date

    line = f"- {short_date} {emotion}"

    intensity = memory.get("intensity")
    if isinstance(intensity, int):
        line += f"({intensity})"

    situation = memory.get("situation")
    if isinstance(situation, str) and situation.strip():
        line += f": {situation.strip()[:30]}"

    return line


def build_system_prompt(memories) -> str:
    """기본 편지 규칙 + (기록이 있을 때만) 최근 감정 기록과 사용 규칙"""
    lines = [line for line in (format_memory_line(m) for m in memories or []) if line]

    # 기록이 없으면 기억 부분은 넣지 않음
    if not lines:
        return SYSTEM_PROMPT

    return (
        SYSTEM_PROMPT
        + "\n" + MEMORY_PROMPT_HEADER + "\n"
        + "\n".join(lines) + "\n"
        + MEMORY_PROMPT_RULES
    )


def is_gemini(base_url: str) -> bool:
    """AI 주소가 Gemini(OpenAI 호환 API)인지 확인"""
    return "generativelanguage.googleapis.com" in base_url


app = FastAPI(title="오늘의 편지")


def error_response(status_code: int, message: str) -> JSONResponse:
    """한국어 오류 메시지를 {"error": "..."} 형식으로 돌려줌"""
    return JSONResponse(status_code=status_code, content={"error": message})


def log(message: str) -> None:
    """터미널에 디버그 로그 출력 (콘솔 인코딩 문제로 요청이 실패하지 않도록 보호)"""
    try:
        print(f"[ai] {message}", flush=True)
    except Exception:
        print(f"[ai] {ascii(message)}", flush=True)


def call_ai(base_url: str, api_key: str, model: str, diary: str, timeout: float = 25,
            system_prompt: str = SYSTEM_PROMPT):
    """OpenAI 호환 AI API(Codyssey, Gemini 등)에 일기를 보내고 (AI 응답 문자열, 오류응답) 중 하나를 돌려줌"""

    # 키 값은 출력하지 않고, 읽혔는지 여부와 길이만 출력
    log(f"주소: {base_url}, 모델: {model}")
    log(f"API 키 읽힘: {bool(api_key)}, 길이: {len(api_key)}")

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": diary},
        ],
    }

    # Gemini(thinking 모델) 전용 옵션
    # - max_tokens: thinking 토큰도 이 한도를 함께 쓰므로 넉넉하게 잡음
    # - reasoning_effort: 추론을 낮게 해서 응답 시간과 토큰 사용을 줄임
    # Codyssey(gpt-5-mini)는 max_tokens를 거부(max_completion_tokens만 허용)할 수 있어 보내지 않음
    if is_gemini(base_url):
        payload["max_tokens"] = AI_MAX_TOKENS
        payload["reasoning_effort"] = GEMINI_REASONING_EFFORT

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        response = requests.post(
            f"{base_url}/chat/completions",
            headers=headers,
            json=payload,
            timeout=timeout,
        )
    except requests.exceptions.Timeout:
        log(f"요청 시간 초과 ({timeout:.0f}초)")
        return None, error_response(504, "AI 응답 시간이 초과되었습니다.")
    except requests.exceptions.RequestException as exc:
        log(f"연결 실패: {type(exc).__name__}: {str(exc)[:300]}")
        return None, error_response(502, "AI 서버에 연결하지 못했습니다.")

    # AI 응답 확인
    if response.status_code != 200:
        log(f"응답 실패 - 상태 코드: {response.status_code}, 본문(앞 300자): {response.text[:300]}")
        return None, error_response(502, "AI 서버에서 답장을 받지 못했습니다.")

    try:
        result = response.json()
        choice = result["choices"][0]
        reply = choice["message"].get("content")
    except (KeyError, IndexError, TypeError, ValueError, AttributeError):
        log(f"응답 형식 오류 - 받은 본문(앞 300자): {response.text[:300]}")
        return None, error_response(502, "AI 응답 형식이 올바르지 않습니다.")

    # 원인 확인용: 종료 이유, 토큰 사용량, AI 원본 응답 앞 300자 (키는 출력하지 않음)
    usage = result.get("usage") if isinstance(result, dict) else None
    log(f"finish_reason: {choice.get('finish_reason')}, usage: {usage}")
    log(f"AI 원본 응답(앞 300자): {reply[:300] if isinstance(reply, str) else repr(reply)}")

    # 내용이 비어 오는 경우 (예: thinking이 출력 한도를 다 써서 content가 null/빈 문자열)
    # → 빈 문자열로 넘겨서 재요청 / 최종 오류 처리로 이어지게 함
    if reply is None:
        reply = ""

    if not isinstance(reply, str):
        log(f"응답 형식 오류 - 받은 본문(앞 300자): {response.text[:300]}")
        return None, error_response(502, "AI 응답 형식이 올바르지 않습니다.")

    return reply, None


# ==============================
# AI 응답(JSON) 파싱 / 보정
# ==============================

def extract_json_text(text: str) -> str:
    """```json 코드블록이나 앞뒤 설명이 붙어 와도 JSON 부분만 꺼냄"""
    text = text.strip()

    # ```json ... ``` 또는 ``` ... ``` 코드블록
    fence = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL | re.IGNORECASE)
    if fence:
        text = fence.group(1).strip()

    # 앞뒤에 다른 문장이 붙어 있으면 첫 { 부터 마지막 } 까지만 사용
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        text = text[start:end + 1]

    return text


def normalize_memory(raw):
    """감정 요약을 정해진 형식으로 보정. 쓸 수 없는 값이면 None"""
    if not isinstance(raw, dict):
        return None

    emotion = raw.get("emotion")
    emotion = emotion.strip() if isinstance(emotion, str) else ""
    if emotion not in EMOTIONS:
        emotion = DEFAULT_EMOTION

    # 강도: 정수로 바꾼 뒤 1~5 범위로 맞춤 (못 바꾸면 중간값 3)
    try:
        intensity = int(round(float(raw.get("intensity"))))
    except (TypeError, ValueError, OverflowError):
        intensity = 3
    intensity = max(1, min(5, intensity))

    situation = raw.get("situation")
    situation = " ".join(situation.split())[:30] if isinstance(situation, str) else ""

    keywords = raw.get("keywords")
    if not isinstance(keywords, list):
        keywords = []
    keywords = [k.strip()[:20] for k in keywords if isinstance(k, str) and k.strip()][:3]

    return {
        "emotion": emotion,
        "intensity": intensity,
        "situation": situation,
        "keywords": keywords,
    }


def parse_ai_reply(text: str):
    """AI 응답에서 (편지, 감정 요약)을 꺼냄. 편지를 못 꺼내면 None"""
    try:
        data = json.loads(extract_json_text(text))
    except (ValueError, TypeError):
        return None

    if not isinstance(data, dict):
        return None

    letter = data.get("letter")
    if not isinstance(letter, str) or not letter.strip():
        return None

    return letter.strip(), normalize_memory(data.get("memory"))


def get_letter_and_memory(base_url: str, api_key: str, model: str, diary: str,
                          system_prompt: str = SYSTEM_PROMPT):
    """
    AI를 호출해 (편지, 감정 요약, 오류응답)을 돌려줌.
    system_prompt: 기본 규칙 + (있으면) 최근 감정 기록이 들어간 시스템 프롬프트
    JSON 파싱에 실패하면 한 번 더 요청하고, 그래도 실패하면 AI 응답 전체를 편지로 쓰고 요약은 None.
    """
    started = time.monotonic()

    raw, error = call_ai(base_url, api_key, model, diary, timeout=AI_TOTAL_BUDGET,
                         system_prompt=system_prompt)
    if error is not None:
        return None, None, error

    parsed = parse_ai_reply(raw)
    if parsed is not None:
        return parsed[0], parsed[1], None

    # 재요청 (남은 시간이 충분할 때만)
    remaining = AI_TOTAL_BUDGET - (time.monotonic() - started)
    if remaining >= AI_RETRY_MIN_TIME:
        log("JSON 파싱 실패 → 한 번 더 요청")
        retry_raw, retry_error = call_ai(base_url, api_key, model, diary, timeout=remaining,
                                         system_prompt=system_prompt)

        if retry_error is None:
            raw = retry_raw
            parsed = parse_ai_reply(raw)
            if parsed is not None:
                return parsed[0], parsed[1], None
    else:
        log(f"JSON 파싱 실패 → 남은 시간({remaining:.0f}초)이 부족해 재요청하지 않음")

    # 응답이 비어 있으면 빈 편지를 보내지 않고 오류로 처리
    if not raw.strip():
        log("AI 응답이 비어 있음 → 오류로 처리")
        return None, None, error_response(502, "AI가 빈 답장을 보냈어요. 잠시 후 다시 시도해주세요.")

    # 끝내 실패: AI 응답 전체를 편지로 보여주고 기억은 저장하지 않음
    log("JSON 파싱 최종 실패 → 응답 전체를 편지로 사용 (기억 저장 안 함)")
    return raw.strip(), None, None


# ==============================
# API: 일기 → AI 답장
# ==============================

@app.post("/api/diary")
async def create_letter(request: Request):

    # AI 설정 / API 키 확인
    base_url, api_key, model = get_ai_config()

    if not api_key:
        log("API 키 읽힘: False (AI_API_KEY, CODYSSEY_API_KEY 모두 없음)")
        return error_response(500, "서버에 AI API 키가 설정되지 않았습니다.")

    # 요청 데이터 읽기 (JSON이 아니면 400)
    try:
        data = await request.json()
    except Exception:
        return error_response(400, "잘못된 요청입니다.")

    diary = data.get("diary", "") if isinstance(data, dict) else None

    if not isinstance(diary, str):
        return error_response(400, "잘못된 요청입니다.")

    # 일기 내용 확인
    diary = diary.strip()

    if not diary:
        return error_response(400, "일기 내용을 입력해주세요.")

    # 사용자 문서 준비 + 동의 여부 갱신 (Firestore가 없거나 실패해도 편지는 계속 진행)
    # memory_consent가 정확히 true일 때만 동의로 봄
    user_id = data.get("user_id")
    memory_consent = data.get("memory_consent") is True
    try:
        await run_in_threadpool(memory_store.prepare_user, user_id, memory_consent)
    except Exception as exc:
        log(f"기억 기능 건너뜀: {type(exc).__name__}")

    # 최근 감정 기록 불러오기 (memory_enabled=true일 때만, 오늘 일기 저장 전이므로 오늘 것은 포함 안 됨)
    try:
        recent_memories = await run_in_threadpool(memory_store.load_recent_memories, user_id)
    except Exception as exc:
        log(f"기억 불러오기 건너뜀: {type(exc).__name__}")
        recent_memories = []

    system_prompt = build_system_prompt(recent_memories)

    # requests는 동기 라이브러리이므로 별도 스레드에서 실행
    reply, memory, error = await run_in_threadpool(
        get_letter_and_memory, base_url, api_key, model, diary, system_prompt
    )

    if error is not None:
        return error

    # 동의한 사용자(memory_enabled=true)만 감정 요약 저장. 일기 원문은 넘기지 않음
    if memory is not None:
        try:
            await run_in_threadpool(memory_store.save_memory, user_id, memory)
        except Exception as exc:
            log(f"기억 저장 건너뜀: {type(exc).__name__}")

    # 프론트엔드로 AI 답장 + 감정 요약 전달
    return {"reply": reply, "memory": memory}


# ==============================
# 화면(정적 파일) 제공
# ==============================

@app.get("/", include_in_schema=False)
async def index():
    return FileResponse(BASE_DIR / "index.html")


app.mount("/css", StaticFiles(directory=BASE_DIR / "css"), name="css")
app.mount("/js", StaticFiles(directory=BASE_DIR / "js"), name="js")
