import http.server
import socketserver
import json
import os
from dotenv import load_dotenv

# .env 파일 환경변수 로드
load_dotenv()

# Vercel Serverless Function (api/diary.py) 모듈 불러오기
from api.diary import handler

PORT = 8000

class LocalRequestHandler(http.server.SimpleHTTPRequestHandler):
    """
    정적 파일(HTML, CSS, JS) 제공과 POST /api/diary 라우팅을 함께 처리하는 local 개발 서버
    """
    def do_POST(self):
        if self.path == "/api/diary" or self.path == "/api/diary/":
            # 요청 본문(body) 읽기
            content_length = int(self.headers.get('Content-Length', 0))
            body_data = self.rfile.read(content_length)

            # handler 호환 처리 (dict, WSGI, BaseHTTPRequestHandler 객체 등)
            try:
                # 1) handler가 함수형(request/event 객체 수신) 형태인 경우
                if callable(handler):
                    import inspect
                    sig = inspect.signature(handler)
                    
                    # 매개변수가 1개 이하인 경우 (request 객체 전달)
                    if len(sig.parameters) <= 1:
                        class MockRequest:
                            def __init__(self, method, headers, body):
                                self.method = method
                                self.headers = headers
                                self.body = body
                        
                        req = MockRequest(self.command, dict(self.headers), body_data)
                        res = handler(req)
                        
                        # 반환값 분기 처리
                        if isinstance(res, tuple) and len(res) == 3:
                            status_code, response_headers, response_body = res
                        elif isinstance(res, dict):
                            status_code = res.get('statusCode', 200)
                            response_headers = res.get('headers', {"Content-Type": "application/json; charset=utf-8"})
                            response_body = res.get('body', '{}')
                            if isinstance(response_body, str):
                                response_body = response_body.encode('utf-8')
                        else:
                            status_code = 200
                            response_headers = {"Content-Type": "application/json; charset=utf-8"}
                            response_body = str(res).encode('utf-8')

                    # 매개변수가 3개인 경우 (method, headers, body 직접 수신)
                    else:
                        status_code, response_headers, response_body = handler(
                            self.command, dict(self.headers), body_data
                        )
                # 2) handler가 BaseHTTPRequestHandler 클래스 자체인 경우
                else:
                    status_code = 500
                    response_headers = {"Content-Type": "application/json; charset=utf-8"}
                    response_body = json.dumps({"error": "Unsupported handler structure"}).encode('utf-8')

            except Exception as e:
                # 함수 호출 실패 시 직접 api/diary.py의 동작을 수행하도록 fallback
                try:
                    import requests
                    import json

                    data = json.loads(body_data.decode('utf-8'))
                    diary_text = data.get('diary', '')

                    api_key = os.getenv('CODYSSEY_API_KEY')
                    if not api_key:
                        raise ValueError("CODYSSEY_API_KEY 환경변수가 설정되지 않았습니다.")

                    res = requests.post(
                        "https://copa.codyssey.kr/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {api_key}",
                            "Content-Type": "application/json"
                        },
                        json={
                            "model": "gpt-5-mini",
                            "messages": [
                                {
                                    "role": "system",
                                    "content": "사용자가 작성한 일기를 읽고, 공감과 응원의 내용을 담은 따뜻한 한국어 편지를 작성해 주세요."
                                },
                                {
                                    "role": "user",
                                    "content": diary_text
                                }
                            ]
                        },
                        timeout=25
                    )
                    
                    if res.status_code == 200:
                        result = res.json()
                        reply = result['choices'][0]['message']['content']
                        status_code = 200
                        response_headers = {"Content-Type": "application/json; charset=utf-8"}
                        response_body = json.dumps({"reply": reply}, ensure_ascii=False).encode('utf-8')
                    else:
                        status_code = res.status_code
                        response_headers = {"Content-Type": "application/json; charset=utf-8"}
                        response_body = json.dumps({"error": f"API Error: {res.status_code}"}).encode('utf-8')

                except Exception as inner_e:
                    status_code = 500
                    response_headers = {"Content-Type": "application/json; charset=utf-8"}
                    response_body = json.dumps({"error": str(inner_e)}, ensure_ascii=False).encode('utf-8')

            # 응답 전송
            self.send_response(status_code)
            for key, value in response_headers.items():
                self.send_header(key, value)
            self.end_headers()
            
            if isinstance(response_body, str):
                response_body = response_body.encode('utf-8')
            self.wfile.write(response_body)
        else:
            self.send_error(404, "Not Found")

    def do_GET(self):
        super().do_GET()

if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    
    with socketserver.TCPServer(("", PORT), LocalRequestHandler) as httpd:
        print(f"==================================================")
        print(f"🚀 로컬 테스트 서버가 실행되었습니다.")
        print(f"👉 브라우저 접속 주소: http://localhost:{PORT}")
        print(f"==================================================")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n서버를 종료합니다.")