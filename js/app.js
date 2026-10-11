/*
    ?ㅻ뒛???몄?
    Frontend JavaScript
*/


// ========================================
// ?섏씠吏 ?붿냼 媛?몄삤湲?
// ========================================

const pages = document.querySelectorAll(".page");

const navigationLinks = document.querySelectorAll("[data-page]");


// ========================================
// ?쇨린 ?묒꽦 愿???붿냼
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
// AI ?듭옣 愿???붿냼
// ========================================

const aiResponse =
    document.getElementById("ai-response");


// ========================================
// ?섏씠吏 ?대룞 ?⑥닔
// ========================================

function showPage(pageName) {

    // 紐⑤뱺 ?섏씠吏 ?④린湲?
    pages.forEach((page) => {

        page.classList.remove("active");

    });


    // ?좏깮???섏씠吏 李얘린
    const targetPage =
        document.getElementById(pageName);


    // ?섏씠吏媛 議댁옱?섎㈃ 蹂댁뿬二쇨린
    if (targetPage) {

        targetPage.classList.add("active");

    }


    // ?섏씠吏 ?꾩そ?쇰줈 ?대룞
    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


// ========================================
// ?섏씠吏 ?대룞
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
// 硫붾돱 踰꾪듉 ?대┃
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
// 二쇱냼??#home, #write ?깆쓣 媛먯?
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
// 泥섏쓬 ?뱀궗?댄듃瑜??댁뿀????
// ========================================

const initialPage =
    window.location.hash.replace(
        "#",
        ""
    ) || "home";


showPage(initialPage);


// ========================================
// ?쇨린 湲?????쒖떆
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
// ?ㅻ쪟 硫붿떆吏 蹂댁뿬二쇨린
// ========================================

function showError(message) {

    errorMessage.textContent =
        message;


    errorMessage.classList.remove(
        "hidden"
    );

}


// ========================================
// ?ㅻ쪟 硫붿떆吏 ?④린湲?
// ========================================

function hideError() {

    errorMessage.textContent = "";


    errorMessage.classList.add(
        "hidden"
    );

}


// ========================================
// AI ?붿껌 以??붾㈃
// ========================================

function setLoading(isLoading) {


    // AI ?붿껌 以?
    if (isLoading) {

        sendButton.disabled = true;


        buttonText.textContent =
            "AI媛 ?듭옣???곌퀬 ?덉뼱??;


        loadingSpinner.classList.remove(
            "hidden"
        );


    }

    // AI ?붿껌 ??
    else {

        sendButton.disabled = false;


        buttonText.textContent =
            "AI?먭쾶 ?듭옣 諛쏄린";


        loadingSpinner.classList.add(
            "hidden"
        );

    }

}


// ========================================
// Python API???쇨린 蹂대궡湲?
// ========================================

async function requestAiLetter(diary) {


    // 30珥???꾩븘???ㅼ젙
    const controller =
        new AbortController();


    const timeoutId =
        setTimeout(() => {

            controller.abort();

        }, 30000);


    try {


        // Python API ?몄텧
        const response =
            await fetch(
                "/api",
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


        // ?쒕쾭 ?묐떟??JSON?쇰줈 蹂??
        let data = {};


        try {

            data =
                await response.json();

        }

        catch {

            throw new Error(
                "?쒕쾭?먯꽌 ?щ컮瑜??묐떟??諛쏆? 紐삵뻽?듬땲??"
            );

        }


        // ?쒕쾭?먯꽌 ?ㅻ쪟媛 諛쒖깮??寃쎌슦
        if (!response.ok) {

            throw new Error(
                data.error ||
                "AI ?쒕쾭?먯꽌 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎."
            );

        }


        // AI ?듭옣???녿뒗 寃쎌슦
        if (!data.reply) {

            throw new Error(
                "AI ?듭옣??諛쏆? 紐삵뻽?듬땲??"
            );

        }


        // AI ?듭옣 諛섑솚
        return data.reply;


    }

    catch (error) {


        // 30珥???꾩븘??
        if (
            error.name ===
            "AbortError"
        ) {

            throw new Error(
                "AI???듭옣????뼱吏怨??덉뒿?덈떎. ?좎떆 ???ㅼ떆 ?쒕룄?댁＜?몄슂."
            );

        }


        // ?ㅻⅨ ?ㅻ쪟
        throw error;

    }

    finally {

        clearTimeout(timeoutId);

    }

}


// ========================================
// "AI?먭쾶 ?듭옣 諛쏄린" 踰꾪듉
// ========================================

sendButton.addEventListener(
    "click",
    async () => {


        // 湲곗〈 ?ㅻ쪟 ?쒓굅
        hideError();


        // ?쇨린 ?댁슜 媛?몄삤湲?
        const diary =
            diaryInput.value.trim();


        // ====================================
        // 鍮??낅젰 寃??
        // ====================================

        if (!diary) {

            showError(
                "?ㅻ뒛???댁빞湲곕? ??以꾩씠?쇰룄 ?묒꽦?댁＜?몄슂."
            );


            diaryInput.focus();


            return;

        }


        // ====================================
        // ?덈Т 吏㏃? ?낅젰 寃??
        // ====================================

        if (diary.length < 5) {

            showError(
                "議곌툑留????먯꽭?섍쾶 ?댁빞湲곕? ?곸뼱二쇱꽭??"
            );


            diaryInput.focus();


            return;

        }


        // ====================================
        // 濡쒕뵫 ?쒖옉
        // ====================================

        setLoading(true);


        try {


            // Python API???쇨린 ?꾩넚
            const reply =
                await requestAiLetter(
                    diary
                );


            // AI ?듭옣 ?붾㈃???쒖떆
            aiResponse.textContent =
                reply;


            // ?몄? ?섏씠吏濡??대룞
            navigate("letter");


        }

        catch (error) {


            console.error(
                "AI ?붿껌 ?ㅻ쪟:",
                error
            );


            showError(
                error.message ||
                "AI ?듭옣??媛?몄삤??以?臾몄젣媛 諛쒖깮?덉뒿?덈떎."
            );

        }

        finally {

            // 濡쒕뵫 醫낅즺
            setLoading(false);

        }

    }
);


// ========================================
// Ctrl + Enter濡?AI ?붿껌
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
