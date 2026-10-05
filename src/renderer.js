const verEl = document.getElementById("ver");
const statusEl = document.getElementById("status");
const overlay = document.getElementById("force-update-overlay");
const forceMsg = document.getElementById("force-msg");
const forceVers = document.getElementById("force-vers");
const btn = document.getElementById("btn-update");
const progress = document.getElementById("progress");

let downloading = false;

async function init() {
  verEl.textContent = await window.electronAPI.getVersion();
  // فحص مبدئي (الـ main بيفحص تلقائيا برضه بعد 2.5 ثانية)
  await window.electronAPI.checkForUpdates();
}

window.electronAPI.onForceUpdate((info) => {
  forceMsg.textContent = info.message;
  forceVers.textContent = "نسختك: " + info.current + " — المطلوبة: " + info.required;
  overlay.classList.add("show");
  statusEl.textContent = "يوجد تحديث إجباري";
});

window.electronAPI.onUpdateMessage((m) => {
  statusEl.textContent = m.text;
  if (overlay.classList.contains("show")) progress.textContent = m.text;
});

window.electronAPI.onUpdateProgress((p) => {
  downloading = true;
  btn.disabled = true;
  progress.textContent = "جاري التحميل: " + p.percent + "%";
});

window.electronAPI.onUpdateDownloaded((info) => {
  progress.textContent = "اكتمل التحميل، جاري التثبيت...";
  window.electronAPI.installUpdate();
});

btn.addEventListener("click", async () => {
  if (downloading) return;
  btn.disabled = true;
  progress.textContent = "بدء التحميل...";
  try {
    await window.electronAPI.downloadUpdate();
  } catch (e) {
    progress.textContent = "فشل: " + e.message;
    btn.disabled = false;
    downloading = false;
  }
});

// منع إغلاق/تخطي الأوفرلاي: لا يوجد زر إغلاق عمدا
init();
