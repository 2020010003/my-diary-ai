console.log("app.js 정상 로드됨");

// 화면 전환 함수
function showPage(pageId) {
    console.log("이동할 화면:", pageId);

    const pages = document.querySelectorAll(".page");
    const targetPage = document.getElementById(pageId);

    if (!targetPage) {
        console.error("해당 화면을 찾을 수 없습니다:", pageId);
        return;
    }

    pages.forEach(function (page) {
        page.classList.remove("active");
    });

    targetPage.classList.add("active");
    window.scrollTo(0, 0);
}

// 버튼 클릭으로 화면 이동
document.addEventListener("click", function (event) {
    const button = event.target.closest("[data-page]");

    if (!button) {
        return;
    }

    event.preventDefault();

    const pageId = button.getAttribute("data-page");
    console.log("버튼 클릭됨:", pageId);

    showPage(pageId);
});

// 일기 제출 처리
document.addEventListener("DOMContentLoaded", function () {
    const diaryForm = document.getElementById("diaryForm");
    const diaryInput = document.getElementById("diaryInput");
    const replyOutput = document.getElementById("replyOutput");
    const errorMessage = document.getElementById("errorMessage");
    const sendButton = document.getElementById("sendButton");
    const buttonText = document.getElementById("buttonText");

    function showError(message) {
        if (!errorMessage) {
            alert(message);
            return;
        }

        errorMessage.textContent = message;
        errorMessage.classList.remove("hidden");
    }

    function clearError() {
        if (!errorMessage) {
            return;
        }

        errorMessage.textContent = "";
        errorMessage.classList.add("hidden");
    }

    if (!diaryForm) {
        console.log("diaryForm이 없어서 제출 이벤트는 연결하지 않음");
        return;
    }

    diaryForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        clearError();

        const diaryText = diaryInput.value.trim();

        if (!diaryText) {
            showError("오늘의 이야기를 먼저 적어주세요.");
            return;
        }

        if (sendButton) {
            sendButton.disabled = true;
        }

        if (buttonText) {
            buttonText.textContent = "편지를 쓰는 중...";
        }

        try {
            const response = await fetch("/api", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    diary: diaryText,
                    message: diaryText
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "AI 답장을 받지 못했습니다.");
            }

            const reply =
                data.reply ||
                data.message ||
                data.content ||
                "답장이 도착했지만 내용을 읽지 못했어요.";

            if (replyOutput) {
                replyOutput.textContent = reply;
            }

            showPage("letter");
        } catch (error) {
            console.error("API 오류:", error);
            showError(error.message || "오류가 발생했습니다.");
        } finally {
            if (sendButton) {
                sendButton.disabled = false;
            }

            if (buttonText) {
                buttonText.textContent = "AI에게 편지 받기";
            }
        }
    });
});
<script src="/js/app.js"></script>