/*
    오늘의 편지
    Frontend JavaScript
*/


// ========================================
// 페이지 요소 가져오기
// ========================================

const pages = document.querySelectorAll(".page");

const navigationLinks = document.querySelectorAll("[data-page]");


// ========================================
// 일기 작성 관련 요소
// ========================================

const diaryInput = document.getElementById("diary");

const charCount = document.getElementById("char-count");

const sendButton = document.getElementById("send-button");

const buttonText = document.getElementById("button-text");

const loadingSpinner =
    document.getElementById("loading-spinner");

const errorMessage =
    document.getElementById("error-message");


// ========================================
// AI 답장 관련 요소
// ========================================

const aiResponse =
    document.getElementById("ai-response");


// ========================================
// 페이지 이동 함수
// ========================================

function showPage(pageName) {

    // 모든 페이지 숨기기
    pages.forEach((page) => {

        page.classList.remove("active");

    });


    // 선택한 페이지 찾기
    const targetPage =
        document.getElementById(pageName);


    // 페이지가 존재하면 보여주기
    if (targetPage) {

        targetPage.classList.add("active");

    }


    // 페이지 위쪽으로 이동
    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


// ========================================
// 페이지 이동
// ========================================

function navigate(pageName) {

    const currentHash =
        window.location.hash;


    const newHash =
        `#${pageName}`;


    if (currentHash !== newHash) {

        window.location.hash =
            pageName;

    } else {

        showPage(pageName);

    }

}


// ========================================
// 메뉴 버튼 클릭
// ========================================

navigationLinks.forEach((link) => {

    link.addEventListener("click", (event) => {

        event.preventDefault();


        const pageName =
            link.dataset.page;


        navigate(pageName);

    });

});


// ========================================
// 주소의 #home, #write 등을 감지
// ========================================

window.addEventListener(
    "hashchange",
    () => {

        const pageName =
            window.location.hash.replace(
                "#",
                ""
            ) || "home";


        showPage(pageName);

    }
);


// ========================================
// 처음 웹사이트를 열었을 때
// ========================================

const initialPage =
    window.location.hash.replace(
        "#",
        ""
    ) || "home";


showPage(initialPage);


// ========================================
// 일기 글자 수 표시
// ========================================

diaryInput.addEventListener(
    "input",
    () => {

        const length =
            diaryInput.value.length;


        charCount.textContent =
            `${length} / 3000`;

    }
);


// ========================================
// 오류 메시지 보여주기
// ========================================

function showError(message) {

    errorMessage.textContent =
        message;


    errorMessage.classList.remove(
        "hidden"
    );

}


// ========================================
// 오류 메시지 숨기기
// ========================================

function hideError() {

    errorMessage.textContent = "";


    errorMessage.classList.add(
        "hidden"
    );

}


// ========================================
// AI 요청 중 화면
// ========================================

function setLoading(isLoading) {


    // AI 요청 중
    if (isLoading) {

        sendButton.disabled = true;


        buttonText.textContent =
            "AI가 답장을 쓰고 있어요";


        loadingSpinner.classList.remove(
            "hidden"
        );


    }

    // AI 요청 끝
    else {

        sendButton.disabled = false;


        buttonText.textContent =
            "AI에게 답장 받기";


        loadingSpinner.classList.add(
            "hidden"
        );

    }

}


// ========================================
// Python API에 일기 보내기
// ========================================

async function requestAiLetter(diary) {


    // 30초 타임아웃 설정
    const controller =
        new AbortController();


    const timeoutId =
        setTimeout(() => {

            controller.abort();

        }, 30000);


    try {


        // Python API 호출
        const response =
            await fetch(
                "/api/diary",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        diary: diary
                    }),

                    signal:
                        controller.signal

                }
            );


        // 서버 응답을 JSON으로 변환
        let data = {};


        try {

            data =
                await response.json();

        }

        catch {

            throw new Error(
                "서버에서 올바른 응답을 받지 못했습니다."
            );

        }


        // 서버에서 오류가 발생한 경우
        if (!response.ok) {

            throw new Error(
                data.error ||
                "AI 서버에서 오류가 발생했습니다."
            );

        }


        // AI 답장이 없는 경우
        if (!data.reply) {

            throw new Error(
                "AI 답장을 받지 못했습니다."
            );

        }


        // AI 답장 반환
        return data.reply;


    }

    catch (error) {


        // 30초 타임아웃
        if (
            error.name ===
            "AbortError"
        ) {

            throw new Error(
                "AI의 답장이 늦어지고 있습니다. 잠시 후 다시 시도해주세요."
            );

        }


        // 다른 오류
        throw error;

    }

    finally {

        clearTimeout(timeoutId);

    }

}


// ========================================
// "AI에게 답장 받기" 버튼
// ========================================

sendButton.addEventListener(
    "click",
    async () => {


        // 기존 오류 제거
        hideError();


        // 일기 내용 가져오기
        const diary =
            diaryInput.value.trim();


        // ====================================
        // 빈 입력 검사
        // ====================================

        if (!diary) {

            showError(
                "오늘의 이야기를 한 줄이라도 작성해주세요."
            );


            diaryInput.focus();


            return;

        }


        // ====================================
        // 너무 짧은 입력 검사
        // ====================================

        if (diary.length < 5) {

            showError(
                "조금만 더 자세하게 이야기를 적어주세요."
            );


            diaryInput.focus();


            return;

        }


        // ====================================
        // 로딩 시작
        // ====================================

        setLoading(true);


        try {


            // Python API에 일기 전송
            const reply =
                await requestAiLetter(
                    diary
                );


            // AI 답장 화면에 표시
            aiResponse.textContent =
                reply;


            // 편지 페이지로 이동
            navigate("letter");


        }

        catch (error) {


            console.error(
                "AI 요청 오류:",
                error
            );


            showError(
                error.message ||
                "AI 답장을 가져오는 중 문제가 발생했습니다."
            );

        }

        finally {

            // 로딩 종료
            setLoading(false);

        }

    }
);


// ========================================
// Ctrl + Enter로 AI 요청
// ========================================

diaryInput.addEventListener(
    "keydown",
    (event) => {


        if (
            event.key === "Enter" &&
            event.ctrlKey
        ) {

            event.preventDefault();


            sendButton.click();

        }

    }
);