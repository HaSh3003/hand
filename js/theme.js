(() => {
  const THEME_KEY = "hand-color-theme";
  const savedTheme = localStorage.getItem(THEME_KEY);
  document.documentElement.dataset.theme = savedTheme === "light" ? "light" : "dark";

  function mountToggle() {
    const host = document.querySelector(".profile-menu") || document.querySelector(".form-side");
    if (!host || document.querySelector("#themeToggle")) return;
    const button = document.createElement("button");
    button.id = "themeToggle";
    button.type = "button";
    button.className = `theme-toggle${host.classList.contains("form-side") ? " login-theme-toggle" : ""}`;
    button.innerHTML = `<svg class="theme-sun" aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg><svg class="theme-moon" aria-hidden="true" viewBox="0 0 24 24"><path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z"/></svg>`;
    function updateLabel() {
      const isLight = document.documentElement.dataset.theme === "light";
      button.setAttribute("aria-label", isLight ? "تفعيل الوضع الداكن" : "تفعيل الوضع الفاتح");
      button.title = isLight ? "الوضع الداكن" : "الوضع الفاتح";
    }
    button.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      document.documentElement.dataset.theme = next;
      localStorage.setItem(THEME_KEY, next);
      updateLabel();
    });
    host.prepend(button);
    updateLabel();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountToggle);
  else mountToggle();
})();
