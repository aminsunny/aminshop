// ================================================================
// sheets.js — ارتباط با Google Sheets API
// ================================================================
// قبل از استفاده، این دو مقدار را از فایل JSON و شیت خود پر کن:

const SHEETS_CONFIG = {
    // از فایل JSON که دانلود کردی:
    client_email: "aminshop-bot@aminshop-497507.iam.gserviceaccount.com",
    private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDOlXkVYv7FRLYp\n9baCK0o0KSkAeNOuA5ZPFBwNU/tUrFn3mo1Q+JHiDOPmeTBDXnpLd9kToYbuqN6i\nDeXL/Y9g6htmCf5ABsux+OYzEWB6SWVVrRDVlYFVeUNPGMmXo1peGZm946bCteOL\n30m2B7h8q1/woDdciViuYttXte/xs8IGqTPGvfP8R3fz8cpwMMTxtm0RgXfaCFhZ\nyPC5tIrGJSzmLCmHudDUN34Sy6zJ21ziS+7x6v1zFBmi9ltr3LwkQfPqOOSHbYCe\n6/2DMUhMCrxWrGA8eGDCLXnlYlKEKuJIzcMVDOIBtCff8firPHA3FMMyXvxxREHL\nEMkb4xhpAgMBAAECggEADSNkd/+7xEACddiyqsSmC3syqF0G2WJRBOZ6gj59FX2A\nm0axBh1I6d93/whmEWLI1FPi8mSreDI1Nok7vCV8IOXCqFKqYNgNzFvQCB9qy1wv\nnatMDslbWFxF85nX+FTjQmjOZk08JdX7isHAplsHWKZti5gk7TWu9ihDWuivQefX\ncHVYEMPX/UhceJAA+jCPXbVaSZ2gA2SS27Ux9sx6la9721B5ismD6HvPKkhTvVcn\nPASmNScZ4uI8EqDwn5hcoURXk2ZG1t3Nh+rxnRMix9XWRkk2SnYW1T8gBUaa0YB9\nRQEbw+fGxu9uzpWV7kfwUAC479Yuzcwj8UalFSFrIQKBgQD4bmJqlLE73C5ZuJlN\nLurOzWL5NZ6a+WydiWH8AUdZpjduNoSt0yS946rBQm7lBoPUXZUGH8NZiM4AOLMb\nJMivJSr2BUnnzzlrLyXstfhjC+jhNIkd8Tclot9HooVR71nol1d70hjjA08/P612\nlome9Vot/pORhJl/GuQIwXXqkwKBgQDU4LRT4D5M8GoV0mkZ3W6mJ/eRZ3BGdTWi\nOoiC+GY6U+LXFRmsJmQEkT4kHgdnmWX+QC0w8Mjdxia3Vc8W+GZXF5kmsXjsME1d\nUMnnCOB1h1eH1v2iYB1ILyeL6QdA8XsP9V6lS5SBxn0fx8xWmnrjcNYKmosh9VSq\nR1sKUS7CkwKBgCxPO9x4otfjYJz+ENG0YYr7FQEP8DcB7751Z3WUIM67l71fmfCK\n7U21Epqfp7nPnKm++zp5ZdVNUji15DQeLnEWtv/kV5cx3bLhWOlMV34K/MFWJnKh\nuE1NLHfRY+gGQcn7XE4oXen3iCXmzKCPHwKsDiaP9nAI73u9JxjssIRjAoGAAyGb\nBXDS+ca/iLqjmSHMstz7o0PmPuMSeuRphaOpvUnmmEtTKVkXN4n7ZASdD0UOXwMK\npyGjkr+Laj704N2eg8FxG0SZBsBfIvRBRAi5ZIEtJG5hJLZNN/aZmlE/LhFfQgjV\n75CBCrekt4b01oFHNXk/bMCBM2qsaCTMjgZLrckCgYBmx+N5Q5Jn6duNii38iQPc\nwuFi5RVmwuo8cstXQeQeAZ03R76dtcyLHbkbF0o4b2N80nD2mETvvqRksNJz8as9\nVD3OpWT7tR1Ke3Egsk8y7sPu6Nwb6STiwuq+7M/2X/yndRFtEX4HjJrGV4ezjLKY\nWLdcd3qkWyvt/73MqG1s3g==\n-----END PRIVATE KEY-----\n",

    // ID شیت گوگل (از آدرس مرورگر):
    spreadsheet_id: "1bLANucgiYAlQWfzwoKys5Cq9PDBYXqjuZfHK0FyoBwU",
};

