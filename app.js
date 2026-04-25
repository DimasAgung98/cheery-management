// --- Konfigurasi Firebase & Inisialisasi ---
firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.firestore();
const auth = firebase.auth();

// --- Utility Functions ---
// --- PWA & Offline Support ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => console.log('SW Registered', reg.scope))
            .catch(err => console.error('SW Registration Failed', err));
    });
}

// LocalStorage Queue untuk saat Offline
let offlineQueue = JSON.parse(localStorage.getItem('cherryOfflineQueue') || '[]');

const updateNetworkStatus = () => {
    const statusEl = document.getElementById('network-status');
    const textEl = document.getElementById('network-text');
    if (!statusEl || !textEl) return;

    if (navigator.onLine) {
        statusEl.className = 'bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full ml-2 flex items-center gap-1 transition-colors';
        textEl.innerText = 'Online';
        statusEl.querySelector('i').className = 'fa-solid fa-cloud';
        processOfflineQueue();
    } else {
        statusEl.className = 'bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full ml-2 flex items-center gap-1 transition-colors';
        textEl.innerText = 'Offline';
        statusEl.querySelector('i').className = 'fa-solid fa-cloud-bolt';
    }
};

window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);
document.addEventListener('DOMContentLoaded', updateNetworkStatus);

const saveToOfflineQueue = (type, payload) => {
    payload.isSynced = false; // Flag khusus offline
    offlineQueue.push({ _id: Date.now().toString(), type, data: payload });
    localStorage.setItem('cherryOfflineQueue', JSON.stringify(offlineQueue));
    showToast('Tersimpan di antrean offline lokal.', 'info');
    
    // Optimistic UI Update sementara (bisa di-refresh jika perlu)
    if(type === 'setoran') state.setoran.push({ id: 'loc_'+Date.now(), ...payload });
    if(type === 'penjualan') state.penjualan.push({ id: 'loc_'+Date.now(), ...payload });
    if(type === 'operasional') state.operasional.push({ id: 'loc_'+Date.now(), ...payload });
    render();
};

const processOfflineQueue = async () => {
    if (offlineQueue.length === 0) return;
    showToast(`Menyinkronkan ${offlineQueue.length} data tertunda...`, 'info');
    
    /* 
      PLACEHOLDER ARCHITECTURE AUTO-SYNC FIREBASE
      Saat online, data yang isSynced: false dari LocalStorage 
      akan didorong ke Firebase, kemudian isSynced diset ke true.
    */
    
    const failedQueue = [];
    for (let item of offlineQueue) {
        try {
            if (!item.data.isSynced) {
                // Dorong ke Firebase
                await db.collection(item.type).add(item.data);
                item.data.isSynced = true; // Tandai tersinkron
            }
        } catch (e) {
            console.error('Gagal sync', item, e);
            failedQueue.push(item);
        }
    }
    
    offlineQueue = failedQueue;
    localStorage.setItem('cherryOfflineQueue', JSON.stringify(offlineQueue));
    if (offlineQueue.length === 0) showToast('Data offline selesai disinkronisasi!', 'success');
};
const formatRupiah = (num) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(num);
const formatInputRibuan = (value) => {
    let num = value.toString().replace(/\D/g, '');
    return num ? new Intl.NumberFormat('id-ID').format(num) : '';
};
const parseRupiahToNumber = (value) => parseFloat(value.toString().replace(/\./g, '')) || 0;
const getTodayDate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const formatDateTime = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' });
};
const formatDate = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

// --- Toast System ---
const showToast = (message, type = 'success') => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600';
    const icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info';
    toast.className = `${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 toast-enter text-sm font-medium z-50`;
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.replace('toast-enter', 'toast-exit');
        toast.addEventListener('animationend', () => toast.remove());
    }, 3000);
};

// --- State Management ---
let state = {
    settings: { hargaJual: 0, upahPerKg: 0, stokAwal: 0 },
    employees: [],
    setoran: [],
    penjualan: [],
    operasional: []
};

// --- Firebase Sync System ---
let loadStatus = { s: false, e: false, set: false, pen: false, op: false };
const checkInitialLoad = () => {
    if(Object.values(loadStatus).every(v => v)) {
        document.querySelectorAll('[id^="loading-"]').forEach(el => el.classList.add('hidden'));
        document.getElementById('dash-loader').classList.add('hidden');
        render(); // Force one final clean render
    }
};

const startSync = () => {
    // 1. Settings
    db.collection('app_settings').doc('master').onSnapshot(doc => {
        if (doc.exists) state.settings = { stokAwal: 0, ...doc.data() };
        else db.collection('app_settings').doc('master').set(state.settings); // default
        loadStatus.s = true;
        render(); checkInitialLoad();
    });

    // 2. Employees
    db.collection('employees').onSnapshot(snap => {
        state.employees = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        loadStatus.e = true;
        render(); checkInitialLoad();
    });

    // 3. Setoran
    db.collection('setoran').onSnapshot(snap => {
        state.setoran = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        loadStatus.set = true;
        render(); checkInitialLoad();
    });

    // 4. Penjualan
    db.collection('penjualan').onSnapshot(snap => {
        state.penjualan = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        loadStatus.pen = true;
        render(); checkInitialLoad();
    });

    // 5. Operasional
    db.collection('operasional').onSnapshot(snap => {
        state.operasional = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        loadStatus.op = true;
        render(); checkInitialLoad();
    });
};

