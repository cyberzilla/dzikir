// Konfigurasi State Global
let fullData = [];
let currentSessionData = [];
let currentSlideIndex = 0;
let activeSession = '';
let userProgress = { pagi: {}, petang: {} };

// State untuk Engine Gesture Layar Utama
let isDragging = false;
let startX = 0;
let initialTranslatePx = 0;

// 1. Inisialisasi Aplikasi
async function initApp() {
    startClock();
    checkAndResetDailyProgress();
    registerServiceWorker();

    try {
        const response = await fetch('dzikir.json');
        fullData = await response.json();
        setupTouchEvents();
        setupSheetDrag();

        // Memulihkan posisi terakhir pengguna jika ada
        restoreState();

    } catch (error) {
        console.error("Data JSON tidak ditemukan atau gagal dimuat.", error);
        alert("Gagal memuat dzikir.json. Pastikan dijalankan melalui Local Server.");
    }
}

// 2. Fungsi Jam dan Tanggal Real-time
function startClock() {
    setInterval(() => {
        const now = new Date();

        document.getElementById('clock-text').innerText = now.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
        });

        document.getElementById('date-text').innerText = now.toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        });

        const hour = now.getHours();
        const greetingEl = document.getElementById('greeting-text');

        if (hour >= 3 && hour < 11) {
            greetingEl.innerText = "Selamat Pagi";
        } else if (hour >= 11 && hour < 15) {
            greetingEl.innerText = "Selamat Siang";
        } else if (hour >= 15 && hour < 18) {
            greetingEl.innerText = "Selamat Petang";
        } else {
            greetingEl.innerText = "Selamat Malam";
        }
    }, 1000);
}

// 3. Sistem Reset Harian & State
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

// Fitur Pemulihan Posisi (Resume) - DIRAPIKAN
function restoreState() {
    const savedSession = localStorage.getItem('dzikir_active_session');
    const savedSlide = localStorage.getItem('dzikir_current_slide');

    if (savedSession) {
        let initialIndex = 0;
        if (savedSlide !== null) {
            initialIndex = parseInt(savedSlide, 10);
        }
        // Langsung instruksikan openDzikir untuk lompat ke index ini
        openDzikir(savedSession, initialIndex);
    }
}

// 4. Navigasi Antar Tampilan - DITAMBAHKAN PARAMETER INDEX
function openDzikir(session, targetIndex = 0) {
    activeSession = session;

    document.getElementById('home-view').classList.remove('active');
    document.getElementById('dzikir-view').classList.add('active');
    document.body.className = 'theme-' + session;

    const headerTitle = session === 'pagi' ? 'Dzikir Pagi' : 'Dzikir Petang';
    document.getElementById('dzikir-header-title').innerText = headerTitle;

    currentSessionData = fullData.filter(d => d.waktu === 'keduanya' || d.waktu === session);

    // Validasi target index jika dimuat dari memori
    if (targetIndex > currentSessionData.length) {
        targetIndex = currentSessionData.length;
    }
    currentSlideIndex = targetIndex;

    const track = document.getElementById('slider-track');

    // Matikan transisi saat DOM sedang dibongkar-pasang
    track.style.transition = 'none';

    buildSlides();
    updateUI();
    window.scrollTo(0, 0);

    // TRIK PERBAIKAN: Double requestAnimationFrame
    // Menunggu 2 frame tayang di layar untuk memastikan browser telah
    // selesai merender lebar elemen dan teks secara utuh sebelum menghidupkan animasi.
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            track.style.transition = '';
        });
    });
}

function closeDzikir() {
    document.getElementById('dzikir-view').classList.remove('active');
    document.getElementById('home-view').classList.add('active');
    document.body.className = '';
    document.getElementById('bottom-sheet').classList.remove('expanded');

    localStorage.removeItem('dzikir_active_session');
    localStorage.removeItem('dzikir_current_slide');
    activeSession = '';
}

