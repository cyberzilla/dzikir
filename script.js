let fullData = [];
let currentSessionData = [];
let currentSlideIndex = 0;
let activeSession = '';
let userProgress = { pagi: {}, petang: {} };

let isDragging = false;
let startX = 0;
let initialTranslatePx = 0;

let appSettings = {
    font: 'hafs',
    showLatin: true,
    showTerjemah: true,
    clockFormat: '24',
    arabicSize: 2,
    fabPosition: null
};

let isFabDragging = false;
let fabHasMoved = false;

const iconBook = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>`;
const iconCheck = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
const iconClock = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;

async function initApp() {
    loadSettings();
    startClock();
    checkAndResetDailyProgress();
    registerServiceWorker();

    createClouds();
    createStars();

    try {
        const response = await fetch('dzikir.json');
        fullData = await response.json();
        setupTouchEvents();

        setupSheetDrag('bottom-sheet', 'drag-area');
        setupSheetDrag('info-sheet', 'info-drag-area');

        setupFabDrag();

        restoreState();
    } catch (error) {
        console.error("Data JSON tidak ditemukan", error);
        alert("Gagal memuat dzikir.json.");
    }
}

function startClock() {
    setInterval(() => {
        const now = new Date();

        let h = now.getHours();
        let m = now.getMinutes();
        let ampm = '';

        if (appSettings.clockFormat === '12') {
            ampm = h >= 12 ? ' PM' : ' AM';
            h = h % 12;
            h = h ? h : 12;
        } else {
            h = h < 10 ? '0' + h : h;
        }

        m = m < 10 ? '0' + m : m;

        let timeString = h + ':' + m;
        if (ampm !== '') {
            timeString += `<span style="font-size: 1.2rem; margin-left: 5px;">${ampm}</span>`;
        }

        document.getElementById('clock-text').innerHTML = timeString;
        document.getElementById('date-text').innerText = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });

        const hour = now.getHours();
        const greetingEl = document.getElementById('greeting-text');

        if (hour >= 3 && hour < 11) greetingEl.innerText = "Selamat Pagi";
        else if (hour >= 11 && hour < 15) greetingEl.innerText = "Selamat Siang";
        else if (hour >= 15 && hour < 18) greetingEl.innerText = "Selamat Petang";
        else greetingEl.innerText = "Selamat Malam";
    }, 1000);
}

function checkAndResetDailyProgress() {
    const today = new Date().toDateString();
    const savedDate = localStorage.getItem('dzikir_last_date');
    const savedProgress = localStorage.getItem('dzikir_progress');

    if (savedDate !== today) {
        userProgress = { pagi: {}, petang: {} };
        localStorage.setItem('dzikir_last_date', today);
        localStorage.removeItem('dzikir_active_session');
        localStorage.removeItem('dzikir_current_slide');
        saveProgress();
    } else if (savedProgress) {
        userProgress = JSON.parse(savedProgress);
    }
}

function saveProgress() {
    localStorage.setItem('dzikir_progress', JSON.stringify(userProgress));
}

function restoreState() {
    const savedSession = localStorage.getItem('dzikir_active_session');
    const savedSlide = localStorage.getItem('dzikir_current_slide');
    if (savedSession) {
        let initialIndex = savedSlide !== null ? parseInt(savedSlide, 10) : 0;
        openDzikir(savedSession, initialIndex);
    }
}

function openDzikir(session, targetIndex = 0) {
    activeSession = session;
    closeAllSheets();

    document.getElementById('info-sheet').style.display = 'none';
    document.getElementById('home-view').classList.remove('active');
    document.getElementById('dzikir-view').classList.add('active');
    document.body.className = 'theme-' + session;
    applySettings();

    const headerTitle = session === 'pagi' ? 'Dzikir Pagi' : 'Dzikir Petang';
    document.getElementById('dzikir-header-title').innerText = headerTitle;

    currentSessionData = fullData.filter(d => d.waktu === 'keduanya' || d.waktu === session);
    currentSlideIndex = targetIndex > currentSessionData.length ? currentSessionData.length : targetIndex;

    const track = document.getElementById('slider-track');
    track.style.transition = 'none';

    buildSlides();
    updateUI();
    window.scrollTo(0, 0);

    setTimeout(() => {
        track.style.transition = 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1), height 0.4s ease';
    }, 50);
}

function closeDzikir() {
    document.getElementById('dzikir-view').classList.remove('active');
    document.getElementById('home-view').classList.add('active');
    document.body.className = '';
    applySettings();

    closeAllSheets();

    document.getElementById('tab-info').style.display = '';

    switchTab('info', false);

    document.getElementById('bottom-sheet').style.display = 'none';
    document.getElementById('info-sheet').style.display = 'flex';

    localStorage.removeItem('dzikir_active_session');
    localStorage.removeItem('dzikir_current_slide');
    activeSession = '';
}

function checkOverlay() {
    const infoExpanded = document.getElementById('info-sheet').classList.contains('expanded');
    const dalilExpanded = document.getElementById('bottom-sheet').classList.contains('expanded');
    const overlay = document.getElementById('sheet-overlay');

    if (infoExpanded || dalilExpanded) {
        overlay.classList.add('active');
    } else {
        overlay.classList.remove('active');
    }

    if (infoExpanded) {
        overlay.style.zIndex = '125';
    } else {
        overlay.style.zIndex = '115';
    }

    if (!infoExpanded) {
        setTimeout(() => {
            if (document.getElementById('dzikir-view').classList.contains('active') && !document.getElementById('info-sheet').classList.contains('expanded')) {
                document.getElementById('info-sheet').style.display = 'none';
            }
        }, 400);
    }
}

function closeAllSheets() {
    document.querySelectorAll('.bottom-sheet').forEach(sheet => {
        sheet.classList.remove('expanded');
    });
    checkOverlay();
}

function buildSlides() {
    const track = document.getElementById('slider-track');
    track.innerHTML = '';

    currentSessionData.forEach((item) => {
        if (!userProgress[activeSession][item.id]) userProgress[activeSession][item.id] = 0;

        const card = document.createElement('div');
        card.className = 'slide-card';
        card.innerHTML = `
            <div class="card-content">
                <h2 class="dzikir-title">${item.title} <span class="read-count-label">Dibaca ${item.target_baca} kali</span></h2>
                <div class="arabic">${item.arabic}</div>
                <div class="latin-section">
                    <span class="section-label">Teks Latin</span>
                    <div class="latin-text">${item.latin}</div>
                </div>
                <div class="terjemah-section">
                    <span class="section-label">Artinya</span>
                    <div class="translation-text">${item.translation}</div>
                </div>
            </div>
        `;
        track.appendChild(card);
    });

    const finishScreen = document.createElement('div');
    finishScreen.className = 'slide-card';
    finishScreen.innerHTML = `
        <div class="success-screen">
            <div class="success-icon">${activeSession === 'pagi' ? '🌅' : '🌃'}</div>
            <h2 style="color: var(--primary);">Selesai</h2>
            <p>Dzikir ${activeSession} telah tunai. Semoga perlindungan Allah selalu menyertai.</p>
            <button onclick="closeDzikir()" style="padding:15px 30px; border-radius:30px; border:none; background:var(--primary); color:white; font-weight:700; cursor:pointer; margin-top: 20px;">Kembali ke Beranda</button>
        </div>
    `;
    track.appendChild(finishScreen);
}

function setupTouchEvents() {
    const viewport = document.getElementById('slider-viewport');
    let startY = 0;
    let isScrolling = null;

    const onStart = (e) => {
        isDragging = true;
        isScrolling = null;
        startX = e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
        startY = e.type.includes('mouse') ? e.pageY : e.touches[0].clientY;

        const track = document.getElementById('slider-track');
        initialTranslatePx = -currentSlideIndex * viewport.offsetWidth;
        track.style.transition = 'none';
    };

    const onMove = (e) => {
        if (!isDragging) return;
        const currentX = e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
        const currentY = e.type.includes('mouse') ? e.pageY : e.touches[0].clientY;

        const diffX = currentX - startX;
        const diffY = currentY - startY;

        if (isScrolling === null) {
            if (Math.abs(diffX) > 3 || Math.abs(diffY) > 3) isScrolling = Math.abs(diffY) > Math.abs(diffX);
        }

        if (isScrolling) return;
        if (e.cancelable) e.preventDefault();

        document.getElementById('slider-track').style.transform = `translateX(${initialTranslatePx + diffX}px)`;
    };

    const onEnd = (e) => {
        if (!isDragging) return;
        isDragging = false;
        if (isScrolling) { isScrolling = null; return; }

        const endX = e.type.includes('mouse') ? e.pageX : e.changedTouches[0].clientX;
        const diff = endX - startX;
        const threshold = 100;

        if (diff < -threshold && currentSlideIndex < currentSessionData.length) currentSlideIndex++;
        else if (diff > threshold && currentSlideIndex > 0) currentSlideIndex--;

        const track = document.getElementById('slider-track');
        track.style.transition = 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1), height 0.4s ease';
        updateUI();
    };

    viewport.addEventListener('mousedown', onStart);
    viewport.addEventListener('mousemove', onMove, { passive: false });
    viewport.addEventListener('mouseup', onEnd);
    viewport.addEventListener('mouseleave', onEnd);
    viewport.addEventListener('touchstart', onStart, { passive: true });
    viewport.addEventListener('touchmove', onMove, { passive: false });
    viewport.addEventListener('touchend', onEnd);
}

function isDzikirTime(session) {
    const hour = new Date().getHours();
    if (session === 'pagi') {
        return hour >= 3 && hour <= 11;
    } else if (session === 'petang') {
        return hour >= 15 && hour <= 20;
    }
    return true;
}

function updateUI() {
    if (!currentSessionData.length) return;

    const track = document.getElementById('slider-track');
    track.style.transform = `translateX(${-(currentSlideIndex * 100)}%)`;

    const cards = document.querySelectorAll('.slide-card');
    cards.forEach((card, index) => {
        if (index === currentSlideIndex) card.classList.add('active-slide');
        else card.classList.remove('active-slide');
    });

    const activeCard = cards[currentSlideIndex];
    if (activeCard) track.style.height = activeCard.offsetHeight + 'px';

    const isEndScreen = currentSlideIndex === currentSessionData.length;
    const progressPercent = isEndScreen ? 100 : (currentSlideIndex / currentSessionData.length) * 100;
    document.getElementById('progress-fill').style.width = progressPercent + '%';

    const bottomSheet = document.getElementById('bottom-sheet');

    if (isEndScreen) {
        document.getElementById('progress-text').innerHTML = `<span>STATUS</span> <span>SELESAI</span>`;
        document.getElementById('btn-counter').style.visibility = 'hidden';
        bottomSheet.style.display = 'none';
    } else {
        document.getElementById('progress-text').innerHTML = `<span>DZIKIR ${currentSlideIndex + 1} DARI ${currentSessionData.length}</span> <span>${Math.round(progressPercent)}%</span>`;
        document.getElementById('btn-counter').style.visibility = 'visible';
        bottomSheet.style.display = 'flex';

        const activeItem = currentSessionData[currentSlideIndex];
        document.getElementById('sheet-dalil').innerText = activeItem.dalil || 'Tidak ada catatan spesifik.';
        document.getElementById('sheet-ref').innerHTML = `<em>${activeItem.referensi}</em>`;

        updateFAB();
    }

    document.getElementById('btn-prev').disabled = currentSlideIndex === 0;
    document.getElementById('btn-next').disabled = isEndScreen;

    if (activeSession) {
        localStorage.setItem('dzikir_active_session', activeSession);
        localStorage.setItem('dzikir_current_slide', currentSlideIndex);
    }
}

function updateFAB() {
    const item = currentSessionData[currentSlideIndex];
    const count = userProgress[activeSession][item.id];
    const fab = document.getElementById('btn-counter');

    fab.classList.remove('pop-anim');

    if (!isDzikirTime(activeSession)) {
        document.getElementById('btn-main-text').innerHTML = iconClock;
        document.getElementById('btn-sub-text').innerText = "Tunggu";
        fab.classList.add('disabled-time');
        fab.classList.remove('done');
        return;
    } else {
        fab.classList.remove('disabled-time');
    }

    if (count >= item.target_baca) {
        document.getElementById('btn-main-text').innerHTML = iconCheck;
        document.getElementById('btn-sub-text').innerText = "Selesai";
        fab.classList.add('done');
    } else {
        document.getElementById('btn-main-text').innerHTML = iconBook;
        document.getElementById('btn-sub-text').innerText = `${count} dari ${item.target_baca}`;
        fab.classList.remove('done');
    }
}

function incrementCounter() {
    if (!isDzikirTime(activeSession)) {
        const timeText = activeSession === 'pagi' ? '03:00 s.d 11:59' : '15:00 s.d 20:59';
        alert(`Saat ini belum masuk jam utama Dzikir ${activeSession.charAt(0).toUpperCase() + activeSession.slice(1)}.\n\n(Waktu anjuran: ${timeText})`);
        return;
    }

    const item = currentSessionData[currentSlideIndex];
    if (userProgress[activeSession][item.id] < item.target_baca) {
        userProgress[activeSession][item.id]++;
        saveProgress();

        if (navigator.vibrate) navigator.vibrate(40);
        updateFAB();

        const fab = document.getElementById('btn-counter');
        fab.classList.remove('pop-anim');
        void fab.offsetWidth;
        fab.classList.add('pop-anim');

        if (userProgress[activeSession][item.id] === item.target_baca) {
            setTimeout(() => {
                if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
                nextSlide();
            }, 600);
        }
    }
}

function nextSlide() {
    if (currentSlideIndex < currentSessionData.length) {
        currentSlideIndex++;
        document.getElementById('slider-track').style.transition = 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1), height 0.4s ease';
        updateUI();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function prevSlide() {
    if (currentSlideIndex > 0) {
        currentSlideIndex--;
        document.getElementById('slider-track').style.transition = 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1), height 0.4s ease';
        updateUI();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function setupSheetDrag(sheetId, dragAreaId) {
    const sheet = document.getElementById(sheetId);
    const dragArea = document.getElementById(dragAreaId);

    if (!sheet || !dragArea) return;

    let startY = 0;
    let currentY = 0;
    let isDraggingSheet = false;

    const onStartSheet = (e) => {
        isDraggingSheet = true;
        startY = e.type.includes('mouse') ? e.pageY : e.touches[0].clientY;
        sheet.style.transition = 'none';
    };

    const onMoveSheet = (e) => {
        if (!isDraggingSheet) return;
        if (e.cancelable) e.preventDefault();

        currentY = e.type.includes('mouse') ? e.pageY : e.touches[0].clientY;
        const diff = currentY - startY;
        const isExpanded = sheet.classList.contains('expanded');

        let transformY = isExpanded ? diff : (sheet.offsetHeight - 50) + diff;
        if (transformY < 0) transformY = 0;
        if (transformY > sheet.offsetHeight - 50) transformY = sheet.offsetHeight - 50;

        sheet.style.transform = `translateY(${transformY}px)`;
    };

    const onEndSheet = (e) => {
        if (!isDraggingSheet) return;
        isDraggingSheet = false;
        sheet.style.transition = 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)';

        const diff = currentY - startY;
        const isExpanded = sheet.classList.contains('expanded');

        const isBtn = e.target.closest('button') || e.target.closest('a') || e.target.closest('svg');

        if (Math.abs(diff) < 15) {
            if (!isBtn) {
                sheet.classList.toggle('expanded');
            }
        } else {
            if (isExpanded && diff > 50) sheet.classList.remove('expanded');
            else if (!isExpanded && diff < -50) sheet.classList.add('expanded');
        }

        sheet.style.transform = '';
        checkOverlay();
    };

    dragArea.addEventListener('mousedown', onStartSheet);
    document.addEventListener('mousemove', onMoveSheet, { passive: false });
    document.addEventListener('mouseup', onEndSheet);
    dragArea.addEventListener('touchstart', onStartSheet, { passive: true });
    document.addEventListener('touchmove', onMoveSheet, { passive: false });
    document.addEventListener('touchend', onEndSheet);
}

function setupFabDrag() {
    const fab = document.getElementById('btn-counter');
    let startX, startY, initialLeft, initialTop;

    const onStart = (e) => {
        isFabDragging = true;
        fabHasMoved = false;
        startX = e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
        startY = e.type.includes('mouse') ? e.pageY : e.touches[0].clientY;

        const rect = fab.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
    };

    const onMove = (e) => {
        if (!isFabDragging) return;
        const currentX = e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
        const currentY = e.type.includes('mouse') ? e.pageY : e.touches[0].clientY;

        const diffX = currentX - startX;
        const diffY = currentY - startY;

        if (!fabHasMoved && (Math.abs(diffX) > 5 || Math.abs(diffY) > 5)) {
            fabHasMoved = true;
            fab.style.transition = 'none';
            fab.classList.add('dragged');
        }

        if (fabHasMoved) {
            let newLeft = initialLeft + diffX;
            let newTop = initialTop + diffY;

            const maxX = window.innerWidth - fab.offsetWidth;
            const maxY = window.innerHeight - fab.offsetHeight;

            newLeft = Math.max(0, Math.min(newLeft, maxX));
            newTop = Math.max(0, Math.min(newTop, maxY));

            fab.style.left = newLeft + 'px';
            fab.style.top = newTop + 'px';

            if (e.cancelable) e.preventDefault();
        }
    };

    const onEnd = (e) => {
        if (!isFabDragging) return;
        isFabDragging = false;

        if (fabHasMoved) {
            appSettings.fabPosition = {
                left: fab.style.left,
                top: fab.style.top
            };
            localStorage.setItem('dzikir_settings', JSON.stringify(appSettings));
            fab.style.transition = '';
        } else {
            incrementCounter();
        }
    };

    fab.addEventListener('mousedown', onStart);
    document.addEventListener('mousemove', onMove, { passive: false });
    document.addEventListener('mouseup', onEnd);

    fab.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
}

function applyFabPosition() {
    const fab = document.getElementById('btn-counter');
    fab.style.transition = 'none';

    if (appSettings.fabPosition) {
        fab.classList.add('dragged');
        fab.style.left = appSettings.fabPosition.left;
        fab.style.top = appSettings.fabPosition.top;
    } else {
        fab.classList.remove('dragged');
        fab.style.left = '50%';
        fab.style.top = 'auto';
        fab.style.bottom = '50px';
    }

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            fab.style.transition = '';
            fab.classList.add('visible');
        });
    });
}

function resetFabPosition() {
    appSettings.fabPosition = null;
    localStorage.setItem('dzikir_settings', JSON.stringify(appSettings));
    applyFabPosition();
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(function(registration) {})
            .catch(function(error) {});
    }
}

function createClouds() {
    const pagiArea = document.querySelector('.pagi');
    if (!pagiArea) return;

    document.querySelectorAll('.cloud').forEach(el => el.remove());

    const numClouds = 4;

    for (let i = 0; i < numClouds; i++) {
        const cloud = document.createElement('div');
        cloud.className = 'cloud';

        const width = Math.floor(Math.random() * 60) + 50;
        cloud.style.width = `${width}px`;
        cloud.style.height = `${width * 0.35}px`;

        const top = Math.floor(Math.random() * 45) + 5;
        cloud.style.top = `${top}%`;

        const duration = Math.floor(Math.random() * 20) + 15;
        cloud.style.animationDuration = `${duration}s`;

        const delay = (Math.random() * duration) * -1;
        cloud.style.animationDelay = `${delay}s`;

        pagiArea.appendChild(cloud);
    }
}

function createStars() {
    const petangArea = document.querySelector('.petang');
    if (!petangArea) return;

    document.querySelectorAll('.star').forEach(el => el.remove());

    const numStars = 25;

    for (let i = 0; i < numStars; i++) {
        const star = document.createElement('div');
        star.className = 'star';

        const size = Math.random() * 2 + 1;
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;

        star.style.left = `${Math.floor(Math.random() * 100)}%`;
        star.style.top = `${Math.floor(Math.random() * 90)}%`;

        const duration = Math.random() * 3 + 2;
        star.style.animationDuration = `${duration}s`;

        const delay = Math.random() * 5;
        star.style.animationDelay = `${delay}s`;

        star.addEventListener('animationiteration', () => {
            star.style.left = `${Math.floor(Math.random() * 100)}%`;
            star.style.top = `${Math.floor(Math.random() * 90)}%`;
        });

        petangArea.appendChild(star);
    }
}

function loadSettings() {
    const saved = localStorage.getItem('dzikir_settings');
    if (saved) {
        appSettings = Object.assign(appSettings, JSON.parse(saved));
    }

    const fontSelect = document.getElementById('font-select');
    const clockFormatSelect = document.getElementById('clock-format');
    const toggleLatin = document.getElementById('toggle-latin');
    const toggleTerjemah = document.getElementById('toggle-terjemah');

    if (fontSelect) fontSelect.value = appSettings.font;
    if (clockFormatSelect) clockFormatSelect.value = appSettings.clockFormat;
    if (toggleLatin) toggleLatin.checked = appSettings.showLatin;
    if (toggleTerjemah) toggleTerjemah.checked = appSettings.showTerjemah;

    applySettings();
    applyFabPosition();
}

function updateSettings() {
    appSettings.font = document.getElementById('font-select').value;
    appSettings.clockFormat = document.getElementById('clock-format').value;
    appSettings.showLatin = document.getElementById('toggle-latin').checked;
    appSettings.showTerjemah = document.getElementById('toggle-terjemah').checked;
    localStorage.setItem('dzikir_settings', JSON.stringify(appSettings));
    applySettings();
}

function changeFontSize(step) {
    appSettings.arabicSize += step;

    if (appSettings.arabicSize < 1.5) appSettings.arabicSize = 1.5;
    if (appSettings.arabicSize > 4.5) appSettings.arabicSize = 4.5;

    updateSettings();
}

function applySettings() {
    document.body.classList.remove('font-hafs', 'font-naskh','font-saleem','font-scheherazade');
    document.body.classList.add('font-' + appSettings.font);

    document.documentElement.style.setProperty('--arabic-font-size', appSettings.arabicSize + 'rem');

    if (appSettings.showLatin) {
        document.body.classList.remove('hide-latin');
    } else {
        document.body.classList.add('hide-latin');
    }

    if (appSettings.showTerjemah) {
        document.body.classList.remove('hide-terjemah');
    } else {
        document.body.classList.add('hide-terjemah');
    }

    setTimeout(() => {
        if(document.getElementById('dzikir-view').classList.contains('active')) {
            const track = document.getElementById('slider-track');
            const activeCard = document.querySelectorAll('.slide-card')[currentSlideIndex];
            if (activeCard && track) track.style.height = activeCard.offsetHeight + 'px';
        }
    }, 100);
}

function switchTab(tab, forceExpand = true) {
    document.getElementById('tab-info').classList.remove('active');
    document.getElementById('tab-settings').classList.remove('active');
    document.getElementById('content-info').style.display = 'none';
    document.getElementById('content-settings').style.display = 'none';

    document.getElementById('tab-' + tab).classList.add('active');
    document.getElementById('content-' + tab).style.display = 'block';

    if (forceExpand) {
        const infoSheet = document.getElementById('info-sheet');
        if (!infoSheet.classList.contains('expanded')) {
            infoSheet.classList.add('expanded');
            checkOverlay();
        }
    }
}

function openSettings() {
    const infoSheet = document.getElementById('info-sheet');

    document.getElementById('tab-info').style.display = 'none';

    infoSheet.style.display = 'flex';
    void infoSheet.offsetWidth;

    switchTab('settings');
}

window.addEventListener('resize', () => {
    if (document.getElementById('dzikir-view').classList.contains('active')) {
        updateUI();
    }
});

document.addEventListener('DOMContentLoaded', initApp);