// --- Auth / Login System ---
document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pin = document.getElementById('input-pin').value;
    if (pin === APP_PIN) {
        document.getElementById('btn-login').classList.add('hidden');
        document.getElementById('login-loading').classList.remove('hidden');
        document.getElementById('login-loading').classList.add('flex');
        
        try {
            await auth.signInAnonymously();
            // Auth state observer will handle the UI
        } catch (error) {
            showToast('Gagal terhubung ke database. Cek koneksi internet.', 'error');
            document.getElementById('btn-login').classList.remove('hidden');
            document.getElementById('login-loading').classList.add('hidden');
        }
    } else {
        showToast('PIN Salah!', 'error');
        document.getElementById('input-pin').value = '';
    }
});

auth.onAuthStateChanged(user => {
    if (user) {
        // Hide overlay, show app
        const overlay = document.getElementById('login-overlay');
        overlay.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => overlay.classList.add('hidden'), 500);
        
        document.getElementById('app-content').classList.remove('opacity-0');
        
        // Start Data Sync
        startSync();
    }
});


// --- Computed & Helpers ---
const getTotalSisaStok = () => {
    const totalSetoran = state.setoran.reduce((sum, item) => sum + item.kg, 0);
    const totalJual = state.penjualan.reduce((sum, item) => sum + item.kg, 0);
    return state.settings.stokAwal + totalSetoran - totalJual;
};

