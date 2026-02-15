// Konfigurasi State Global
let fullData = [];
let currentSessionData = [];
let currentSlideIndex = 0;
let activeSession = '';
let userProgress = { pagi: {}, petang: {} };

// State untuk Engine Gesture Layar Utama
let isDragging = false;
let startX = 0;
let currentX = 0;
let initialTranslatePx = 0;

// 1. Inisialisasi Aplikasi
async function initApp() {
    startClock();
    checkAndResetDailyProgress();

    try {
        const response = await fetch('dzikir.json');
        fullData = await response.json();
        setupTouchEvents();
        setupSheetDrag(); // Inisialisasi engine drag untuk bottom sheet
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

// 3. Sistem Reset Harian (Security Feature)
function checkAndResetDailyProgress() {
    const today = new Date().toDateString();
    const savedDate = localStorage.getItem('dzikir_last_date');
    const savedProgress = localStorage.getItem('dzikir_progress');

    if (savedDate !== today) {
        userProgress = { pagi: {}, petang: {} };
        localStorage.setItem('dzikir_last_date', today);
        saveProgress();
    } else if (savedProgress) {
        userProgress = JSON.parse(savedProgress);
    }
}

function saveProgress() {
    localStorage.setItem('dzikir_progress', JSON.stringify(userProgress));
}

// 4. Navigasi Antar Tampilan
function openDzikir(session) {
    activeSession = session;
    currentSlideIndex = 0;

    document.getElementById('home-view').classList.remove('active');
    document.getElementById('dzikir-view').classList.add('active');

    document.body.className = 'theme-' + session;

    const headerTitle = session === 'pagi' ? 'Dzikir Pagi' : 'Dzikir Petang';
    document.getElementById('dzikir-header-title').innerText = headerTitle;

    currentSessionData = fullData.filter(d => d.waktu === 'keduanya' || d.waktu === session);

    buildSlides();
    updateUI();
    window.scrollTo(0, 0);
}

function closeDzikir() {
    document.getElementById('dzikir-view').classList.remove('active');
    document.getElementById('home-view').classList.add('active');
    document.body.className = '';
    document.getElementById('bottom-sheet').classList.remove('expanded');
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

    // Membangun Layar Sukses
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

// 6. Engine Swipe/Drag Berbasis Pixel untuk Konten Dzikir
function setupTouchEvents() {
    const viewport = document.getElementById('slider-viewport');

    const onStart = (e) => {
        isDragging = true;
        startX = e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;

        const track = document.getElementById('slider-track');
        initialTranslatePx = -currentSlideIndex * viewport.offsetWidth;
        track.style.transition = 'none';
    };

    const onMove = (e) => {
        if (!isDragging) return;

        currentX = e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
        const diff = currentX - startX;

        const track = document.getElementById('slider-track');
        track.style.transform = `translateX(${initialTranslatePx + diff}px)`;
    };

    const onEnd = (e) => {
        if (!isDragging) return;
        isDragging = false;

        const endX = e.type.includes('mouse') ? e.pageX : e.changedTouches[0].clientX;
        const diff = endX - startX;
        const threshold = 100;

        if (diff < -threshold && currentSlideIndex < currentSessionData.length) {
            currentSlideIndex++;
        } else if (diff > threshold && currentSlideIndex > 0) {
            currentSlideIndex--;
        }

        const track = document.getElementById('slider-track');
        track.style.transition = 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1), height 0.4s ease';

        updateUI();
    };

    viewport.addEventListener('mousedown', onStart);
    viewport.addEventListener('mousemove', onMove);
    viewport.addEventListener('mouseup', onEnd);
    viewport.addEventListener('mouseleave', onEnd);

    viewport.addEventListener('touchstart', onStart, { passive: true });
    viewport.addEventListener('touchmove', onMove, { passive: true });
    viewport.addEventListener('touchend', onEnd);
}

// 7. Pembaruan Antarmuka Pengguna
function updateUI() {
    if (!currentSessionData.length) return;

    const track = document.getElementById('slider-track');
    track.style.transform = `translateX(-${currentSlideIndex * 100}%)`;

    const cards = document.querySelectorAll('.slide-card');
    cards.forEach((card, index) => {
        if (index === currentSlideIndex) {
            card.classList.add('active-slide');
        } else {
            card.classList.remove('active-slide');
        }
    });

    // Menyesuaikan tinggi kontainer persis dengan kartu yang aktif
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
        bottomSheet.style.display = 'none'; // Sembunyikan panel di halaman akhir
    } else {
        progressTextEl.innerHTML = `<span>DZIKIR ${currentSlideIndex + 1} DARI ${currentSessionData.length}</span> <span>${Math.round(progressPercent)}%</span>`;
        document.getElementById('btn-counter').style.visibility = 'visible';
        bottomSheet.style.display = 'flex'; // Tampilkan kembali panel

        // Isi data Dalil & Referensi ke dalam Bottom Sheet
        const activeItem = currentSessionData[currentSlideIndex];
        document.getElementById('sheet-dalil').innerText = activeItem.dalil || 'Tidak ada catatan spesifik.';
        document.getElementById('sheet-ref').innerHTML = `<em>${activeItem.referensi}</em>`;

        // Tutup panel otomatis saat berganti halaman dzikir
        bottomSheet.classList.remove('expanded');

        updateFAB();
    }

    document.getElementById('btn-prev').disabled = currentSlideIndex === 0;
    document.getElementById('btn-next').disabled = isEndScreen;
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
        e.preventDefault();

        currentY = e.type.includes('mouse') ? e.pageY : e.touches[0].clientY;
        const diff = currentY - startY;
        const isExpanded = sheet.classList.contains('expanded');

        let transformY = isExpanded ? diff : (sheet.offsetHeight - 35) + diff;

        if (transformY < 0) transformY = 0;
        if (transformY > sheet.offsetHeight - 35) transformY = sheet.offsetHeight - 35;

        sheet.style.transform = `translateY(${transformY}px)`;
    };

    const onEndSheet = (e) => {
        if (!isDraggingSheet) return;
        isDraggingSheet = false;
        sheet.style.transition = 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)';

        const diff = currentY - startY;
        const isExpanded = sheet.classList.contains('expanded');

        if (Math.abs(diff) < 5) {
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

// Listener global agar tinggi selalu update saat layar diputar/di-resize
window.addEventListener('resize', () => {
    if (document.getElementById('dzikir-view').classList.contains('active')) {
        updateUI();
    }
});

// Panggil fungsi inisialisasi ketika DOM siap
document.addEventListener('DOMContentLoaded', initApp);