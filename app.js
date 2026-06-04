// ================================================================
// app.js — منطق اصلی اپلیکیشن
// ================================================================
import { loadAllData, saveAll, saveLogs, saveActive, saveDebts, saveArchive, saveSalaries, saveEmployees, saveConfig } from "./sheets.js";

// ================================================================
// State مرکزی
// ================================================================
let STATE = {
    employees: [],
    logs: [],
    active: [],
    debts: [],
    archive: [],
    salaries: {},
    config: {
        admin_pass: btoa("602158"),   // رمز مدیریت پیش‌فرض
        entry_pass: btoa("1234"),     // رمز ورود به اپ پیش‌فرض
        morning_start: "10",
        morning_min: "0",
        afternoon_start: "17",
        afternoon_min: "0",
    },
    loaded: false,
};

// ================================================================
// تاریخ شمسی
// ================================================================
function toJalali(date = new Date()) {
    let gy = date.getFullYear(), gm = date.getMonth() + 1, gd = date.getDate();
    let g_d_no, jy, jd, j_np, jp, j_d_no;
    const g_days_in_month = [31,28,31,30,31,30,31,31,30,31,30,31];
    const j_days_in_month = [31,31,31,31,31,31,30,30,30,30,30,29];
    gy -= 1600; gm -= 1; gd -= 1;
    g_d_no = 365*gy + Math.floor((gy+3)/4) - Math.floor((gy+99)/100) + Math.floor((gy+399)/400);
    for (let i=0; i<gm; i++) g_d_no += g_days_in_month[i];
    if (gm > 1 && ((gy%4===0 && gy%100!==0) || (gy%400===0))) g_d_no++;
    g_d_no += gd;
    j_d_no = g_d_no - 79;
    j_np = Math.floor(j_d_no/12053); j_d_no %= 12053;
    jy = 979 + 33*j_np + 4*Math.floor(j_d_no/1461);
    j_d_no %= 1461;
    if (j_d_no >= 366) { jy += Math.floor((j_d_no-1)/365); j_d_no = (j_d_no-1)%365; }
    for (let i=0; i<11 && j_d_no>=j_days_in_month[i]; i++) { j_d_no -= j_days_in_month[i]; jp = i+1; }
    jd = j_d_no + 1;
    const jm = (jp === undefined ? 1 : jp + 1);
    return `${jy}/${String(jm).padStart(2,'0')}/${String(jd).padStart(2,'0')}`;
}

function nowTime() {
    const n = new Date();
    return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
}
function nowHour() { return new Date().getHours(); }
function uid() { return crypto.randomUUID().slice(0, 8); }

// ================================================================
// رمز ورود به اپ
// ================================================================
function showLoginScreen() {
    document.getElementById("login-screen").style.display  = "flex";
    document.getElementById("app-content").style.display   = "none";
    document.getElementById("bottom-nav").style.display    = "none";
    document.getElementById("app-header").style.display    = "none";
    // فوکوس خودکار
    setTimeout(() => document.getElementById("login-pass-input")?.focus(), 300);
}

function hideLoginScreen() {
    document.getElementById("login-screen").style.display  = "none";
    document.getElementById("app-content").style.display   = "block";
    document.getElementById("bottom-nav").style.display    = "flex";
    document.getElementById("app-header").style.display    = "flex";
}

function checkEntryPass() {
    const input = document.getElementById("login-pass-input");
    const val   = input.value;
    if (!val) return;
    const stored = STATE.config.entry_pass || btoa("1234");
    if (btoa(val) === stored) {
        hideLoginScreen();
        input.value = "";
    } else {
        input.value = "";
        input.placeholder = "رمز اشتباه است، دوباره امتحان کن";
        input.style.borderColor = "var(--red)";
        setTimeout(() => {
            input.placeholder = "رمز ورود را وارد کنید";
            input.style.borderColor = "";
        }, 2000);
    }
}

