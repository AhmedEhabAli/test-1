const { app, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");

let mainWindow = null;
let forcedInfo = null;
let controlUrl = "";
let pkg = {};
const githubToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";

try {
  // eslint-disable-next-line import/no-dynamic-require
  pkg = require("../package.json");
  controlUrl = pkg.updateControlUrl || "";
} catch {
  controlUrl = "";
}

function isNewer(local, remote) {
  const p = (v) => String(v).split(".").map((n) => parseInt(n, 10) || 0);
  const [a1 = 0, b1 = 0, c1 = 0] = p(local);
  const [a2 = 0, b2 = 0, c2 = 0] = p(remote);
  if (a2 !== a1) return a2 > a1;
  if (b2 !== b1) return b2 > b1;
  return c2 > c1;
}

async function fetchControl() {
  if (!controlUrl) return null;
  // cache-busting عشان GitHub raw بيتكاش
  const url = controlUrl + (controlUrl.includes("?") ? "&" : "?") + "t=" + Date.now();
  // لو ريبو التحديثات public مش محتاج هيدر، التوكن للطوارئ فقط (برايفت)
  const headers = githubToken ? { Authorization: "Bearer " + githubToken } : {};
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error("control http " + res.status);
  return res.json();
}

function send(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function setupUpdater(win) {
  mainWindow = win;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // ريبو التحديثات public: لا حاجة لتوكن عند اليوزر (app-update.yml المدمج يكفي)
  // لو حولته لبرايفت لاحقا: حط private:true في build.publish وساعتها اليوزر هيحتاج GH_TOKEN
  const pub = pkg.build && pkg.build.publish;
  if (githubToken && pub && pub.private) {
    try {
      autoUpdater.setFeedURL({
        provider: "github",
        owner: pub.owner,
        repo: pub.repo,
        private: true,
        token: githubToken,
      });
    } catch {}
  }

  autoUpdater.on("update-available", (info) => {
    // لو التحديث إجباري حمّل تلقائيا، غير كده استنى إذنك (الإذن = ملف الكنترول)
    if (forcedInfo) {
      send("update-message", { text: "جاري تحميل التحديث الإجباري " + (info.version || "") + "..." });
      autoUpdater.downloadUpdate().catch((e) => {
        send("update-message", { text: "فشل التحميل: " + e.message });
      });
    }
  });

  autoUpdater.on("download-progress", (p) => {
    send("update-progress", { percent: Math.round(p.percent || 0) });
  });

  autoUpdater.on("update-downloaded", (info) => {
    send("update-downloaded", { version: info.version });
  });

  autoUpdater.on("error", (e) => {
    send("update-message", { text: "خطأ في التحديث: " + (e && e.message ? e.message : e) });
  });

  ipcMain.handle("app:get-version", () => app.getVersion());
  ipcMain.handle("updater:check", () => checkForForcedUpdate());
  ipcMain.handle("updater:download", async () => {
    await autoUpdater.downloadUpdate();
    return true;
  });
  ipcMain.handle("updater:install", () => {
    autoUpdater.quitAndInstall(false, true);
    return true;
  });

  // فحص بعد فتح الواجهة بشوية عشان الـ UI يكون جاهز
  setTimeout(() => checkForForcedUpdate().catch(() => {}), 2500);
}

async function checkForForcedUpdate() {
  const current = app.getVersion();
  let control = null;
  try {
    control = await fetchControl();
  } catch {
    // مفيش نت أو الرابط غلط -> شغّل التطبيق عادي
    return { forced: false, current, reason: "no-control" };
  }
  if (!control || !control.forceUpdate) {
    return { forced: false, current, reason: "not-forced" };
  }

  const min = String(control.minimumRequiredVersion || "0.0.0");
  if (!isNewer(current, min)) {
    return { forced: false, current, reason: "up-to-date" };
  }

  // إجباري: ابلوك الواجهة
  forcedInfo = {
    current,
    required: min,
    message: control.messageAr || "نزل تحديث مهم، لازم تحدث عشان تكمل استخدام التطبيق.",
  };
  send("force-update-required", forcedInfo);

  // ابدأ فحص electron-updater (يجيب الملفات من GitHub Releases)
  if (app.isPackaged) {
    try {
      await autoUpdater.checkForUpdates();
    } catch (e) {
      send("update-message", { text: "مش قادر أوصل لسيرفر التحديث: " + e.message });
    }
  } else {
    send("update-message", { text: "وضع التطوير: التحديث التلقائي يعمل فقط في النسخة المبنية (dist)." });
  }
  return { forced: true, ...forcedInfo };
}

module.exports = { setupUpdater, checkForForcedUpdate };
