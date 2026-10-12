console.log("js/app.js 정상 로드됨");

document.addEventListener("DOMContentLoaded", function () {
    const pages = document.querySelectorAll(".page");

    function showPage(pageId) {
        console.log("화면 이동:", pageId);

        const targetPage = document.getElementById(pageId);

        if (!targetPage) {
            console.error("없는 화면 ID:", pageId);
            return;
        }

        pages.forEach(function (page) {
            page.classList.remove("active");
        });

        targetPage.classList.add("active");
        window.scrollTo(0, 0);
    }

    window.showPage = showPage;

    document.body.addEventListener("click", function (event) {
        const button = event.target.closest("[data-page]");

        if (!button) {
            return;
        }

        event.preventDefault();

        const pageId = button.getAttribute("data-page");
        showPage(pageId);
    });

    const diaryForm = document.getElementById("diaryForm");
    const diaryInput = document.getElementById("diaryInput");
    const replyOutput = document.getElementById("replyOutput");

    if (!diaryForm) {
        console.log("diaryForm 없음. 화면 전환만 사용합니다.");
        return;
    }

    diaryForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const diaryText = diaryInput.value.trim();

        if (!diaryText) {
            alert("일기를 먼저 입력해주세요.");
            return;
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

            if (replyOutput) {
                replyOutput.textContent = data.reply || data.message || "답장이 도착했어요.";
            }

            showPage("letter");
        } catch (error) {
            console.error(error);
            alert("오류가 발생했습니다: " + error.message);
        }
    });
});