// =============================================================================
// 1. BACKEND API YAPILANDIRMASI
// =============================================================================

const API_BASE_URL = "http://localhost:5000/api";

let isLoginMode = true; 
let currentUser = null; 

const authArea = document.getElementById("auth-area");
const authTitle = document.getElementById("auth-title");
const authDesc = document.getElementById("auth-desc");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const authSubmitBtn = document.getElementById("auth-submit-btn");
const authToggle = document.getElementById("auth-toggle");


// =============================================================================
// 2. KULLANICI GİRİŞ / KAYIT / OTOMATİK OTURUM İŞLEMLERİ
// =============================================================================

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

        currentUser = data.user || { email: email, uid: email.replace(/[^a-zA-Z0-9]/g, "_") };
        localStorage.setItem("kelimeAppUser", JSON.stringify(currentUser));
        
        alert(isLoginMode ? "Başarıyla giriş yapıldı! Keyifli öğrenmeler." : "Hesabınız başarıyla oluşturuldu! 🎉");
        
        authArea.style.display = "none";
        document.getElementById("category-selection").style.display = "block";
        
        await loadUserScore(currentUser);
        await loadWords();
    } catch (error) {
        console.error("Giriş hatası:", error);
        currentUser = { email: email, uid: email.replace(/[^a-zA-Z0-9]/g, "_") };
        localStorage.setItem("kelimeAppUser", JSON.stringify(currentUser));
        
        authArea.style.display = "none";
        document.getElementById("category-selection").style.display = "block";
        await loadUserScore(currentUser);
        await loadWords();
    }
};

window.logout = function() {
    localStorage.removeItem("kelimeAppUser");
    location.reload();
};


// =============================================================================
// 3. VERİ YÖNETİMİ (SKOR VE ÖZEL KELİME YÜKLEME / KAYDETME)
// =============================================================================

async function loadUserScore(user) {
    try {
        const res = await fetch(`${API_BASE_URL}/scores/${user.uid || user.email}`);
        if (res.ok) {
            const data = await res.json();
            learnedCount = data.learnedCount || 0;
        } else {
            learnedCount = 0;
        }
        updateStats(); 
    } catch (e) {
        learnedCount = 0;
        updateStats();
    }
}

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
    } catch (e) {
        console.error("Skor kaydedilirken hata oluştu:", e);
    }
}

window.openAddWordModal = function() {
    document.getElementById("add-word-modal").style.display = "flex";
};

window.closeAddWordModal = function() {
    document.getElementById("add-word-modal").style.display = "none";
};

window.saveCustomWord = async function() {
    const category = document.getElementById("custom-cat").value.trim();
    const level = document.getElementById("custom-lvl").value.trim() || "Genel";
    const en = document.getElementById("custom-en").value.trim();
    const tr = document.getElementById("custom-tr").value.trim();

    if (!category || !en || !tr) {
        alert("Lütfen Kategori, İngilizce ve Türkçe alanlarını doldurun!");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/words/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                category: category,
                level: level,
                en: en,
                tr: tr,
                userEmail: currentUser ? currentUser.email : null
            })
        });

        if (response.ok) {
            alert("Kelime başarıyla eklendi! 🎉");
            closeAddWordModal();
            document.getElementById("custom-en").value = "";
            document.getElementById("custom-tr").value = "";
            await loadWords();
        } else {
            const err = await response.json();
            alert(err.error || "Kelime eklenirken hata oluştu.");
        }
    } catch (e) {
        console.error("Özel kelime kaydı başarısız:", e);
        alert("Sunucuya bağlanılamadı. Backend'in çalıştığından emin olun.");
    }
};


// =============================================================================
// 4. OYUN MEKANİKLERİ VE DEĞİŞKENLERİ
// =============================================================================

let allData = {};
let currentCategory = "";
let currentLevelName = "";
let currentPart = 1; // 1 = 1. Kısım (İlk 5 kelime), 2 = 2. Kısım (Son 5 kelime)
let pool = [];
let currentWord = null;
let learnedCount = 0; 
let lastWordsHistory = [];

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
        "images/dogru1.jpg", "images/dogru2.jpg", "images/dogru3.jpg",
        "images/dogru4.jpg", "images/dogru5.jpg", "images/dogru6.jpg", "images/dogru7.jpg"
    ],
    wrong: [
        "images/yanlis1.jpg", "images/yanlis2.jpg", "images/yanlis3.jpg",
        "images/yanlis4.jpg", "images/yanlis5.jpg", "images/yanlis6.jpg", "images/yanlis7.jpg"
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
};

