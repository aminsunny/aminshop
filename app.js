// ================================================================
// app.js — اپ موبایل ویپ شاپ امین
// ================================================================
import { loadAllData, addToPending, saveConfig, APPS_SCRIPT_URL } from "./sheets.js";

function APPS_SCRIPT_PENDING_URL(){
    return APPS_SCRIPT_URL + "?action=pending";
}

let STATE = {
    employees: [],
    logs: [],
    active: [],
    debts: [],
    archive: [],
    config: { entry_pass: btoa("1234") },
    loaded: false,
    offlineQueue: JSON.parse(localStorage.getItem("offlineQueue") || "[]"),
};

// ================================================================
// تاریخ شمسی
// ================================================================
function toJalali(date = new Date()) {
    let gy=date.getFullYear(),gm=date.getMonth()+1,gd=date.getDate();
    let g_d_no,jy,jd,j_np,jp,j_d_no;
    const g_days=[31,28,31,30,31,30,31,31,30,31,30,31];
    const j_days=[31,31,31,31,31,31,30,30,30,30,30,29];
    gy-=1600;gm-=1;gd-=1;
    g_d_no=365*gy+Math.floor((gy+3)/4)-Math.floor((gy+99)/100)+Math.floor((gy+399)/400);
    for(let i=0;i<gm;i++) g_d_no+=g_days[i];
    if(gm>1&&((gy%4===0&&gy%100!==0)||(gy%400===0))) g_d_no++;
    g_d_no+=gd;j_d_no=g_d_no-79;
    j_np=Math.floor(j_d_no/12053);j_d_no%=12053;
    jy=979+33*j_np+4*Math.floor(j_d_no/1461);j_d_no%=1461;
    if(j_d_no>=366){jy+=Math.floor((j_d_no-1)/365);j_d_no=(j_d_no-1)%365;}
    for(let i=0;i<11&&j_d_no>=j_days[i];i++){j_d_no-=j_days[i];jp=i+1;}
    jd=j_d_no+1;
    const jm=(jp===undefined?1:jp+1);
    return `${jy}/${String(jm).padStart(2,'0')}/${String(jd).padStart(2,'0')}`;
}
function nowTime(){const n=new Date();return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;}
function nowHour(){return new Date().getHours();}
function uid(){return "m"+crypto.randomUUID().replace(/-/g,"").slice(0,15);}
function formatNum(n){return parseInt(n||0).toLocaleString();}

// ================================================================
// صفحه ورود
// ================================================================
function showLogin(){
    document.getElementById("login-screen").style.display="flex";
    document.getElementById("app-content").style.display="none";
    document.getElementById("bottom-nav").style.display="none";
    document.getElementById("app-header").style.display="none";
    setTimeout(()=>document.getElementById("login-pass-input")?.focus(),300);
}
function hideLogin(){
    document.getElementById("login-screen").style.display="none";
    document.getElementById("app-content").style.display="block";
    document.getElementById("bottom-nav").style.display="flex";
    document.getElementById("app-header").style.display="flex";
}
function checkEntryPass(){
    const input=document.getElementById("login-pass-input");
    const val=input.value;
    if(!val) return;
    const stored=STATE.config.entry_pass||btoa("1234");
    if(btoa(val)===stored){
        hideLogin();input.value="";
        // بعد از ورود، صف آفلاین رو بفرست
        flushOfflineQueue();
    } else {
        input.value="";
        input.placeholder="رمز اشتباه است";
        input.style.borderColor="var(--red)";
        setTimeout(()=>{input.placeholder="رمز ورود را وارد کنید";input.style.borderColor="";},2000);
    }
}

// ================================================================
// بارگذاری
// ================================================================
async function init(){
    showLogin();
    showLoading(true);
    try {
        const data=await loadAllData();
        STATE.employees=data.employees||[];
        STATE.logs=data.logs||[];
        STATE.active=data.active||[];
        STATE.debts=data.debts||[];
        STATE.archive=data.archive||[];
        STATE.config={...STATE.config,...data.config};
        STATE.loaded=true;

        // فقط رکوردهای آفلاین که هنوز ارسال نشدن رو نشون بده
        const q = STATE.offlineQueue;
        if(q.length > 0){
            q.forEach(item=>{
                if(item.type==="logs") STATE.logs.push(item.record);
                if(item.type==="active") STATE.active.push(item.record);
            });
        }
    } catch(e){
        // آفلاین — فقط از offlineQueue نمایش بده
        STATE.logs   = STATE.offlineQueue.filter(i=>i.type==="logs").map(i=>i.record);
        STATE.active = STATE.offlineQueue.filter(i=>i.type==="active").map(i=>i.record);
        showToast("آفلاین — اطلاعات محلی نمایش داده می‌شود","error");
    }
    showLoading(false);
    updateEmpSelects();
    renderAttReport();
    renderFinance();
}

