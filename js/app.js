document.addEventListener("DOMContentLoaded", function () {
    console.log("app.js 새 버전 로드됨");

    const pages = document.querySelectorAll(".page");
    const pageButtons = document.querySelectorAll("[data-page]");

    const form = document.getElementById("diaryForm");
    const diaryInput = document.getElementById("diaryInput");
    const sendButton = document.getElementById("sendButton");
    const buttonText = document.getElementById("buttonText");
    const loadingSpinner = document.getElementById("loadingSpinner");
    const replyOutput = document.getElementById("replyOutput");
    const errorMessage = document.getElementById("errorMessage");

    function showPage(pageId) {
        const targetPage = document.getElementById(pageId);

        if (!targetPage) {
            console.warn("존재하지 않는 화면입니다:", pageId);
            return;
        }

        pages.forEach(function (page) {
            page.classList.remove("active");
        });

        targetPage.classList.add("active");

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }

    pageButtons.forEach(function (button) {
        button.addEventListener("click", function () {
            const pageId = button.getAttribute("data-page");
            showPage(pageId);
        });
    });

    function setLoading(isLoading) {
        if (sendButton) {
            sendButton.disabled = isLoading;
        }

        if (buttonText) {
            buttonText.textContent = isLoading ? "편지를 쓰는 중..." : "AI에게 편지 받기";
        }

        if (loadingSpinner) {
            if (isLoading) {
                loadingSpinner.classList.remove("hidden");
            } else {
                loadingSpinner.classList.add("hidden");
            }
        }
    }

    function showError(message) {
        if (!errorMessage) return;

        errorMessage.textContent = message;
        errorMessage.classList.remove("hidden");
    }

    function clearError() {
        if (!errorMessage) return;

        errorMessage.textContent = "";
        errorMessage.classList.add("hidden");
    }

    function extractReply(data) {
        if (!data) {
            return "";
        }

        if (typeof data === "string") {
            return data;
        }

        if (data.reply) {
            return data.reply;
        }

        if (data.message) {
            return data.message;
        }

        if (data.content) {
            return data.content;
        }

        if (
            data.choices &&
            data.choices[0] &&
            data.choices[0].message &&
            data.choices[0].message.content
        ) {
            return data.choices[0].message.content;
        }

        return "";
    }

    async function handleSubmit(event) {
        event.preventDefault();

        clearError();

        const diaryText = diaryInput ? diaryInput.value
// 긴급 화면 전환 코드
document.addEventListener("click", function (event) {
    const button = event.target.closest("[data-page]");

    if (!button) {
        return;
    }

    event.preventDefault();

    const pageId = button.getAttribute("data-page");
    const targetPage = document.getElementById(pageId);
    const pages = document.querySelectorAll(".page");

    console.log("화면 이동 버튼 클릭됨:", pageId);

    if (!targetPage) {
        console.error("이동할 화면을 찾을 수 없습니다:", pageId);
        return;
    }

    pages.forEach(function (page) {
        page.classList.remove("active");
    });

    targetPage.classList.add("active");

    window.scrollTo(0, 0);
});