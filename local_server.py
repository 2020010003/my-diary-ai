"""로컬 테스트 서버 — 정적 파일(index.html·css·js)과 POST /api 를 한 포트에서 함께 처리합니다.

Vercel 은 정적 파일과 api/index.py 를 따로 실행하지만, 로컬에서는 이 파일 하나로 같은 흐름을
확인합니다. 실행: python local_server.py → http://localhost:8000
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler

from api.index import handler as ApiHandler

PORT = 8000


class LocalHandler(SimpleHTTPRequestHandler):
    send_json = ApiHandler.send_json

    def do_POST(self):
        if self.path.split("?")[0].rstrip("/") == "/api":
            ApiHandler.do_POST(self)
        else:
            self.send_json(404, {"error": "없는 주소입니다."})


if __name__ == "__main__":
    print(f"http://localhost:{PORT} 에서 실행 중입니다. 끝내려면 Ctrl+C")
    HTTPServer(("", PORT), LocalHandler).serve_forever()
