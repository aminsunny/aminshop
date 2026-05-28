// ================================================================
// sheets.js — ارتباط با Google Sheets API
// ================================================================
import APP_CONFIG from "./config.js";

const SHEETS = {
    EMPLOYEES: "employees",
    LOGS:      "attendance_logs",
    ACTIVE:    "finance_active",
    DEBTS:     "finance_debts",
    ARCHIVE:   "finance_archive",
    SALARIES:  "salaries",
    CONFIG:    "config",
};

// ================================================================
// JWT و احراز هویت
// ================================================================
async function getAccessToken() {
    const now = Math.floor(Date.now() / 1000);
    const header  = { alg: "RS256", typ: "JWT" };
    const payload = {
        iss: APP_CONFIG.client_email,
        scope: "https://www.googleapis.com/auth/spreadsheets",
        aud: "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now,
    };

    const b64 = (obj) => btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

    const signingInput = `${b64(header)}.${b64(payload)}`;
    const keyData = APP_CONFIG.private_key
        .replace("-----BEGIN PRIVATE KEY-----", "")
        .replace("-----END PRIVATE KEY-----", "")
        .replace(/\n/g, "");

    const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey(
        "pkcs8", binaryKey.buffer,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false, ["sign"]
    );
    const signature = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5", cryptoKey,
        new TextEncoder().encode(signingInput)
    );
    const b64sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

    const jwt = `${signingInput}.${b64sig}`;
    const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    });
    const data = await res.json();
    if (!data.access_token) throw new Error("خطا در احراز هویت گوگل");
    return data.access_token;
}

// ================================================================
// توابع پایه
// ================================================================
async function sheetsGet(range) {
    const token = await getAccessToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${APP_CONFIG.spreadsheet_id}/values/${encodeURIComponent(range)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    return data.values || [];
}

async function sheetsAppend(sheetName, rows) {
    const token = await getAccessToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${APP_CONFIG.spreadsheet_id}/values/${encodeURIComponent(sheetName)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
    await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: rows }),
    });
}

async function sheetsClear(sheetName) {
    const token = await getAccessToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${APP_CONFIG.spreadsheet_id}/values/${encodeURIComponent(sheetName)}:clear`;
    await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
}

async function sheetsWrite(sheetName, rows) {
    await sheetsClear(sheetName);
    if (rows.length > 0) await sheetsAppend(sheetName, rows);
}

// ================================================================
// ساخت شیت‌های اولیه
// ================================================================
async function initSheets() {
    const token = await getAccessToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${APP_CONFIG.spreadsheet_id}`;
    const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    const existing = data.sheets.map(s => s.properties.title);
    const needed = Object.values(SHEETS).filter(s => !existing.includes(s));
    if (needed.length === 0) return;
    await fetch(`${url}:batchUpdate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            requests: needed.map(title => ({ addSheet: { properties: { title } } }))
        }),
    });
}

// ================================================================
// بارگذاری از Sheets
// ================================================================
async function loadAllData() {
    await initSheets();
    const [empRows, logRows, activeRows, debtRows, archiveRows, salaryRows, configRows] = await Promise.all([
        sheetsGet(SHEETS.EMPLOYEES), sheetsGet(SHEETS.LOGS),
        sheetsGet(SHEETS.ACTIVE),   sheetsGet(SHEETS.DEBTS),
        sheetsGet(SHEETS.ARCHIVE),  sheetsGet(SHEETS.SALARIES),
        sheetsGet(SHEETS.CONFIG),
    ]);

    const employees = empRows.map(r => r[0]).filter(Boolean);

    const logs = logRows.map(r => ({
        id: r[0], date: r[1], time: r[2], name: r[3],
        minutes: parseInt(r[4]) || 0, shift: r[5], type: r[6]
    })).filter(r => r.name);

    const active = activeRows.map(r => ({
        id: r[0], date: r[1], name: r[2],
        amount: parseInt(r[3]) || 0, desc: r[4] || ""
    })).filter(r => r.name);

    const debts = debtRows.map(r => ({
        id: r[0], date: r[1], name: r[2],
        amount: parseInt(r[3]) || 0, desc: r[4] || ""
    })).filter(r => r.name);

    const archive = archiveRows.map(r => {
        try { return JSON.parse(r[0]); } catch { return null; }
    }).filter(Boolean);

    const salaries = {};
    salaryRows.forEach(r => { if (r[0] && r[1]) salaries[r[0]] = parseInt(r[1]) || 0; });

    const config = {};
    configRows.forEach(r => { if (r[0] && r[1]) config[r[0]] = r[1]; });

    return { employees, logs, active, debts, archive, salaries, config };
}

// ================================================================
// ذخیره در Sheets
// ================================================================
async function saveEmployees(employees) {
    await sheetsWrite(SHEETS.EMPLOYEES, employees.map(e => [e]));
}
async function saveLogs(logs) {
    await sheetsWrite(SHEETS.LOGS, logs.map(l =>
        [l.id||"", l.date||"", l.time||"", l.name||"", l.minutes||0, l.shift||"", l.type||""]
    ));
}
async function saveActive(active) {
    await sheetsWrite(SHEETS.ACTIVE, active.map(a =>
        [a.id||"", a.date||"", a.name||"", a.amount||0, a.desc||""]
    ));
}
async function saveDebts(debts) {
    await sheetsWrite(SHEETS.DEBTS, debts.map(d =>
        [d.id||"", d.date||"", d.name||"", d.amount||0, d.desc||""]
    ));
}
async function saveArchive(archive) {
    await sheetsWrite(SHEETS.ARCHIVE, archive.map(a => [JSON.stringify(a)]));
}
async function saveSalaries(salaries) {
    await sheetsWrite(SHEETS.SALARIES, Object.entries(salaries).map(([k, v]) => [k, v]));
}
async function saveConfig(config) {
    await sheetsWrite(SHEETS.CONFIG, Object.entries(config).map(([k, v]) => [k, String(v)]));
}
async function saveAll(state) {
    await Promise.all([
        saveEmployees(state.employees),
        saveLogs(state.logs),
        saveActive(state.active),
        saveDebts(state.debts),
        saveArchive(state.archive),
        saveSalaries(state.salaries),
        saveConfig(state.config),
    ]);
}

export {
    loadAllData, saveAll,
    saveEmployees, saveLogs, saveActive,
    saveDebts, saveArchive, saveSalaries, saveConfig,
};