// --- Core Rendering Logic ---
const render = () => {
    if(!Object.values(loadStatus).every(v => v)) return; // Wait until all data is loaded initially

    const today = getTodayDate();
    
    // Config Inputs (Prevent overwrite if typing)
    if (document.activeElement.id !== 'input-harga-jual') document.getElementById('input-harga-jual').value = formatInputRibuan(state.settings.hargaJual);
    if (document.activeElement.id !== 'input-upah-per-kg') document.getElementById('input-upah-per-kg').value = formatInputRibuan(state.settings.upahPerKg);

    // Navbar
    document.getElementById('nav-sisa-stok').innerText = getTotalSisaStok().toLocaleString('id-ID', { maximumFractionDigits: 1 });

    // Navbar
    document.getElementById('nav-sisa-stok').innerText = getTotalSisaStok().toLocaleString('id-ID', { maximumFractionDigits: 1 });

    // Filter Today's Data

    // Filter Today's Data
    const todaySetoran = state.setoran.filter(s => s.date === today);
    const todayPenjualan = state.penjualan.filter(p => p.date === today);
    const todayOps = state.operasional.filter(o => o.date === today);

    // Setoran Summary
    const sumSetoranKg = todaySetoran.reduce((sum, s) => sum + s.kg, 0);
    const sumSetoranUpah = todaySetoran.reduce((sum, s) => sum + s.totalUpah, 0);
    document.getElementById('summary-setoran-kg').innerText = `${sumSetoranKg.toLocaleString('id-ID', { maximumFractionDigits: 1 })} Kg`;
    document.getElementById('summary-setoran-upah').innerText = `Rp ${formatRupiah(sumSetoranUpah)}`;

    // Update POS Preview
    updatePosPreview();

    // Transaksi (Setoran & Penjualan) Hari Ini
    const tableTx = document.getElementById('table-transaksi-hari-ini');
    tableTx.innerHTML = '';
    const mainTx = [
        ...todaySetoran.map(s => ({ ...s, _type: 'setoran' })),
        ...todayPenjualan.map(p => ({ ...p, _type: 'penjualan' }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (mainTx.length === 0) {
        tableTx.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-gray-400 italic">Belum ada transaksi hari ini</td></tr>`;
    } else {
        mainTx.forEach(tx => {
            const tr = document.createElement('tr');
            let typeBadge, ket, nominalHtml;
            if (tx._type === 'setoran') {
                typeBadge = `<span class="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-semibold">Setoran</span>`;
                ket = `<div class="font-medium">${tx.nama}</div><div class="text-xs text-gray-500">${tx.kg} kg</div>`;
                nominalHtml = `<span class="money-out font-medium">- Rp ${formatRupiah(tx.totalUpah)}</span><div class="text-xs text-gray-400">upah</div>`;
            } else {
                typeBadge = `<span class="px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-xs font-semibold">Jual</span>`;
                ket = `<div class="font-medium">${tx.kg} kg</div>`;
                nominalHtml = `<span class="money-in font-medium">+ Rp ${formatRupiah(tx.totalHarga)}</span>`;
            }
            
            tr.innerHTML = `
                <td class="py-2 px-4 text-gray-500 text-xs whitespace-nowrap">${formatDateTime(tx.timestamp).split(', ')[1]}</td>
                <td class="py-2 px-4">${typeBadge}</td>
                <td class="py-2 px-4">${ket}</td>
                <td class="py-2 px-4 text-right">${nominalHtml}</td>
                <td class="py-2 px-4 text-center">
                    <button onclick="openEditModal('${tx._type}', '${tx.id}')" class="text-gray-400 hover:text-blue-600 transition-colors p-1" title="Edit">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                </td>
            `;
            tableTx.appendChild(tr);
        });
    }

    // Biaya Operasional Hari Ini
    const tableOps = document.getElementById('table-operasional-hari-ini');
    tableOps.innerHTML = '';
    const opsTx = todayOps.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (opsTx.length === 0) {
        tableOps.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-gray-400 italic">Belum ada biaya operasional</td></tr>`;
    } else {
        opsTx.forEach(tx => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="py-2 px-4 text-gray-500 text-xs whitespace-nowrap">${formatDateTime(tx.timestamp).split(', ')[1]}</td>
                <td class="py-2 px-4 font-medium">${tx.keterangan}</td>
                <td class="py-2 px-4 text-right font-medium money-out">- Rp ${formatRupiah(tx.biaya)}</td>
                <td class="py-2 px-4 text-center">
                    <button onclick="openEditModal('ops', '${tx.id}')" class="text-gray-400 hover:text-orange-600 transition-colors p-1" title="Edit">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                </td>
            `;
            tableOps.appendChild(tr);
        });
    }

    // Dashboard Performa
    const dashKgTerjual = todayPenjualan.reduce((sum, p) => sum + p.kg, 0);
    const dashOmzet = todayPenjualan.reduce((sum, p) => sum + p.totalHarga, 0);
    const dashOps = todayOps.reduce((sum, o) => sum + o.biaya, 0);
    
    document.getElementById('dash-date').innerText = `Tanggal: ${formatDate(today)}`;
    document.getElementById('dash-kg-terjual').innerText = dashKgTerjual.toLocaleString('id-ID', { maximumFractionDigits: 1 });
    document.getElementById('dash-omzet').innerText = formatRupiah(dashOmzet);
    document.getElementById('dash-kg-upah').innerText = sumSetoranKg.toLocaleString('id-ID', { maximumFractionDigits: 1 });
    document.getElementById('dash-beban-upah').innerText = formatRupiah(sumSetoranUpah);
    document.getElementById('dash-total-ops').innerText = formatRupiah(dashOps);
    
    const profitBersih = dashOmzet - sumSetoranUpah - dashOps;
    const profitEl = document.getElementById('dash-profit-container');
    document.getElementById('dash-profit').innerText = formatRupiah(profitBersih);
    
    if (profitBersih < 0) {
        profitEl.className = 'text-3xl font-bold money-out';
    } else {
        profitEl.className = 'text-3xl font-bold money-in';
    }

    // --- Render Log Harian ---
    const logs = {};
    const processDaily = (arr, type) => {
        arr.forEach(item => {
            if (!logs[item.date]) logs[item.date] = { date: item.date, kgSetoran: 0, upah: 0, kgJual: 0, omzet: 0, ops: 0 };
            if (type === 's') { logs[item.date].kgSetoran += item.kg; logs[item.date].upah += item.totalUpah; }
            if (type === 'p') { logs[item.date].kgJual += item.kg; logs[item.date].omzet += item.totalHarga; }
            if (type === 'o') { logs[item.date].ops += item.biaya; }
        });
    };
    processDaily(state.setoran, 's'); processDaily(state.penjualan, 'p'); processDaily(state.operasional, 'o');
    
    const logArr = Object.values(logs).sort((a, b) => new Date(b.date) - new Date(a.date));
    const tableLog = document.getElementById('table-log-harian');
    tableLog.innerHTML = '';
    if (logArr.length === 0) tableLog.innerHTML = `<tr><td colspan="7" class="py-4 text-center text-gray-400 italic">Belum ada arsip log</td></tr>`;
    else {
        logArr.forEach(l => {
            const lProf = l.omzet - l.upah - l.ops;
            tableLog.innerHTML += `
                <tr class="hover:bg-gray-50 transition-colors cursor-pointer group" onclick="openLogDetail('${l.date}')">
                    <td class="py-3 px-4 font-medium text-blue-600 group-hover:underline">${formatDate(l.date)}</td>
                    <td class="py-3 px-4 text-right">${l.kgSetoran} kg</td>
                    <td class="py-3 px-4 text-right">${l.kgJual} kg</td>
                    <td class="py-3 px-4 text-right text-emerald-600">Rp ${formatRupiah(l.omzet)}</td>
                    <td class="py-3 px-4 text-right text-red-600">Rp ${formatRupiah(l.upah)}</td>
                    <td class="py-3 px-4 text-right text-red-600">Rp ${formatRupiah(l.ops)}</td>
                    <td class="py-3 px-4 text-right font-bold ${lProf < 0 ? 'text-red-600' : 'text-emerald-700'}">Rp ${formatRupiah(lProf)}</td>
                    <td class="py-3 px-4 text-center" onclick="event.stopPropagation()">
                        <button onclick="deleteDailyLog('${l.date}')" class="text-gray-400 hover:text-red-600 transition-colors p-1" title="Hapus Keseluruhan Log ${l.date}">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
    }

    // --- Render Daftar Karyawan ---
    const listEmp = document.getElementById('list-karyawan');
    listEmp.innerHTML = '';
    state.employees.forEach(emp => {
        const empSets = state.setoran.filter(s => s.empId === emp.id);
        const totalKg = empSets.reduce((sum, s) => sum + s.kg, 0);
        const li = document.createElement('li');
        li.className = `p-4 hover:bg-gray-50 cursor-pointer transition-colors flex justify-between items-center ${window.activeEmpId === emp.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`;
        li.onclick = () => viewEmployeeDetail(emp.id);
        li.innerHTML = `
            <div>
                <p class="font-medium text-gray-800">${emp.nama}</p>
                <p class="text-xs text-gray-500">${empSets.length} kali setor</p>
            </div>
            <div class="text-right">
                <p class="text-sm font-bold text-gray-700">${totalKg.toLocaleString('id-ID', {maximumFractionDigits:1})} kg</p>
            </div>
        `;
        listEmp.appendChild(li);
    });
    
    if (window.activeEmpId) viewEmployeeDetail(window.activeEmpId, false);
};

// --- PIN Modal for Delete Daily Log ---
let _pendingDeleteDate = null; // menyimpan tanggal yang akan dihapus

const deleteDailyLog = (date) => {
    // Hitung ringkasan data yang akan terhapus
    const setoran   = state.setoran.filter(s => s.date === date);
    const penjualan = state.penjualan.filter(p => p.date === date);
    const ops       = state.operasional.filter(o => o.date === date);
    const total     = setoran.length + penjualan.length + ops.length;

    if (total === 0) { showToast('Tidak ada data untuk dihapus.', 'info'); return; }

    // Isi info di modal
    _pendingDeleteDate = date;
    document.getElementById('pin-modal-date').textContent = formatDate(date);
    document.getElementById('pin-modal-info-setoran').textContent =
        `${setoran.length} setoran (${setoran.reduce((s,i)=>s+i.kg,0)} kg)`;
    document.getElementById('pin-modal-info-penjualan').textContent =
        `${penjualan.length} penjualan (${penjualan.reduce((s,i)=>s+i.kg,0)} kg)`;
    document.getElementById('pin-modal-info-ops').textContent =
        `${ops.length} biaya operasional`;

    // Reset state modal
    const pinInput = document.getElementById('input-delete-pin');
    pinInput.value = '';
    document.getElementById('pin-error-msg').classList.add('hidden');
    pinInput.classList.remove('shake', 'border-red-500');
    pinInput.classList.add('border-gray-200');

    // Tampilkan modal
    const modal = document.getElementById('pin-confirm-modal');
    modal.style.display = 'flex';
    setTimeout(() => pinInput.focus(), 100);
};

const closePinModal = () => {
    document.getElementById('pin-confirm-modal').style.display = 'none';
    _pendingDeleteDate = null;
};

// --- Log Detail Modal Logic ---
const openLogDetail = (date) => {
    const setoran   = state.setoran.filter(s => s.date === date).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    const penjualan = state.penjualan.filter(p => p.date === date).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    const ops       = state.operasional.filter(o => o.date === date).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));

    document.getElementById('log-detail-date').textContent = formatDate(date);

    // Populate Setoran
    const setBody = document.getElementById('log-detail-setoran-body');
    setBody.innerHTML = '';
    let totalSetKg = 0, totalSetUpah = 0;
    setoran.forEach(s => {
        totalSetKg += s.kg; totalSetUpah += s.totalUpah;
        setBody.innerHTML += `<tr><td class="py-2 px-3">${s.nama}</td><td class="py-2 px-3 text-right font-medium">${s.kg} kg</td><td class="py-2 px-3 text-right text-gray-500">Rp ${formatRupiah(s.totalUpah)}</td></tr>`;
    });
    document.getElementById('log-detail-setoran-kg').textContent = `${totalSetKg.toLocaleString('id-ID')} kg`;
    document.getElementById('log-detail-setoran-upah').textContent = `Rp ${formatRupiah(totalSetUpah)}`;

    // Populate Penjualan
    const penBody = document.getElementById('log-detail-penjualan-body');
    penBody.innerHTML = '';
    let totalPenKg = 0, totalPenRp = 0;
    penjualan.forEach(p => {
        totalPenKg += p.kg; totalPenRp += p.totalHarga;
        penBody.innerHTML += `<tr><td class="py-2 px-3 text-gray-400">${formatDateTime(p.timestamp).split(', ')[1]}</td><td class="py-2 px-3 text-right font-medium">${p.kg} kg</td><td class="py-2 px-3 text-right text-emerald-600 font-medium">Rp ${formatRupiah(p.totalHarga)}</td></tr>`;
    });
    document.getElementById('log-detail-penjualan-kg').textContent = `${totalPenKg.toLocaleString('id-ID')} kg`;
    document.getElementById('log-detail-penjualan-total').textContent = `Rp ${formatRupiah(totalPenRp)}`;

    // Populate Operasional
    const opsBody = document.getElementById('log-detail-ops-body');
    opsBody.innerHTML = '';
    let totalOpsRp = 0;
    ops.forEach(o => {
        totalOpsRp += o.biaya;
        opsBody.innerHTML += `<tr><td class="py-2 px-3">${o.keterangan}</td><td class="py-2 px-3 text-right text-red-600 font-medium">Rp ${formatRupiah(o.biaya)}</td></tr>`;
    });
    document.getElementById('log-detail-ops-total').textContent = `Rp ${formatRupiah(totalOpsRp)}`;

    // Summary Bottom
    const profit = totalPenRp - totalSetUpah - totalOpsRp;
    document.getElementById('log-detail-final-omzet').textContent = `Rp ${formatRupiah(totalPenRp)}`;
    document.getElementById('log-detail-final-out').textContent = `- Rp ${formatRupiah(totalSetUpah + totalOpsRp)}`;
    const profEl = document.getElementById('log-detail-final-profit');
    profEl.textContent = `Rp ${formatRupiah(profit)}`;
    profEl.className = `text-xl font-black ${profit < 0 ? 'text-red-600' : 'text-emerald-700'}`;

    document.getElementById('log-detail-modal').style.display = 'flex';
};

const closeLogDetail = () => {
    document.getElementById('log-detail-modal').style.display = 'none';
};

const confirmDeleteWithPin = async () => {
    const pinInput   = document.getElementById('input-delete-pin');
    const errorMsg   = document.getElementById('pin-error-msg');
    const btn        = document.getElementById('btn-confirm-delete-log');
    const enteredPin = pinInput.value;

    // Validasi PIN
    if (enteredPin !== APP_PIN) {
        // Shake animation
        pinInput.classList.remove('shake');
        pinInput.classList.add('border-red-500');
        void pinInput.offsetWidth; // force reflow
        pinInput.classList.add('shake');
        pinInput.addEventListener('animationend', () => pinInput.classList.remove('shake'), { once: true });

        errorMsg.classList.remove('hidden');
        pinInput.value = '';
        pinInput.focus();
        return;
    }

    // PIN benar — jalankan hapus
    const date = _pendingDeleteDate;
    closePinModal();

    const toDelete = {
        setoran:     state.setoran.filter(s => s.date === date),
        penjualan:   state.penjualan.filter(p => p.date === date),
        operasional: state.operasional.filter(o => o.date === date),
    };

    showToast(`Menghapus log ${formatDate(date)}...`, 'info');

    try {
        // Firestore batch delete (maks 500 ops per batch)
        const batch = db.batch();
        toDelete.setoran.forEach(i     => batch.delete(db.collection('setoran').doc(i.id)));
        toDelete.penjualan.forEach(i   => batch.delete(db.collection('penjualan').doc(i.id)));
        toDelete.operasional.forEach(i => batch.delete(db.collection('operasional').doc(i.id)));
        await batch.commit();

        const kgSetoran = toDelete.setoran.reduce((s, i) => s + i.kg, 0);
        const kgJual    = toDelete.penjualan.reduce((s, i) => s + i.kg, 0);
        const parts     = [];
        if (kgSetoran > 0) parts.push(`${kgSetoran} kg setoran`);
        if (kgJual > 0)    parts.push(`${kgJual} kg penjualan`);
        showToast(
            `Log ${formatDate(date)} berhasil dihapus. ${parts.length ? parts.join(' & ') + ' dibatalkan.' : ''} Stok diperbarui otomatis.`,
            'info'
        );
    } catch (err) {
        console.error('Gagal hapus log:', err);
        showToast('Gagal menghapus log. Cek koneksi internet.', 'error');
    }
};

// Tekan Enter di input PIN = klik tombol hapus
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('input-delete-pin').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') confirmDeleteWithPin();
        if (e.key === 'Escape') closePinModal();
    });
});

