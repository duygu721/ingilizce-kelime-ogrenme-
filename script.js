let allData = {};
let currentCategory = "";
let currentLevelName = "";
let pool = [];
let currentWord = null;
let learnedCount = 0;
let lastWordsHistory = [];

let askedLevelPassChoice = false;
let mustLearnAllWords = false;

let levelProgress = {};
let reviewMode = false;
let reviewLevels = [];
let reviewTargetLevel = "";
let reviewAnsweredCount = 0;

let forcedWord = null;
let answerLocked = false;

const nextButton = document.getElementById("next-btn");
const userInput = document.getElementById("user-input");

function normalizeText(text) {
    return String(text)
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ")
        .replace(/[.,!?;:()[\]{}"'`´]/g, "")
        .replace(/ç/g, "c")
        .replace(/ğ/g, "g")
        .replace(/ı/g, "i")
        .replace(/i̇/g, "i")
        .replace(/ö/g, "o")
        .replace(/ş/g, "s")
        .replace(/ü/g, "u");
}

function speak(text, isSlow = false) {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();

    const preferredVoice =
        voices.find(v => v.name.includes("Google") && v.lang.includes("en")) ||
        voices.find(v => v.lang.includes("en"));

    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.rate = isSlow ? 0.35 : 0.85;
    utterance.pitch = 1;
    utterance.lang = "en-US";

    window.speechSynthesis.speak(utterance);
}

window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
};

function createChoiceModal() {
    if (document.getElementById("level-choice-modal")) return;

    const modal = document.createElement("div");
    modal.id = "level-choice-modal";
    modal.style.display = "none";
    modal.style.position = "fixed";
    modal.style.inset = "0";
    modal.style.background = "rgba(0, 0, 0, 0.45)";
    modal.style.justifyContent = "center";
    modal.style.alignItems = "center";
    modal.style.zIndex = "9999";

    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 14px; width: 90%; max-width: 420px; box-shadow: 0 6px 20px rgba(0,0,0,0.2); text-align: center;">
            <h3 style="margin-top: 0;">Seviye Tamamlama</h3>
            <p style="line-height: 1.5;">
                Seviyeyi geçmek için yeterli kelime bildiniz.<br>
                Ne yapmak istersiniz?
            </p>
            <button id="modal-next-level-btn" class="cat-btn" style="display:block; width:100%; margin:10px 0;">Yeni seviyeye geç</button>
            <button id="modal-learn-all-btn" class="cat-btn" style="display:block; width:100%; margin:10px 0;">Tüm kelimeleri öğren</button>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById("modal-next-level-btn").onclick = () => {
        hideChoiceModal();
        finishLevel();
    };

    document.getElementById("modal-learn-all-btn").onclick = () => {
        mustLearnAllWords = true;
        hideChoiceModal();
        askQuestion();
    };
}

function showChoiceModal() {
    const modal = document.getElementById("level-choice-modal");
    if (modal) modal.style.display = "flex";
}

function hideChoiceModal() {
    const modal = document.getElementById("level-choice-modal");
    if (modal) modal.style.display = "none";
}

async function loadWords() {
    try {
        const res = await fetch("words.json");
        allData = await res.json();
        initLevelProgress();
        createChoiceModal();
        renderCategories();
    } catch (e) {
        console.error("Veri yuklenemedi!", e);
        alert("words.json yuklenemedi.");
    }
}

function initLevelProgress() {
    levelProgress = {};

    Object.keys(allData).forEach(category => {
        levelProgress[category] = {};

        Object.keys(allData[category]).forEach(level => {
            levelProgress[category][level] = allData[category][level].map(word => ({
                ...word,
                learned: false
            }));
        });
    });
}

function selectCategory(cat) {
    currentCategory = cat;
    document.getElementById("category-selection").style.display = "none";
    document.getElementById("level-selection").style.display = "block";
    document.getElementById("game-area").style.display = "none";
    renderLevels();
}

function getOrderedLevelsForCurrentCategory() {
    const orderedLevels = ["a1", "a2", "b1", "b2", "c1", "c2"];
    const levels = Object.keys(allData[currentCategory] || {});

    return levels.sort((a, b) => {
        const ai = orderedLevels.indexOf(a);
        const bi = orderedLevels.indexOf(b);

        if (ai === -1 && bi === -1) return a.localeCompare(b);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
    });
}

async function startWithLevel(lvl) {
    currentLevelName = lvl;
    learnedCount = 0;
    lastWordsHistory = [];
    askedLevelPassChoice = false;
    mustLearnAllWords = false;
    reviewMode = false;
    reviewLevels = [];
    reviewTargetLevel = "";
    reviewAnsweredCount = 0;
    forcedWord = null;
    currentWord = null;

    if (Object.keys(allData).length === 0) {
        await loadWords();
    }

    const allWordsInCat = allData[currentCategory]?.[currentLevelName];

    if (!allWordsInCat || allWordsInCat.length < 5) {
        alert("Bu seviyede (" + lvl.toUpperCase() + ") yeterli kelime bulunamadi!");
        location.reload();
        return;
    }

    pool = [...allWordsInCat]
        .sort(() => Math.random() - 0.5)
        .slice(0, 10)
        .map(w => ({ ...w, step: 1, wrongCount: 0 }));

    document.getElementById("level-selection").style.display = "none";
    document.getElementById("game-area").style.display = "block";

    updateStats();
    askQuestion();
}

function updateStats() {
    document.getElementById("stat-cat").innerText = currentCategory ? currentCategory.toUpperCase() : "-";

    if (reviewMode) {
        document.getElementById("stat-lvl").innerText = reviewLevels.map(l => l.toUpperCase()).join("+") + " TEST";
        document.getElementById("stat-count").innerText = reviewAnsweredCount;
    } else {
        document.getElementById("stat-lvl").innerText = currentLevelName ? currentLevelName.toUpperCase() : "-";
        document.getElementById("stat-count").innerText = learnedCount;
    }
}

function getCurrentQuestionMode() {
    return reviewMode ? currentWord.questionMode : currentWord.step;
}

function getCorrectAnswerForCurrentQuestion() {
    const mode = getCurrentQuestionMode();
    if (mode === 1 || mode === 3 || mode === 4) return currentWord.en;
    return currentWord.tr;
}

function getQuestionSourceWords() {
    if (!reviewMode) return allData[currentCategory][currentLevelName] || [];

    let words = [];
    reviewLevels.forEach(level => {
        words = words.concat(allData[currentCategory][level] || []);
    });
    return words;
}

function askQuestion() {
    if (reviewMode) {
        if (pool.length === 0) {
            finishReviewTest();
            return;
        }
    } else {
        if (pool.length === 0) {
            finishLevel();
            return;
        }

        if (learnedCount >= 8 && !askedLevelPassChoice && !mustLearnAllWords) {
            askedLevelPassChoice = true;
            showChoiceModal();
            return;
        }
    }

    let selectedWord;

    if (forcedWord && pool.includes(forcedWord)) {
        selectedWord = forcedWord;
    } else {
        let availableWords = pool.filter(w => !lastWordsHistory.includes(w.en));

        if (availableWords.length === 0) {
            lastWordsHistory = [];
            availableWords = pool;
        }

        selectedWord = availableWords[Math.floor(Math.random() * availableWords.length)];
    }

    lastWordsHistory.push(selectedWord.en);
    if (lastWordsHistory.length > 2) lastWordsHistory.shift();

    currentWord = selectedWord;
    answerLocked = false;

    const stepTexts = [
        "",
        "TR -> EN (Seçim)",
        "EN -> TR (Seçim)",
        "TR -> EN (Yazım)",
        "Dinle ve Yaz"
    ];

    const mode = getCurrentQuestionMode();

    document.getElementById("level-step-info").innerText = reviewMode
        ? "Tekrar Testi: " + stepTexts[mode]
        : "Aşama: " + stepTexts[mode];

    document.getElementById("result-text").innerText = "";
    document.getElementById("result-text").className = "";
    nextButton.style.display = "none";
    userInput.value = "";

    if (mode <= 2) {
        showMultipleChoice();
    } else {
        showInputArea();

        if (mode === 4) {
            document.getElementById("question").innerHTML = `
                <div style="display: flex; justify-content: center; gap: 20px; flex-wrap: wrap;">
                    <button id="speak-normal-btn" style="font-size: 40px; border: none; background: none; cursor: pointer;">
                        🔊 <span style="font-size: 14px; display: block;">Normal</span>
                    </button>
                    <button id="speak-slow-btn" style="font-size: 40px; border: none; background: none; cursor: pointer;">
                        🐢 <span style="font-size: 14px; display: block;">Yavaş</span>
                    </button>
                </div>
                <button id="cant-listen-btn" class="cat-btn" style="margin-top: 14px;">
                    Şu anda dinleyemiyorum
                </button>
            `;

            document.getElementById("speak-normal-btn").onclick = () => speak(currentWord.en);
            document.getElementById("speak-slow-btn").onclick = () => speak(currentWord.en, true);
            document.getElementById("cant-listen-btn").onclick = () => checkResult(true, currentWord.en);

            speak(currentWord.en);
        } else {
            document.getElementById("question").innerText = mode === 3 ? currentWord.tr : currentWord.en;
        }
    }
}

function showMultipleChoice() {
    document.getElementById("answers").style.display = "block";
    document.getElementById("input-area").style.display = "none";

    const mode = getCurrentQuestionMode();
    const isStep1 = mode === 1;
    document.getElementById("question").innerText = isStep1 ? currentWord.tr : currentWord.en;

    const correct = isStep1 ? currentWord.en : currentWord.tr;
    const sourceWords = getQuestionSourceWords();

    const options = [correct];

    while (options.length < 4 && sourceWords.length > 0) {
        const randomWord = sourceWords[Math.floor(Math.random() * sourceWords.length)];
        const randomValue = randomWord[isStep1 ? "en" : "tr"];
        if (!options.includes(randomValue)) options.push(randomValue);
    }

    options.sort(() => Math.random() - 0.5);

    const div = document.getElementById("answers");
    div.innerHTML = "";

    options.forEach(opt => {
        const btn = document.createElement("button");
        btn.innerText = opt;
        btn.onclick = () => checkResult(normalizeText(opt) === normalizeText(correct), correct);
        div.appendChild(btn);
    });
}

function showInputArea() {
    document.getElementById("answers").style.display = "none";
    document.getElementById("input-area").style.display = "block";

    const mode = getCurrentQuestionMode();
    if (mode !== 4) {
        document.getElementById("question").innerText = mode === 3 ? currentWord.tr : currentWord.en;
    }

    setTimeout(() => userInput.focus(), 10);
}

function checkInputAnswer() {
    const correct = getCorrectAnswerForCurrentQuestion();
    const userAnswer = normalizeText(userInput.value);
    const correctAnswer = normalizeText(correct);

    checkResult(userAnswer === correctAnswer, correct);
}

function markWordAsLearned(category, level, word) {
    const words = levelProgress[category]?.[level] || [];
    const found = words.find(w => w.en === word.en && w.tr === word.tr);
    if (found) found.learned = true;
}

function markWordAsUnlearned(category, level, word) {
    const words = levelProgress[category]?.[level] || [];
    const found = words.find(w => w.en === word.en && w.tr === word.tr);
    if (found) found.learned = false;
}

function getLearnedCount(category, level) {
    const words = levelProgress[category]?.[level] || [];
    return words.filter(w => w.learned).length;
}

function getFirstFailedLevel(levels) {
    for (const level of levels) {
        if (getLearnedCount(currentCategory, level) < 8) {
            return level;
        }
    }
    return null;
}

function endReviewAndReturnToLevel(level) {
    reviewMode = false;
    reviewLevels = [];
    reviewTargetLevel = "";
    reviewAnsweredCount = 0;
    forcedWord = null;

    alert(level.toUpperCase() + " seviyesindeki öğrenilen kelime sayısı 8'in altına düştü. Bu seviyeye geri dönüyorsunuz.");
    startWithLevel(level);
}

function checkResult(isCorrect, correctVal) {
    if (answerLocked) return;
    answerLocked = true;

    const resDiv = document.getElementById("result-text");

    if (isCorrect) {
        resDiv.innerText = "Doğru!";
        resDiv.className = "correct";
        currentWord.wrongCount = 0;
        forcedWord = null;

        if (reviewMode) {
            pool = pool.filter(w => w !== currentWord);
            reviewAnsweredCount++;
            updateStats();
        } else {
            currentWord.step++;

            if (currentWord.step > 4) {
                markWordAsLearned(currentCategory, currentLevelName, currentWord);
                pool = pool.filter(w => w !== currentWord);
                learnedCount++;
                updateStats();
            }
        }
    } else {
        currentWord.wrongCount++;
        resDiv.className = "wrong";
        if (lastWordsHistory) {
            lastWordsHistory.push(currentWord.en);
            if (lastWordsHistory.length > 3) lastWordsHistory.shift();
        }

        if (currentWord.wrongCount >= 2) {
            if (reviewMode) {
                markWordAsUnlearned(currentCategory, currentWord.sourceLevel, currentWord);
                pool = pool.filter(w => w !== currentWord);
                reviewAnsweredCount++;
                updateStats();
                forcedWord = null;

                resDiv.innerText = "Yanlış! 2 hata yaptınız. Bu kelime artık bilinmiyor sayıldı. Doğru cevap: " + correctVal;

                const failedLevel = getFirstFailedLevel(reviewLevels);
                if (failedLevel) {
                    nextButton.style.display = "none";
                    setTimeout(() => endReviewAndReturnToLevel(failedLevel), 700);
                    return;
                }
            } else {
                currentWord.step = 1;
                currentWord.wrongCount = 0;
                forcedWord = null;
                resDiv.innerText = "Yanlış! 2 hata yaptınız. Kelime başa döndü. Doğru cevap: " + correctVal;
            }
        } else {
            forcedWord = currentWord;
            resDiv.innerText = "Yanlış! Bir hata hakkınız daha var. Doğru cevap: " + correctVal;
        }
    }

    document.querySelectorAll("#answers button").forEach(b => {
        b.disabled = true;
    });

    const cantListenButton = document.getElementById("cant-listen-btn");
    if (cantListenButton) cantListenButton.disabled = true;

    nextButton.style.display = "inline-block";
}

function startReviewTest(levels, nextLevel) {
    const failedLevel = getFirstFailedLevel(levels);
    if (failedLevel) {
        alert(failedLevel.toUpperCase() + " seviyesinde öğrenilen kelime sayısı zaten 8'in altında. Önce bu seviyeyi tekrar tamamlamalısınız.");
        startWithLevel(failedLevel);
        return;
    }

    reviewMode = true;
    reviewLevels = levels;
    reviewTargetLevel = nextLevel;
    reviewAnsweredCount = 0;
    forcedWord = null;
    currentWord = null;
    lastWordsHistory = [];

    let candidates = [];

    levels.forEach(level => {
        const learnedWords = (levelProgress[currentCategory][level] || [])
            .filter(w => w.learned)
            .map(w => ({
                ...w,
                sourceLevel: level,
                questionMode: Math.floor(Math.random() * 4) + 1,
                wrongCount: 0
            }));

        candidates = candidates.concat(learnedWords);
    });

    if (candidates.length === 0) {
        alert("Tekrar testi için yeterli kelime bulunamadı.");
        startWithLevel(levels[0]);
        return;
    }

    pool = candidates
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(10, candidates.length));

    document.getElementById("game-area").style.display = "block";
    updateStats();
    alert(levels.map(l => l.toUpperCase()).join(" + ") + " için tekrar testi başlıyor.");
    askQuestion();
}

