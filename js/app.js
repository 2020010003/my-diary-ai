/*
    오늘의 편지
    Frontend JavaScript
*/

// ========================================
// 구글 앱스 스크립트 웹 앱 URL
// ========================================
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbymV2J8YMBL8O375s0mtPP190U3iwadDx99jwNzJvaCY7t-r0ZqxteJoHCzYi5ARi0/exec";


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

const letterMemory =
    document.getElementById("letter-memory");


// ========================================
// 감정 기록 저장 동의 체크박스
// 체크 상태를 localStorage에 기억해서 다음 방문 때도 유지
// ========================================

const memoryConsent =
    document.getElementById("memory-consent");

// 설정 화면의 "감정 기록 저장" 스위치 (일기 쓰기 화면의 동의 체크와 같은 값)
const settingsMemory =
    document.getElementById("settings-memory");

const CONSENT_KEY = "diary_memory_consent";


// 동의 값을 두 화면의 체크박스와 localStorage에 함께 반영
function setMemoryConsent(value) {

    memoryConsent.checked = value;
    settingsMemory.checked = value;

    try {

        window.localStorage.setItem(
            CONSENT_KEY,
            value ? "true" : "false"
        );

    } catch (error) {

        // 저장 실패 시 이번 페이지에서만 유지

    }

}


let savedConsent = false;

try {

    savedConsent =
        window.localStorage.getItem(CONSENT_KEY) === "true";

} catch (error) {

    // localStorage를 쓸 수 없으면 체크 해제 상태로 시작
    savedConsent = false;

}

memoryConsent.checked = savedConsent;
settingsMemory.checked = savedConsent;

memoryConsent.addEventListener(
    "change",
    () => {

        setMemoryConsent(memoryConsent.checked);

    }
);

settingsMemory.addEventListener(
    "change",
    () => {

        setMemoryConsent(settingsMemory.checked);

    }
);


// ========================================
// 설정 화면 요소
// ========================================

const settingsEmail =
    document.getElementById("settings-email");

const settingsTime =
    document.getElementById("settings-time");

const settingsNotify =
    document.getElementById("settings-notify");

const settingsSaveButton =
    document.getElementById("settings-save-button");

const settingsStatus =
    document.getElementById("settings-status");

const settingsMessage =
    document.getElementById("settings-message");


// ========================================
// 마음 기록 화면 요소
// ========================================

const memoriesList =
    document.getElementById("memories-list");

const memoriesEmpty =
    document.getElementById("memories-empty");

const memoriesStatus =
    document.getElementById("memories-status");

const memoriesMessage =
    document.getElementById("memories-message");

const deleteArea =
    document.getElementById("delete-area");

const deleteOpenButton =
    document.getElementById("delete-open-button");

const deleteConfirm =
    document.getElementById("delete-confirm");

const deleteCancelButton =
    document.getElementById("delete-cancel-button");

const deleteConfirmButton =
    document.getElementById("delete-confirm-button");


// ========================================
// 사용자 구분 (로그인 없음)
// 처음 방문 시 user_id를 만들어 localStorage에 저장하고,
// 모든 API 요청 body에 같이 보냄
// ========================================

const USER_ID_KEY = "diary_user_id";

// UUID 만들기 (crypto.randomUUID가 없는 환경 대비)
function createUuid() {

    if (window.crypto && typeof window.crypto.randomUUID === "function") {

        return window.crypto.randomUUID();

    }

    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);

    // UUID v4 형식 맞추기
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (b) =>
        b.toString(16).padStart(2, "0")
    ).join("");

    return (
        hex.slice(0, 8) + "-" +
        hex.slice(8, 12) + "-" +
        hex.slice(12, 16) + "-" +
        hex.slice(16, 20) + "-" +
        hex.slice(20)
    );

}

// 저장된 user_id를 읽고, 없으면 새로 만들어 저장
// localStorage를 쓸 수 없으면 이 페이지에서만 쓰는 임시 ID 사용
function loadUserId() {

    try {

        const saved = window.localStorage.getItem(USER_ID_KEY);

        if (saved) {

            return saved;

        }

        const newId = createUuid();
        window.localStorage.setItem(USER_ID_KEY, newId);

        return newId;

    } catch (error) {

        return createUuid();

    }

}

const userId = loadUserId();


// ========================================
// 페이지 이동 함수
// ========================================