const updatePosPreview = () => {
    const kg = parseFloat(document.getElementById('input-kg-jual').value) || 0;
    document.getElementById('preview-total-jual').innerText = formatRupiah(kg * state.settings.hargaJual);
};

// --- Tab System ---
const switchTab = (tabId) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
    
    document.querySelectorAll('.tab-btn').forEach(el => {
        el.classList.remove('border-accent-500', 'text-accent-600');
        el.classList.add('border-transparent', 'text-gray-500');
    });
    const btn = document.querySelector(`[data-target="${tabId}"]`);
    if(btn){
        btn.classList.remove('border-transparent', 'text-gray-500');
        btn.classList.add('border-accent-500', 'text-accent-600');
    }
};

// --- Karyawan Detail ---
const viewEmployeeDetail = (empId, forceScroll = true) => {
    window.activeEmpId = empId;
    const emp = state.employees.find(e => e.id === empId);
    if (!emp) return;
    
    const sets = state.setoran.filter(s => s.empId === emp.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const container = document.getElementById('detail-karyawan');
    
    let html = `
        <div class="flex items-center justify-between mb-6 border-b pb-4">
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xl font-bold">
                    ${emp.nama.charAt(0).toUpperCase()}
                </div>
                <div>
                    <h3 class="text-xl font-bold text-gray-800">${emp.nama}</h3>
                    <p class="text-sm text-gray-500">Total akumulasi: ${sets.reduce((s,i)=>s+i.kg,0).toLocaleString('id-ID',{maximumFractionDigits:1})} kg</p>
                </div>
            </div>
            <button onclick="deleteEmployee('${emp.id}')" class="text-red-500 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium">
                <i class="fa-solid fa-user-minus"></i> Hapus
            </button>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <table class="min-w-full text-sm text-left">
                <thead class="bg-gray-50 text-gray-600 border-b">
                    <tr><th class="py-2 px-4">Waktu</th><th class="py-2 px-4 text-right">Kg</th><th class="py-2 px-4 text-right">Upah</th></tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
    `;
    
    if (sets.length === 0) html += `<tr><td colspan="3" class="py-4 text-center text-gray-400">Belum ada riwayat</td></tr>`;
    sets.forEach(s => {
        html += `<tr>
            <td class="py-2 px-4 text-gray-600 whitespace-nowrap">${formatDateTime(s.timestamp)}</td>
            <td class="py-2 px-4 text-right font-medium">${s.kg}</td>
            <td class="py-2 px-4 text-right text-gray-500">Rp ${formatRupiah(s.totalUpah)}</td>
        </tr>`;
    });
    
    html += `</tbody></table></div>`;
    container.innerHTML = html;
    
    document.querySelectorAll('#list-karyawan li').forEach(li => {
        li.classList.remove('bg-blue-50', 'border-l-4', 'border-blue-500');
        if (li.querySelector('p')?.innerText === emp.nama) li.classList.add('bg-blue-50', 'border-l-4', 'border-blue-500');
    });
};

// --- Edit System ---
const openEditModal = (type, id) => {
    let item;
    if (type === 'setoran') item = state.setoran.find(i => i.id === id);
    if (type === 'penjualan') item = state.penjualan.find(i => i.id === id);
    if (type === 'ops') item = state.operasional.find(i => i.id === id);
    
    if (!item) return;

    document.getElementById('edit-id').value = id;
    document.getElementById('edit-type').value = type;
    
    const fields = document.getElementById('edit-fields');
    fields.innerHTML = '';
    
    if (type === 'setoran') {
        fields.innerHTML = `
            <div><label class="block text-sm font-medium text-gray-600 mb-1">Nama Karyawan</label>
            <input type="text" id="edit-nama" value="${item.nama}" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required></div>
            <div><label class="block text-sm font-medium text-gray-600 mb-1">Jumlah (kg)</label>
            <input type="number" step="0.1" id="edit-kg" value="${item.kg}" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required></div>
            <div><label class="block text-sm font-medium text-gray-600 mb-1">Upah per kg (Rp)</label>
            <input type="text" inputmode="numeric" id="edit-upah-per-kg" value="${formatInputRibuan(item.upahPerKg)}" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required></div>
        `;
        document.getElementById('edit-upah-per-kg').addEventListener('input', function() { this.value = formatInputRibuan(this.value); });
    } else if (type === 'penjualan') {
        fields.innerHTML = `
            <div><label class="block text-sm font-medium text-gray-600 mb-1">Jumlah Terjual (kg)</label>
            <input type="number" step="0.1" id="edit-kg" value="${item.kg}" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" required></div>
        `;
    } else if (type === 'ops') {
        fields.innerHTML = `
            <div><label class="block text-sm font-medium text-gray-600 mb-1">Keterangan</label>
            <input type="text" id="edit-ket" value="${item.keterangan}" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500" required></div>
            <div><label class="block text-sm font-medium text-gray-600 mb-1">Jumlah Biaya (Rp)</label>
            <input type="text" inputmode="numeric" id="edit-biaya" value="${formatInputRibuan(item.biaya)}" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500" required></div>
        `;
        document.getElementById('edit-biaya').addEventListener('input', function() { this.value = formatInputRibuan(this.value); });
    }

    document.getElementById('edit-modal').classList.remove('hidden');
    // Button actions logic (Save / Delete) will be handled in listener
};

const closeEditModal = () => {
    document.getElementById('edit-modal').classList.add('hidden');
};

document.getElementById('form-edit').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const type = document.getElementById('edit-type').value;
    
    document.getElementById('btn-save-edit').disabled = true;
    document.getElementById('btn-save-edit').innerHTML = '<div class="loader !w-4 !h-4 !border-2"></div> Menyimpan...';
    
    try {
        if (type === 'setoran') {
            const item = state.setoran.find(i => i.id === id);
            const newNama = document.getElementById('edit-nama').value.trim();
            const newKg = parseFloat(document.getElementById('edit-kg').value);
            const newUpahPerKg = parseRupiahToNumber(document.getElementById('edit-upah-per-kg').value);
            
            let empId = item.empId;
            let finalNama = item.nama;
            
            if (item.nama.toLowerCase() !== newNama.toLowerCase()) {
                let emp = state.employees.find(e => e.nama.toLowerCase() === newNama.toLowerCase());
                if (!emp) {
                    // Create new employee
                    const empRef = await db.collection('employees').add({ nama: newNama });
                    empId = empRef.id;
                    finalNama = newNama;
                } else {
                    empId = emp.id;
                    finalNama = emp.nama;
                }
            }
            
            await db.collection('setoran').doc(id).update({
                empId: empId,
                nama: finalNama,
                kg: newKg,
                upahPerKg: newUpahPerKg,
                totalUpah: newKg * newUpahPerKg
            });
            
        } else if (type === 'penjualan') {
            const item = state.penjualan.find(i => i.id === id);
            const newKg = parseFloat(document.getElementById('edit-kg').value);
            await db.collection('penjualan').doc(id).update({
                kg: newKg,
                totalHarga: newKg * item.hargaJual
            });
        } else if (type === 'ops') {
            await db.collection('operasional').doc(id).update({
                keterangan: document.getElementById('edit-ket').value.trim(),
                biaya: parseRupiahToNumber(document.getElementById('edit-biaya').value)
            });
        }
        showToast('Data berhasil diperbarui di cloud');
        closeEditModal();
    } catch (error) {
        showToast('Gagal update data: ' + error.message, 'error');
    } finally {
        document.getElementById('btn-save-edit').disabled = false;
        document.getElementById('btn-save-edit').innerHTML = '<span>Simpan</span>';
    }
});

