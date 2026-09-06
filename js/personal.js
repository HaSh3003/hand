const PERSONAL_KEY = "hand-private-account-youssef-v1";
const DEBTS_KEY = "hand-private-debts-youssef-v1";
const debtSeed = [
  { id: 101, creditor: "أحمد محمود", title: "مبلغ شخصي", amount: 5000, paid: 1500, dueDate: "2026-09-20", note: "سداد على دفعات" },
  { id: 102, creditor: "البنك", title: "قسط جهاز", amount: 8000, paid: 4000, dueDate: "2026-10-05", note: "القسط المتبقي" }
];
const seed = [
  { id: 1, type: "income", title: "الراتب الشهري", amount: 18000, account: "الحساب البنكي", category: "راتب", note: "راتب سبتمبر", date: "2026-09-01" },
  { id: 2, type: "income", title: "عمل حر", amount: 4500, account: "المحفظة الإلكترونية", category: "عمل إضافي", note: "مشروع تصميم", date: "2026-09-02" },
  { id: 3, type: "expense", title: "مشتريات شخصية", amount: 1200, account: "الحساب البنكي", category: "تسوق", note: "مستلزمات الشهر", date: "2026-09-02" },
  { id: 4, type: "expense", title: "مواصلات", amount: 750, account: "نقدي", category: "تنقل", note: "", date: "2026-09-03" }
];
let transactions = [];
let debts = [];
let users = [];
let currentUserId = null;
let activeFilter = "all";
let numbersHidden = false;
const incomeCategories = ["راتب","عمل إضافي","مكافأة","استثمار","أخرى"];
const expenseCategories = ["طعام","تنقل","تسوق","ترفيه","اشتراكات","صحة","سداد ديون","أخرى"];

const body = document.querySelector("#personalLedgerBody");
const empty = document.querySelector("#personalEmpty");
const dialog = document.querySelector("#personalDialog");
const form = document.querySelector("#personalForm");
const typeInput = document.querySelector("#personalType");
const categoryInput = document.querySelector("#personalCategory");
const toast = document.querySelector("#toast");

const debtTable = document.querySelector("#debtTable");
const debtList = document.querySelector("#debtListBody");
const debtDialog = document.querySelector("#debtDialog");
const debtForm = document.querySelector("#debtForm");
const debtPaymentDialog = document.querySelector("#debtPaymentDialog");
const debtPaymentForm = document.querySelector("#debtPaymentForm");
const deleteDebtDialog = document.querySelector("#deleteDebtDialog");
const deleteDebtMessage = document.querySelector("#deleteDebtMessage");
let pendingDeleteId = null;
const debtDirectionInput = document.querySelector("#debtDirection");
const debtDirectionButtons = document.querySelectorAll(".debt-direction-switch button");
const debtPersonSelect = document.querySelector("#debtPerson");
const debtCounterpartyInput = document.querySelector("#debtCounterpartyId");
const debtCreditorInput = document.querySelector("#debtCreditor");
const debtExternalWrap = document.querySelector("#debtExternalWrap");
const iOweRemainingEl = document.querySelector("#iOweRemaining");
const owedToMeRemainingEl = document.querySelector("#owedToMeRemaining");

async function request(url, options) {
  const response = await apiFetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "تعذر الاتصال بالخادم");
  return data;
}

async function loadData() {
  const data = await request("/api/bootstrap");
  transactions = data.personalTransactions;
  debts = data.debts;
  users = data.users || [];
  currentUserId = data.currentUserId;
  numbersHidden = Boolean(data.settings?.hidePersonalTotals);
  renderDebtPersonOptions();
}

function money(value) { return `${new Intl.NumberFormat("en-EG", { maximumFractionDigits: 2 }).format(value)} ج`; }
function date(value) { return new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }

function totals() {
  const income = transactions.filter(item => item.type === "income").reduce((sum, item) => sum + Number(item.amount), 0);
  const expense = transactions.filter(item => item.type === "expense").reduce((sum, item) => sum + Number(item.amount), 0);
  return { income, expense, balance: income - expense };
}

