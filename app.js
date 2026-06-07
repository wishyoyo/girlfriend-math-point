const TYPES = [
  { id: "examples", name: "例題、演練", points: 1, books: ["lecture"] },
  { id: "quick", name: "小試身手", points: 2, books: ["lecture"] },
  { id: "literacy", name: "素養題", points: 3, books: ["lecture"] },
  { id: "assessment", name: "實力評量", points: 2, books: ["lecture"] },
  { id: "past", name: "歷屆試題", points: 2, books: ["lecture"] },
  { id: "workbook", name: "習作題目", points: 2, books: ["workbook"] }
];

const REWARDS = [
  { id: "drink", emoji: "🥤", name: "手搖杯", detail: "約 NT$50–80", points: 15 },
  { id: "tea", emoji: "🧋", name: "下午茶", detail: "甜點＋飲料", points: 25 },
  { id: "mcd", emoji: "🍟", name: "麥當勞套餐", detail: "大麥克等級", points: 35 }
];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const today = () => new Date().toLocaleDateString("en-CA");
const uid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;

class Store {
  constructor() {
    this.key = "love-math-points-v1";
    this.mode = "demo";
    this.user = { id: "demo-boyfriend", role: "boyfriend", name: "男友" };
    this.session = null;
    this.config = window.APP_CONFIG || {};
  }

  configured() {
    return Boolean(this.config.supabaseUrl && this.config.supabaseAnonKey);
  }

  headers(auth = true) {
    const headers = { apikey: this.config.supabaseAnonKey, "Content-Type": "application/json" };
    if (auth && this.session?.access_token) headers.Authorization = `Bearer ${this.session.access_token}`;
    return headers;
  }

