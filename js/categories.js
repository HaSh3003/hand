const CATEGORY_KEY = "hand-housing-categories-v1";
const defaultCategories = [
  { id: 101, name: "اشتراك السكن", type: "income", amount: 1580, dueDay: 1, frequency: "monthly", amountMode: "fixed", description: "المبلغ الشهري الذي يدفعه كل فرد للمحفظة" },
  { id: 102, name: "إيجار السكن", type: "expense", amount: 6000, dueDay: 5, frequency: "monthly", amountMode: "fixed", description: "الإيجار الشهري الأساسي للسكن" },
  { id: 103, name: "فاتورة الكهرباء", type: "expense", amount: 1350, dueDay: 10, frequency: "monthly", amountMode: "flexible", description: "مبلغ أساسي يمكن أن يزيد حسب الاستهلاك" },
  { id: 104, name: "فاتورة المياه", type: "expense", amount: 420, dueDay: 12, frequency: "monthly", amountMode: "flexible", description: "مبلغ أساسي يمكن أن يزيد حسب الاستهلاك" },
  { id: 105, name: "اشتراك الإنترنت", type: "expense", amount: 630, dueDay: 15, frequency: "monthly", amountMode: "fixed", description: "اشتراك الإنترنت المنزلي" }
];

let categories = [];
let activeFilter = "all";
const grid = document.querySelector("#categoryGrid");
const emptyState = document.querySelector("#categoryEmpty");
const dialog = document.querySelector("#categoryDialog");
const form = document.querySelector("#categoryForm");
const typeInput = document.querySelector("#categoryType");
const toast = document.querySelector("#toast");

async function request(url, options) { const response = await apiFetch(url, options); const data = await response.json(); if (!response.ok) throw new Error(data.error || "تعذر الاتصال بالخادم"); return data; }
async function loadCategories() { categories = await request("/api/categories"); }
function money(value) { return `${new Intl.NumberFormat("en-EG", { maximumFractionDigits: 2 }).format(value)} ج`; }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" })[char]); }

function renderSummary() {
  const monthlyTotal = categories.filter(item => item.type === "expense" && item.frequency === "monthly").reduce((sum,item) => sum + Number(item.amount),0);
  document.querySelector("#monthlyTotal").textContent = money(monthlyTotal);
  document.querySelector("#categoriesCount").textContent = categories.length;
  const today = new Date().getDate();
  const expenses = categories.filter(item => item.type === "expense");
  const nearest = [...expenses].sort((a,b) => ((a.dueDay - today + 31) % 31) - ((b.dueDay - today + 31) % 31))[0];
  document.querySelector("#nearestDue").textContent = nearest ? `يوم ${nearest.dueDay}` : "—";
  document.querySelector("#nearestDueName").textContent = nearest ? nearest.name : "لا توجد استحقاقات";
}

function renderCards() {
  const visible = categories.filter(item => activeFilter === "all" || item.type === activeFilter);
  emptyState.classList.toggle("show", visible.length === 0);
  grid.innerHTML = visible.map(item => `<article class="category-card ${item.type}">
    <div class="category-card-head">
      <span class="category-icon"><svg viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6M9 16h3"/></svg></span>
      <span class="category-type">${item.type === "income" ? "داخل المحفظة" : "خارج المحفظة"}</span>
    </div>
    <button class="category-delete" data-delete="${item.id}" aria-label="حذف ${escapeHtml(item.name)}"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg></button>
    <h4>${escapeHtml(item.name)}</h4><p>${escapeHtml(item.description || "بدون وصف")}</p>
    <div class="amount-mode ${item.amountMode === "flexible" ? "flexible" : ""}">${item.amountMode === "flexible" ? "قابل للزيادة" : "مبلغ ثابت"}</div>
    <div class="category-details"><div class="category-amount"><span>${item.amountMode === "flexible" ? "القيمة الأساسية" : "القيمة الثابتة"}</span><strong>${money(item.amount)}</strong></div><div class="category-due">${item.frequency === "monthly" ? "يتكرر شهريًا" : "مرة واحدة"}<strong>مستحق يوم ${item.dueDay}</strong></div></div>
  </article>`).join("");
  document.querySelectorAll("[data-delete]").forEach(button => button.addEventListener("click", async () => {
    const item = categories.find(category => category.id === Number(button.dataset.delete));
    if (item && window.confirm(`هل تريد حذف تصنيف «${item.name}»؟`)) {
      try { await request(`/api/categories/${item.id}`, { method: "DELETE" }); categories = categories.filter(category => category.id !== item.id); render(); showToast("تم حذف التصنيف"); } catch (error) { showToast(error.message); }
    }
  }));
}

function render() { renderSummary(); renderCards(); }
function showToast(message) { toast.textContent = message; toast.classList.add("show"); window.setTimeout(() => toast.classList.remove("show"),2400); }
function setType(type) { typeInput.value = type; document.querySelectorAll(".type-switch button").forEach(button => button.classList.toggle("active",button.dataset.type === type)); }

document.querySelector("#addCategory").addEventListener("click", () => { setType("expense"); dialog.showModal(); });
document.querySelectorAll(".type-switch button").forEach(button => button.addEventListener("click", () => setType(button.dataset.type)));
document.querySelector("#closeCategoryDialog").addEventListener("click", () => dialog.close());
document.querySelector("#cancelCategory").addEventListener("click", () => dialog.close());
form.addEventListener("submit", async event => {
  event.preventDefault();
  const payload = { name: document.querySelector("#categoryName").value.trim(), type: typeInput.value, amount: Number(document.querySelector("#categoryAmount").value), dueDay: Number(document.querySelector("#categoryDueDay").value), frequency: document.querySelector("#categoryFrequency").value, amountMode: document.querySelector("#categoryAmountMode").value, description: document.querySelector("#categoryDescription").value.trim() };
  try { categories.push(await request("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })); render(); form.reset(); setType("expense"); dialog.close(); showToast("تمت إضافة التصنيف وربطه بالمحفظة"); } catch (error) { showToast(error.message); }
});
document.querySelectorAll(".category-filters button").forEach(button => button.addEventListener("click", () => { activeFilter = button.dataset.filter; document.querySelectorAll(".category-filters button").forEach(item => item.classList.toggle("active",item === button)); renderCards(); }));

const sidebar = document.querySelector("#sidebar"), menuBtn = document.querySelector("#menuBtn");
menuBtn.addEventListener("click", () => { const open = sidebar.classList.toggle("open"); menuBtn.setAttribute("aria-expanded",String(open)); });
const profileMenu = document.querySelector("#profileMenu"), profileBtn = document.querySelector("#profileBtn"), profileDropdown = document.querySelector("#profileDropdown");
profileBtn.addEventListener("click", () => { const open = !profileDropdown.classList.contains("open"); profileDropdown.classList.toggle("open",open); profileBtn.setAttribute("aria-expanded",String(open)); profileDropdown.setAttribute("aria-hidden",String(!open)); });
document.addEventListener("click", event => { if (!profileMenu.contains(event.target)) { profileDropdown.classList.remove("open"); profileBtn.setAttribute("aria-expanded","false"); } });
document.querySelectorAll(".dropdown-item").forEach(item => {
  if (item.textContent.includes("الدعم")) {
    item.addEventListener("click", () => { window.location.href = "support.html"; });
  }
});
document.querySelector("#logoutBtn").addEventListener("click", () => { window.location.href = "index.html"; });
loadCategories().then(render).catch(error => showToast(error.message));