// ================================================================
// صف آفلاین
// ================================================================
function saveOfflineQueue(){
    localStorage.setItem("offlineQueue", JSON.stringify(STATE.offlineQueue));
}


async function sendRecord(type, record){
    try {
        await addToPending(type, record);
        // ارسال موفق — نیازی به offlineQueue نیست
        return { ok: true };
    } catch(e){
        if(e.isDuplicate){
            if(type === "logs") STATE.logs = STATE.logs.filter(l => l.id !== record.id);
            if(type === "active") STATE.active = STATE.active.filter(a => a.id !== record.id);
            renderAttReport();
            renderFinance();
            showErrorModal("ثبت تکراری", e.message);
            return { ok: false, duplicate: true };
        }
        // آفلاین — به صف اضافه کن
        STATE.offlineQueue.push({type, record});
        saveOfflineQueue();
        showToast("آفلاین — رکورد در صف ذخیره شد","error");
        return { ok: false, offline: true };
    }
}

async function flushOfflineQueue(){
    if(STATE.offlineQueue.length === 0) return;
    showToast(`⏳ ${STATE.offlineQueue.length} رکورد آفلاین در حال ارسال...`);
    const sent = [];
    const failed = [];
    for(const item of STATE.offlineQueue){
        try {
            await addToPending(item.type, item.record);
            sent.push(item);
        } catch(e) {
            failed.push(item);
        }
    }
    STATE.offlineQueue = failed;
    saveOfflineQueue();

    if(sent.length > 0){
        _showOfflineSentDialog(sent, failed.length);
    }
}

function _showOfflineSentDialog(sent, failedCount){
    // ساخت modal
    const overlay = document.createElement("div");
    overlay.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,.7);
        backdrop-filter:blur(4px);z-index:3000;
        display:flex;align-items:flex-end;justify-content:center;
    `;

    const modal = document.createElement("div");
    modal.style.cssText = `
        background:var(--surface);border-radius:20px 20px 0 0;
        padding:20px 20px 32px;width:100%;max-width:480px;
        max-height:80dvh;overflow-y:auto;
        animation:slideUp .3s ease;font-family:'Vazirmatn',sans-serif;
        direction:rtl;
    `;

    let rows = "";
    sent.forEach(item => {
        const r = item.record;
        if(item.type === "logs"){
            const badge = r.type?.includes("غیبت")
                ? `<span style="background:rgba(248,113,113,.2);color:#f87171;padding:2px 8px;border-radius:12px;font-size:11px">${r.type}</span>`
                : `<span style="background:rgba(52,211,153,.2);color:#34d399;padding:2px 8px;border-radius:12px;font-size:11px">حضور</span>`;
            rows += `<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;display:flex;justify-content:space-between;align-items:center">
                <span style="color:var(--muted)">${r.date} — ${r.name}</span>${badge}
            </div>`;
        } else if(item.type === "active"){
            rows += `<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;display:flex;justify-content:space-between;align-items:center">
                <span style="color:var(--muted)">${r.date} — ${r.name}</span>
                <span style="background:rgba(99,102,241,.2);color:#818cf8;padding:2px 8px;border-radius:12px;font-size:11px">${parseInt(r.amount||0).toLocaleString()} تومان</span>
            </div>`;
        }
    });

    modal.innerHTML = `
        <div style="width:40px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 16px"></div>
        <div style="font-size:16px;font-weight:700;margin-bottom:4px">📤 رکوردهای آفلاین ارسال شدند</div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:16px">
            ${sent.length} رکورد با موفقیت به سرور فرستاده شد
            ${failedCount > 0 ? `<span style="color:var(--red)"> | ${failedCount} رکورد ناموفق</span>` : ''}
        </div>
        <div style="margin-bottom:16px">${rows}</div>
        <button onclick="this.closest('div[style*=fixed]').remove()" style="
            width:100%;background:var(--accent);color:#fff;
            border:none;border-radius:10px;padding:14px;
            font-family:inherit;font-size:15px;font-weight:700;cursor:pointer
        ">✅ تأیید</button>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    overlay.addEventListener("click", e => { if(e.target===overlay) overlay.remove(); });
}

