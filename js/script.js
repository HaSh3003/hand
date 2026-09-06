const sidebar = document.querySelector("#sidebar");
const menuBtn = document.querySelector("#menuBtn");
const dialog = document.querySelector("#paymentDialog");
const toast = document.querySelector("#toast");
const monthLabel = document.querySelector("#monthLabel");
const profileMenu = document.querySelector("#profileMenu");
const profileBtn = document.querySelector("#profileBtn");
const profileDropdown = document.querySelector("#profileDropdown");

const walletSeed = [
  { type: "income", amount: 1580 }, { type: "income", amount: 1580 }, { type: "income", amount: 1580 },
  { type: "expense", amount: 120 }, { type: "expense", amount: 740 }
];

async function updateWalletTotals() {
  let transactions = walletSeed;
  try { const response = await apiFetch("/api/housing-transactions"); const data = await response.json(); if (response.ok && Array.isArray(data)) transactions = data; } catch {}
  const incoming = transactions.filter(item => item.type === "income");
  const outgoing = transactions.filter(item => item.type === "expense");
  const totalIn = incoming.reduce((sum, item) => sum + Number(item.amount), 0);
  const totalOut = outgoing.reduce((sum, item) => sum + Number(item.amount), 0);
  const format = value => new Intl.NumberFormat("en-EG", { maximumFractionDigits: 2 }).format(value);
  document.querySelector("#dashboardTotalIn").innerHTML = `${format(totalIn)} <small>ج</small>`;
  document.querySelector("#dashboardTotalOut").innerHTML = `${format(totalOut)} <small>ج</small>`;
  document.querySelector("#dashboardIncomeCount").textContent = `${incoming.length} حركات`;
  document.querySelector("#dashboardExpenseCount").textContent = `${outgoing.length} حركات`;
}

function setProfileMenu(open) {
  profileDropdown.classList.toggle("open", open);
  profileDropdown.setAttribute("aria-hidden", String(!open));
  profileBtn.setAttribute("aria-expanded", String(open));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2400);
}

profileBtn.addEventListener("click", () => {
  setProfileMenu(profileBtn.getAttribute("aria-expanded") !== "true");
});

document.addEventListener("click", (event) => {
  if (!profileMenu.contains(event.target)) setProfileMenu(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setProfileMenu(false);
    profileBtn.focus();
  }
});



document.querySelector("#logoutBtn").addEventListener("click", () => {
  setProfileMenu(false);
  showToast("تم تسجيل الخروج");
  window.setTimeout(() => {
    window.location.href = "index.html";
  }, 550);
});

menuBtn.addEventListener("click", () => {
  const open = sidebar.classList.toggle("open");
  menuBtn.setAttribute("aria-expanded", String(open));
});

document.addEventListener("click", (event) => {
  if (window.innerWidth <= 760 && sidebar.classList.contains("open") && !sidebar.contains(event.target) && event.target !== menuBtn) {
    sidebar.classList.remove("open");
    menuBtn.setAttribute("aria-expanded", "false");
  }
});

document.querySelector("#recordPayment").addEventListener("click", () => dialog.showModal());
document.querySelector("#addExpense").addEventListener("click", () => dialog.showModal());

dialog.addEventListener("close", () => {
  if (dialog.returnValue === "confirm") {
    showToast("تم حفظ الدفعة بنجاح");
  }
});

const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
let displayedMonth = 8;

function changeMonth(step) {
  displayedMonth = (displayedMonth + step + 12) % 12;
  monthLabel.textContent = `${months[displayedMonth]} 2026`;
}

document.querySelector("#prevMonth").addEventListener("click", () => changeMonth(-1));
document.querySelector("#nextMonth").addEventListener("click", () => changeMonth(1));

window.addEventListener("pageshow", updateWalletTotals);
updateWalletTotals();