// 5. Membangun Kartu ke dalam DOM
function buildSlides() {
    const track = document.getElementById('slider-track');
    track.innerHTML = '';

    currentSessionData.forEach((item) => {
        if (!userProgress[activeSession][item.id]) {
            userProgress[activeSession][item.id] = 0;
        }

        const card = document.createElement('div');
        card.className = 'slide-card';
        card.innerHTML = `
            <div class="card-content">
                <h2 class="dzikir-title">
                    ${item.title} 
                    <span class="read-count-label">Dibaca ${item.target_baca} kali</span>
                </h2>
                
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
    const icon = activeSession === 'pagi' ? '🌅' : '🌃';

    finishScreen.innerHTML = `
        <div class="success-screen">
            <div class="success-icon">${icon}</div>
            <h2 style="color: var(--primary);">Selesai</h2>
            <p>Dzikir ${activeSession} telah tunai. Semoga perlindungan Allah selalu menyertai.</p>
            <button onclick="closeDzikir()" style="padding:15px 30px; border-radius:30px; border:none; background:var(--primary); color:white; font-weight:700; cursor:pointer; margin-top: 20px;">Kembali ke Beranda</button>
        </div>
    `;
    track.appendChild(finishScreen);
}

// 6. Engine Swipe dengan "Intent Detection"
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
            if (Math.abs(diffX) > 3 || Math.abs(diffY) > 3) {
                isScrolling = Math.abs(diffY) > Math.abs(diffX);
            }
        }

        if (isScrolling) {
            return;
        }

        if (e.cancelable) {
            e.preventDefault();
        }

        const track = document.getElementById('slider-track');
        track.style.transform = `translateX(${initialTranslatePx + diffX}px)`;
    };

    const onEnd = (e) => {
        if (!isDragging) return;
        isDragging = false;

        if (isScrolling) {
            isScrolling = null;
            return;
        }

        const endX = e.type.includes('mouse') ? e.pageX : e.changedTouches[0].clientX;
        const diff = endX - startX;
        const threshold = 100;

        if (diff < -threshold && currentSlideIndex < currentSessionData.length) {
            currentSlideIndex++;
        } else if (diff > threshold && currentSlideIndex > 0) {
            currentSlideIndex--;
        }

        const track = document.getElementById('slider-track');
        track.style.transition = '';
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

// 7. Pembaruan Antarmuka Pengguna
function updateUI() {
    if (!currentSessionData.length) return;

    const track = document.getElementById('slider-track');

    // Mencegah nilai -0% yang kadang membuat WebKit kebingungan mengalkulasi titik awal transisi
    const translateVal = currentSlideIndex === 0 ? 0 : -(currentSlideIndex * 100);
    track.style.transform = `translateX(${translateVal}%)`;

    const cards = document.querySelectorAll('.slide-card');
    cards.forEach((card, index) => {
        if (index === currentSlideIndex) {
            card.classList.add('active-slide');
        } else {
            card.classList.remove('active-slide');
        }
    });

    const activeCard = cards[currentSlideIndex];
    if (activeCard) {
        track.style.height = (activeCard.offsetHeight + 120) + 'px';
    }

    const isEndScreen = currentSlideIndex === currentSessionData.length;
    const progressPercent = isEndScreen ? 100 : (currentSlideIndex / currentSessionData.length) * 100;

    document.getElementById('progress-fill').style.width = progressPercent + '%';

    const progressTextEl = document.getElementById('progress-text');
    const bottomSheet = document.getElementById('bottom-sheet');

    if (isEndScreen) {
        progressTextEl.innerHTML = `<span>STATUS</span> <span>SELESAI</span>`;
        document.getElementById('btn-counter').style.visibility = 'hidden';
        bottomSheet.style.display = 'none';
    } else {
        progressTextEl.innerHTML = `<span>DZIKIR ${currentSlideIndex + 1} DARI ${currentSessionData.length}</span> <span>${Math.round(progressPercent)}%</span>`;
        document.getElementById('btn-counter').style.visibility = 'visible';
        bottomSheet.style.display = 'flex';

        const activeItem = currentSessionData[currentSlideIndex];
        document.getElementById('sheet-dalil').innerText = activeItem.dalil || 'Tidak ada catatan spesifik.';
        document.getElementById('sheet-ref').innerHTML = `<em>${activeItem.referensi}</em>`;

        bottomSheet.classList.remove('expanded');

        updateFAB();
    }

    document.getElementById('btn-prev').disabled = currentSlideIndex === 0;
    document.getElementById('btn-next').disabled = isEndScreen;

    if (activeSession) {
        localStorage.setItem('dzikir_active_session', activeSession);
        localStorage.setItem('dzikir_current_slide', currentSlideIndex);
    }
}

// 8. Pembaruan Tombol FAB (Floating Action Button)
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

// 9. Aksi Klik Tombol Baca
function incrementCounter() {
    const item = currentSessionData[currentSlideIndex];

    if (userProgress[activeSession][item.id] < item.target_baca) {
        userProgress[activeSession][item.id]++;
        saveProgress();

        if (navigator.vibrate) {
            navigator.vibrate(40);
        }

        updateFAB();

        const fab = document.getElementById('btn-counter');
        fab.classList.remove('pop-anim');
        void fab.offsetWidth;
        fab.classList.add('pop-anim');

        if (userProgress[activeSession][item.id] === item.target_baca) {
            setTimeout(() => {
                if (navigator.vibrate) {
                    navigator.vibrate([30, 50, 30]);
                }
                nextSlide();
            }, 600);
        }
    }
}

// 10. Kontrol Navigasi
function nextSlide() {
    if (currentSlideIndex < currentSessionData.length) {
        currentSlideIndex++;
        updateUI();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function prevSlide() {
    if (currentSlideIndex > 0) {
        currentSlideIndex--;
        updateUI();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// 11. Engine Drag & Swipe untuk Bottom Sheet (Catatan Kaki)
function setupSheetDrag() {
    const sheet = document.getElementById('bottom-sheet');
    const dragArea = document.getElementById('drag-area');
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
            if (isExpanded && diff > 50) {
                sheet.classList.remove('expanded');
            } else if (!isExpanded && diff < -50) {
                sheet.classList.add('expanded');
            }
        }

        sheet.style.transform = '';
    };

    dragArea.addEventListener('mousedown', onStartSheet);
    document.addEventListener('mousemove', onMoveSheet, { passive: false });
    document.addEventListener('mouseup', onEndSheet);

    dragArea.addEventListener('touchstart', onStartSheet, { passive: true });
    document.addEventListener('touchmove', onMoveSheet, { passive: false });
    document.addEventListener('touchend', onEndSheet);
}

// 12. Pendaftaran Service Worker untuk PWA
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(function(registration) {
                console.log('Service Worker berhasil didaftarkan dengan scope:', registration.scope);
            })
            .catch(function(error) {
                console.log('Pendaftaran Service Worker gagal:', error);
            });
    }
}

// Listener global agar tinggi selalu update saat layar diputar/di-resize
window.addEventListener('resize', () => {
    if (document.getElementById('dzikir-view').classList.contains('active')) {
        updateUI();
    }
});

// Panggil fungsi inisialisasi ketika DOM siap
document.addEventListener('DOMContentLoaded', initApp);