const loginForm = document.querySelector("#loginForm");
const passwordInput = document.querySelector("#password");
const passwordToggle = document.querySelector("#passwordToggle");

passwordToggle.addEventListener("click", () => {
  const showing = passwordInput.type === "text";
  passwordInput.type = showing ? "password" : "text";
  passwordToggle.setAttribute("aria-label", showing ? "إظهار كلمة المرور" : "إخفاء كلمة المرور");
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = loginForm.querySelector(".login-btn");
  submitButton.disabled = true;
  submitButton.querySelector("span").textContent = "جاري الدخول...";
  try {
    const response = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ email: document.querySelector("#email").value.trim(), password: passwordInput.value, remember: document.querySelector('.remember-row input').checked }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "تعذر تسجيل الدخول");
    window.location.href = "dashboard.html";
  } catch (error) {
    submitButton.disabled = false;
    submitButton.querySelector("span").textContent = "تسجيل الدخول";
    const message = document.querySelector("#loginError") || document.createElement("p");
    message.id = "loginError"; message.className = "login-error"; message.textContent = error.message;
    if (!message.parentNode) loginForm.append(message);
  }
});
