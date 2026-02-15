// Konfigurasi State Global
let fullData = [];
let currentSessionData = [];
let currentSlideIndex = 0;
let activeSession = '';
let userProgress = { pagi: {}, petang: {} };

// State untuk Engine Gesture (Drag & Swipe)
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
                
                <div class="ref-box">
                    <em>${item.referensi}</em>
                </div>
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

// 6. Engine Swipe/Drag Berbasis Pixel (Stabil)
function setupTouchEvents() {
    const viewport = document.getElementById('slider-viewport');

    const onStart = (e) => {
        isDragging = true;
        startX = e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;

        const track = document.getElementById('slider-track');
        initialTranslatePx = -currentSlideIndex * viewport.offsetWidth;

        // Matikan transisi agar kartu menempel di jari
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
        const threshold = 100; // Minimal gesekan dalam pixel

        if (diff < -threshold && currentSlideIndex < currentSessionData.length) {
            currentSlideIndex++;
        } else if (diff > threshold && currentSlideIndex > 0) {
            currentSlideIndex--;
        }

        const track = document.getElementById('slider-track');
        // FIX BUG: Transisi transformasi geser dan tinggi kartu animasi sejalan
        track.style.transition = 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1), height 0.4s ease';

        updateUI();
    };

    // Pasang Event Listener
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

    // Posisikan slider menggunakan persen agar aman jika layar diresize
    const track = document.getElementById('slider-track');
    track.style.transform = `translateX(-${currentSlideIndex * 100}%)`;

    // Atur status aktif pada kartu untuk efek visual
    const cards = document.querySelectorAll('.slide-card');
    cards.forEach((card, index) => {
        if (index === currentSlideIndex) {
            card.classList.add('active-slide');
        } else {
            card.classList.remove('active-slide');
        }
    });

    // FIX BUG: Menyesuaikan tinggi kontainer persis dengan kartu yang aktif
    const activeCard = cards[currentSlideIndex];
    if (activeCard) {
        // offsetHeight mengambil tinggi elemen, ditambah 150px untuk margin-bottom
        track.style.height = (activeCard.offsetHeight + 150) + 'px';
    }

    // Hitung Progres
    const isEndScreen = currentSlideIndex === currentSessionData.length;
    const progressPercent = isEndScreen ? 100 : (currentSlideIndex / currentSessionData.length) * 100;

    document.getElementById('progress-fill').style.width = progressPercent + '%';

    const progressTextEl = document.getElementById('progress-text');
    if (isEndScreen) {
        progressTextEl.innerHTML = `<span>STATUS</span> <span>SELESAI</span>`;
        document.getElementById('btn-counter').style.visibility = 'hidden';
    } else {
        progressTextEl.innerHTML = `<span>DZIKIR ${currentSlideIndex + 1} DARI ${currentSessionData.length}</span> <span>${Math.round(progressPercent)}%</span>`;
        document.getElementById('btn-counter').style.visibility = 'visible';
        updateFAB();
    }

    // Atur tombol navigasi kiri-kanan
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

        // Haptic Feedback: Getar pendek
        if (navigator.vibrate) {
            navigator.vibrate(40);
        }

        updateFAB();

        // Animasi Pop pada tombol
        const fab = document.getElementById('btn-counter');
        fab.classList.remove('pop-anim');
        void fab.offsetWidth; // Trigger reflow DOM
        fab.classList.add('pop-anim');

        // Jika target hitungan selesai
        if (userProgress[activeSession][item.id] === item.target_baca) {
            setTimeout(() => {
                // Haptic Feedback: Getar panjang tanda selesai
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

// Panggil fungsi inisialisasi ketika DOM siap
document.addEventListener('DOMContentLoaded', initApp);

// FIX BUG: Memperbarui tinggi saat layar di-resize
window.addEventListener('resize', () => {
    if (document.getElementById('dzikir-view').classList.contains('active')) {
        updateUI();
    }
});