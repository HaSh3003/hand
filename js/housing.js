const STORAGE_KEY = "hand-housing-wallet-v1";
const CATEGORY_KEY = "hand-housing-categories-v1";
const defaultCategories = [
  { name: "اشتراك السكن", type: "income", amount: 1580, amountMode: "fixed" },
  { name: "إيجار السكن", type: "expense", amount: 6000, amountMode: "fixed" },
  { name: "فاتورة الكهرباء", type: "expense", amount: 1350, amountMode: "flexible" },
  { name: "فاتورة المياه", type: "expense", amount: 420, amountMode: "flexible" },
  { name: "اشتراك الإنترنت", type: "expense", amount: 630, amountMode: "fixed" }
];
const seedTransactions = [
  { id: 1, type: "income", party: "محمد علي", amount: 1580, category: "اشتراك السكن", note: "حصة شهر سبتمبر", date: "2026-09-01" },
  { id: 2, type: "income", party: "عمر خالد", amount: 1580, category: "اشتراك السكن", note: "حصة شهر سبتمبر", date: "2026-09-01" },
  { id: 3, type: "income", party: "يوسف أحمد", amount: 1580, category: "اشتراك السكن", note: "حصة شهر سبتمبر", date: "2026-09-02" },
  { id: 4, type: "expense", party: "فاتورة الغاز", amount: 120, category: "غاز", note: "فاتورة سبتمبر", date: "2026-09-02" },
  { id: 5, type: "expense", party: "مستلزمات المنزل", amount: 740, category: "مستلزمات", note: "منظفات وأدوات مطبخ", date: "2026-09-03" }
];

let transactions = [];
let categories = [];
let activeFilter = "all";

const ledgerBody = document.querySelector("#ledgerBody");
const ledgerEmpty = document.querySelector("#ledgerEmpty");
const dialog = document.querySelector("#transactionDialog");
const form = document.querySelector("#transactionForm");
const typeInput = document.querySelector("#transactionType");
const partyLabel = document.querySelector("#partyLabel");
const partyInput = document.querySelector("#partyInput");
const categoryInput = document.querySelector("#categoryInput");
const toast = document.querySelector("#toast");

async function request(url, options) { const response = await fetch(url, options); const data = await response.json(); if (!response.ok) throw new Error(data.error || "تعذر الاتصال بالخادم"); return data; }
async function loadData() { [categories, transactions] = await Promise.all([request("/api/categories"), request("/api/housing-transactions")]); }

function populateCategories(type) {
  const matching = categories.filter(item => item.type === type);
  const items = matching.length ? matching : [{ id: "", name: "أخرى", amount: "", amountMode: "custom" }];
  categoryInput.innerHTML = items.map(item => `<option value="${item.id || ""}" data-name="${escapeHtml(item.name)}" data-amount="${Number(item.amount) || ""}" data-mode="${item.amountMode || "fixed"}">${escapeHtml(item.name)}</option>`).join("");
  applyCategoryDefaults();
}

function applyCategoryDefaults() {
  const option = categoryInput.selectedOptions[0];
  if (!option) return;
  const defaultAmount = option.dataset.amount;
  const amountInput = document.querySelector("#amountInput");
  const amountHint = document.querySelector("#amountHint");
  const mode = option.dataset.mode;
  amountInput.value = defaultAmount || "";
  amountInput.readOnly = mode === "fixed" && Boolean(defaultAmount);
  amountInput.min = mode === "flexible" && defaultAmount ? defaultAmount : "1";
  amountHint.textContent = mode === "flexible" ? `القيمة الأساسية ${formatMoney(defaultAmount)} — يمكنك إدخال قيمة أكبر` : mode === "fixed" && defaultAmount ? "قيمة ثابتة — يمكن تعديلها من صفحة التصنيفات" : "أدخل القيمة الفعلية للحركة";
  amountHint.classList.toggle("flexible", mode === "flexible");
  if (typeInput.value === "expense") partyInput.value = option.dataset.name === "أخرى" ? "" : option.dataset.name;
}

