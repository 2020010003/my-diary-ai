document.addEventListener("DOMContentLoaded", function () {
    console.log("app.js 새 버전 로드됨");

    const form = document.getElementById("diaryForm");
    const diaryInput = document.getElementById("diaryInput");
    const sendButton = document.getElementById("sendButton");
    const buttonText = document.getElementById("buttonText");
    const loadingSpinner = document.getElementById("loadingSpinner");
    const resultSection = document.getElementById("resultSection");
    const replyOutput = document.getElementById("replyOutput");
     const pageButtons = document.querySelectorAll("[data-page]");

    function showPage(pageId) {
        const targetPage = document.getElementById(pageId);

        if (!targetPage) {
            console.warn("해당 페이지를 찾을 수 없습니다:", pageId);
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
        button.addEventListener("click", function (event) {
            event.preventDefault();

            const pageId = button.dataset.page;
            showPage(pageId);
        });
    });

    // 처음 로드했을 때 active 페이지가 없으면 첫 번째 page를 보여줌
    if (!document.querySelector(".page.active") && pages.length > 0) {
        pages[0].classList.add("active");
    }

    const API_URL = "/api";

    function setLoading(isLoading) {
        if (sendButton) {
            sendButton.disabled = isLoading;
        }

        if (buttonText) {
            buttonText.textContent = isLoading
                ? "AI가 답장을 쓰고 있어요..."
                : "답장 받기";
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
        console.error(message);

        if (errorMessage) {
            errorMessage.textContent = message;
            errorMessage.classList.remove("hidden");
        }
    }

    function hideError() {
        if (errorMessage) {
            errorMessage.textContent = "";
            errorMessage.classList.add("hidden");
        }
    }

    function showResult(text) {
        if (replyOutput) {
            replyOutput.textContent = text;
        }

        if (resultSection) {
            resultSection.classList.remove("hidden");
        }
    }

    async function requestReply(diaryText) {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                diary: diaryText
            })
        });

        let data = {};

        try {
            data = await response.json();
        } catch (e) {
            data = {};
        }

        if (!response.ok) {
            throw new Error(data.error || "서버 요청에 실패했습니다.");
        }

        return (
            data.reply ||
            data.message ||
            data.result ||
            "답장을 받아왔지만 내용이 비어 있습니다."
        );
    }

    async function handleSubmit(event) {
        if (event) {
            event.preventDefault();
        }

        hideError();

        const diaryText = diaryInput ? diaryInput.value.trim() : "";

        if (!diaryText) {
            showError("일기 내용을 입력해 주세요.");
            return;
        }

        setLoading(true);

        try {
            const reply = await requestReply(diaryText);
            showResult(reply);
        } catch (error) {
            showError(error.message || "답장을 불러오는 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    }

    if (form) {
        form.addEventListener("submit", handleSubmit);
    }

    if (sendButton) {
        sendButton.addEventListener("click", handleSubmit);
    }
});