// نام شیت‌ها
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
        iss: SHEETS_CONFIG.client_email,
        scope: "https://www.googleapis.com/auth/spreadsheets",
        aud: "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now,
    };

    const b64 = (obj) => btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

    const signingInput = `${b64(header)}.${b64(payload)}`;
    const keyData = SHEETS_CONFIG.private_key
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
// توابع پایه Sheets API
// ================================================================
async function sheetsGet(range) {
    const token = await getAccessToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_CONFIG.spreadsheet_id}/values/${encodeURIComponent(range)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    return data.values || [];
}

async function sheetsAppend(sheetName, rows) {
    const token = await getAccessToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_CONFIG.spreadsheet_id}/values/${encodeURIComponent(sheetName)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
    await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: rows }),
    });
}

async function sheetsClear(sheetName) {
    const token = await getAccessToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_CONFIG.spreadsheet_id}/values/${encodeURIComponent(sheetName)}:clear`;
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
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_CONFIG.spreadsheet_id}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    const existing = data.sheets.map(s => s.properties.title);

    const needed = Object.values(SHEETS).filter(s => !existing.includes(s));
    if (needed.length === 0) return;

    const addUrl = `${url}:batchUpdate`;
    await fetch(addUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            requests: needed.map(title => ({
                addSheet: { properties: { title } }
            }))
        }),
    });
}

// ================================================================
// توابع بارگذاری داده‌ها از Sheets
// ================================================================
async function loadAllData() {
    await initSheets();

    const [empRows, logRows, activeRows, debtRows, archiveRows, salaryRows, configRows] = await Promise.all([
        sheetsGet(SHEETS.EMPLOYEES),
        sheetsGet(SHEETS.LOGS),
        sheetsGet(SHEETS.ACTIVE),
        sheetsGet(SHEETS.DEBTS),
        sheetsGet(SHEETS.ARCHIVE),
        sheetsGet(SHEETS.SALARIES),
        sheetsGet(SHEETS.CONFIG),
    ]);

    const employees = empRows.map(r => r[0]).filter(Boolean);

    const logs = logRows.map(r => ({
        id: r[0], date: r[1], time: r[2], name: r[3],
        minutes: parseInt(r[4]) || 0, shift: r[5], type: r[6]
    }));

    const active = activeRows.map(r => ({
        id: r[0], date: r[1], name: r[2], amount: parseInt(r[3]) || 0, desc: r[4]
    }));

    const debts = debtRows.map(r => ({
        id: r[0], date: r[1], name: r[2], amount: parseInt(r[3]) || 0, desc: r[4]
    }));

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
// توابع ذخیره داده‌ها در Sheets
// ================================================================
async function saveEmployees(employees) {
    await sheetsWrite(SHEETS.EMPLOYEES, employees.map(e => [e]));
}

async function saveLogs(logs) {
    await sheetsWrite(SHEETS.LOGS, logs.map(l =>
        [l.id, l.date, l.time, l.name, l.minutes, l.shift, l.type]
    ));
}

async function saveActive(active) {
    await sheetsWrite(SHEETS.ACTIVE, active.map(a =>
        [a.id, a.date, a.name, a.amount, a.desc]
    ));
}

async function saveDebts(debts) {
    await sheetsWrite(SHEETS.DEBTS, debts.map(d =>
        [d.id, d.date, d.name, d.amount, d.desc]
    ));
}

async function saveArchive(archive) {
    await sheetsWrite(SHEETS.ARCHIVE, archive.map(a => [JSON.stringify(a)]));
}

async function saveSalaries(salaries) {
    await sheetsWrite(SHEETS.SALARIES, Object.entries(salaries).map(([k, v]) => [k, v]));
}

async function saveConfig(config) {
    await sheetsWrite(SHEETS.CONFIG, Object.entries(config).map(([k, v]) => [k, v]));
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
    SHEETS_CONFIG
};
