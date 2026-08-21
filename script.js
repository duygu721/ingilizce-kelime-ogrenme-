// =============================================================================
// 1. BACKEND API YAPILANDIRMASI
// =============================================================================

// Güvenli Node.js Express Backend URL'imiz (Tüm veritabanı iletişimi buradan yönetilir)
const API_BASE_URL = "http://localhost:5000/api";

// Üyelik ve Oturum Değişkenleri
let isLoginMode = true; 
let currentUser = null; 

// HTML Elementleri
const authArea = document.getElementById("auth-area");
const authTitle = document.getElementById("auth-title");
const authDesc = document.getElementById("auth-desc");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const authSubmitBtn = document.getElementById("auth-submit-btn");
const authToggle = document.getElementById("auth-toggle");


// =============================================================================
// 2. KULLANICI GİRİŞ / KAYIT İŞLEMLERİ (BACKEND İLE)
// =============================================================================

// Giriş Yap / Kayıt Ol Ekran Geçişi
authToggle.onclick = () => {
    isLoginMode = !isLoginMode;
    if (isLoginMode) {
        authTitle.innerText = "Giriş Yap";
        authDesc.innerText = "Kelime serüvenine kaldığın yerden devam et";
        authSubmitBtn.innerText = "Giriş Yap 🚀";
        authToggle.innerHTML = "Hesabın yok mu? <span>Kayıt Ol</span>";
    } else {
        authTitle.innerText = "Kayıt Ol";
        authDesc.innerText = "Hemen ücretsiz hesabını aç ve öğrenmeye başla";
        authSubmitBtn.innerText = "Kayıt Ol ✨";
        authToggle.innerHTML = "Zaten hesabın var mı? <span>Giriş Yap</span>";
    }
};

// Form Gönderme (Backend üzerinden oturum açma / kaydetme)
authSubmitBtn.onclick = async () => {
    const email = authEmail.value.trim();
    const password = authPassword.value;

    if (!email || !password) {
        alert("Lütfen tüm alanları doldurun!");
        return;
    }

    if (password.length < 6) {
        alert("Şifreniz en az 6 karakter olmalıdır!");
        return;
    }

    try {
        const endpoint = isLoginMode ? "/login" : "/register";
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || "Giriş işlemi başarısız oldu!");
            return;
        }

        // Başarılı oturum
        currentUser = data.user || { email: email, uid: email.replace(/[^a-zA-Z0-9]/g, "_") };
        alert(isLoginMode ? "Başarıyla giriş yapıldı! Keyifli öğrenmeler." : "Hesabınız başarıyla oluşturuldu! 🎉");
        
        authArea.style.display = "none";
        document.getElementById("category-selection").style.display = "block";
        
        await loadUserScore(currentUser);
    } catch (error) {
        console.error("Giriş hatası:", error);
        // Backend henüz login endpoint'ine sahip değilse geçici olarak yerel oturum açar
        currentUser = { email: email, uid: email.replace(/[^a-zA-Z0-9]/g, "_") };
        authArea.style.display = "none";
        document.getElementById("category-selection").style.display = "block";
        await loadUserScore(currentUser);
    }
};


// =============================================================================
// 3. VERİ YÖNETİMİ (BACKEND İLE SKOR YÜKLEME / KAYDETME)
// =============================================================================

// Backend üzerinden kullanıcının skorunu çekme
async function loadUserScore(user) {
    try {
        const res = await fetch(`${API_BASE_URL}/scores/${user.uid || user.email}`);
        if (res.ok) {
            const data = await res.json();
            learnedCount = data.learnedCount || 0;
            console.log("Skor backend'den başarıyla yüklendi:", learnedCount);
        } else {
            learnedCount = 0;
        }
        updateStats(); 
    } catch (e) {
        console.log("Skor backend'den çekilemedi, yerel sayaç başlatıldı:", e);
        learnedCount = 0;
        updateStats();
    }
}