function renderSummary() {
  const { income, expense, balance } = totals();
  document.querySelector("#personalBalance").textContent = money(balance);
  document.querySelector("#personalIncome").textContent = money(income);
  document.querySelector("#personalExpense").textContent = money(expense);
  document.querySelector("#savingRate").textContent = income ? `${Math.round(balance / income * 100)}%` : "0%";
  document.querySelector("#incomeCount").textContent = `${transactions.filter(item => item.type === "income").length} حركات`;
  document.querySelector("#expenseCount").textContent = `${transactions.filter(item => item.type === "expense").length} حركات`;
  document.querySelector("#balanceMessage").textContent = balance < 0 ? `عجز شخصي بقيمة ${money(Math.abs(balance))}` : "متاح للاستخدام";
}

function running() {
  let balance = 0;
  return [...transactions].sort((a, b) => a.id - b.id).map(item => {
    balance += item.type === "income" ? Number(item.amount) : -Number(item.amount);
    return { ...item, runningBalance: balance };
  }).reverse();
}

function renderLedger() {
  const items = running().filter(item => activeFilter === "all" || item.type === activeFilter);
  empty.classList.toggle("show", items.length === 0);
  body.innerHTML = items.map(item => `<tr><td><div class="transaction-name"><span class="transaction-symbol ${item.type}">${item.type === "income" ? "↓" : "↑"}</span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.note || "بدون ملاحظة")}</small></div></div></td><td>${escapeHtml(item.account)}</td><td>${escapeHtml(item.category)}</td><td>${date(item.date)}</td><td><span class="transaction-amount private-amount ${item.type}">${item.type === "income" ? "+" : "−"}${money(item.amount)}</span></td><td><span class="running-balance private-amount ${item.runningBalance < 0 ? "negative" : ""}">${money(item.runningBalance)}</span></td></tr>`).join("");
}

function getDebtView(debt) {
  const iAmOwner = debt.ownerId === currentUserId;
  const iAmCounterparty = debt.counterpartyId === currentUserId;
  const iOwe = (debt.direction === "i_owe" && iAmOwner) || (debt.direction === "owed_to_me" && iAmCounterparty);
  const isExternal = !debt.counterparty;
  const isCreditor = (debt.direction === "i_owe" && iAmCounterparty) || (debt.direction === "owed_to_me" && iAmOwner);
  const canDelete = iAmOwner || isCreditor;
  let otherName = "";
  if (iOwe) {
    otherName = isExternal ? debt.creditor : (debt.counterparty ? debt.counterparty.name : debt.creditor);
  } else {
    otherName = (debt.direction === "i_owe") ? (debt.owner ? debt.owner.name : debt.creditor) : (debt.counterparty ? debt.counterparty.name : debt.creditor);
  }
  return { iOwe, otherName, isExternal, canDelete };
}