// Delete Data
document.getElementById('btn-delete').addEventListener('click', async () => {
    const id = document.getElementById('edit-id').value;
    const type = document.getElementById('edit-type').value;
    if(!confirm('Anda yakin ingin menghapus data ini secara permanen?')) return;
    
    try {
        await db.collection(type).doc(id).delete();
        showToast('Data berhasil dihapus dari cloud', 'info');
        closeEditModal();
    } catch (err) {
        showToast('Gagal menghapus data', 'error');
    }
});


// --- Listeners for CRUD Inputs ---
document.addEventListener('DOMContentLoaded', () => {
    switchTab('tab-dashboard');

    ['input-harga-jual', 'input-upah-per-kg', 'input-biaya-ops'].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.addEventListener('input', function() { this.value = formatInputRibuan(this.value); });
    });

    // 1. Master Config Submit
    document.getElementById('form-config').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<div class="loader !w-4 !h-4 !border-2"></div> Menyimpan...';
        
        try {
            const hargaJual = parseRupiahToNumber(document.getElementById('input-harga-jual').value);
            const upahPerKg = parseRupiahToNumber(document.getElementById('input-upah-per-kg').value);
            
            await db.collection('app_settings').doc('master').update({ hargaJual, upahPerKg });
            
            // Batch update transactions TODAY
            const today = getTodayDate();
            const batch = db.batch();
            
            state.setoran.filter(s => s.date === today).forEach(s => {
                const ref = db.collection('setoran').doc(s.id);
                batch.update(ref, { upahPerKg: upahPerKg, totalUpah: s.kg * upahPerKg });
            });
            state.penjualan.filter(p => p.date === today).forEach(p => {
                const ref = db.collection('penjualan').doc(p.id);
                batch.update(ref, { hargaJual: hargaJual, totalHarga: p.kg * hargaJual });
            });
            
            await batch.commit();
            showToast('Pengaturan disinkronkan ke seluruh perangkat.');
        } catch (error) {
            showToast('Gagal menyimpan pengaturan: ' + error.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    });

    // 2. Setoran Submit
    document.getElementById('form-setoran').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (state.settings.upahPerKg < 0) return showToast('Peringatan: Atur Master Config dahulu!', 'error');

        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<div class="loader !w-4 !h-4 !border-2"></div> Menyimpan...';

        try {
            const empId   = document.getElementById('selected-emp-id').value;
            const empNama = document.getElementById('selected-emp-nama').value;
            const kg      = parseFloat(document.getElementById('input-kg-setoran').value);

            if (!empId) {
                showToast('Pilih karyawan terlebih dahulu.', 'error');
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-plus"></i> Tambah Ke Database';
                return;
            }

            const isPribadi = document.getElementById('check-pribadi').checked;
            const currentUpahPerKg = isPribadi ? 0 : state.settings.upahPerKg;

            const payload = {
                date: getTodayDate(),
                timestamp: new Date().toISOString(),
                empId: empId,
                nama: empNama,
                kg: kg,
                upahPerKg: currentUpahPerKg,
                totalUpah: kg * currentUpahPerKg
            };

            if (!navigator.onLine) {
                saveToOfflineQueue('setoran', payload);
            } else {
                await db.collection('setoran').add(payload);
                showToast(`Setoran ${kg} kg dari ${empNama} tersimpan di cloud.`);
            }

            // Reset form
            document.getElementById('selected-emp-id').value = '';
            document.getElementById('selected-emp-nama').value = '';
            document.getElementById('emp-avatar').innerText = '?';
            document.getElementById('emp-avatar').className = 'w-9 h-9 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center font-bold text-sm flex-shrink-0';
            document.getElementById('emp-picker-label').innerText = 'Ketuk untuk pilih karyawan';
            document.getElementById('emp-picker-label').className = 'text-sm font-medium text-blue-700';
            document.getElementById('emp-picker-sub').innerText = 'Belum ada yang dipilih';
            document.getElementById('input-kg-setoran').value = '';
            document.getElementById('check-pribadi').checked = false;
        } catch (error) {
            showToast('Gagal menyimpan setoran: ' + error.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-plus"></i> Tambah Ke Database';
        }
    });

    // 3. POS Live Preview
    document.getElementById('input-kg-jual').addEventListener('input', updatePosPreview);

    // 4. Penjualan Submit
    document.getElementById('form-penjualan').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (state.settings.hargaJual <= 0) return showToast('Gagal: Atur Harga Jual dahulu!', 'error');

        const kg = parseFloat(document.getElementById('input-kg-jual').value);
        if (kg > getTotalSisaStok()) return showToast(`Gagal: Sisa stok tidak cukup!`, 'error');

        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;

        try {
            const payload = {
                date: getTodayDate(),
                timestamp: new Date().toISOString(),
                kg: kg,
                hargaJual: state.settings.hargaJual,
                totalHarga: kg * state.settings.hargaJual
            };

            if (!navigator.onLine) {
                saveToOfflineQueue('penjualan', payload);
            } else {
                await db.collection('penjualan').add(payload);
                showToast(`Penjualan ${kg}kg tercatat di cloud`, 'success');
            }

            document.getElementById('input-kg-jual').value = '';
        } catch (error) {
            showToast('Gagal mencatat penjualan.', 'error');
        } finally {
            btn.disabled = false;
        }
    });

    // 5. Operasional Submit
    document.getElementById('form-operasional').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;

        try {
            const ket = document.getElementById('input-ket-ops').value.trim();
            const biaya = parseRupiahToNumber(document.getElementById('input-biaya-ops').value);

            const payload = {
                date: getTodayDate(),
                timestamp: new Date().toISOString(),
                keterangan: ket,
                biaya: biaya
            };

            if (!navigator.onLine) {
                saveToOfflineQueue('operasional', payload);
            } else {
                await db.collection('operasional').add(payload);
                showToast('Biaya operasional tersimpan di cloud');
            }

            document.getElementById('input-ket-ops').value = '';
            document.getElementById('input-biaya-ops').value = '';
        } catch (error) {
            showToast('Gagal mencatat biaya ops.', 'error');
        } finally {
            btn.disabled = false;
        }
    });
});

