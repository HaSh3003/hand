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
    const response = await apiFetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: document.querySelector("#email").value.trim(),
        password: passwordInput.value,
        remember: document.querySelector('.remember-row input').checked
      })
    });

    const raw = await response.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (parseError) {
      console.error("Login response parse error:", parseError, raw);
      throw new Error("رد الخادم غير مفهوم. تأكد أن السيرفر شغّال وأنك فاتح التطبيق من الرابط الصحيح.");
    }

    if (!response.ok) throw new Error(data.error || "تعذر تسجيل الدخول");
    if (!data.user) throw new Error("لم يتم استلام بيانات المستخدم من الخادم");

    window.location.href = "dashboard.html";
  } catch (error) {
    submitButton.disabled = false;
    submitButton.querySelector("span").textContent = "تسجيل الدخول";
    const message = document.querySelector("#loginError") || document.createElement("p");
    message.id = "loginError";
    message.className = "login-error";
    message.textContent = error.message;
    if (!message.parentNode) loginForm.append(message);
  }
});