window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
};


// =============================================================================
// 7. VERİ YÜKLEME VE İLERLEME TAKİBİ
// =============================================================================

async function loadWords() {
    const container = document.getElementById("category-buttons");
    container.textContent = "Kategoriler yükleniyor...";
    const userEmail = currentUser ? currentUser.email : "guest";
    const sources = [
        `${API_BASE_URL}/words/${encodeURIComponent(userEmail)}`,
        `${API_BASE_URL}/words`,
        "./words.json"
    ];

    for (const source of sources) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        try {
            const response = await fetch(source, { signal: controller.signal });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (!data || typeof data !== "object" || Array.isArray(data) ||
                Object.keys(data).length === 0) {
                throw new Error("Kategori verisi boş veya geçersiz.");
            }
            for (const levels of Object.values(data)) {
                if (!levels || typeof levels !== "object" || Array.isArray(levels) ||
                    !Object.values(levels).every(words => Array.isArray(words) &&
                        words.every(word => word && typeof word.en === "string" &&
                            typeof word.tr === "string"))) {
                    throw new Error("Kelime verisinin biçimi geçersiz.");
                }
            }
            const merged = {};
            for (const [category, levels] of Object.entries(data)) {
                merged[category] = {};
                for (const [level, words] of Object.entries(levels)) {
                    const name = level.replace(/^([abc][12])-\d+$/i, "$1").toLowerCase();
                    merged[category][name] ||= [];
                    for (const word of words) {
                        if (!merged[category][name].some(item => item.en === word.en && item.tr === word.tr)) {
                            merged[category][name].push(word);
                        }
                    }
                }
            }
            allData = merged;
            initLevelProgress();
            renderCategories();
            return;
        } catch (error) {
            console.warn(`Kelime kaynağı yüklenemedi: ${source}`, error);
        } finally {
            clearTimeout(timeout);
        }
    }

    container.textContent = location.protocol === "file:"
        ? "Kelimeler yüklenemedi. index.html dosyasını Live Server ile açın ve words.json dosyasını aynı klasörde tutun."
        : "Kelimeler yüklenemedi. words.json dosyasının aynı klasörde olduğunu ve geçerli JSON içerdiğini kontrol edin.";
    const retry = document.createElement("button");
    retry.className = "cat-btn";
    retry.textContent = "Tekrar dene";
    retry.onclick = () => loadWords();
    container.appendChild(retry);
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
        const ai = orderedLevels.indexOf(a.toLowerCase());
        const bi = orderedLevels.indexOf(b.toLowerCase());

        if (ai === -1 && bi === -1) return a.localeCompare(b);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
    });
}


// =============================================================================
// 8. KELİME İNCELEME (STUDY) VE TEST BAŞLATMA
// =============================================================================

function getPartWords(level) {
    return allData[currentCategory]?.[level] || [];
}

function startWithLevel(lvl, part = 1) {
    currentLevelName = lvl;
    currentPart = part;
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
    const targetWords = getPartWords(currentLevelName, currentPart);
    if (!targetWords || targetWords.length === 0) {
        alert("Bu seviyede kelime bulunamadı!");
        return;
    }
    
    isStudyActive = true;
    studyWords = [...targetWords];
    currentStudyIndex = 0;
    renderStudyCard();
};

window.nextStudyWord = function() {
    currentStudyIndex++;
    renderStudyCard();
};

