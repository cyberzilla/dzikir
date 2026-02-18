let fullData = [];
let currentSessionData = [];
let currentSlideIndex = 0;
let activeSession = '';
let userProgress = { pagi: {}, petang: {} };

let isDragging = false;
let startX = 0;
let initialTranslatePx = 0;

async function initApp() {
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

        restoreState();
    } catch (error) {
        console.error("Data JSON tidak ditemukan atau gagal dimuat.", error);
        alert("Gagal memuat dzikir.json. Pastikan dijalankan melalui Local Server.");
    }
}

function startClock() {
    setInterval(() => {
        const now = new Date();
        document.getElementById('clock-text').innerText = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
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

    closeAllSheets();

    document.getElementById('bottom-sheet').style.display = 'none';
    document.getElementById('info-sheet').style.display = 'flex';

    localStorage.removeItem('dzikir_active_session');
    localStorage.removeItem('dzikir_current_slide');
    activeSession = '';
}

function checkOverlay() {
    const anyExpanded = document.querySelectorAll('.bottom-sheet.expanded').length > 0;
    const overlay = document.getElementById('sheet-overlay');
    if (anyExpanded) {
        overlay.classList.add('active');
    } else {
        overlay.classList.remove('active');
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
                <span class="section-label">Cara Baca</span>
                <div class="latin-text">${item.latin}</div>
                <span class="section-label">Artinya</span>
                <div class="translation-text">${item.translation}</div>
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
    if (count >= item.target_baca) {
        document.getElementById('btn-main-text').innerText = "✓ SELESAI";
        document.getElementById('btn-sub-text').innerText = "Lanjut Berikutnya";
        fab.classList.add('done');
    } else {
        document.getElementById('btn-main-text').innerText = "BACA";
        document.getElementById('btn-sub-text').innerText = `${count} dari ${item.target_baca}`;
        fab.classList.remove('done');
    }
}

function incrementCounter() {
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

        if (Math.abs(diff) < 15) {
            sheet.classList.toggle('expanded');
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

window.addEventListener('resize', () => {
    if (document.getElementById('dzikir-view').classList.contains('active')) {
        updateUI();
    }
});

document.addEventListener('DOMContentLoaded', initApp);