"""
오늘의 편지 - Firestore 연결 (Long-term Memory용)

데이터 구조
users/{user_id}
  - created_at, email, notify_time("HH:MM"), notify_enabled,
    memory_enabled, last_notified_date, consent_at
  - memories/{auto_id}: date(한국 시간 YYYY-MM-DD), emotion, intensity, situation, keywords, created_at
    (memory_enabled가 true인 사용자만 저장. 일기 원문은 절대 저장하지 않음)

환경변수 FIREBASE_SERVICE_ACCOUNT(서비스 계정 JSON 한 줄 문자열)가 없거나 잘못되면
기억 기능만 건너뛰고, 편지 기능에는 영향을 주지 않음.
"""

import json
import os
import re
import threading
from datetime import datetime, timedelta, timezone

# 한국 시간 (Windows에는 tzdata가 없을 수 있어 ZoneInfo 대신 고정 오프셋 사용)
KST = timezone(timedelta(hours=9))

# 초기화 결과 캐시 (None: 아직 시도 안 함, False: 사용 불가, 그 외: Firestore 클라이언트)
_db = None
_lock = threading.Lock()

# user_id는 프론트엔드가 crypto.randomUUID()로 만든 UUID 형식만 허용
_USER_ID_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
)


def _log(message: str) -> None:
    """터미널 로그 (서비스 계정 키 내용은 절대 넣지 말 것)"""
    try:
        print(f"[memory] {message}", flush=True)
    except Exception:
        print(f"[memory] {ascii(message)}", flush=True)


def is_valid_user_id(user_id) -> bool:
    return isinstance(user_id, str) and bool(_USER_ID_PATTERN.match(user_id))


def get_db():
    """Firestore 클라이언트를 돌려줌. 사용할 수 없으면 None (한 번만 초기화 시도)"""
    global _db

    if _db is not None:
        return _db or None

    with _lock:
        if _db is not None:
            return _db or None

        raw = (os.environ.get("FIREBASE_SERVICE_ACCOUNT") or "").strip()
        if not raw:
            _log("FIREBASE_SERVICE_ACCOUNT 없음 → 기억 기능을 건너뜁니다.")
            _db = False
            return None

        try:
            import firebase_admin
            from firebase_admin import credentials, firestore

            # 이미 초기화된 앱이 있으면 다시 초기화하지 않음
            try:
                app = firebase_admin.get_app()
            except ValueError:
                info = json.loads(raw)
                app = firebase_admin.initialize_app(credentials.Certificate(info))

            _db = firestore.client(app)
            _log("Firestore 연결 준비 완료")
        except Exception as exc:
            # 예외 메시지에 키 일부가 섞일 수 있으므로 종류만 출력
            _log(f"Firestore 초기화 실패: {type(exc).__name__} → 기억 기능을 건너뜁니다.")
            _db = False

    return _db or None


def ensure_user(user_id: str) -> bool:
    """
    users/{user_id} 문서가 없으면 기본값으로 만들어 둠.
    문서를 쓸 수 있는 상태면 True. 실패해도 예외를 밖으로 내보내지 않음
    """
    if not is_valid_user_id(user_id):
        _log("user_id 형식이 올바르지 않음 → 사용자 문서 생성을 건너뜁니다.")
        return False

    db = get_db()
    if db is None:
        return False

    try:
        from firebase_admin import firestore
        from google.api_core.exceptions import AlreadyExists

        doc_ref = db.collection("users").document(user_id)
        try:
            # create()는 문서가 이미 있으면 AlreadyExists를 냄 (기존 값 덮어쓰지 않음)
            doc_ref.create({
                "created_at": firestore.SERVER_TIMESTAMP,
                "email": None,
                "notify_time": None,
                "notify_enabled": False,
                "memory_enabled": False,
                "last_notified_date": None,
                "consent_at": None,
            })
            _log("새 사용자 문서 생성")
        except AlreadyExists:
            pass
        return True
    except Exception as exc:
        _log(f"사용자 문서 처리 실패: {type(exc).__name__}: {str(exc)[:200]}")
        return False


def prepare_user(user_id: str, memory_consent: bool) -> None:
    """
    사용자 문서를 준비하고 동의 여부를 갱신.
    동의: memory_enabled=true, consent_at=현재시각 / 미동의: memory_enabled=false
    """
    if not ensure_user(user_id):
        return

    try:
        from firebase_admin import firestore

        if memory_consent:
            changes = {"memory_enabled": True, "consent_at": firestore.SERVER_TIMESTAMP}
        else:
            changes = {"memory_enabled": False}

        get_db().collection("users").document(user_id).update(changes)
    except Exception as exc:
        _log(f"동의 여부 갱신 실패: {type(exc).__name__}: {str(exc)[:200]}")


def load_recent_memories(user_id: str, limit: int = 5) -> list:
    """
    memory_enabled가 true인 사용자의 최근 감정 기록을 최대 limit개 가져옴.
    created_at 내림차순으로 가져온 뒤, 오래된 것부터 날짜순으로 돌려줌.
    실패하거나 사용할 수 없으면 빈 목록. (로그에는 개수만 출력)
    """
    if not is_valid_user_id(user_id):
        return []

    db = get_db()
    if db is None:
        return []

    try:
        from firebase_admin import firestore

        user_ref = db.collection("users").document(user_id)
        snapshot = user_ref.get()

        user_data = snapshot.to_dict() if snapshot.exists else None
        if not user_data or user_data.get("memory_enabled") is not True:
            return []

        docs = (
            user_ref.collection("memories")
            .order_by("created_at", direction=firestore.Query.DESCENDING)
            .limit(limit)
            .stream()
        )

        memories = []
        for doc in docs:
            item = doc.to_dict() or {}
            memories.append({
                "date": item.get("date"),
                "emotion": item.get("emotion"),
                "intensity": item.get("intensity"),
                "situation": item.get("situation"),
            })

        # 오래된 것부터 날짜순
        memories.reverse()

        _log(f"불러온 기억 개수: {len(memories)}")
        return memories
    except Exception as exc:
        _log(f"기억 불러오기 실패: {type(exc).__name__}: {str(exc)[:200]}")
        return []


def save_memory(user_id: str, memory: dict) -> None:
    """memory_enabled가 true인 사용자만 users/{user_id}/memories에 감정 요약 저장"""
    if not is_valid_user_id(user_id) or not isinstance(memory, dict):
        return

    db = get_db()
    if db is None:
        return

    try:
        from firebase_admin import firestore

        user_ref = db.collection("users").document(user_id)
        snapshot = user_ref.get()

        user_data = snapshot.to_dict() if snapshot.exists else None
        if not user_data or user_data.get("memory_enabled") is not True:
            return

        # 정해진 필드만 저장 (일기 원문은 받지도, 저장하지도 않음)
        user_ref.collection("memories").add({
            "date": datetime.now(KST).strftime("%Y-%m-%d"),
            "emotion": memory.get("emotion"),
            "intensity": memory.get("intensity"),
            "situation": memory.get("situation"),
            "keywords": memory.get("keywords") or [],
            "created_at": firestore.SERVER_TIMESTAMP,
        })
        _log("감정 요약 저장")
    except Exception as exc:
        _log(f"감정 요약 저장 실패: {type(exc).__name__}: {str(exc)[:200]}")