function formatMoney(value) {
  return `${new Intl.NumberFormat("en-EG", { maximumFractionDigits: 2 }).format(value)} ج`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function totals() {
  const income = transactions.filter(item => item.type === "income").reduce((sum, item) => sum + Number(item.amount), 0);
  const expense = transactions.filter(item => item.type === "expense").reduce((sum, item) => sum + Number(item.amount), 0);
  return { income, expense, balance: income - expense };
}

function renderSummary() {
  const { income, expense, balance } = totals();
  document.querySelector("#totalIncome").textContent = formatMoney(income);
  document.querySelector("#totalExpense").textContent = formatMoney(expense);
  document.querySelector("#transactionCount").textContent = transactions.length;
  document.querySelector("#walletBalance").textContent = formatMoney(balance);
  const balanceCard = document.querySelector("#walletBalanceCard");
  const walletState = document.querySelector("#walletState span");
  balanceCard.classList.toggle("negative", balance < 0);
  walletState.textContent = balance < 0 ? `عجز في المحفظة بقيمة ${formatMoney(Math.abs(balance))}` : balance === 0 ? "رصيد المحفظة نفد" : "الرصيد متاح للصرف";
}

function runningBalances() {
  let balance = 0;
  return [...transactions].sort((a, b) => a.id - b.id).map(item => {
    balance += item.type === "income" ? Number(item.amount) : -Number(item.amount);
    return { ...item, runningBalance: balance };
  }).reverse();
}

function renderLedger() {
  const items = runningBalances().filter(item => activeFilter === "all" || item.type === activeFilter);
  ledgerEmpty.classList.toggle("show", items.length === 0);
  ledgerBody.innerHTML = items.map(item => {
    const income = item.type === "income";
    const sign = income ? "+" : "−";
    return `<tr>
      <td><div class="transaction-name"><span class="transaction-symbol ${item.type}">${income ? "↓" : "↑"}</span><div><strong>${escapeHtml(item.party)}</strong><small>${escapeHtml(item.note || "بدون ملاحظة")}</small></div></div></td>
      <td>${escapeHtml(item.category?.name || "أخرى")}</td>
      <td>${formatDate(item.date)}</td>
      <td><span class="transaction-amount ${item.type}">${sign}${formatMoney(item.amount)}</span></td>
      <td><span class="running-balance ${item.runningBalance < 0 ? "negative" : ""}">${formatMoney(item.runningBalance)}</span></td>
    </tr>`;
  }).join("");
}

function render() { renderSummary(); renderLedger(); }

function setTransactionType(type) {
  typeInput.value = type;
  document.querySelectorAll(".type-switch button").forEach(button => button.classList.toggle("active", button.dataset.type === type));
  partyLabel.textContent = type === "income" ? "اسم الفرد" : "اسم المصروف";
  partyInput.placeholder = type === "income" ? "مثال: محمد علي" : "مثال: فاتورة الكهرباء";
  populateCategories(type);
}

document.querySelector("#addTransaction").addEventListener("click", () => { setTransactionType("income"); dialog.showModal(); });
document.querySelectorAll(".type-switch button").forEach(button => button.addEventListener("click", () => setTransactionType(button.dataset.type)));
categoryInput.addEventListener("change", applyCategoryDefaults);
document.querySelector("#closeDialog").addEventListener("click", () => dialog.close());
document.querySelector("#cancelTransaction").addEventListener("click", () => dialog.close());

form.addEventListener("submit", async event => {
  event.preventDefault();
  const payload = { type: typeInput.value, party: partyInput.value.trim(), amount: Number(document.querySelector("#amountInput").value), categoryId: categoryInput.value ? Number(categoryInput.value) : null, note: document.querySelector("#noteInput").value.trim(), date: new Date().toISOString().slice(0, 10) };
  try { transactions.push(await request("/api/housing-transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })); render(); form.reset(); setTransactionType("income"); dialog.close(); toast.textContent = "تم تسجيل الحركة وتحديث رصيد المحفظة"; toast.classList.add("show"); window.setTimeout(() => toast.classList.remove("show"), 2400); } catch (error) { toast.textContent = error.message; toast.classList.add("show"); }
});

document.querySelectorAll(".ledger-filters button").forEach(button => button.addEventListener("click", () => {
  activeFilter = button.dataset.filter;
  document.querySelectorAll(".ledger-filters button").forEach(item => item.classList.toggle("active", item === button));
  renderLedger();
}));

const sidebar = document.querySelector("#sidebar");
const menuBtn = document.querySelector("#menuBtn");
menuBtn.addEventListener("click", () => { const open = sidebar.classList.toggle("open"); menuBtn.setAttribute("aria-expanded", String(open)); });
const profileMenu = document.querySelector("#profileMenu");
const profileBtn = document.querySelector("#profileBtn");
const profileDropdown = document.querySelector("#profileDropdown");
profileBtn.addEventListener("click", () => { const open = !profileDropdown.classList.contains("open"); profileDropdown.classList.toggle("open", open); profileBtn.setAttribute("aria-expanded", String(open)); profileDropdown.setAttribute("aria-hidden", String(!open)); });
document.addEventListener("click", event => { if (!profileMenu.contains(event.target)) { profileDropdown.classList.remove("open"); profileBtn.setAttribute("aria-expanded", "false"); } });
document.querySelectorAll(".dropdown-item").forEach(item => {
  if (item.textContent.includes("الدعم")) {
    item.addEventListener("click", () => { window.location.href = "support.html"; });
  }
});
document.querySelector("#logoutBtn").addEventListener("click", () => { window.location.href = "index.html"; });

loadData().then(() => { setTransactionType("income"); render(); }).catch(error => { toast.textContent = error.message; toast.classList.add("show"); });