// ================================================================
// بارگذاری و نمایش
// ================================================================
async function init() {
    // اول login رو نشون بده
    showLoginScreen();
    showLoading(true);
    try {
        const data = await loadAllData();
        STATE = { ...STATE, ...data, loaded: true };
        // اطمینان از وجود کلیدهای جدید در داده‌های قدیمی
        STATE.config.entry_pass = STATE.config.entry_pass || btoa("1234");
        STATE.config.admin_pass = STATE.config.admin_pass || btoa("602158");
    } catch(e) {
        showToast("خطا در اتصال به گوگل شیت: " + e.message, "error");
    }
    showLoading(false);
    renderPage("attendance");
    updateEmployeeLists();
}

function showLoading(show) {
    document.getElementById("loading-overlay").style.display = show ? "flex" : "none";
}

function showToast(msg, type = "success") {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.className = `toast show ${type}`;
    setTimeout(() => t.className = "toast", 3000);
}

// ================================================================
// ناوبری
// ================================================================
function renderPage(page) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    document.getElementById(`page-${page}`)?.classList.add("active");
    document.querySelector(`[data-page="${page}"]`)?.classList.add("active");

    if (page === "attendance") renderAttReport();
    if (page === "finance")    renderFinance();
    if (page === "archive")    renderArchive();
    if (page === "settings")   renderSettingsValues();
}

// ================================================================
// مدیریت کارمندان
// ================================================================
function updateEmployeeLists() {
    const emps = STATE.employees;
    ["att-emp", "att-emp-abs", "fin-emp", "att-filter", "fin-filter", "admin-sal-emp"].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const prev = el.value;
        el.innerHTML = id.includes("filter")
            ? `<option value="همه">همه کارمندان</option>` + emps.map(e => `<option>${e}</option>`).join("")
            : `<option value="">انتخاب کارمند...</option>` + emps.map(e => `<option>${e}</option>`).join("");
        if (prev) el.value = prev;
    });
    // لیست کارمندان در تنظیمات
    const chips = document.getElementById("emp-chips");
    if (chips) {
        chips.innerHTML = emps.map(e =>
            `<div class="emp-chip"><span>${e}</span><button onclick="removeEmployee('${e}')">×</button></div>`
        ).join("");
    }
}

async function addEmployee() {
    const inp  = document.getElementById("new-emp-name");
    const name = inp.value.trim();
    if (!name) return showToast("نام نمی‌تواند خالی باشد", "error");
    if (STATE.employees.includes(name)) return showToast("این کارمند قبلاً ثبت شده", "error");
    STATE.employees.push(name);
    STATE.employees.sort();
    showLoading(true);
    await saveEmployees(STATE.employees);
    showLoading(false);
    updateEmployeeLists();
    inp.value = "";
    showToast(`کارمند "${name}" اضافه شد`);
}

async function removeEmployee(name) {
    if (!confirm(`آیا مطمئنید که "${name}" حذف شود؟`)) return;
    STATE.employees = STATE.employees.filter(e => e !== name);
    STATE.logs      = STATE.logs.filter(l => l.name !== name);
    STATE.active    = STATE.active.filter(a => a.name !== name);
    STATE.debts     = STATE.debts.filter(d => d.name !== name);
    delete STATE.salaries[name];
    showLoading(true);
    await saveAll(STATE);
    showLoading(false);
    updateEmployeeLists();
    renderAttReport();
    renderFinance();
    showToast(`کارمند "${name}" حذف شد`);
}

// ================================================================
// ثبت حضور
// ================================================================
async function registerAttendance() {
    const name = document.getElementById("att-emp").value;
    if (!name) return showToast("کارمند انتخاب کنید", "error");
    const h = nowHour();
    let targetH, targetM, shift;
    if (h >= 8 && h < 14) {
        targetH = parseInt(STATE.config.morning_start);
        targetM = parseInt(STATE.config.morning_min);
        shift = "صبح";
    } else if (h >= 15 && h < 23) {
        targetH = parseInt(STATE.config.afternoon_start);
        targetM = parseInt(STATE.config.afternoon_min);
        shift = "عصر";
    } else {
        return showToast("خارج از ساعت کاری", "error");
    }
    const now    = new Date();
    const target = new Date(); target.setHours(targetH, targetM, 0, 0);
    const diff   = Math.floor((now - target) / 60000);
    const log    = { id: uid(), date: toJalali(), time: nowTime(), name, minutes: diff, shift, type: "حضور" };
    STATE.logs.push(log);
    showLoading(true);
    await saveLogs(STATE.logs);
    showLoading(false);
    renderAttReport();
    const msg = diff > 0 ? `تاخیر: ${diff} دقیقه` : diff < 0 ? `${Math.abs(diff)} دقیقه زودتر` : "دقیقاً به موقع";
    showToast(`ورود ${name} ثبت شد — ${msg}`);
}

