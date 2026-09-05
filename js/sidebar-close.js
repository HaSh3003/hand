(() => {
  const sidebar = document.querySelector("#sidebar");
  const closeButton = document.querySelector("#sidebarClose");
  const menuButton = document.querySelector("#menuBtn");
  if (!sidebar || !closeButton) return;

  function closeSidebar() {
    sidebar.classList.remove("open");
    if (menuButton) menuButton.setAttribute("aria-expanded", "false");
    if (menuButton && window.innerWidth <= 760) menuButton.focus();
  }

  closeButton.addEventListener("click", closeSidebar);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && sidebar.classList.contains("open")) closeSidebar();
  });
})();