// ================================================================
// UI helpers
// ================================================================
function showLoading(show){document.getElementById("loading-overlay").style.display=show?"flex":"none";}

function showSuccessModal(title, message){
    const overlay = document.createElement("div");
    overlay.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,.7);
        backdrop-filter:blur(4px);z-index:3000;
        display:flex;align-items:center;justify-content:center;padding:20px;
    `;
    overlay.innerHTML = `
        <div style="background:var(--surface);border-radius:20px;padding:32px 24px;
             width:100%;max-width:340px;text-align:center;font-family:'Vazirmatn',sans-serif;direction:rtl">
            <div style="font-size:56px;margin-bottom:16px">✅</div>
            <div style="font-size:18px;font-weight:700;color:var(--green);margin-bottom:10px">${title}</div>
            <div style="font-size:14px;color:var(--muted);margin-bottom:24px;line-height:1.7">${message}</div>
            <button onclick="this.closest('div[style*=fixed]').remove()" style="
                width:100%;background:var(--accent);color:#fff;
                border:none;border-radius:12px;padding:14px;
                font-family:inherit;font-size:15px;font-weight:700;cursor:pointer
            ">✅ تأیید</button>
        </div>
    `;
    document.body.appendChild(overlay);
}

function showErrorModal(title, message){
    const overlay = document.createElement("div");
    overlay.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,.7);
        backdrop-filter:blur(4px);z-index:3000;
        display:flex;align-items:center;justify-content:center;padding:20px;
    `;
    overlay.innerHTML = `
        <div style="background:var(--surface);border-radius:20px;padding:32px 24px;
             width:100%;max-width:340px;text-align:center;font-family:'Vazirmatn',sans-serif;direction:rtl">
            <div style="font-size:56px;margin-bottom:16px">⚠️</div>
            <div style="font-size:18px;font-weight:700;color:var(--red);margin-bottom:10px">${title}</div>
            <div style="font-size:14px;color:var(--muted);margin-bottom:24px;line-height:1.7">${message}</div>
            <button onclick="this.closest('div[style*=fixed]').remove()" style="
                width:100%;background:rgba(248,113,113,.2);color:var(--red);
                border:1px solid rgba(248,113,113,.3);border-radius:12px;padding:14px;
                font-family:inherit;font-size:15px;font-weight:700;cursor:pointer
            ">باشه</button>
        </div>
    `;
    document.body.appendChild(overlay);
}
function showToast(msg,type="success"){
    const t=document.getElementById("toast");
    t.textContent=msg;t.className=`toast show ${type}`;
    setTimeout(()=>t.className="toast",3000);
}
function renderPage(page){
    document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
    document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));
    document.getElementById(`page-${page}`)?.classList.add("active");
    document.querySelector(`[data-page="${page}"]`)?.classList.add("active");
    if(page==="attendance") renderAttReport();
    if(page==="finance") renderFinance();
    if(page==="archive") renderArchiveMobile();
}
function updateEmpSelects(){
    const emps=STATE.employees;
    ["att-emp","att-emp-abs","fin-emp","att-filter","fin-filter"].forEach(id=>{
        const el=document.getElementById(id);
        if(!el) return;
        const prev=el.value;
        el.innerHTML=id.includes("filter")
            ?`<option value="همه">همه کارمندان</option>`+emps.map(e=>`<option>${e}</option>`).join("")
            :`<option value="">انتخاب کارمند...</option>`+emps.map(e=>`<option>${e}</option>`).join("");
        if(prev) el.value=prev;
    });
}

// ================================================================
// ثبت ورود
// ================================================================
let _isSubmitting = false;