function renderDebts() {
  const iOweRemaining = debts.filter(d => getDebtView(d).iOwe).reduce((sum, item) => sum + Math.max(0, Number(item.amount) - Number(item.paid)), 0);
  const owedToMeRemaining = debts.filter(d => !getDebtView(d).iOwe).reduce((sum, item) => sum + Math.max(0, Number(item.amount) - Number(item.paid)), 0);
  const active = debts.filter(item => Number(item.paid) < Number(item.amount));
  iOweRemainingEl.textContent = money(iOweRemaining);
  owedToMeRemainingEl.textContent = money(owedToMeRemaining);
  document.querySelector("#activeDebtCount").textContent = active.length;
  document.querySelector("#debtEmpty").classList.toggle("show", debts.length === 0);
  if (debtTable) debtTable.classList.toggle("hidden", debts.length === 0);

  const today = new Date().toISOString().slice(0, 10);
  debtList.innerHTML = debts.map(item => {
    const view = getDebtView(item);
    const left = Math.max(0, Number(item.amount) - Number(item.paid));
    const settled = left === 0;
    const overdue = !settled && item.dueDate < today;
    const status = settled ? "تم السداد" : overdue ? "متأخر" : "قائم";
    const canPay = view.iOwe;
    const payButton = settled || !canPay ? "" : `<button class="debt-action-pay" data-pay-debt="${item.id}">تسجيل سداد</button>`;
    const deleteButton = view.canDelete ? `<button class="debt-action-delete" data-delete-debt="${item.id}">حذف</button>` : "";
    return `<tr class="debt-row ${settled ? "settled" : overdue ? "overdue" : ""} ${view.iOwe ? "i-owe" : "owed-to-me"}"><td><strong>${escapeHtml(item.title)}</strong><small class="debt-row-direction">${view.iOwe ? "عليا" : "ليا"}</small></td><td>${escapeHtml(view.otherName)}</td><td class="private-amount">${money(item.amount)}</td><td class="private-amount">${money(left)}</td><td>${date(item.dueDate)}</td><td><span class="debt-status ${settled ? "settled" : overdue ? "overdue" : ""}">${status}</span></td><td class="debt-actions-cell">${payButton}${deleteButton}</td></tr>`;
  }).join("");
  document.querySelectorAll("[data-pay-debt]").forEach(button => button.addEventListener("click", () => openDebtPayment(Number(button.dataset.payDebt))));
  document.querySelectorAll("[data-delete-debt]").forEach(button => button.addEventListener("click", () => deleteDebt(Number(button.dataset.deleteDebt))));
}

function render() { renderSummary(); renderLedger(); renderDebts(); }

function setType(type) {
  typeInput.value = type;
  document.querySelectorAll(".personal-type-switch button").forEach(button => button.classList.toggle("active", button.dataset.type === type));
  const items = type === "income" ? incomeCategories : expenseCategories;
  categoryInput.innerHTML = items.map(item => `<option>${item}</option>`).join("");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2400);
}

document.querySelector("#addPersonalTransaction").addEventListener("click", () => { setType("income"); dialog.showModal(); });
document.querySelectorAll(".personal-type-switch button").forEach(button => button.addEventListener("click", () => setType(button.dataset.type)));
document.querySelector("#closePersonalDialog").addEventListener("click", () => dialog.close());
document.querySelector("#cancelPersonal").addEventListener("click", () => dialog.close());