function finishReviewTest() {
    const failedLevel = getFirstFailedLevel(reviewLevels);

    reviewMode = false;
    forcedWord = null;

    if (failedLevel) {
        alert(failedLevel.toUpperCase() + " seviyesindeki öğrenilen kelime sayısı 8'in altına düştü. Bu seviyeye geri dönüyorsunuz.");
        startWithLevel(failedLevel);
        return;
    }

    alert("Tekrar testini geçtiniz. Şimdi " + reviewTargetLevel.toUpperCase() + " seviyesine geçiliyor.");
    startWithLevel(reviewTargetLevel);
}

function advanceToNextStage() {
    const levels = getOrderedLevelsForCurrentCategory();
    const currentIndex = levels.indexOf(currentLevelName);

    if (currentIndex === -1) {
        alert("Geçersiz seviye bulundu.");
        location.reload();
        return;
    }

    const nextLevel = levels[currentIndex + 1];

    if (!nextLevel) {
        alert("Harika! Bu ilgi alanındaki tüm seviyeleri bitirdiniz. Başka bir kategori seçebilirsiniz.");
        location.reload();
        return;
    }

    if (currentLevelName === "a2" && nextLevel === "b1") {
        startReviewTest(["a1", "a2"].filter(level => levels.includes(level)), "b1");
        return;
    }

    if (currentLevelName === "b2" && nextLevel === "c1") {
        startReviewTest(["b1", "b2"].filter(level => levels.includes(level)), "c1");
        return;
    }

    alert("Tebrikler! " + currentLevelName.toUpperCase() + " seviyesini tamamladınız. Şimdi " + nextLevel.toUpperCase() + " seviyesine geçiliyor!");
    startWithLevel(nextLevel);
}