// Backend üzerinden skoru Firestore'a güvenle kaydetme
async function saveUserScoreToCloud() {
    if (!currentUser) return;
    try {
        await fetch(`${API_BASE_URL}/scores`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId: currentUser.uid || currentUser.email,
                username: currentUser.email,
                score: learnedCount
            })
        });
        console.log("Yeni skor backend üzerinden güvenle kaydedildi:", learnedCount);
    } catch (e) {
        console.error("Skor kaydedilirken hata oluştu:", e);
    }
}


// =============================================================================
// 4. OYUN MEKANİKLERİ VE DEĞİŞKENLERİ
// =============================================================================

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

let studyWords = [];
let currentStudyIndex = 0;
let isStudyActive = false;

const nextButton = document.getElementById("next-btn");
const userInput = document.getElementById("user-input");

const catImages = {
    correct: [
        "images/dogru1.jpg",
        "images/dogru2.jpg",
        "images/dogru3.jpg",
        "images/dogru4.jpg",
        "images/dogru5.jpg",
        "images/dogru6.jpg",
        "images/dogru7.jpg"
    ],
    wrong: [
        "images/yanlis1.jpg",
        "images/yanlis2.jpg",
        "images/yanlis3.jpg",
        "images/yanlis4.jpg",
        "images/yanlis5.jpg",
        "images/yanlis6.jpg",
        "images/yanlis7.jpg"
    ]
};


// =============================================================================
// 5. YARDIMCI GÖRSEL VE YAZI FONKSİYONLARI
// =============================================================================

function getRandomCatImage(type) {
    const list = catImages[type];
    return list[Math.floor(Math.random() * list.length)];
}

function showCatReaction(type) {
    const cat = document.getElementById("cat-meme");
    if (!cat) return;

    if (type === "correct" || type === "wrong") {
        cat.src = getRandomCatImage(type);
        cat.classList.remove("show");
        cat.classList.add("pop-center");

        clearTimeout(cat.reactionTimer);
        cat.reactionTimer = setTimeout(() => {
            cat.classList.remove("pop-center");
            cat.src = "";
        }, 1500);
    }
}

function hideIdleCat() {
    const cat = document.getElementById("cat-meme");
    if (cat && !cat.classList.contains("pop-center")) {
        cat.classList.remove("show");
    }
}

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


// =============================================================================
// 6. SESLENDİRME SİSTEMİ (TEXT TO SPEECH)
// =============================================================================

