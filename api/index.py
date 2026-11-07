"""
오늘의 편지 - FastAPI 백엔드

- POST /api/diary : 일기를 받아 AI(Codyssey 또는 Gemini) 답장을 돌려줌
- GET  /          : index.html 제공
- /css, /js       : 정적 파일 제공 (Vercel에서는 빌드 시 CDN으로 옮겨짐)

로컬 실행: uvicorn api.index:app --reload --port 8000
"""

import os
from pathlib import Path

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool


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
"""


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


def call_ai(base_url: str, api_key: str, model: str, diary: str):
    """OpenAI 호환 AI API(Codyssey, Gemini 등)에 일기를 보내고 (답장, 오류응답) 중 하나를 돌려줌"""

    # 키 값은 출력하지 않고, 읽혔는지 여부와 길이만 출력
    log(f"주소: {base_url}, 모델: {model}")
    log(f"API 키 읽힘: {bool(api_key)}, 길이: {len(api_key)}")

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": diary},
        ],
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        response = requests.post(
            f"{base_url}/chat/completions",
            headers=headers,
            json=payload,
            timeout=25,
        )
    except requests.exceptions.Timeout:
        log("요청 시간 초과 (25초)")
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
        reply = result["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError, ValueError):
        log(f"응답 형식 오류 - 받은 본문(앞 300자): {response.text[:300]}")
        return None, error_response(502, "AI 응답 형식이 올바르지 않습니다.")

    if not isinstance(reply, str):
        log(f"응답 형식 오류 - 받은 본문(앞 300자): {response.text[:300]}")
        return None, error_response(502, "AI 응답 형식이 올바르지 않습니다.")

    return reply, None


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

    # requests는 동기 라이브러리이므로 별도 스레드에서 실행
    reply, error = await run_in_threadpool(call_ai, base_url, api_key, model, diary)

    if error is not None:
        return error

    # 프론트엔드로 AI 답장 전달
    return {"reply": reply}


# ==============================
# 화면(정적 파일) 제공
# ==============================

@app.get("/", include_in_schema=False)
async def index():
    return FileResponse(BASE_DIR / "index.html")


app.mount("/css", StaticFiles(directory=BASE_DIR / "css"), name="css")
app.mount("/js", StaticFiles(directory=BASE_DIR / "js"), name="js")
