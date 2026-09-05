(async function () {
  const response = await fetch("/api/me", { credentials: "same-origin" });
  if (!response.ok) { window.location.replace("index.html"); return; }
  const { user } = await response.json();
  const role = user.role === "manager" ? "مدير السكن" : "مشترك";
  const avatar = user.avatarUrl || "assets/profile-youssef.png";

  document.querySelectorAll(".profile-copy strong, .dropdown-user strong").forEach(node => { node.textContent = user.name; });
  document.querySelectorAll(".profile-copy small").forEach(node => { node.textContent = role; });
  document.querySelectorAll(".dropdown-user small").forEach(node => { node.textContent = user.email; });
  document.querySelectorAll(".profile-avatar, .dropdown-user img").forEach(image => { image.src = avatar; image.alt = `صورة ${user.name}`; });
  const greeting = document.querySelector(".topbar h1");
  if (greeting && greeting.textContent.includes("يا ")) greeting.textContent = `صباح الخير يا ${user.name.split(" ")[0]}`;

  const dropdown = document.querySelector("#profileDropdown");
  if (dropdown && ![...dropdown.querySelectorAll(".dropdown-item")].some(item => item.textContent.includes("الملف الشخصي"))) {
    const profileLink = document.createElement("button"); profileLink.className = "dropdown-item"; profileLink.type = "button"; profileLink.textContent = "الملف الشخصي";
    const separator = dropdown.querySelector(".dropdown-separator"); (separator || dropdown.firstChild)?.after(profileLink);
  }
  document.querySelectorAll(".dropdown-item").forEach(item => {
    if (item.textContent.includes("الملف الشخصي")) item.addEventListener("click", () => { window.location.href = "profile.html"; });
  });
  const logout = document.querySelector("#logoutBtn");
  if (logout) logout.addEventListener("click", async event => {
    event.preventDefault(); event.stopImmediatePropagation();
    await fetch("/api/logout", { method: "POST", credentials: "same-origin", keepalive: true });
    window.location.replace("index.html");
  }, true);
})();
