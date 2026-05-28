// ================================================================
// sheets.js — ارتباط با Google Sheets API
// ================================================================
// قبل از استفاده، این دو مقدار را از فایل JSON و شیت خود پر کن:

const SHEETS_CONFIG = {
    // از فایل JSON که دانلود کردی:
    client_email: "amin-manager@aminshop-497507.iam.gserviceaccount.com",
    private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDIeGP0VpwJ2pEB\n6wkj6C+xYYQZR4ee1Z5TC0KiLZoAxps9oCZdPN0TxqWEbhUHNoblrivJAZwSZtKA\nT7RBAljdN3vt2Ln4MWbEQATmJ3E89Udd8cJPEc8layEiyltgxLZDM2bjVlDO0yHX\nm7+y6GqXsjHpJIdYJPwci8q6Kod2AFTBY/armNPhI0ggWJmsqDVrEBr9l9TtCwt2\n9KH0rKiaVb3S4gN/QGe/+NKKxIZ+ipe3vNoqyJRWfnlUP2rAwmdEsjodiON8G+4C\nTfEjyeZUyCiRzUNwTKB46lGOjPVRI7qkipEjowu36djguLf+O3DtP3P9MaScVq25\noRr1/CP5AgMBAAECggEABalGs1f9zJZwSWRUi//K1wDIvPkE5rKkJ7a18UQF6Rcy\nu50J8FCfcqdFtdVxARTkXtiaEnFZ8bgXIjn9/mb9UPP36znXWJ+2hfzD1qcO/thz\nZT8GTHrVhXo+w4+A4Jz1g7TQJ0PhANI8Dq1ujrQbDIEjATE/pDjZKMo21aaNUEL5\nw1iOQ8SK8efVJK8lDYTTVb2FjSSujiJO2cjvU1uDALHwqkQRSuR2U2yn9cd2J/6v\neFvR166bHgRRtFJ45BIV9vIbVLsicwZK7dm26M/CEBgh+wMeLH40Ym1Bi0gtisJx\n93+Hp12khs6zjev61HcOfnuuYwxGl0s9mCZwHbaXQQKBgQD8M+T5cG/qzyNF2gUr\neMetPzpwVuKQuPL0t8dVEB09rKtBoV9w7hxwtb/N8CwFz74Vsdfwq+1Z+UUkJHxE\nhL6ptY0gkMzaQ9NgmvrhHJLx4lceSSBlMCc3TONMIPQ2p7aFS2FyNxj7NW+VPpbP\ngkP6A7YVA2Go/h7Re0M3PPcwWQKBgQDLfRhoa7P2zlJxNPYQkgWxEik9+elIYO3v\n7z0xMBtQwcGsZ6GMc6SBYL7uEPnSQ7Cs5Zclql2ounZEiKUADTIbruFImg2EekOl\n+HlOr0DLCjklyjwtzh3AOkouQzRqkg1I/3WF2abijxpAx9rp+pTzOVMHP29qKZnp\nZjvTT4UcoQKBgEWxGW8McQDT6I1e59rRb2wicsWkXMtdMFYLituorkvisRhbvYH5\naoaC0tPXsHKSq5ZXJLLu75HTXhXUtzo/7Gf9MVh0awdNgtXJPdaDDOAmiahm0Lrl\niZCwgIcC/Dk2Myu2XuEu9IpGg+Ub/JSvDJXD/MblvlDymBWPGE3lXPFRAoGAOntK\nT4BcqVrkoLp62YpN7nTsu24emHmbCHD2YjOUNiJpWfYynJ4DslcuqFbipYZkuVwG\nk4GiB0MHiGzJFvmz4/bfsjDsH53P4VxG6NE/Sts2T2EO6I8rR7q45RDVeKdfABLD\nIOPLraM5BVMq3EHzGu/np9aYW6d3H3gNS464D+ECgYBfJe93kNGGO3L5LmGCEPPp\nYvWn1XmrwfY/5QCCTMNiLBCGyURV/fzxvTQAWa8rlSGv3xrHk91HkDIsFRUcu5cg\njBRRoFJvBDugdBJj81OZ7iJqgjXM/igyUccJx6NbvFqvBxwdJSk0yhM09C1gg7QJ\nntI+28x8sKGsS38tV5y2qQ==\n-----END PRIVATE KEY-----\n",

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