function renderStudyCard() {
    if (currentStudyIndex >= studyWords.length) {
        alert("Harika! Bu seviyedeki kelimeleri incelediniz, şimdi test zamanı!");
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
// 9. ANA OYUN DÖNGÜSÜ VE 4 AŞAMALI SORULAR
// =============================================================================

window.initActualGame = function() {
    isStudyActive = false;
    lastWordsHistory = [];
    reviewMode = false;
    reviewLevels = [];
    reviewTargetLevel = "";
    reviewAnsweredCount = 0;
    forcedWord = null;
    currentWord = null;

    const targetWords = getPartWords(currentLevelName, currentPart);

    if (!targetWords || targetWords.length === 0) {
        alert("Bu seviyede kelime bulunamadı!");
        location.reload();
        return;
    }

    pool = [...targetWords]
        .sort(() => Math.random() - 0.5)
        .map(w => ({ ...w, step: 2, wrongCount: 0 }));

    updateStats();
    askQuestion();
};

function updateStats() {
    document.getElementById("stat-cat").innerText = currentCategory ? currentCategory.toUpperCase() : "-";

    if (reviewMode) {
        document.getElementById("stat-lvl").innerText = reviewLevels.map(l => l.toUpperCase()).join("+") + " TEST";
        document.getElementById("stat-count").innerText = reviewAnsweredCount;
    } else {
        document.getElementById("stat-lvl").innerText = currentLevelName.toUpperCase();
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
            finishCurrentPart();
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
        "1. Aşama: TR ➔ EN (Seçim)",
        "1. Aşama: EN ➔ TR (Seçim)",
        "2. Aşama: TR ➔ EN (Yazım)",
        "3. Aşama: Dinle ve Yaz"
    ];

    const mode = getCurrentQuestionMode();

    document.getElementById("level-step-info").innerText = reviewMode
        ? "Tekrar Testi: " + stepTexts[mode]
        : stepTexts[mode];

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
            document.getElementById("question").innerText = currentWord.tr;
        }
    }
}


// =============================================================================
// 10. ŞIKLAR VE CEVAP KONTROLÜ
// =============================================================================

function showMultipleChoice() {
    document.getElementById("answers").style.display = "grid";
    document.getElementById("input-area").style.display = "none";

    const mode = getCurrentQuestionMode();
    const isStep1 = mode === 1;
    
    document.getElementById("question").innerText = isStep1 ? currentWord.tr : currentWord.en;
    const correct = isStep1 ? currentWord.en : currentWord.tr;

    const optionsSet = new Set([correct]);
    const sourceWords = getQuestionSourceWords();

    for (let w of [...sourceWords].sort(() => 0.5 - Math.random())) {
        const val = isStep1 ? w.en : w.tr;
        if (val) optionsSet.add(val);
        if (optionsSet.size === 4) break;
    }

    if (optionsSet.size < 4) {
        const allWordsList = Object.values(allData).flatMap(cat => Object.values(cat)).flat();
        for (let w of [...allWordsList].sort(() => 0.5 - Math.random())) {
            const val = isStep1 ? w.en : w.tr;
            if (val) optionsSet.add(val);
            if (optionsSet.size === 4) break;
        }
    }

    const options = Array.from(optionsSet).sort(() => Math.random() - 0.5);

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
        document.getElementById("question").innerText = currentWord.tr;
    }

    setTimeout(() => userInput.focus(), 10);
    hideIdleCat();
}

window.checkInputAnswer = function() {
    const correct = getCorrectAnswerForCurrentQuestion();
    const userAnswer = normalizeText(userInput.value);
    const correctAnswer = normalizeText(correct);

    checkResult(userAnswer === correctAnswer, correct);
};


// =============================================================================
// 11. İLERLEME VE SEVİYE TAKİBİ
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
    reviewMode = false; 
    reviewLevels = []; 
    reviewTargetLevel = ""; 
    reviewAnsweredCount = 0; 
    forcedWord = null;
    alert(level.toUpperCase() + " seviyesindeki öğrenilen kelime sayısı yetersiz kaldı. Bu seviyeye geri dönüyorsunuz.");
    startWithLevel(level, 1);
}


// =============================================================================
// 12. SONUÇ DEĞERLENDİRME (CHECK RESULT)
// =============================================================================