async function registerAbsence() {
    // هر دو select رو چک کن
    const name = document.getElementById("att-emp-abs").value || document.getElementById("att-emp").value;
    if (!name) return showToast("کارمند انتخاب کنید", "error");
    const shift = document.querySelector('input[name="abs-shift"]:checked')?.value || "صبح";
    const desc  = document.getElementById("abs-desc").value.trim();
    const log   = { id: uid(), date: toJalali(), time: "--:--", name, minutes: 0, shift, type: `غیبت: ${desc}` };
    STATE.logs.push(log);
    showLoading(true);
    await saveLogs(STATE.logs);
    showLoading(false);
    renderAttReport();
    document.getElementById("abs-desc").value = "";
    showToast(`غیبت ${name} ثبت شد`);
}

async function deleteLog(id) {
    if (!checkAdminPass()) return;
    const log = STATE.logs.find(l => l.id === id);
    if (!log) return;
    if (!confirm(`حذف رکورد ${log.name} — ${log.date}؟`)) return;
    STATE.logs = STATE.logs.filter(l => l.id !== id);
    showLoading(true);
    await saveLogs(STATE.logs);
    showLoading(false);
    renderAttReport();
    showToast("رکورد حذف شد");
}

function renderAttReport() {
    const filt  = document.getElementById("att-filter")?.value || "همه";
    const from  = document.getElementById("att-from")?.value?.replace(/\//g, "") || "";
    const to    = document.getElementById("att-to")?.value?.replace(/\//g, "") || "";
    const tbody = document.getElementById("att-tbody");
    if (!tbody) return;
    let totalMins = 0, absCount = 0, rows = "";
    const filtered = [...STATE.logs].reverse().filter(l => {
        const d = l.date.replace(/\//g, "");
        return (filt === "همه" || l.name === filt) && (!from || d >= from) && (!to || d <= to);
    });
    filtered.forEach(l => {
        if (l.type.includes("غیبت")) absCount++;
        else totalMins += l.minutes;
        const badge = l.type.includes("غیبت")
            ? `<span class="badge red">${l.type}</span>`
            : l.minutes > 0
                ? `<span class="badge yellow">تاخیر ${l.minutes} دقیقه</span>`
                : `<span class="badge green">به موقع</span>`;
        rows += `<tr>
            <td>${l.date}</td><td>${l.name}</td>
            <td>${l.shift}</td><td>${l.time}</td>
            <td>${badge}</td>
            <td><button class="icon-btn del" onclick="deleteLog('${l.id}')">🗑</button></td>
        </tr>`;
    });
    tbody.innerHTML = rows || `<tr><td colspan="6" class="empty">رکوردی یافت نشد</td></tr>`;
    document.getElementById("att-summary").textContent =
        `جمع تاخیر: ${totalMins} دقیقه | تعداد غیبت: ${absCount}`;
}

// ================================================================
// امور مالی
// ================================================================
async function registerFinance() {
    const name   = document.getElementById("fin-emp").value;
    const amount = parseInt(document.getElementById("fin-amount").value.replace(/,/g, "")) || 0;
    const desc   = document.getElementById("fin-desc").value.trim();
    if (!name)   return showToast("کارمند انتخاب کنید", "error");
    if (!amount) return showToast("مبلغ را وارد کنید", "error");
    if (!confirm(`ثبت مساعده ${amount.toLocaleString()} تومان برای ${name}؟`)) return;
    STATE.active.push({ id: uid(), date: toJalali(), name, amount, desc });
    showLoading(true);
    await saveActive(STATE.active);
    showLoading(false);
    document.getElementById("fin-amount").value = "";
    document.getElementById("fin-desc").value   = "";
    renderFinance();
    showToast(`مساعده ${name} ثبت شد`);
}

async function deleteActive(id) {
    if (!checkAdminPass()) return;
    STATE.active = STATE.active.filter(a => a.id !== id);
    showLoading(true);
    await saveActive(STATE.active);
    showLoading(false);
    renderFinance();
    showToast("رکورد حذف شد");
}

function renderFinance() {
    const filt      = document.getElementById("fin-filter")?.value || "همه";
    const actTbody  = document.getElementById("fin-active-tbody");
    const debtTbody = document.getElementById("fin-debt-tbody");
    if (!actTbody) return;
    let totalActive = 0, totalDebt = 0, activeRows = "", debtRows = "";
    STATE.active.filter(a => filt === "همه" || a.name === filt).forEach(a => {
        totalActive += a.amount;
        activeRows += `<tr>
            <td>${a.date}</td><td>${a.name}</td>
            <td>${a.amount.toLocaleString()}</td><td>${a.desc || "-"}</td>
            <td><button class="icon-btn del" onclick="deleteActive('${a.id}')">🗑</button></td>
        </tr>`;
    });
    STATE.debts.filter(d => filt === "همه" || d.name === filt).forEach(d => {
        totalDebt += d.amount;
        debtRows += `<tr class="debt-row">
            <td>${d.date}</td><td>${d.name}</td>
            <td>${d.amount.toLocaleString()}</td><td>${d.desc || "-"}</td>
            <td></td>
        </tr>`;
    });
    actTbody.innerHTML  = activeRows  || `<tr><td colspan="5" class="empty">خالی</td></tr>`;
    debtTbody.innerHTML = debtRows    || `<tr><td colspan="5" class="empty">بدهی انتقالی ندارد</td></tr>`;
    const total = totalActive + totalDebt;
    document.getElementById("fin-summary").innerHTML =
        `مساعده: <b>${totalActive.toLocaleString()}</b> | بدهی: <b style="color:#f87171">${totalDebt.toLocaleString()}</b> | جمع: <b style="color:#818cf8">${total.toLocaleString()}</b> تومان`;
}

// ================================================================
// تسویه حساب
// ================================================================
function openSettleDialog() {
    const filt = document.getElementById("fin-filter").value;
    if (filt === "همه") return showToast("ابتدا یک کارمند را فیلتر کنید", "error");
    const activeItems = STATE.active.filter(a => a.name === filt);
    const debtItems   = STATE.debts.filter(d => d.name === filt);
    if (!activeItems.length && !debtItems.length) return showToast("رکورد فعالی وجود ندارد", "error");
    const totalActive = activeItems.reduce((s, a) => s + a.amount, 0);
    const totalDebt   = debtItems.reduce((s, d) => s + d.amount, 0);
    const total       = totalActive + totalDebt;
    const defSalary   = STATE.salaries[filt] || 0;
    document.getElementById("settle-name").textContent    = filt;
    document.getElementById("settle-active").textContent  = totalActive.toLocaleString();
    document.getElementById("settle-debt").textContent    = totalDebt.toLocaleString();
    document.getElementById("settle-total").textContent   = total.toLocaleString();
    document.getElementById("settle-salary").value        = defSalary ? defSalary.toLocaleString() : "";
    document.getElementById("settle-modal").style.display = "flex";
    document.getElementById("settle-confirm").onclick = async () => {
        const salary  = parseInt(document.getElementById("settle-salary").value.replace(/,/g, "")) || 0;
        if (!salary) return showToast("حقوق را وارد کنید", "error");
        const debtOut = total - salary;
        const saveSal = document.getElementById("settle-save-salary").checked;
        if (!confirm(debtOut > 0
            ? `${debtOut.toLocaleString()} تومان بدهی به دوره بعد منتقل می‌شود. ادامه؟`
            : "تسویه کامل انجام شود؟")) return;
        if (saveSal) STATE.salaries[filt] = salary;
        STATE.archive.push({
            id: uid(), settle_date: toJalali(), name: filt,
            salary, total_amount: total,
            total_active: totalActive, total_debt_in: totalDebt,
            debt_carried_out: Math.max(debtOut, 0),
            details: [...activeItems, ...debtItems]
        });
        STATE.active = STATE.active.filter(a => a.name !== filt);
        STATE.debts  = STATE.debts.filter(d => d.name !== filt);
        if (debtOut > 0) {
            STATE.debts.push({ id: uid(), date: toJalali(), name: filt, amount: debtOut,
                desc: `بدهی انتقالی از تسویه ${toJalali()}` });
        }
        showLoading(true);
        await saveAll(STATE);
        showLoading(false);
        closeSettle();
        renderFinance();
        renderArchive();
        showToast("تسویه حساب انجام شد");
    };
}

function closeSettle() {
    document.getElementById("settle-modal").style.display = "none";
}

// ================================================================
// بایگانی
// ================================================================
function renderArchive() {
    const tbody = document.getElementById("archive-tbody");
    if (!tbody) return;
    let rows = "";
    [...STATE.archive].reverse().forEach(r => {
        rows += `<tr onclick="showArchiveDetail('${r.id}')" style="cursor:pointer">
            <td>${r.settle_date}</td><td>${r.name}</td>
            <td>${r.total_amount?.toLocaleString()}</td>
            <td>${r.salary?.toLocaleString() || "-"}</td>
            <td>${r.debt_carried_out > 0
                ? `<span class="badge red">${r.debt_carried_out.toLocaleString()}</span>`
                : `<span class="badge green">کامل</span>`}</td>
        </tr>`;
    });
    tbody.innerHTML = rows || `<tr><td colspan="5" class="empty">بایگانی خالی است</td></tr>`;
}

function showArchiveDetail(id) {
    const rec = STATE.archive.find(r => r.id === id);
    if (!rec) return;
    document.getElementById("detail-title").textContent = `ریز برداشتی‌های ${rec.name}`;
    let html = `<div class="detail-info">
        <span>👤 ${rec.name}</span>
        <span>📅 ${rec.settle_date}</span>
        <span>💰 جمع: ${rec.total_amount?.toLocaleString()} تومان</span>
        <span>💵 حقوق: ${rec.salary?.toLocaleString() || "-"} تومان</span>
        ${rec.debt_carried_out > 0
            ? `<span class="red">⚠️ بدهی انتقالی: ${rec.debt_carried_out.toLocaleString()}</span>`
            : `<span class="green">✅ تسویه کامل</span>`}
    </div><hr/>`;
    (rec.details || []).forEach((d, i) => {
        html += `<div class="detail-item">
            <b>${i+1}.</b> ${d.amount?.toLocaleString()} تومان
            <span class="muted">— ${d.date} — ${d.desc || "-"}</span>
        </div>`;
    });
    document.getElementById("detail-body").innerHTML = html;
    document.getElementById("detail-modal").style.display = "flex";
}

function closeDetail() {
    document.getElementById("detail-modal").style.display = "none";
}

// ================================================================
// تنظیمات — نیاز به رمز مدیر
// ================================================================
function checkAdminPass() {
    const pass = prompt("رمز عبور مدیریت:");
    if (!pass) return false;
    return btoa(pass) === STATE.config.admin_pass;
}

function renderPage_settings() {
    // ورود به تنظیمات نیاز به رمز مدیر دارد
    if (!checkAdminPass()) {
        showToast("رمز مدیریت اشتباه است", "error");
        // برگشت به صفحه قبل
        renderPage("attendance");
        document.querySelector('[data-page="attendance"]').classList.add("active");
        document.querySelector('[data-page="settings"]').classList.remove("active");
        return;
    }
    renderPage("settings");
}

function renderSettingsValues() {
    const el = id => document.getElementById(id);
    if (el("morning-h"))   el("morning-h").value   = STATE.config.morning_start   || "10";
    if (el("morning-m"))   el("morning-m").value   = STATE.config.morning_min     || "0";
    if (el("afternoon-h")) el("afternoon-h").value = STATE.config.afternoon_start || "17";
    if (el("afternoon-m")) el("afternoon-m").value = STATE.config.afternoon_min   || "0";
}

async function saveAdminSettings() {
    STATE.config.morning_start   = document.getElementById("morning-h").value;
    STATE.config.morning_min     = document.getElementById("morning-m").value;
    STATE.config.afternoon_start = document.getElementById("afternoon-h").value;
    STATE.config.afternoon_min   = document.getElementById("afternoon-m").value;
    showLoading(true);
    await saveConfig(STATE.config);
    showLoading(false);
    showToast("تنظیمات ذخیره شد");
}

// تغییر رمز ورود به اپ
async function changeEntryPassword() {
    const newPass = prompt("رمز ورود جدید به اپ (حداقل ۴ کاراکتر):");
    if (!newPass || newPass.length < 4) return showToast("رمز باید حداقل ۴ کاراکتر باشد", "error");
    const confirm2 = prompt("رمز جدید را دوباره وارد کنید:");
    if (newPass !== confirm2) return showToast("رمزها یکسان نیستند", "error");
    STATE.config.entry_pass = btoa(newPass);
    showLoading(true);
    await saveConfig(STATE.config);
    showLoading(false);
    showToast("رمز ورود تغییر یافت");
}

// تغییر رمز مدیریت
async function changeAdminPassword() {
    const newPass = prompt("رمز مدیریت جدید (حداقل ۴ کاراکتر):");
    if (!newPass || newPass.length < 4) return showToast("رمز باید حداقل ۴ کاراکتر باشد", "error");
    const confirm2 = prompt("رمز جدید را دوباره وارد کنید:");
    if (newPass !== confirm2) return showToast("رمزها یکسان نیستند", "error");
    STATE.config.admin_pass = btoa(newPass);
    showLoading(true);
    await saveConfig(STATE.config);
    showLoading(false);
    showToast("رمز مدیریت تغییر یافت");
}

async function saveSalaryAdmin() {
    const name   = document.getElementById("admin-sal-emp").value;
    const amount = parseInt(document.getElementById("admin-sal-amount").value.replace(/,/g, "")) || 0;
    if (!name)   return showToast("کارمند انتخاب کنید", "error");
    if (!amount) return showToast("مبلغ را وارد کنید", "error");
    STATE.salaries[name] = amount;
    showLoading(true);
    await saveSalaries(STATE.salaries);
    showLoading(false);
    showToast(`حقوق ${name} ذخیره شد`);
}

function loadSalaryAdmin() {
    const name = document.getElementById("admin-sal-emp").value;
    if (!name) return;
    const sal = STATE.salaries[name];
    document.getElementById("admin-sal-amount").value = sal ? sal.toLocaleString() : "";
}

// ================================================================
// فرمت عدد
// ================================================================
function formatInput(el) {
    const v = el.value.replace(/,/g, "");
    if (/^\d+$/.test(v)) el.value = parseInt(v).toLocaleString();
}

// ================================================================
// Global exports
// ================================================================
window.renderPage            = renderPage;
window.renderPage_settings   = renderPage_settings;
window.checkEntryPass        = checkEntryPass;
window.addEmployee           = addEmployee;
window.removeEmployee        = removeEmployee;
window.registerAttendance    = registerAttendance;
window.registerAbsence       = registerAbsence;
window.deleteLog             = deleteLog;
window.renderAttReport       = renderAttReport;
window.registerFinance       = registerFinance;
window.deleteActive          = deleteActive;
window.renderFinance         = renderFinance;
window.openSettleDialog      = openSettleDialog;
window.closeSettle           = closeSettle;
window.renderArchive         = renderArchive;
window.showArchiveDetail     = showArchiveDetail;
window.closeDetail           = closeDetail;
window.saveAdminSettings     = saveAdminSettings;
window.changeEntryPassword   = changeEntryPassword;
window.changeAdminPassword   = changeAdminPassword;
window.saveSalaryAdmin       = saveSalaryAdmin;
window.loadSalaryAdmin       = loadSalaryAdmin;
window.formatInput           = formatInput;
window.toJalali              = toJalali;

// شروع
init();