form.addEventListener("submit", async event => {
  event.preventDefault();
  const payload = {
    type: typeInput.value,
    title: document.querySelector("#personalTitle").value.trim(),
    amount: Number(document.querySelector("#personalAmount").value),
    account: document.querySelector("#personalAccount").value,
    category: categoryInput.value,
    note: document.querySelector("#personalNote").value.trim(),
    date: new Date().toISOString().slice(0, 10)
  };
  try {
    transactions.push(await request("/api/personal-transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
    render(); form.reset(); dialog.close(); showToast("تم حفظ الحركة في حسابك الخاص");
  } catch (error) { showToast(error.message); }
});

function renderDebtPersonOptions() {
  if (!currentUserId) return;
  const others = users.filter(u => u.id !== currentUserId);
  const userOptions = others.map(u => `<option value="${u.id}">${escapeHtml(u.name)}</option>`).join("");
  const direction = debtDirectionInput.value;
  if (direction === "i_owe") {
    debtPersonSelect.innerHTML = `<option value="" disabled selected>اختر شخصًا أو جهة خارجية</option>${userOptions}<option value="external">جهة خارجية</option>`;
  } else {
    debtPersonSelect.innerHTML = `<option value="" disabled selected>اختر الشخص اللي ليك عنده فلوس</option>${userOptions}`;
  }
  debtCounterpartyInput.value = "";
  debtCreditorInput.value = "";
  debtExternalWrap.style.display = "none";
  debtCreditorInput.required = false;
}

function setDebtDirection(direction) {
  debtDirectionInput.value = direction;
  debtDirectionButtons.forEach(button => button.classList.toggle("active", button.dataset.direction === direction));
  renderDebtPersonOptions();
}

debtDirectionButtons.forEach(button => button.addEventListener("click", () => setDebtDirection(button.dataset.direction)));

debtPersonSelect.addEventListener("change", () => {
  const value = debtPersonSelect.value;
  if (value === "external") {
    debtCounterpartyInput.value = "";
    debtExternalWrap.style.display = "block";
    debtCreditorInput.value = "";
    debtCreditorInput.readOnly = false;
    debtCreditorInput.required = true;
    debtCreditorInput.focus();
  } else if (value) {
    const user = users.find(u => u.id === Number(value));
    debtCounterpartyInput.value = value;
    debtExternalWrap.style.display = "none";
    debtCreditorInput.value = user ? user.name : "";
    debtCreditorInput.readOnly = true;
    debtCreditorInput.required = false;
  } else {
    debtCounterpartyInput.value = "";
    debtExternalWrap.style.display = "none";
    debtCreditorInput.value = "";
    debtCreditorInput.readOnly = false;
    debtCreditorInput.required = false;
  }
});

document.querySelector("#addDebt").addEventListener("click", () => {
  debtForm.reset();
  document.querySelector("#debtDueDate").value = new Date().toISOString().slice(0, 10);
  setDebtDirection("i_owe");
  debtDialog.showModal();
});
document.querySelector("#closeDebtDialog").addEventListener("click", () => debtDialog.close());
document.querySelector("#cancelDebt").addEventListener("click", () => debtDialog.close());

debtForm.addEventListener("submit", async event => {
  event.preventDefault();
  const amount = Number(document.querySelector("#debtAmount").value);
  const paid = Number(document.querySelector("#debtInitiallyPaid").value);
  if (paid > amount) { showToast("المبلغ المدفوع لا يمكن أن يتجاوز إجمالي الدين"); return; }
  const direction = document.querySelector("#debtDirection").value;
  const counterpartyId = document.querySelector("#debtCounterpartyId").value;
  if (!counterpartyId && direction === "owed_to_me") { showToast("يجب اختيار مستخدم عند تسجيل دين ليك"); return; }
  if (!counterpartyId && !debtCreditorInput.value.trim()) { showToast("يجب كتابة اسم الجهة"); return; }
  const payload = {
    direction,
    counterpartyId: counterpartyId ? Number(counterpartyId) : null,
    creditor: counterpartyId ? "" : debtCreditorInput.value.trim(),
    title: document.querySelector("#debtTitle").value.trim(),
    amount,
    paid,
    dueDate: document.querySelector("#debtDueDate").value,
    note: document.querySelector("#debtNote").value.trim()
  };
  try {
    debts.push(await request("/api/debts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
    render(); debtForm.reset(); debtDialog.close(); showToast("تم حفظ الدين");
  } catch (error) { showToast(error.message); }
});

function openDebtPayment(id) {
  const debt = debts.find(item => item.id === id);
  if (!debt) return;
  const view = getDebtView(debt);
  if (!view.iOwe) return;
  const remaining = Math.max(0, debt.amount - debt.paid);
  document.querySelector("#paymentDebtId").value = id;
  document.querySelector("#paymentDebtName").textContent = `${debt.title} — ${debt.creditor}`;
  document.querySelector("#paymentRemaining").textContent = `المتبقي حاليًا: ${money(remaining)}`;
  const input = document.querySelector("#debtPaymentAmount");
  input.value = "";
  input.max = remaining;
  debtPaymentDialog.showModal();
}

document.querySelector("#closeDebtPayment").addEventListener("click", () => debtPaymentDialog.close());
document.querySelector("#cancelDebtPayment").addEventListener("click", () => debtPaymentDialog.close());

debtPaymentForm.addEventListener("submit", async event => {
  event.preventDefault();
  const id = Number(document.querySelector("#paymentDebtId").value);
  const payment = Number(document.querySelector("#debtPaymentAmount").value);
  const debt = debts.find(item => item.id === id);
  if (!debt || payment <= 0 || payment > debt.amount - debt.paid) { showToast("أدخل مبلغًا صحيحًا لا يتجاوز المتبقي"); return; }
  try {
    const updated = await request(`/api/debts/${id}/payments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: payment, account: "نقدي" }) });
    debts = debts.map(item => item.id === id ? updated : item);
    transactions = await request("/api/personal-transactions");
    render();
    debtPaymentDialog.close();
    showToast("تم تسجيل السداد وتحديث حسابك الشخصي");
  } catch (error) { showToast(error.message); }
});

async function deleteDebt(id) {
  const debt = debts.find(item => item.id === id);
  if (!debt) return;
  const view = getDebtView(debt);
  if (!view.canDelete) { showToast("لا يمكنك حذف هذا الدين"); return; }
  pendingDeleteId = id;
  if (deleteDebtMessage) { deleteDebtMessage.textContent = `هل أنت متأكد أنك تريد حذف "${debt.title}"؟ لا يمكن التراجع بعد الحذف.`; }
  deleteDebtDialog.showModal();
}

async function executeDeleteDebt() {
  if (!pendingDeleteId) return;
  try {
    await request(`/api/debts/${pendingDeleteId}`, { method: "DELETE" });
    debts = debts.filter(item => item.id !== pendingDeleteId);
    pendingDeleteId = null;
    deleteDebtDialog.close();
    render();
    showToast("تم حذف الدين");
  } catch (error) { showToast(error.message); }
}

document.querySelectorAll(".personal-filters button").forEach(button => button.addEventListener("click", () => {
  activeFilter = button.dataset.filter;
  document.querySelectorAll(".personal-filters button").forEach(item => item.classList.toggle("active", item === button));
  renderLedger();
}));

if (deleteDebtDialog) {
  document.querySelector("#closeDeleteDebt")?.addEventListener("click", () => deleteDebtDialog.close());
  document.querySelector("#cancelDeleteDebt")?.addEventListener("click", () => deleteDebtDialog.close());
  document.querySelector("#confirmDeleteDebt")?.addEventListener("click", executeDeleteDebt);
}

document.querySelector("#hideBalances").addEventListener("click", () => {
  numbersHidden = !numbersHidden;
  document.querySelector(".personal-content").classList.toggle("hide-private", numbersHidden);
  document.querySelector("#hideBalances span").textContent = numbersHidden ? "إظهار الأرقام" : "إخفاء الأرقام";
});

const sidebar = document.querySelector("#sidebar");
const menuBtn = document.querySelector("#menuBtn");
menuBtn.addEventListener("click", () => { const open = sidebar.classList.toggle("open"); menuBtn.setAttribute("aria-expanded", String(open)); });

const profileMenu = document.querySelector("#profileMenu");
const profileBtn = document.querySelector("#profileBtn");
const profileDropdown = document.querySelector("#profileDropdown");
profileBtn.addEventListener("click", () => { const open = !profileDropdown.classList.contains("open"); profileDropdown.classList.toggle("open", open); profileBtn.setAttribute("aria-expanded", String(open)); profileDropdown.setAttribute("aria-hidden", String(!open)); });
document.addEventListener("click", event => { if (!profileMenu.contains(event.target)) { profileDropdown.classList.remove("open"); profileBtn.setAttribute("aria-expanded", "false"); } });
document.querySelectorAll(".dropdown-item").forEach(item => { if (item.textContent.includes("الدعم")) { item.addEventListener("click", () => { window.location.href = "support.html"; }); } });
document.querySelector("#logoutBtn").addEventListener("click", () => { window.location.href = "index.html"; });

setType("income");
loadData().then(() => {
  render();
  if (numbersHidden) { document.querySelector(".personal-content").classList.add("hide-private"); document.querySelector("#hideBalances span").textContent = "إظهار الأرقام"; }
}).catch(error => showToast(error.message));
