// ================================================================
// sheets.js — ارتباط با Google Sheets از طریق Apps Script
// ================================================================

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxCgzbtndPL8YyGzF1iAYob_2zM_Ig3IvPxtFIOO-BoPpksiZN9yCz6PuSj85bdbl14bQ/exec";

function nowSyncTs() {
    const n = new Date();
    return `${n.getFullYear()}/${String(n.getMonth()+1).padStart(2,'0')}/${String(n.getDate()).padStart(2,'0')} ${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}:${String(n.getSeconds()).padStart(2,'0')}`;
}

// ================================================================
// بارگذاری داده‌های اصلی (کارمندان و config)
// ================================================================
async function loadAllData() {
    const res  = await fetch(APPS_SCRIPT_URL);
    const json = await res.json();
    if (json.status !== "success") throw new Error("خطا در دریافت داده‌ها");
    const d = json.data;

    function fixDate(v) {
        if (!v) return "";
        const s = String(v);
        // ISO format: 1405-03-02T20:34:16.000Z → 1405/03/02
        if (s.includes("T")) return s.split("T")[0].replace(/-/g, "/");
        return s.replace(/-/g, "/");
    }

    function fixTime(v) {
        if (!v) return "--:--";
        const s = String(v);
        // اگه ISO بود یا 1899 بود، ساعت رو از داخلش بکش
        if (s.includes("T")) {
            const t = s.split("T")[1] || "";
            return t.slice(0, 5); // HH:MM
        }
        // اگه عدد دهدهی بود (مثل 0.375 = 9:00)
        if (!isNaN(parseFloat(s)) && s.includes(".") && !s.includes(":")) {
            const totalMins = Math.round(parseFloat(s) * 24 * 60);
            const h = Math.floor(totalMins / 60) % 24;
            const m = totalMins % 60;
            return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
        }
        // اگه --:-- یا HH:MM بود همونطور برگردون
        if (s === "--:--" || s.includes(":")) return s.slice(0,5);
        return "--:--";
    }

    function fixId(v) {
        return String(v).split(".")[0];
    }

    const employees = (d.employees || []).map(r => r[0]).filter(Boolean);

    const logs = (d.attendance_logs || []).map(r => ({
        id: fixId(r[0]), date: fixDate(r[1]), time: fixTime(r[2]),
        name: r[3], minutes: parseInt(r[4]) || 0, shift: r[5], type: r[6]
    })).filter(r => r.name);

    const active = (d.finance_active || []).map(r => ({
        id: fixId(r[0]), date: fixDate(r[1]), name: r[2],
        amount: parseInt(r[3]) || 0, desc: r[4] || ""
    })).filter(r => r.name);

    const debts = (d.finance_debts || []).map(r => ({
        id: fixId(r[0]), date: fixDate(r[1]), name: r[2],
        amount: parseInt(r[3]) || 0, desc: r[4] || ""
    })).filter(r => r.name);

    const archive = (d.finance_archive || []).map(r => {
        try { return JSON.parse(r[0]); } catch { return null; }
    }).filter(Boolean);

    const salaries = {};
    (d.salaries || []).forEach(r => { if (r[0] && r[1]) salaries[r[0]] = parseInt(r[1]) || 0; });

    const config = {};
    (d.config || []).forEach(r => { if (r[0] && r[1]) config[r[0]] = r[1]; });

    return { employees, logs, active, debts, archive, salaries, config };
}

// ================================================================
// ارسال رکورد جدید به pending_sync
// ================================================================
async function addToPending(type, record) {
    const pendingId = "p" + crypto.randomUUID().replace(/-/g,"").slice(0,14);
    const ts = nowSyncTs();
    const payload = {
        pending_sync: [[pendingId, type, ts, JSON.stringify(record)]]
    };
    const res  = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (json.status === "duplicate") {
        const err = new Error(json.message || "این رکورد قبلاً ثبت شده است");
        err.isDuplicate = true;
        throw err;
    }
    if (json.status !== "success") throw new Error("خطا در ذخیره رکورد");
}

// ================================================================
// ذخیره config (برای تغییر رمز)
// ================================================================
async function saveConfig(config) {
    const res  = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({ config: Object.entries(config).map(([k,v]) => [k, String(v)]) }),
    });
    const json = await res.json();
    if (json.status !== "success") throw new Error("خطا در ذخیره تنظیمات");
}

// توابع دیگر برای سازگاری
async function saveLogs(logs) {
    // موبایل دیگه مستقیم logs نمیفرسته — از addToPending استفاده کن
}
async function saveActive(active) {
    // موبایل دیگه مستقیم active نمیفرسته — از addToPending استفاده کن
}
async function saveAll(state) { }

export { loadAllData, addToPending, saveConfig, saveLogs, saveActive, saveAll, APPS_SCRIPT_URL };
