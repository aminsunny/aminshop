// ================================================================
// sheets.js — ارتباط با Google Sheets از طریق Apps Script
// هیچ کلید یا اطلاعات محرمانه‌ای اینجا نیست
// ================================================================

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxCgzbtndPL8YyGzF1iAYob_2zM_Ig3IvPxtFIOO-BoPpksiZN9yCz6PuSj85bdbl14bQ/exec";

// ================================================================
// بارگذاری همه داده‌ها
// ================================================================
async function loadAllData() {
    const res  = await fetch(APPS_SCRIPT_URL);
    const json = await res.json();
    if (json.status !== "success") throw new Error("خطا در دریافت داده‌ها");
    const d = json.data;

    const employees = (d.employees || []).map(r => r[0]).filter(Boolean);

    const logs = (d.attendance_logs || []).map(r => ({
        id: r[0], date: r[1], time: r[2], name: r[3],
        minutes: parseInt(r[4]) || 0, shift: r[5], type: r[6]
    })).filter(r => r.name);

    const active = (d.finance_active || []).map(r => ({
        id: r[0], date: r[1], name: r[2],
        amount: parseInt(r[3]) || 0, desc: r[4] || ""
    })).filter(r => r.name);

    const debts = (d.finance_debts || []).map(r => ({
        id: r[0], date: r[1], name: r[2],
        amount: parseInt(r[3]) || 0, desc: r[4] || ""
    })).filter(r => r.name);

    const archive = (d.finance_archive || []).map(r => {
        try { return JSON.parse(r[0]); } catch { return null; }
    }).filter(Boolean);

    const salaries = {};
    (d.salaries || []).forEach(r => {
        if (r[0] && r[1]) salaries[r[0]] = parseInt(r[1]) || 0;
    });

    const config = {};
    (d.config || []).forEach(r => {
        if (r[0] && r[1]) config[r[0]] = r[1];
    });

    return { employees, logs, active, debts, archive, salaries, config };
}

// ================================================================
// ذخیره همه داده‌ها
// ================================================================
async function saveAll(state) {
    const payload = {
        employees:       state.employees.map(e => [e]),
        attendance_logs: state.logs.map(l => [l.id||"", l.date||"", l.time||"", l.name||"", l.minutes||0, l.shift||"", l.type||""]),
        finance_active:  state.active.map(a => [a.id||"", a.date||"", a.name||"", a.amount||0, a.desc||""]),
        finance_debts:   state.debts.map(d => [d.id||"", d.date||"", d.name||"", d.amount||0, d.desc||""]),
        finance_archive: state.archive.map(a => [JSON.stringify(a)]),
        salaries:        Object.entries(state.salaries).map(([k,v]) => [k, v]),
        config:          Object.entries(state.config).map(([k,v]) => [k, String(v)]),
    };

    const res  = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (json.status !== "success") throw new Error("خطا در ذخیره داده‌ها");
}

// ================================================================
// توابع همگام با app.js جهت جلوگیری از تداخل رفتار برنامه
// ================================================================
async function saveEmployees(employees) { return saveAll({ ...window.appState, employees }); }
async function saveLogs(logs) { return saveAll({ ...window.appState, logs }); }
async function saveActive(active) { return saveAll({ ...window.appState, active }); }
async function saveDebts(debts) { return saveAll({ ...window.appState, debts }); }
async function saveArchive(archive) { return saveAll({ ...window.appState, archive }); }
async function saveSalaries(salaries) { return saveAll({ ...window.appState, salaries }); }
async function saveConfig(config) { return saveAll({ ...window.appState, config }); }

export {
    loadAllData, saveAll,
    saveEmployees, saveLogs, saveActive,
    saveDebts, saveArchive, saveSalaries, saveConfig,
};
