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
