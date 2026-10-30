// 화면 전환과 AI 답장 요청을 처리합니다.
// 상태는 세 가지입니다: 로딩(버튼 잠금) → 성공(답장 화면) → 실패(입력창 아래 안내 문구)

const MIN_LENGTH = 10;
const MAX_LENGTH = 2000;
const TIMEOUT_MS = 30000;

document.addEventListener("DOMContentLoaded", function () {
    const pages = document.querySelectorAll(".page");
    const diaryForm = document.getElementById("diaryForm");
    const diaryInput = document.getElementById("diaryInput");
    const charCount = document.getElementById("charCount");
    const replyOutput = document.getElementById("replyOutput");
    const errorMessage = document.getElementById("errorMessage");
    const sendButton = document.getElementById("sendButton");
    const buttonText = document.getElementById("buttonText");

    function showPage(pageId) {
        const targetPage = document.getElementById(pageId);

        if (!targetPage) {
            return;
        }

        pages.forEach(function (page) {
            page.classList.remove("active");
        });

        targetPage.classList.add("active");
        window.scrollTo(0, 0);
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove("hidden");
    }

    function clearError() {
        errorMessage.textContent = "";
        errorMessage.classList.add("hidden");
    }

    function setLoading(isLoading) {
        sendButton.disabled = isLoading;
        buttonText.textContent = isLoading ? "편지를 쓰는 중..." : "AI에게 편지 받기";
    }

    // 이모지처럼 두 칸을 차지하는 글자도 1자로 셉니다(서버 Python len 과 같은 기준).
    function countChars(text) {
        return Array.from(text).length;
    }

    function validate(text) {
        const length = countChars(text);

        if (!text) {
            return "오늘의 이야기를 한 줄이라도 작성해주세요.";
        }
        if (length < MIN_LENGTH) {
            return "조금만 더 자세하게 이야기를 적어주세요. (" + MIN_LENGTH + "자 이상)";
        }
        if (length > MAX_LENGTH) {
            return "일기는 " + MAX_LENGTH + "자까지 보낼 수 있어요.";
        }
        return "";
    }

    // 서버가 JSON 대신 HTML 오류 페이지를 줄 때도(배포 오류 등) 안내 문구가 나오게 합니다.
    async function readJson(response) {
        try {
            return await response.json();
        } catch (error) {
            if (error.name === "AbortError") {
                throw error;
            }
            return {};
        }
    }

    async function requestReply(diaryText) {
        const controller = new AbortController();
        const timer = setTimeout(function () {
            controller.abort();
        }, TIMEOUT_MS);

        try {
            const response = await fetch("/api", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ diary: diaryText }),
                signal: controller.signal
            });
            const data = await readJson(response);

            if (!response.ok) {
                throw new Error(data.error || "AI 답장을 받지 못했습니다. 잠시 후 다시 시도해주세요.");
            }
            if (!data.reply) {
                throw new Error("답장이 도착했지만 내용을 읽지 못했어요.");
            }
            return data.reply;
        } catch (error) {
            if (error.name === "AbortError") {
                throw new Error("답장이 늦어지고 있어요. 잠시 후 다시 시도해주세요.");
            }
            throw error;
        } finally {
            clearTimeout(timer);
        }
    }

    document.addEventListener("click", function (event) {
        const button = event.target.closest("[data-page]");

        if (!button) {
            return;
        }

        event.preventDefault();
        showPage(button.getAttribute("data-page"));
    });

    diaryInput.addEventListener("input", function () {
        charCount.textContent = countChars(diaryInput.value) + " / " + MAX_LENGTH + "자";
    });

    diaryForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        clearError();

        const diaryText = diaryInput.value.trim();
        const problem = validate(diaryText);

        if (problem) {
            showError(problem);
            return;
        }

        setLoading(true);

        try {
            replyOutput.textContent = await requestReply(diaryText);
            showPage("letter");
        } catch (error) {
            showError(error.message || "오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    });
});