  async signIn(email, password) {
    if (!this.configured()) throw new Error("尚未設定雲端服務，請先使用試玩模式。");
    const response = await fetch(`${this.config.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST", headers: this.headers(false), body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error_description || data.msg || "登入失敗");
    this.mode = "cloud";
    this.session = data;
    localStorage.setItem("love-math-session", JSON.stringify(data));
    await this.loadProfile();
  }

  async restore() {
    if (!this.configured()) return false;
    const saved = JSON.parse(localStorage.getItem("love-math-session") || "null");
    if (!saved?.access_token) return false;
    this.mode = "cloud";
    this.session = saved;
    try {
      await this.loadProfile();
      return true;
    } catch {
      localStorage.removeItem("love-math-session");
      return false;
    }
  }

  async loadProfile() {
    const response = await fetch(`${this.config.supabaseUrl}/rest/v1/profiles?id=eq.${this.session.user.id}&select=*`, { headers: this.headers() });
    const rows = await response.json();
    if (!response.ok || !rows[0]) throw new Error("找不到使用者設定");
    this.user = rows[0];
  }

  demo() {
    this.mode = "demo";
    const existing = this.localData();
    if (!existing.initialized) {
      existing.initialized = true;
      existing.records = [];
      existing.redemptions = [];
      this.saveLocal(existing);
    }
  }

  logout() {
    localStorage.removeItem("love-math-session");
    this.session = null;
  }

  localData() {
    return JSON.parse(localStorage.getItem(this.key) || '{"records":[],"redemptions":[]}');
  }

  saveLocal(data) {
    localStorage.setItem(this.key, JSON.stringify(data));
  }

  async getData() {
    if (this.mode === "demo") return this.localData();
    const [recordsRes, redemptionsRes] = await Promise.all([
      fetch(`${this.config.supabaseUrl}/rest/v1/study_records?select=*&order=created_at.desc`, { headers: this.headers() }),
      fetch(`${this.config.supabaseUrl}/rest/v1/redemptions?select=*&order=created_at.desc`, { headers: this.headers() })
    ]);
    if (!recordsRes.ok || !redemptionsRes.ok) throw new Error("同步資料失敗");
    return { records: await recordsRes.json(), redemptions: await redemptionsRes.json() };
  }

  async addRecord(record) {
    if (this.mode === "demo") {
      const data = this.localData();
      data.records.unshift(record);
      this.saveLocal(data);
      return;
    }
    const response = await fetch(`${this.config.supabaseUrl}/rest/v1/study_records`, {
      method: "POST", headers: { ...this.headers(), Prefer: "return=minimal" },
      body: JSON.stringify({ ...record, couple_code: this.user.couple_code, submitted_by: this.user.id })
    });
    if (!response.ok) throw new Error("送出紀錄失敗");
  }

  async approveRecord(id) {
    if (this.mode === "demo") {
      const data = this.localData();
      const item = data.records.find((r) => r.id === id);
      if (item) item.status = "approved";
      this.saveLocal(data);
      return;
    }
    const response = await fetch(`${this.config.supabaseUrl}/rest/v1/study_records?id=eq.${id}`, {
      method: "PATCH", headers: { ...this.headers(), Prefer: "return=minimal" },
      body: JSON.stringify({ status: "approved", approved_by: this.user.id, approved_at: new Date().toISOString() })
    });
    if (!response.ok) throw new Error("確認失敗");
  }

  async redeem(reward) {
    const item = { id: uid(), reward_id: reward.id, reward_name: reward.name, points: reward.points, redeemed_at: new Date().toISOString() };
    if (this.mode === "demo") {
      const data = this.localData();
      data.redemptions.unshift(item);
      this.saveLocal(data);
      return;
    }
    const response = await fetch(`${this.config.supabaseUrl}/rest/v1/redemptions`, {
      method: "POST", headers: { ...this.headers(), Prefer: "return=minimal" },
      body: JSON.stringify({ ...item, couple_code: this.user.couple_code, redeemed_by: this.user.id })
    });
    if (!response.ok) throw new Error("兌換失敗");
  }
}

const store = new Store();
let appData = { records: [], redemptions: [] };

function activeTypes() {
  const book = $("#bookType").value;
  return TYPES.filter((type) => type.books.includes(book));
}

function renderQuestionRows() {
  $("#questionRows").innerHTML = activeTypes().map((type) => `
    <div class="question-row" data-type="${type.id}" data-rate="${type.points}">
      <div class="type-name">${type.name}<small>每題 ${type.points} pt</small></div>
      <label>直接答對<input class="correct-input" type="number" min="0" value="0"></label>
      <label>訂正後對<input class="corrected-input" type="number" min="0" value="0"></label>
      <label>看了解答<input class="answer-input" type="number" min="0" value="0"></label>
      <div class="row-points">0 pt</div>
    </div>
  `).join("");
  $("#bonusBox").classList.toggle("hidden", $("#bookType").value === "workbook");
  $$("#questionRows input").forEach((input) => input.addEventListener("input", updatePreview));
  updatePreview();
}

function calculateRecord() {
  const items = {};
  let basePoints = 0;
  let correct = 0;
  let attempted = 0;
  $$(".question-row").forEach((row) => {
    const rate = Number(row.dataset.rate);
    const direct = Math.max(0, Number(row.querySelector(".correct-input").value) || 0);
    const corrected = Math.max(0, Number(row.querySelector(".corrected-input").value) || 0);
    const answer = Math.max(0, Number(row.querySelector(".answer-input").value) || 0);
    const points = direct * rate + corrected * rate * 0.5;
    items[row.dataset.type] = { direct, corrected, answer, points };
    basePoints += points;
    correct += direct;
    attempted += direct + corrected + answer;
    row.querySelector(".row-points").textContent = `${formatPoints(points)} pt`;
  });

  let bonus = 0;
  const complete = $("#bookType").value === "lecture" && $("#chapterComplete").checked;
  if (complete) bonus += 10;
  const past = items.past;
  const pastTotal = past ? past.direct + past.corrected + past.answer : 0;
  const pastBonus = pastTotal > 0 && past.direct / pastTotal >= 0.7;
  if (pastBonus) bonus += 5;
  return { items, basePoints, bonus, total: basePoints + bonus, correct, attempted, complete, pastBonus };
}

function updatePreview() {
  $("#previewPoints").textContent = formatPoints(calculateRecord().total);
}

function formatPoints(value) {
  return Number.isInteger(value) ? value : value.toFixed(1);
}

function getStats() {
  const approved = appData.records.filter((r) => r.status === "approved");
  const earned = approved.reduce((sum, r) => sum + Number(r.points), 0);
  const spent = appData.redemptions.reduce((sum, r) => sum + Number(r.points), 0);
  const correct = approved.reduce((sum, r) => sum + Number(r.correct_count || 0), 0);
  const attempted = approved.reduce((sum, r) => sum + Number(r.attempted_count || 0), 0);
  const chapters = new Set(approved.filter((r) => r.chapter_complete).map((r) => r.chapter_name)).size;
  return { earned, spent, current: earned - spent, correct, attempted, chapters };
}

function renderDashboard() {
  const stats = getStats();
  $("#currentPoints").textContent = formatPoints(stats.current);
  $("#earnedPoints").textContent = `${formatPoints(stats.earned)} pt`;
  $("#accuracy").textContent = stats.attempted ? `${Math.round(stats.correct / stats.attempted * 100)}%` : "--";
  $("#accuracyCount").textContent = stats.attempted ? `${stats.correct} / ${stats.attempted} 題直接答對` : "尚未作答";
  $("#chapterCount").textContent = `${stats.chapters} 章`;
  const next = REWARDS.find((r) => r.points > stats.current) || REWARDS[REWARDS.length - 1];
  const remaining = Math.max(0, next.points - stats.current);
  $("#nextRewardText").textContent = remaining ? `再 ${formatPoints(remaining)} pt 就能換「${next.name}」` : "今天也可以兌換一份獎勵 ♡";
  $("#rewardProgress").style.width = `${Math.min(100, stats.current / next.points * 100)}%`;
}

function renderApprovals() {
  const pending = appData.records.filter((r) => r.status === "pending");
  const canApprove = store.user.role === "boyfriend";
  $("#approvalSection").classList.toggle("hidden", !canApprove || !pending.length);
  $("#approvalList").innerHTML = pending.map((r) => `
    <article class="approval-card">
      <div><strong>${escapeHtml(r.chapter_name)}</strong><p>${r.study_date} · ${r.book_type === "workbook" ? "數學習作" : "數學講義"} · ${r.attempted_count} 題</p></div>
      <div class="approval-actions"><strong>+${formatPoints(Number(r.points))} pt</strong><button class="primary-btn approve-btn" data-id="${r.id}">確認入帳</button></div>
    </article>
  `).join("");
  $$(".approve-btn").forEach((button) => button.addEventListener("click", () => approve(button.dataset.id)));
}

function renderChapters() {
  const grouped = {};
  appData.records.filter((r) => r.status === "approved").forEach((r) => {
    grouped[r.chapter_name] ||= { points: 0, attempted: 0, correct: 0, complete: false, book: r.book_type };
    grouped[r.chapter_name].points += Number(r.points);
    grouped[r.chapter_name].attempted += Number(r.attempted_count || 0);
    grouped[r.chapter_name].correct += Number(r.correct_count || 0);
    grouped[r.chapter_name].complete ||= r.chapter_complete;
  });
  const entries = Object.entries(grouped);
  $("#chapterList").innerHTML = entries.length ? entries.map(([name, chapter]) => {
    const accuracy = chapter.attempted ? Math.round(chapter.correct / chapter.attempted * 100) : 0;
    return `<article class="chapter-card">
      <div class="chapter-top"><div><h3>${escapeHtml(name)}</h3><p>${chapter.book === "workbook" ? "數學習作" : "數學講義"}</p></div><span>${formatPoints(chapter.points)} pt</span></div>
      <p>直接答對率 ${accuracy}% · ${chapter.complete ? "整章完成 ♡" : "持續進行中"}</p>
      <div class="mini-track"><div style="width:${chapter.complete ? 100 : Math.min(90, Math.max(12, accuracy))}%"></div></div>
    </article>`;
  }).join("") : '<div class="paper-card empty-state">還沒有章節紀錄，第一步就從今天開始。</div>';
}

function renderRewards() {
  const { current } = getStats();
  $("#rewardList").innerHTML = REWARDS.map((reward) => `
    <article class="reward-card">
      <div class="reward-emoji">${reward.emoji}</div>
      <h3>${reward.name}</h3><p>${reward.detail}</p>
      <strong class="reward-price">${reward.points} pt</strong>
      <button class="primary-btn reward-btn" data-id="${reward.id}" ${current < reward.points ? "disabled" : ""}>
        ${current < reward.points ? `還差 ${formatPoints(reward.points - current)} pt` : "兌換這個獎勵"}
      </button>
    </article>
  `).join("");
  $$(".reward-btn").forEach((button) => button.addEventListener("click", () => requestRedeem(button.dataset.id)));
}

function renderHistory() {
  const records = appData.records.map((r) => ({
    date: r.study_date, description: `${r.book_type === "workbook" ? "習作" : "講義"} · ${r.chapter_name}`,
    status: r.status, statusText: r.status === "approved" ? "已入帳" : "待確認", points: `+${formatPoints(Number(r.points))}`
  }));
  const redemptions = appData.redemptions.map((r) => ({
    date: (r.redeemed_at || r.created_at).slice(0, 10), description: `兌換 · ${r.reward_name}`,
    status: "approved", statusText: "已兌換", points: `-${formatPoints(Number(r.points))}`
  }));
  const rows = [...records, ...redemptions].sort((a, b) => b.date.localeCompare(a.date));
  $("#historyBody").innerHTML = rows.length ? rows.map((r) => `
    <tr><td>${r.date}</td><td>${escapeHtml(r.description)}</td><td><span class="status ${r.status}">${r.statusText}</span></td><td>${r.points} pt</td></tr>
  `).join("") : '<tr><td colspan="4" class="empty-state">目前還沒有紀錄。</td></tr>';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

async function refresh() {
  try {
    appData = await store.getData();
    renderDashboard();
    renderApprovals();
    renderChapters();
    renderRewards();
    renderHistory();
  } catch (error) {
    toast(error.message);
  }
}

async function approve(id) {
  try {
    await store.approveRecord(id);
    await refresh();
    toast("已確認，點數正式入帳 ♡");
  } catch (error) {
    toast(error.message);
  }
}

function requestRedeem(id) {
  const reward = REWARDS.find((item) => item.id === id);
  $("#dialogTitle").textContent = `兌換「${reward.name}」？`;
  $("#dialogText").textContent = `將扣除 ${reward.points} pt，兌換日期與紀錄會保留下來。`;
  $("#dialogConfirm").dataset.reward = id;
  $("#confirmDialog").showModal();
}

async function redeemConfirmed() {
  const reward = REWARDS.find((item) => item.id === $("#dialogConfirm").dataset.reward);
  if (!reward || getStats().current < reward.points) return;
  try {
    await store.redeem(reward);
    await refresh();
    toast(`成功兌換 ${reward.name}，好好享受！`);
  } catch (error) {
    toast(error.message);
  }
}

function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("show"), 2600);
}

function enterApp() {
  $("#loginView").classList.add("hidden");
  $("#appView").classList.remove("hidden");
  $("#roleBadge").textContent = store.mode === "demo" ? "試玩模式 · 你是確認者" : `${store.user.name || "使用者"} · ${store.user.role === "boyfriend" ? "確認者" : "學習者"}`;
  $("#recordDate").value = today();
  renderQuestionRows();
  refresh();
}

$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#loginMessage").textContent = "登入中…";
  try {
    await store.signIn($("#email").value, $("#password").value);
    enterApp();
  } catch (error) {
    $("#loginMessage").textContent = error.message;
  }
});

$("#demoBtn").addEventListener("click", () => {
  store.demo();
  enterApp();
});

$("#logoutBtn").addEventListener("click", () => {
  store.logout();
  location.reload();
});

$("#bookType").addEventListener("change", renderQuestionRows);
$("#chapterComplete").addEventListener("change", updatePreview);

$("#recordForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const calculation = calculateRecord();
  if (!calculation.attempted) return toast("請至少記錄一題喔");
  const record = {
    id: uid(),
    study_date: $("#recordDate").value,
    book_type: $("#bookType").value,
    chapter_name: $("#chapterName").value.trim(),
    items: calculation.items,
    points: calculation.total,
    correct_count: calculation.correct,
    attempted_count: calculation.attempted,
    chapter_complete: calculation.complete,
    past_bonus: calculation.pastBonus,
    status: "pending",
    created_at: new Date().toISOString()
  };
  try {
    await store.addRecord(record);
    event.target.reset();
    $("#recordDate").value = today();
    renderQuestionRows();
    await refresh();
    toast("已送出，等男友確認後就會入帳 ♡");
  } catch (error) {
    toast(error.message);
  }
});

$$(".tab").forEach((button) => button.addEventListener("click", () => {
  $$(".tab").forEach((tab) => tab.classList.toggle("active", tab === button));
  $$(".panel").forEach((panel) => panel.classList.toggle("active", panel.id === `${button.dataset.tab}Panel`));
}));

$("#confirmDialog").addEventListener("close", () => {
  if ($("#confirmDialog").returnValue === "confirm") redeemConfirmed();
});

store.restore().then((restored) => {
  if (restored) enterApp();
});
