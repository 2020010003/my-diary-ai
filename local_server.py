"""로컬 테스트 서버 — 정적 파일(index.html·css·js)과 POST /api 를 한 포트에서 함께 처리합니다.

Vercel 은 정적 파일과 api/index.py 를 따로 실행하지만, 로컬에서는 이 파일 하나로 같은 흐름을
확인합니다. 실행: python local_server.py → http://localhost:8000
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler

from api.index import handler as ApiHandler

PORT = 8000
# 화면에 필요한 파일만 내준다 — 같은 폴더의 .env(API 키)가 브라우저로 새지 않게
PUBLIC_FILES = ("/", "/index.html")
PUBLIC_DIRS = ("/css/", "/js/")


class LocalHandler(SimpleHTTPRequestHandler):
    send_json = ApiHandler.send_json

    def do_GET(self):
        path = self.path.split("?")[0]
        if path in PUBLIC_FILES or (path.startswith(PUBLIC_DIRS) and ".." not in path):
            super().do_GET()
        else:
            self.send_json(404, {"error": "없는 주소입니다."})

    def do_POST(self):
        if self.path.split("?")[0].rstrip("/") == "/api":
            ApiHandler.do_POST(self)
        else:
            self.send_json(404, {"error": "없는 주소입니다."})


if __name__ == "__main__":
    print(f"http://localhost:{PORT} 에서 실행 중입니다. 끝내려면 Ctrl+C")
    HTTPServer(("127.0.0.1", PORT), LocalHandler).serve_forever()