// --- Employee Picker Logic ---
const openEmployeeModal = () => {
    document.getElementById('emp-picker-modal').style.display = 'flex';
    document.getElementById('search-emp-picker').value = '';
    filterEmployeePicker();
};

const closeEmployeeModal = () => {
    document.getElementById('emp-picker-modal').style.display = 'none';
    hideAddNewEmpField();
};

const filterEmployeePicker = () => {
    const q = document.getElementById('search-emp-picker').value.toLowerCase();
    const container = document.getElementById('list-emp-picker');
    container.innerHTML = '';
    
    const filtered = state.employees
        .filter(e => e.nama.toLowerCase().includes(q))
        .sort((a, b) => a.nama.localeCompare(b.nama));
        
    if (filtered.length === 0) {
        container.innerHTML = `<div class="py-10 text-center text-gray-400 italic text-sm">Karyawan tidak ditemukan</div>`;
    } else {
        filtered.forEach(emp => {
            const div = document.createElement('div');
            div.className = "flex items-center gap-3 p-3 hover:bg-blue-50 rounded-xl cursor-pointer transition-colors active:scale-95 transform";
            div.onclick = () => selectEmployee(emp.id, emp.nama);
            div.innerHTML = `
                <div class="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                    ${emp.nama.charAt(0).toUpperCase()}
                </div>
                <div>
                    <p class="font-bold text-gray-800">${emp.nama}</p>
                    <p class="text-xs text-gray-500">ID: ${emp.id.slice(0,8)}...</p>
                </div>
            `;
            container.appendChild(div);
        });
    }
};

