import os
import json
import requests
from http.server import BaseHTTPRequestHandler


CODYSSEY_API_URL = "https://copa.codyssey.kr/v1/chat/completions"


class handler(BaseHTTPRequestHandler):

    def send_json(self, status_code, data):

        response = json.dumps(
            data,
            ensure_ascii=False
        ).encode("utf-8")

        self.send_response(status_code)

        self.send_header(
            "Content-Type",
            "application/json; charset=utf-8"
        )

        self.send_header(
            "Content-Length",
            str(len(response))
        )

        self.end_headers()

        self.wfile.write(response)


    def do_POST(self):

        # ==============================
        # API 키 확인
        # ==============================

        api_key = os.environ.get(
            "CODYSSEY_API_KEY"
        )

        if not api_key:

            self.send_json(
                500,
                {
                    "error":
                    "서버에 Codyssey API 키가 설정되지 않았습니다."
                }
            )

            return


        # ==============================
        # 요청 데이터 읽기
        # ==============================

        try:

            content_length = int(
                self.headers.get(
                    "Content-Length",
                    0
                )
            )

            body = self.rfile.read(
                content_length
            )

            data = json.loads(
                body.decode("utf-8")
            )

        except Exception:

            self.send_json(
                400,
                {
                    "error":
                    "잘못된 요청입니다."
                }
            )

            return


        # ==============================
        # 일기 내용 확인
        # ==============================

        diary = data.get(
            "diary",
            ""
        ).strip()


        if not diary:

            self.send_json(
                400,
                {
                    "error":
                    "일기 내용을 입력해주세요."
                }
            )

            return


        # ==============================
        # AI에게 보낼 프롬프트
        # ==============================

        system_prompt = """
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


        # ==============================
        # Codyssey AI 요청
        # ==============================

        payload = {

            "model": "gpt-5-mini",

            "messages": [

                {
                    "role": "system",
                    "content": system_prompt
                },

                {
                    "role": "user",
                    "content": diary
                }

            ]

        }


        headers = {

            "Authorization":
            f"Bearer {api_key}",

            "Content-Type":
            "application/json"

        }


        try:

            response = requests.post(

                CODYSSEY_API_URL,

                headers=headers,

                json=payload,

                timeout=25

            )


        except requests.exceptions.Timeout:

            self.send_json(
                504,
                {
                    "error":
                    "AI 응답 시간이 초과되었습니다."
                }
            )

            return


        except requests.exceptions.RequestException:

            self.send_json(
                502,
                {
                    "error":
                    "AI 서버에 연결하지 못했습니다."
                }
            )

            return


        # ==============================
        # Codyssey 응답 확인
        # ==============================

        if response.status_code != 200:

            self.send_json(
                502,
                {
                    "error":
                    "AI 서버에서 답장을 받지 못했습니다."
                }
            )

            return


        try:

            result = response.json()

            reply = (
                result["choices"][0]
                ["message"]["content"]
            )


        except (
            KeyError,
            IndexError,
            TypeError,
            ValueError
        ):

            self.send_json(
                502,
                {
                    "error":
                    "AI 응답 형식이 올바르지 않습니다."
                }
            )

            return


        # ==============================
        # 프론트엔드로 AI 답장 전달
        # ==============================

        self.send_json(
            200,
            {
                "reply": reply
            }
        )