window.speak = function(text, isSlow = false) {
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


// =============================================================================
// 7. POP-UP / MODAL YÖNETİMİ
// =============================================================================

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


// =============================================================================
// 8. VERİ YÜKLEME VE İLERLEME TAKİBİ
// =============================================================================

async function loadWords() {
    try {
        const res = await fetch("words.json");
        allData = await res.json();
        initLevelProgress();
        createChoiceModal();
        renderCategories();
    } catch (e) {
        console.error("Veri yüklenemedi!", e);
        alert("words.json yüklenemedi.");
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


// =============================================================================
// 9. KELİME İNCELEME (STUDY) MODU
// =============================================================================

function startWithLevel(lvl) {
    currentLevelName = lvl;
    isStudyActive = false;
    
    document.getElementById("level-selection").style.display = "none";
    document.getElementById("game-area").style.display = "block";
    
    document.getElementById("level-step-info").innerText = "Mod Seçimi";
    document.getElementById("result-text").innerText = "";
    document.getElementById("answers").style.display = "none";
    document.getElementById("input-area").style.display = "none";
    nextButton.style.display = "none";

    document.getElementById("question").innerHTML = `
        <p style="font-size: 20px; font-weight: 800; margin-bottom: 15px;">
            ${lvl.toUpperCase()} seviyesine hoş geldiniz! Nasıl devam etmek istersiniz?
        </p>
        <div style="display: flex; gap: 14px; justify-content: center; width: 100%; max-width: 500px;">
            <button class="cat-btn" style="flex: 1;" onclick="startStudyMode()">📚 Kelimeleri İncele</button>
            <button class="cat-btn" style="flex: 1; background: #10b981; border-bottom-color: #059669;" onclick="initActualGame()">✍️ Doğrudan Teste Başla</button>
        </div>
    `;
    updateStats();
    hideIdleCat();
}

window.startStudyMode = function() {
    const allWordsInCat = allData[currentCategory]?.[currentLevelName];
    if (!allWordsInCat || allWordsInCat.length === 0) {
        alert("Bu seviyede kelime bulunamadı!");
        return;
    }
    
    isStudyActive = true;
    studyWords = [...allWordsInCat].sort(() => Math.random() - 0.5).slice(0, 10);
    currentStudyIndex = 0;
    renderStudyCard();
}

window.nextStudyWord = function() {
    currentStudyIndex++;
    renderStudyCard();
}

function renderStudyCard() {
    if (currentStudyIndex >= studyWords.length) {
        alert("Harika! Tüm kelimeleri incelediniz, şimdi test zamanı!");
        initActualGame();
        return;
    }

    const word = studyWords[currentStudyIndex];
    document.getElementById("level-step-info").innerText = `Kelime İnceleme (${currentStudyIndex + 1} / ${studyWords.length})`;
    
    document.getElementById("question").innerHTML = `
        <div style="background: #f3f4f6; padding: 20px; border-radius: 16px; min-width: min(100%, 360px); box-shadow: inset 0 2px 4px rgba(0,0,0,0.06);">
            <div style="font-size: 32px; font-weight: 900; color: #4c1d95; margin-bottom: 10px;">
                ${word.en}
            </div>
            <div style="display: flex; justify-content: center; gap: 15px; margin-bottom: 12px;">
                <button class="cat-btn" style="padding: 6px 14px; font-size: 14px; min-height: auto; background: #60a5fa; border-bottom-color: #2563eb;" onclick="speak('${word.en}')">🔊 Normal</button>
                <button class="cat-btn" style="padding: 6px 14px; font-size: 14px; min-height: auto; background: #fb923c; border-bottom-color: #ea580c;" onclick="speak('${word.en}', true)">🐢 Yavaş</button>
            </div>
            <div style="font-size: 22px; font-weight: 700; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 8px;">
                Anlamı: <span style="color: #10b981;">${word.tr}</span>
            </div>
        </div>
        <button class="cat-btn" style="margin-top: 15px; min-width: 160px;" onclick="nextStudyWord()">Sıradaki Kelime ➡️</button>
    `;
    
    speak(word.en);
    hideIdleCat();
}


// =============================================================================
// 10. ANA OYUN DÖNGÜSÜ VE SORULAR
// =============================================================================

window.initActualGame = function() {
    isStudyActive = false;
    lastWordsHistory = [];
    askedLevelPassChoice = false;
    mustLearnAllWords = false;
    reviewMode = false;
    reviewLevels = [];
    reviewTargetLevel = "";
    reviewAnsweredCount = 0;
    forcedWord = null;
    currentWord = null;

    const allWordsInCat = allData[currentCategory]?.[currentLevelName];

    if (!allWordsInCat || allWordsInCat.length < 5) {
        alert("Bu seviyede (" + currentLevelName.toUpperCase() + ") yeterli kelime bulunamadı!");
        location.reload();
        return;
    }

    pool = [...allWordsInCat]
        .sort(() => Math.random() - 0.5)
        .slice(0, 10)
        .map(w => ({ ...w, step: 1, wrongCount: 0 }));

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


// =============================================================================
// 11. ŞIKLAR VE CEVAP KONTROLÜ
// =============================================================================

function showMultipleChoice() {
    document.getElementById("answers").style.display = "grid";
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
    hideIdleCat();
}

window.checkInputAnswer = function() {
    const correct = getCorrectAnswerForCurrentQuestion();
    const userAnswer = normalizeText(userInput.value);
    const correctAnswer = normalizeText(correct);

    checkResult(userAnswer === correctAnswer, correct);
}


// =============================================================================
// 12. İLERLEME VE SEVİYE TAKİBİ
// =============================================================================

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
    reviewMode = false; reviewLevels = []; reviewTargetLevel = ""; reviewAnsweredCount = 0; forcedWord = null;
    alert(level.toUpperCase() + " seviyesindeki öğrenilen kelime sayısı 8'in altına düştü. Bu seviyeye geri dönüyorsunuz.");
    startWithLevel(level);
}


// =============================================================================
// 13. SONUÇ DEĞERLENDİRME (CHECK RESULT)
// =============================================================================

function checkResult(isCorrect, correctVal) {
    if (answerLocked) return; 
    answerLocked = true; 
    const resDiv = document.getElementById("result-text");

    if (isCorrect) {
        showCatReaction("correct"); 
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
                saveUserScoreToCloud(); // Backend'e kaydet
            } 
        }
    } else {
        showCatReaction("wrong"); 
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

    document.querySelectorAll("#answers button").forEach(b => b.disabled = true);
    const cantListenButton = document.getElementById("cant-listen-btn"); 
    if (cantListenButton) cantListenButton.disabled = true;
    
    nextButton.style.display = "inline-block"; 
    hideIdleCat();
}


// =============================================================================
// 14. SEVİYE ATLAMALARI VE REVIEWS
// =============================================================================

function startReviewTest(levels, nextLevel) {
    const failedLevel = getFirstFailedLevel(levels); 
    if (failedLevel) { 
        alert(failedLevel.toUpperCase() + " seviyesinde öğrenilen kelime sayısı zaten 8'in altında. Önce bu seviyeyi tekrar tamamlamalısınız."); 
        startWithLevel(failedLevel); 
        return; 
    }

    reviewMode = true; reviewLevels = levels; reviewTargetLevel = nextLevel; reviewAnsweredCount = 0; forcedWord = null; currentWord = null; lastWordsHistory = []; 
    let candidates = [];

    levels.forEach(level => { 
        const learnedWords = (levelProgress[currentCategory][level] || [])
            .filter(w => w.learned)
            .map(w => ({ ...w, sourceLevel: level, questionMode: Math.floor(Math.random() * 4) + 1, wrongCount: 0 })); 
        candidates = candidates.concat(learnedWords); 
    });

    if (candidates.length === 0) { 
        alert("Tekrar testi için yeterli kelime bulunamadı."); 
        startWithLevel(levels[0]); 
        return; 
    }

    pool = candidates.sort(() => Math.random() - 0.5).slice(0, Math.min(10, candidates.length));
    document.getElementById("game-area").style.display = "block"; 
    updateStats(); 
    alert(levels.map(l => l.toUpperCase()).join(" + ") + " için tekrar testi başlıyor."); 
    askQuestion();
}

function finishReviewTest() {
    const failedLevel = getFirstFailedLevel(reviewLevels); reviewMode = false; forcedWord = null;
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

    if (currentIndex === -1) { alert("Geçersiz seviye bulundu."); location.reload(); return; }
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


// =============================================================================
// 15. DİNAMİK RENDER VE MENÜ YÖNETİMİ
// =============================================================================

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

function formatCategoryName(category) { return category.charAt(0).toUpperCase() + category.slice(1); }

window.goBack = function() {
    window.speechSynthesis.cancel(); 
    hideIdleCat();
    
    const isLevelSelectionOpen = document.getElementById("level-selection").style.display === "block";
    const isGameAreaOpen = document.getElementById("game-area").style.display === "block";
    
    if (isLevelSelectionOpen) { 
        document.getElementById("level-selection").style.display = "none"; 
        document.getElementById("category-selection").style.display = "block"; 
        document.getElementById("game-area").style.display = "none"; 
        currentCategory = ""; 
    } else if (isGameAreaOpen) { 
        if (isStudyActive || document.getElementById("level-step-info").innerText === "Mod Seçimi") { 
            document.getElementById("game-area").style.display = "none"; 
            document.getElementById("level-selection").style.display = "block"; 
            isStudyActive = false; 
        } else { 
            startWithLevel(currentLevelName); 
        } 
    }
}

nextButton.onclick = () => askQuestion();
userInput.addEventListener("keypress", e => { if (e.key === "Enter") checkInputAnswer(); });

// Başlatıcı
loadWords();