const selectEmployee = (id, nama) => {
    document.getElementById('selected-emp-id').value = id;
    document.getElementById('selected-emp-nama').value = nama;
    
    // Update Button UI
    document.getElementById('emp-avatar').innerText = nama.charAt(0).toUpperCase();
    document.getElementById('emp-avatar').className = 'w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0';
    document.getElementById('emp-picker-label').innerText = nama;
    document.getElementById('emp-picker-label').className = 'text-sm font-bold text-gray-800';
    document.getElementById('emp-picker-sub').innerText = 'Karyawan terpilih';
    
    closeEmployeeModal();
};

const showAddNewEmpField = () => {
    document.getElementById('btn-show-new-emp').classList.add('hidden');
    document.getElementById('new-emp-field').classList.remove('hidden');
    document.getElementById('input-new-emp-name').focus();
};

const hideAddNewEmpField = () => {
    document.getElementById('btn-show-new-emp').classList.remove('hidden');
    document.getElementById('new-emp-field').classList.add('hidden');
    document.getElementById('input-new-emp-name').value = '';
};

const submitNewEmployee = async () => {
    const nama = document.getElementById('input-new-emp-name').value.trim();
    if (!nama) return showToast('Masukkan nama karyawan.', 'error');
    
    const existing = state.employees.find(e => e.nama.toLowerCase() === nama.toLowerCase());
    if (existing) return showToast(`Nama "${nama}" sudah terdaftar.`, 'error');
    
    try {
        const docRef = await db.collection('employees').add({ nama: nama });
        selectEmployee(docRef.id, nama);
        showToast(`Karyawan "${nama}" berhasil ditambahkan.`);
    } catch (err) {
        showToast('Gagal menambahkan karyawan.', 'error');
    }
};