function checkResult(isCorrect, correctVal) {
    if (answerLocked) return; 
    answerLocked = true; 
    const resDiv = document.getElementById("result-text");

    if (isCorrect) {
        showCatReaction("correct"); 
        resDiv.innerText = "Doğru! 🎉"; 
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
                saveUserScoreToCloud();
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
                currentWord.step = 2; 
                currentWord.wrongCount = 0; 
                forcedWord = null; 
                resDiv.innerText = "Yanlış! 2 hata yaptınız. Kelime ilk aşamaya döndü. Doğru cevap: " + correctVal; 
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
// 13. SEVİYE VE KISIM GEÇİŞLERİ (1. KISIM -> 2. KISIM -> YENİ SEVİYE)
// =============================================================================

function finishCurrentPart() {
    alert(`Tebrikler! ${currentLevelName.toUpperCase()} seviyesini tamamladınız!`);
    advanceToNextStage();
}

function startReviewTest(levels, nextLevel) {
    const failedLevel = getFirstFailedLevel(levels); 
    if (failedLevel) { 
        alert(failedLevel.toUpperCase() + " seviyesinde öğrenilen kelime sayısı yetersiz. Önce bu seviyeyi tamamlamalısınız."); 
        startWithLevel(failedLevel, 1); 
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
            .map(w => ({ ...w, sourceLevel: level, questionMode: [2, 3, 4][Math.floor(Math.random() * 3)], wrongCount: 0 })); 
        candidates = candidates.concat(learnedWords); 
    });

    if (candidates.length === 0) { 
        alert("Tekrar testi için yeterli kelime bulunamadı."); 
        startWithLevel(levels[0], 1); 
        return; 
    }

    pool = candidates.sort(() => Math.random() - 0.5).slice(0, Math.min(8, candidates.length));
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
        alert(failedLevel.toUpperCase() + " seviyesindeki öğrenilen kelime sayısı düştü. Bu seviyeye geri dönüyorsunuz."); 
        startWithLevel(failedLevel, 1); 
        return; 
    }
    alert("Tekrar testini geçtiniz. Şimdi " + reviewTargetLevel.toUpperCase() + " seviyesine geçiliyor."); 
    startWithLevel(reviewTargetLevel, 1);
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
        alert("Harika! Bu kategorideki tüm seviyeleri bitirdiniz. Başka bir kategori seçebilirsiniz."); 
        location.reload(); 
        return; 
    }

    if (currentLevelName.toLowerCase() === "a2" && nextLevel.toLowerCase() === "b1") { 
        startReviewTest(["a1", "a2"].filter(level => levels.includes(level)), "b1"); 
        return; 
    }
    if (currentLevelName.toLowerCase() === "b2" && nextLevel.toLowerCase() === "c1") { 
        startReviewTest(["b1", "b2"].filter(level => levels.includes(level)), "c1"); 
        return; 
    }

    alert("Şimdi yeni seviyeye geçiliyor: " + nextLevel.toUpperCase()); 
    startWithLevel(nextLevel, 1);
}


// =============================================================================
// 14. DİNAMİK RENDER VE MENÜ YÖNETİMİ
// =============================================================================

function renderCategories() { 
    const categoryContainer = document.getElementById("category-buttons"); 
    categoryContainer.innerHTML = ""; 

    const categories = Object.keys(allData); 
    
    if (categories.length === 0) { 
        const p = document.createElement("p");
        p.innerText = "Henüz kategori bulunamadı. Yukarıdaki butondan ekleyebilirsiniz!";
        categoryContainer.appendChild(p);
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
        btn.onclick = () => startWithLevel(level, 1); 
        levelContainer.appendChild(btn); 
    }); 
}

function formatCategoryName(category) { 
    return category.charAt(0).toUpperCase() + category.slice(1); 
}

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
            startWithLevel(currentLevelName, currentPart); 
        } 
    }
};

nextButton.onclick = () => askQuestion();
userInput.addEventListener("keypress", e => { if (e.key === "Enter") checkInputAnswer(); });


// =============================================================================
// 15. BAŞLATICI VE OTOMATİK OTURUM KONTROLÜ
// =============================================================================

async function checkSavedSession() {
    const savedUser = localStorage.getItem("kelimeAppUser");
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            document.getElementById("auth-area").style.display = "none";
            document.getElementById("category-selection").style.display = "block";
            await loadUserScore(currentUser);
        } catch (e) {
            console.error("Oturum çözümlenemedi:", e);
        }
    }
    await loadWords();
}

checkSavedSession();
