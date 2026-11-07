# 오늘의 편지 (my-diary-ai) 프로젝트 규칙

## 서비스
일기를 쓰면 AI가 따뜻한 편지로 답장하는 웹 서비스.
Final Project 필수 기술 요소: Long-term Memory(감정 요약 기억) + 자동화 워크플로우(n8n 정시 알림).

## 기술 스택
- Frontend: 바닐라 HTML / CSS / JavaScript (프레임워크 사용 금지)
- Backend: FastAPI (api/index.py 의 app), Vercel에 FastAPI 앱으로 배포
  (예전 BaseHTTPRequestHandler 방식은 새 Vercel Python 런타임에서 동작하지 않아 FastAPI로 전환함)
- AI: Codyssey API (https://copa.codyssey.kr/v1/chat/completions), 모델 gpt-5-mini
- DB: Firebase Firestore (firebase-admin)
- 자동화: n8n (Schedule Trigger → Vercel API → Gmail)
- 배포: Vercel

## 반드시 지킬 것
1. 모든 파일은 UTF-8 (BOM 없음)으로 저장. PowerShell의 Set-Content/Out-File로 파일 내용을 쓰지 말 것.
   과거에 이 때문에 app.js 한글이 깨져서 사이트 전체가 멈춘 적이 있음.
2. JavaScript는 js/app.js 한 곳에만 작성. index.html에 인라인 <script> 코드를 넣지 말 것.
3. HTML/JS 수정 후에는 node --check js/app.js 로 문법 검사.
4. API 키, Firebase 서비스 계정 키는 코드에 쓰지 말고 환경변수로만 읽기. .env는 커밋 금지.
5. 일기 원문은 DB에 저장하지 않음. AI가 만든 감정 요약만 저장.
6. AI가 쓴 편지에는 "AI가 작성했다"는 표시를 항상 보여줄 것.
7. 한 번에 요청받은 범위만 수정하고, 관계없는 파일은 건드리지 말 것.
8. 수정이 끝나면 바뀐 파일 목록과 직접 테스트하는 방법을 알려줄 것.
9. 사용자에게 보이는 문구는 한국어, 코드 주석도 한국어.
10. 팀 프로젝트임. main 브랜치에 직접 커밋·push 하지 말 것. vercel --prod 실행 금지.
11. 커밋 전에 git branch로 현재 브랜치가 main이 아닌지 확인할 것.

## 환경변수
- CODYSSEY_API_KEY
- FIREBASE_SERVICE_ACCOUNT  (서비스 계정 JSON 전체를 한 줄 문자열로)
- CRON_SECRET  (n8n 전용 API 보호용)

## 로컬 실행 (Windows)
.\.venv\Scripts\Activate.ps1
uvicorn api.index:app --reload --port 8000  → http://localhost:8000
(vercel dev는 Windows에서 문제가 많아 사용하지 않음)