async function registerAttendance(){
    if(_isSubmitting) return;
    const name=document.getElementById("att-emp").value;
    if(!name) return showToast("کارمند انتخاب کنید","error");
    const h=nowHour();
    let targetH,targetM,shift;
    if(h>=8&&h<14){
        targetH=parseInt(STATE.config.morning_start||"10");
        targetM=parseInt(STATE.config.morning_min||"0");
        shift="صبح";
    } else if(h>=15&&h<23){
        targetH=parseInt(STATE.config.afternoon_start||"17");
        targetM=parseInt(STATE.config.afternoon_min||"0");
        shift="عصر";
    } else {
        return showToast("خارج از ساعت کاری","error");
    }

    // جلوگیری از ثبت تکراری — همون کارمند، همون تاریخ، همون شیفت، نوع حضور
    const today = toJalali();
    const alreadyRegistered = STATE.logs.some(l =>
        l.name === name && l.date === today && l.shift === shift && l.type === "حضور"
    );
    if(alreadyRegistered){
        return showToast(`${name} امروز در شیفت ${shift} قبلاً ثبت ورود کرده`,"error");
    }

    _isSubmitting = true;
    showLoading(true);
    try {
        const now=new Date(),target=new Date();
        target.setHours(targetH,targetM,0,0);
        const diff=Math.floor((now-target)/60000);
        const log={id:uid(),date:toJalali(),time:nowTime(),name,minutes:diff,shift,type:"حضور"};
        STATE.logs.push(log);
        renderAttReport();
        const result = await sendRecord("logs", log);
        if(result.ok){
            const msg=diff>0?`تاخیر: ${diff} دقیقه`:diff<0?`${Math.abs(diff)} دقیقه زودتر`:"دقیقاً به موقع";
            showSuccessModal(`ورود ${name} ثبت شد`, `📅 ${toJalali()} | 🕒 ${nowTime()}<br/>⏱ ${msg}`);
        } else if(result.duplicate){
            // پیام تکراری از sendRecord نشون داده شده
        }
    } finally {
        _isSubmitting = false;
        showLoading(false);
    }
}

// ================================================================
// ثبت غیبت
// ================================================================
async function registerAbsence(){
    if(_isSubmitting) return;
    const name=document.getElementById("att-emp-abs").value;
    if(!name) return showToast("کارمند انتخاب کنید","error");
    const shift=document.querySelector('input[name="abs-shift"]:checked')?.value||"صبح";
    const desc=document.getElementById("abs-desc").value.trim();
    const log={id:uid(),date:toJalali(),time:"--:--",name,minutes:0,shift,type:`غیبت: ${desc}`};

    _isSubmitting = true;
    showLoading(true);
    try {
        STATE.logs.push(log);
        renderAttReport();
        document.getElementById("abs-desc").value="";
        const result = await sendRecord("logs", log);
        if(result.ok){
            showSuccessModal(`غیبت ${name} ثبت شد`, `📅 ${toJalali()} | شیفت ${shift}`);
        }
    } finally {
        _isSubmitting = false;
        showLoading(false);
    }
}