function showPage(pageName) {

    // 받은 편지가 없는데 편지 화면을 열면 (새로고침, #letter 주소 직접 입력 등)
    // 빈 편지 대신 일기 쓰기 화면과 안내 문구를 보여줌
    if (
        pageName === "letter" &&
        !aiResponse.textContent.trim()
    ) {

        pageName = "write";

        showError(
            "아직 받은 편지가 없어요. 일기를 쓰고 답장을 받아보세요."
        );

    }


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


    // 화면에 들어올 때 서버에서 최신 값 불러오기
    if (pageName === "settings") {

        loadSettings();

    }

    if (pageName === "memories") {

        loadMemories();

    }

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

// 편지 아래에 "오늘의 마음: 불안 · 학교 발표를 앞두고 긴장함" 표시
function showMemory(memory) {

    if (!memory || !memory.emotion) {

        letterMemory.textContent = "";
        letterMemory.classList.add("hidden");

        return;

    }

    let text = "오늘의 마음: " + memory.emotion;

    if (memory.situation) {

        text += " · " + memory.situation;

    }

    letterMemory.textContent = text;
    letterMemory.classList.remove("hidden");

}


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
                        diary: diary,
                        user_id: userId,
                        memory_consent: memoryConsent.checked
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


        // AI 답장이 없거나 비어 있는 경우 (빈 편지를 보여주지 않음)
        if (
            typeof data.reply !== "string" ||
            !data.reply.trim()
        ) {

            throw new Error(
                "AI가 빈 답장을 보냈어요. 잠시 후 다시 시도해주세요."
            );

        }


        // AI 답장 + 감정 요약(없으면 null) 반환
        return {
            reply: data.reply,
            memory: data.memory || null
        };


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
            const result =
                await requestAiLetter(
                    diary
                );


            // AI 답장 화면에 표시
            aiResponse.textContent =
                result.reply;


            // 오늘의 마음 표시 (감정 요약이 있을 때만)
            showMemory(result.memory);


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


// ========================================
// 설정 / 마음 기록 API 공통 요청
// ========================================

// 서버 API 호출. 실패하면 서버가 준 한국어 안내 문구로 Error를 던짐
async function apiRequest(method, path, body) {

    const controller =
        new AbortController();

    const timeoutId =
        setTimeout(() => {

            controller.abort();

        }, 15000);


    // GET / DELETE는 user_id를 주소에, POST는 body에 담음
    let url = path;

    const options = {
        method: method,
        signal: controller.signal
    };

    if (method === "GET" || method === "DELETE") {

        url += "?user_id=" + encodeURIComponent(userId);

    } else {

        options.headers = {
            "Content-Type": "application/json"
        };

        options.body = JSON.stringify(
            Object.assign({ user_id: userId }, body || {})
        );

    }


    try {

        const response =
            await fetch(url, options);

        let data = {};

        try {

            data = await response.json();

        } catch {

            throw new Error(
                "서버에서 올바른 응답을 받지 못했어요."
            );

        }

        if (!response.ok) {

            throw new Error(
                data.error ||
                "요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요."
            );

        }

        return data;

    } catch (error) {

        if (error.name === "AbortError") {

            throw new Error(
                "서버 응답이 늦어지고 있어요. 잠시 후 다시 시도해주세요."
            );

        }

        throw error;

    } finally {

        clearTimeout(timeoutId);

    }

}


// 안내 문구 표시 (type: "error" 또는 "success")
function showCardMessage(element, type, text) {

    element.textContent = text;

    element.classList.remove("error", "success");
    element.classList.add(type);
    element.classList.remove("hidden");

}

function hideCardMessage(element) {

    element.textContent = "";
    element.classList.add("hidden");

}


// ========================================
// 설정 화면
// ========================================

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;


// 화면에 들어올 때 현재 설정 불러오기
async function loadSettings() {

    hideCardMessage(settingsMessage);

    settingsStatus.textContent = "설정을 불러오는 중이에요...";
    settingsStatus.classList.remove("hidden");

    try {

        const data =
            await apiRequest("GET", "/api/settings");

        settingsEmail.value = data.email || "";
        settingsTime.value = data.notify_time || "";
        settingsNotify.checked = data.notify_enabled === true;

        // 기억 기능 스위치는 일기 쓰기 화면의 동의 체크 값을 그대로 따름
        settingsMemory.checked = memoryConsent.checked;

        settingsStatus.classList.add("hidden");

    } catch (error) {

        settingsStatus.classList.add("hidden");

        // 초기 로딩 오류는 화면상 단순 표시용
        showCardMessage(
            settingsMessage,
            "error",
            error.message
        );

    }

}


settingsSaveButton.addEventListener(
    "click",
    async () => {

        hideCardMessage(settingsMessage);

        const email = settingsEmail.value.trim();
        const notifyTime = settingsTime.value.trim();
        const notifyEnabled = settingsNotify.checked;


        // 형식 검사
        if (email && !EMAIL_PATTERN.test(email)) {

            showCardMessage(
                settingsMessage,
                "error",
                "이메일 형식이 올바르지 않아요."
            );

            settingsEmail.focus();

            return;

        }

        if (notifyTime && !TIME_PATTERN.test(notifyTime)) {

            showCardMessage(
                settingsMessage,
                "error",
                "알림 시간은 HH:MM 형식(예: 21:30)으로 입력해주세요."
            );

            settingsTime.focus();

            return;

        }

        if (notifyEnabled && (!email || !notifyTime)) {

            showCardMessage(
                settingsMessage,
                "error",
                "알림을 받으려면 이메일과 알림 시간을 모두 입력해주세요."
            );

            return;

        }


        settingsSaveButton.disabled = true;
        settingsSaveButton.textContent = "저장하는 중...";

        try {

            // 구글 시트 웹 앱으로 설정 데이터 보내기
            const payload = {
                user_id: userId,
                email: email,
                alarm_time: notifyTime,
                enabled: notifyEnabled,
                timezone: "Asia/Seoul"
            };

            await fetch(GOOGLE_SCRIPT_URL, {
                method: "POST",
                mode: "no-cors",
                headers: {
                    "Content-Type": "text/plain;charset=utf-8",
                },
                body: JSON.stringify(payload)
            });

            // 저장 성공 시 일기 쓰기 화면의 동의 체크도 같은 값으로
            setMemoryConsent(settingsMemory.checked);

            showCardMessage(
                settingsMessage,
                "success",
                "설정을 저장했어요."
            );

        } catch (error) {

            showCardMessage(
                settingsMessage,
                "error",
                "저장 중 오류가 발생했어요."
            );

        } finally {

            settingsSaveButton.disabled = false;
            settingsSaveButton.textContent = "설정 저장하기";

        }

    }
);


// ========================================
// 마음 기록 화면
// ========================================

// "2026-11-06" → "2026.11.06"
function formatMemoryDate(dateText) {

    return (dateText || "").replace(/-/g, ".");

}

// 강도 1~5를 ●●●○○ 모양으로
function formatIntensity(intensity) {

    const value =
        Math.max(1, Math.min(5, Number(intensity) || 0));

    return "●".repeat(value) + "○".repeat(5 - value);

}


// 기록 목록 그리기 (서버 값은 textContent로만 넣음)
function renderMemories(memories) {

    memoriesList.textContent = "";

    if (!memories.length) {

        memoriesEmpty.classList.remove("hidden");
        deleteArea.classList.add("hidden");

        return;

    }

    memoriesEmpty.classList.add("hidden");
    deleteArea.classList.remove("hidden");

    memories.forEach((memory) => {

        const item = document.createElement("li");
        item.className = "memory-item";

        const date = document.createElement("span");
        date.className = "memory-date";
        date.textContent = formatMemoryDate(memory.date);

        const emotion = document.createElement("span");
        emotion.className = "memory-emotion";
        emotion.textContent = memory.emotion || "기록";

        const intensity = document.createElement("span");
        intensity.className = "memory-intensity";
        intensity.textContent = formatIntensity(memory.intensity);
        intensity.title = "감정의 세기 " + (Number(memory.intensity) || "-") + " / 5";

        item.append(date, emotion, intensity);

        if (memory.situation) {

            const situation = document.createElement("p");
            situation.className = "memory-situation";
            situation.textContent = memory.situation;

            item.append(situation);

        }

        memoriesList.append(item);

    });

}


// 화면에 들어올 때 내 기록 불러오기
async function loadMemories() {

    hideCardMessage(memoriesMessage);
    deleteConfirm.classList.add("hidden");

    memoriesStatus.textContent = "마음 기록을 불러오는 중이에요...";
    memoriesStatus.classList.remove("hidden");

    try {

        const data =
            await apiRequest("GET", "/api/memories");

        memoriesStatus.classList.add("hidden");

        renderMemories(
            Array.isArray(data.memories) ? data.memories : []
        );

    } catch (error) {

        memoriesStatus.classList.add("hidden");

        memoriesList.textContent = "";
        memoriesEmpty.classList.add("hidden");
        deleteArea.classList.add("hidden");

        showCardMessage(
            memoriesMessage,
            "error",
            error.message
        );

    }

}


// 전체 삭제: 화면 안의 확인 영역에서 한 번 더 확인
deleteOpenButton.addEventListener(
    "click",
    () => {

        hideCardMessage(memoriesMessage);
        deleteConfirm.classList.remove("hidden");

    }
);

deleteCancelButton.addEventListener(
    "click",
    () => {

        deleteConfirm.classList.add("hidden");

    }
);

deleteConfirmButton.addEventListener(
    "click",
    async () => {

        deleteConfirmButton.disabled = true;
        deleteCancelButton.disabled = true;
        deleteConfirmButton.textContent = "삭제하는 중...";

        try {

            await apiRequest("DELETE", "/api/memories");

            deleteConfirm.classList.add("hidden");

            renderMemories([]);

            showCardMessage(
                memoriesMessage,
                "success",
                "마음 기록을 모두 삭제했어요."
            );

        } catch (error) {

            showCardMessage(
                memoriesMessage,
                "error",
                error.message
            );

        } finally {

            deleteConfirmButton.disabled = false;
            deleteCancelButton.disabled = false;
            deleteConfirmButton.textContent = "전체 삭제하기";

        }

    }
);
