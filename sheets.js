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
// توابع جداگانه برای ذخیره بخشی از داده‌ها
// ================================================================
async function saveEmployees(employees) {
    await _saveSheets({ employees: employees.map(e => [e]) });
}
async function saveLogs(logs) {
    await _saveSheets({ attendance_logs: logs.map(l => [l.id||"", l.date||"", l.time||"", l.name||"", l.minutes||0, l.shift||"", l.type||""]) });
}
async function saveActive(active) {
    await _saveSheets({ finance_active: active.map(a => [a.id||"", a.date||"", a.name||"", a.amount||0, a.desc||""]) });
}
async function saveDebts(debts) {
    await _saveSheets({ finance_debts: debts.map(d => [d.id||"", d.date||"", d.name||"", d.amount||0, d.desc||""]) });
}
async function saveArchive(archive) {
    await _saveSheets({ finance_archive: archive.map(a => [JSON.stringify(a)]) });
}
async function saveSalaries(salaries) {
    await _saveSheets({ salaries: Object.entries(salaries).map(([k,v]) => [k, v]) });
}
async function saveConfig(config) {
    await _saveSheets({ config: Object.entries(config).map(([k,v]) => [k, String(v)]) });
}

async function _saveSheets(payload) {
    const res  = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (json.status !== "success") throw new Error("خطا در ذخیره");
}

export {
    loadAllData, saveAll,
    saveEmployees, saveLogs, saveActive,
    saveDebts, saveArchive, saveSalaries, saveConfig,
};