// ================================================================
// گزارش حضور
// ================================================================
function renderAttReport(){
    const filt=document.getElementById("att-filter")?.value||"همه";
    const from=document.getElementById("att-from")?.value?.replace(/\//g,"")||"";
    const to=document.getElementById("att-to")?.value?.replace(/\//g,"")||"";
    const tbody=document.getElementById("att-tbody");
    if(!tbody) return;
    let totalMins=0,absCount=0,rows="";
    [...STATE.logs].reverse().filter(l=>{
        const d=l.date.replace(/\//g,"");
        return(filt==="همه"||l.name===filt)&&(!from||d>=from)&&(!to||d<=to);
    }).forEach(l=>{
        if(l.type.includes("غیبت")) absCount++;
        else totalMins+=l.minutes;
        const badge=l.type.includes("غیبت")
            ?`<span class="badge red">${l.type}</span>`
            :l.minutes>0?`<span class="badge yellow">تاخیر ${l.minutes} دقیقه</span>`
            :`<span class="badge green">به موقع</span>`;
        rows+=`<tr><td>${l.date}</td><td>${l.name}</td><td>${l.shift}</td><td>${l.time}</td><td>${badge}</td></tr>`;
    });
    tbody.innerHTML=rows||`<tr><td colspan="5" class="empty">رکوردی یافت نشد</td></tr>`;
    document.getElementById("att-summary").textContent=`جمع تاخیر: ${totalMins} دقیقه | تعداد غیبت: ${absCount}`;
}

// ================================================================
// ثبت مساعده
// ================================================================
async function registerFinance(){
    if(_isSubmitting) return;
    const name=document.getElementById("fin-emp").value;
    const amount=getInputValue(document.getElementById("fin-amount"));
    const desc=document.getElementById("fin-desc").value.trim();
    if(!name) return showToast("کارمند انتخاب کنید","error");
    if(!amount) return showToast("مبلغ را وارد کنید","error");
    if(!confirm(`ثبت مساعده ${formatNum(amount)} تومان برای ${name}؟`)) return;

    _isSubmitting = true;
    showLoading(true);
    try {
        const rec={id:uid(),date:toJalali(),name,amount,desc};
        STATE.active.push(rec);
        document.getElementById("fin-amount").value="";
        document.getElementById("fin-desc").value="";
        renderFinance();
        const result = await sendRecord("active", rec);
        if(result.ok){
            showSuccessModal(`مساعده ${name} ثبت شد`, `📅 ${toJalali()}<br/>💰 ${formatNum(amount)} تومان`);
        }
    } finally {
        _isSubmitting = false;
        showLoading(false);
    }
}

function renderFinance(){
    const filt=document.getElementById("fin-filter")?.value||"همه";
    const tbody=document.getElementById("fin-tbody");
    const debtTbody=document.getElementById("fin-debt-tbody");
    if(!tbody) return;
    let total=0,totalDebt=0,rows="",debtRows="";

    // معکوس برای نمایش آخرین ورودی اول
    [...STATE.active].reverse().filter(a=>filt==="همه"||a.name===filt).forEach(a=>{
        total+=a.amount;
        rows+=`<tr><td>${a.date}</td><td>${a.name}</td><td>${formatNum(a.amount)}</td><td>${a.desc||"-"}</td></tr>`;
    });
    [...STATE.debts].reverse().filter(d=>filt==="همه"||d.name===filt).forEach(d=>{
        totalDebt+=d.amount;
        debtRows+=`<tr class="debt-row"><td>${d.date}</td><td>${d.name}</td><td>${formatNum(d.amount)}</td><td>${d.desc||"-"}</td></tr>`;
    });
    tbody.innerHTML=rows||`<tr><td colspan="4" class="empty">خالی</td></tr>`;
    if(debtTbody) debtTbody.innerHTML=debtRows||`<tr><td colspan="4" class="empty">بدهی انتقالی ندارد</td></tr>`;
    const summary=document.getElementById("fin-summary");
    if(summary) summary.innerHTML=`مساعده: <b>${formatNum(total)}</b> | بدهی: <b style="color:var(--red)">${formatNum(totalDebt)}</b> | جمع: <b style="color:var(--accent2)">${formatNum(total+totalDebt)}</b> تومان`;
}

function renderArchiveMobile(){
    const tbody=document.getElementById("arc-tbody");
    if(!tbody) return;
    let rows="";
    [...STATE.archive].reverse().forEach(r=>{
        const debt=r.debt_carried_out>0
            ?`<span style="color:var(--red)">${formatNum(r.debt_carried_out)}</span>`
            :`<span style="color:var(--green)">کامل</span>`;
        rows+=`<tr onclick="showArchiveDetailMobile('${r.id}')" style="cursor:pointer">
            <td>${r.settle_date}</td>
            <td>${r.name}</td>
            <td>${formatNum(r.total_amount)}</td>
            <td>${debt}</td>
        </tr>`;
    });
    tbody.innerHTML=rows||`<tr><td colspan="4" class="empty">بایگانی خالی است</td></tr>`;
}

function showArchiveDetailMobile(id){
    const rec=STATE.archive.find(r=>r.id===id);
    if(!rec) return;
    const overlay=document.createElement("div");
    overlay.style.cssText=`position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);z-index:3000;display:flex;align-items:flex-end;justify-content:center;`;
    let details="";
    (rec.details||[]).forEach((d,i)=>{
        details+=`<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;display:flex;justify-content:space-between">
            <span style="color:var(--muted)">${d.date} — ${d.desc||"-"}</span>
            <span>${formatNum(d.amount)} تومان</span>
        </div>`;
    });
    overlay.innerHTML=`
        <div style="background:var(--surface);border-radius:20px 20px 0 0;padding:20px 20px 32px;width:100%;max-width:480px;max-height:80dvh;overflow-y:auto;font-family:'Vazirmatn',sans-serif;direction:rtl">
            <div style="width:40px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 16px"></div>
            <div style="font-size:16px;font-weight:700;margin-bottom:12px">🗄 تسویه ${rec.name}</div>
            <div style="font-size:13px;color:var(--muted);margin-bottom:4px">📅 تاریخ تسویه: ${rec.settle_date}</div>
            <div style="font-size:13px;color:var(--muted);margin-bottom:4px">💵 حقوق: ${formatNum(rec.salary)} تومان</div>
            <div style="font-size:13px;color:var(--muted);margin-bottom:4px">💸 جمع برداشت: ${formatNum(rec.total_amount)} تومان</div>
            <div style="font-size:13px;margin-bottom:12px;${rec.debt_carried_out>0?'color:var(--red)':'color:var(--green)'}">
                ${rec.debt_carried_out>0?`⚠️ بدهی انتقالی: ${formatNum(rec.debt_carried_out)} تومان`:'✅ تسویه کامل'}
            </div>
            <hr style="border-color:var(--border);margin-bottom:12px"/>
            <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:8px">ریز تراکنش‌ها:</div>
            ${details}
            <button onclick="this.closest('div[style*=fixed]').remove()" style="width:100%;background:var(--accent);color:#fff;border:none;border-radius:12px;padding:14px;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;margin-top:16px">بستن</button>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener("click",e=>{if(e.target===overlay)overlay.remove();});
}

function formatInput(el){
    // تبدیل اعداد فارسی به انگلیسی
    let v = el.value
        .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
        .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
        .replace(/,/g, "")
        .replace(/[^0-9]/g, "");
    if(v){
        // نمایش با جداکننده سه‌رقمی فارسی
        el.value = parseInt(v).toLocaleString('fa-IR');
    }
}

function getInputValue(el){
    // تبدیل مقدار فیلد به عدد خالص برای محاسبه
    return parseInt(el.value
        .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
        .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
        .replace(/,/g, "")
        .replace(/،/g, "")
        .replace(/[^0-9]/g, "")
    ) || 0;
}

// ================================================================
// به‌روزرسانی از سرور
// ================================================================
async function refreshFromServer(){
    showLoading(true);
    try {
        const data = await loadAllData();
        STATE.employees = data.employees || [];
        STATE.logs      = data.logs      || [];
        STATE.active    = data.active    || [];
        STATE.debts     = data.debts     || [];
        STATE.config    = { ...STATE.config, ...data.config };

        // اضافه کردن رکوردهای آفلاین که هنوز ارسال نشدن
        STATE.offlineQueue.forEach(item=>{
            if(item.type==="logs") STATE.logs.push(item.record);
            if(item.type==="active") STATE.active.push(item.record);
        });

        updateEmpSelects();
        renderAttReport();
        renderFinance();
        showToast("✅ اطلاعات به‌روز شد");
    } catch(e){
        showToast("خطا در اتصال به سرور","error");
    }
    showLoading(false);
}

// ================================================================
// تغییر رمز ورود
// ================================================================
async function changeEntryPassword(){
    const newPass=prompt("رمز ورود جدید (حداقل ۴ کاراکتر):");
    if(!newPass||newPass.length<4) return showToast("رمز باید حداقل ۴ کاراکتر باشد","error");
    const confirm2=prompt("دوباره وارد کنید:");
    if(newPass!==confirm2) return showToast("رمزها یکسان نیستند","error");
    STATE.config.entry_pass=btoa(newPass);
    showLoading(true);
    await saveConfig(STATE.config);
    showLoading(false);
    showToast("رمز ورود تغییر یافت");
}

async function refreshFromSheets(){
    showLoading(true);
    try {
        const data=await loadAllData();
        STATE.employees=data.employees||[];
        STATE.logs=data.logs||[];
        STATE.active=data.active||[];
        STATE.debts=data.debts||[];
        STATE.archive=data.archive||[];
        STATE.config={...STATE.config,...data.config};

        updateEmpSelects();
        renderAttReport();
        renderFinance();
        renderArchiveMobile();
        showToast("✅ اطلاعات بروزرسانی شد");
    } catch(e){
        showToast("خطا در اتصال به سرور","error");
    }
    showLoading(false);
}
window.refreshFromSheets=refreshFromSheets;
function renderOfflineStatus(){
    const el=document.getElementById("offline-count");
    if(!el) return;
    const q=STATE.offlineQueue.length;
    el.textContent=q>0?`⚠️ ${q} رکورد در صف آفلاین`:"";
    el.style.color=q>0?"var(--yellow)":"";
}

// ================================================================
// Global exports
// ================================================================
window.renderPage=renderPage;
window.checkEntryPass=checkEntryPass;
window.registerAttendance=registerAttendance;
window.registerAbsence=registerAbsence;
window.renderAttReport=renderAttReport;
window.registerFinance=registerFinance;
window.renderFinance=renderFinance;
window.renderArchiveMobile=renderArchiveMobile;
window.showArchiveDetailMobile=showArchiveDetailMobile;
window.formatInput=formatInput;
window.changeEntryPassword=changeEntryPassword;
window.refreshFromServer=refreshFromServer;

init();