function finishLevel() {
    if (learnedCount < 8) {
        alert("Maalesef " + learnedCount + " kelime bildiniz. Seviyeyi geçmek için en az 8 kelimeyi tamamen bitirmelisiniz. Tekrar deneniyor...");
        startWithLevel(currentLevelName);
        return;
    }

    advanceToNextStage();
}

function renderCategories() {
    const categoryContainer = document.getElementById("category-buttons");
    categoryContainer.innerHTML = "";

    const categories = Object.keys(allData);

    if (categories.length === 0) {
        categoryContainer.innerHTML = "<p>Hiç kategori bulunamadı.</p>";
        return;
    }

    categories.forEach(category => {
        const btn = document.createElement("button");
        btn.className = "cat-btn";
        btn.innerText = formatCategoryName(category);
        btn.onclick = () => selectCategory(category);
        categoryContainer.appendChild(btn);
    });
}

function renderLevels() {
    const levelContainer = document.getElementById("level-buttons");
    levelContainer.innerHTML = "";

    const levels = getOrderedLevelsForCurrentCategory();

    if (levels.length === 0) {
        levelContainer.innerHTML = "<p>Bu kategori için seviye bulunamadı.</p>";
        return;
    }

    levels.forEach(level => {
        const btn = document.createElement("button");
        btn.className = "cat-btn";
        btn.innerText = level.toUpperCase();
        btn.onclick = () => startWithLevel(level);
        levelContainer.appendChild(btn);
    });
}

function formatCategoryName(category) {
    return category.charAt(0).toUpperCase() + category.slice(1);
}

nextButton.onclick = () => askQuestion();

userInput.addEventListener("keypress", e => {
    if (e.key === "Enter") checkInputAnswer();
});

loadWords();
