// ================================================================
// app.js — اپ موبایل ویپ شاپ امین
// ================================================================
import { loadAllData, addToPending, saveConfig } from "./sheets.js";

let STATE = {
    employees: [],
    logs: [],
    active: [],
    debts: [],
    config: { entry_pass: btoa("1234") },
    loaded: false,
    // صف آفلاین
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
        STATE.config={...STATE.config,...data.config};
        STATE.loaded=true;
    } catch(e){
        showToast("آفلاین — از حافظه محلی استفاده می‌شود","error");
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

async function flushOfflineQueue(){
    if(STATE.offlineQueue.length === 0) return;
    showToast(`⏳ ${STATE.offlineQueue.length} رکورد آفلاین در حال ارسال...`);
    const failed = [];
    for(const item of STATE.offlineQueue){
        try {
            await addToPending(item.type, item.record);
        } catch(e) {
            failed.push(item);
        }
    }
    STATE.offlineQueue = failed;
    saveOfflineQueue();
    if(failed.length === 0){
        showToast("✅ همه رکوردهای آفلاین ارسال شدند");
    } else {
        showToast(`⚠️ ${failed.length} رکورد هنوز ارسال نشد`,"error");
    }
}

async function sendRecord(type, record){
    try {
        await addToPending(type, record);
    } catch(e){
        // آفلاین — به صف اضافه کن
        STATE.offlineQueue.push({type, record});
        saveOfflineQueue();
        showToast("آفلاین — رکورد در صف ذخیره شد","error");
    }
}

// ================================================================
// UI helpers
// ================================================================
function showLoading(show){document.getElementById("loading-overlay").style.display=show?"flex":"none";}
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
async function registerAttendance(){
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
    const now=new Date(),target=new Date();
    target.setHours(targetH,targetM,0,0);
    const diff=Math.floor((now-target)/60000);
    const log={id:uid(),date:toJalali(),time:nowTime(),name,minutes:diff,shift,type:"حضور"};
    STATE.logs.push(log);
    renderAttReport();
    await sendRecord("logs", log);
    const msg=diff>0?`تاخیر: ${diff} دقیقه`:diff<0?`${Math.abs(diff)} دقیقه زودتر`:"دقیقاً به موقع";
    showToast(`ورود ${name} ثبت شد — ${msg}`);
}

// ================================================================
// ثبت غیبت
// ================================================================
async function registerAbsence(){
    const name=document.getElementById("att-emp-abs").value;
    if(!name) return showToast("کارمند انتخاب کنید","error");
    const shift=document.querySelector('input[name="abs-shift"]:checked')?.value||"صبح";
    const desc=document.getElementById("abs-desc").value.trim();
    const log={id:uid(),date:toJalali(),time:"--:--",name,minutes:0,shift,type:`غیبت: ${desc}`};
    STATE.logs.push(log);
    renderAttReport();
    document.getElementById("abs-desc").value="";
    await sendRecord("logs", log);
    showToast(`غیبت ${name} ثبت شد`);
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
    const name=document.getElementById("fin-emp").value;
    const amount=parseInt(document.getElementById("fin-amount").value.replace(/,/g,""))||0;
    const desc=document.getElementById("fin-desc").value.trim();
    if(!name) return showToast("کارمند انتخاب کنید","error");
    if(!amount) return showToast("مبلغ را وارد کنید","error");
    if(!confirm(`ثبت مساعده ${formatNum(amount)} تومان برای ${name}؟`)) return;
    const rec={id:uid(),date:toJalali(),name,amount,desc};
    STATE.active.push(rec);
    document.getElementById("fin-amount").value="";
    document.getElementById("fin-desc").value="";
    renderFinance();
    await sendRecord("active", rec);
    showToast(`مساعده ${name} ثبت شد`);
}

function renderFinance(){
    const filt=document.getElementById("fin-filter")?.value||"همه";
    const tbody=document.getElementById("fin-tbody");
    const debtTbody=document.getElementById("fin-debt-tbody");
    if(!tbody) return;
    let total=0,totalDebt=0,rows="",debtRows="";
    STATE.active.filter(a=>filt==="همه"||a.name===filt).forEach(a=>{
        total+=a.amount;
        rows+=`<tr><td>${a.date}</td><td>${a.name}</td><td>${formatNum(a.amount)}</td><td>${a.desc||"-"}</td></tr>`;
    });
    STATE.debts.filter(d=>filt==="همه"||d.name===filt).forEach(d=>{
        totalDebt+=d.amount;
        debtRows+=`<tr class="debt-row"><td>${d.date}</td><td>${d.name}</td><td>${formatNum(d.amount)}</td><td>${d.desc||"-"}</td></tr>`;
    });
    tbody.innerHTML=rows||`<tr><td colspan="4" class="empty">خالی</td></tr>`;
    if(debtTbody) debtTbody.innerHTML=debtRows||`<tr><td colspan="4" class="empty">بدهی انتقالی ندارد</td></tr>`;
    const summary=document.getElementById("fin-summary");
    if(summary) summary.innerHTML=`مساعده: <b>${formatNum(total)}</b> | بدهی: <b style="color:var(--red)">${formatNum(totalDebt)}</b> | جمع: <b style="color:var(--accent2)">${formatNum(total+totalDebt)}</b> تومان`;
}

function formatInput(el){
    const v=el.value.replace(/,/g,"");
    if(/^\d+$/.test(v)) el.value=parseInt(v).toLocaleString();
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

// ================================================================
// نمایش وضعیت صف آفلاین
// ================================================================
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
window.formatInput=formatInput;
window.changeEntryPassword=changeEntryPassword;

init();