// --- Employee Deletion Modal Logic ---
let _pendingDeleteEmpId = null;

const deleteEmployee = (id) => {
    const emp = state.employees.find(e => e.id === id);
    if (!emp) return;

    _pendingDeleteEmpId = id;
    document.getElementById('del-emp-name').textContent = emp.nama;
    
    const hasData = state.setoran.some(s => s.empId === id);
    const warningEl = document.getElementById('del-emp-warning');
    if (hasData) {
        warningEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1"></i> Karyawan ini memiliki riwayat setoran. Menghapus master data tidak akan menghapus riwayat, namun nama di riwayat lama akan tetap tersimpan.`;
    } else {
        warningEl.textContent = "Karyawan ini belum memiliki riwayat. Data akan dihapus sepenuhnya.";
    }

    // Reset modal
    const pinInput = document.getElementById('input-del-emp-pin');
    pinInput.value = '';
    document.getElementById('del-emp-error-msg').classList.add('hidden');
    pinInput.classList.remove('shake', 'border-red-500');
    
    const modal = document.getElementById('emp-delete-modal');
    modal.style.display = 'flex';
    setTimeout(() => pinInput.focus(), 100);
};

const closeDelEmpModal = () => {
    document.getElementById('emp-delete-modal').style.display = 'none';
    _pendingDeleteEmpId = null;
};

const confirmDeleteEmployee = async () => {
    const pinInput   = document.getElementById('input-del-emp-pin');
    const errorMsg   = document.getElementById('del-emp-error-msg');
    const enteredPin = pinInput.value;

    if (enteredPin !== APP_PIN) {
        pinInput.classList.remove('shake');
        pinInput.classList.add('border-red-500');
        void pinInput.offsetWidth;
        pinInput.classList.add('shake');
        errorMsg.classList.remove('hidden');
        pinInput.value = '';
        pinInput.focus();
        return;
    }

    const id = _pendingDeleteEmpId;
    const emp = state.employees.find(e => e.id === id);
    closeDelEmpModal();

    try {
        await db.collection('employees').doc(id).delete();
        showToast(`Karyawan "${emp.nama}" berhasil dihapus.`, 'info');
        document.getElementById('detail-karyawan').innerHTML = `
            <div class="h-full flex flex-col items-center justify-center text-gray-400 py-20">
                <i class="fa-solid fa-user-slash text-6xl mb-4 opacity-20"></i>
                <p>Pilih karyawan untuk melihat detail</p>
            </div>
        `;
        window.activeEmpId = null;
    } catch (err) {
        showToast('Gagal menghapus karyawan.', 'error');
    }
};

// Keyboard listeners for deletion modals
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('input-del-emp-pin').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') confirmDeleteEmployee();
        if (e.key === 'Escape') closeDelEmpModal();
    });
});

