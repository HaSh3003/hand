(function () {
  var overlay = document.createElement("div");
  overlay.className = "loader-overlay";
  overlay.id = "pageLoader";
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-label", "جاري تحميل هاند");
  overlay.innerHTML =
    '<svg class="loader-hand" viewBox="0 0 250 90" aria-hidden="true">' +
    '<g stroke="var(--primary)" stroke-width="4.5" fill="var(--primary)" fill-opacity="0" stroke-linecap="round" stroke-linejoin="round">' +
    '<path class="loader-letter" d="M20,20 V70 M60,20 V70 M20,45 H60" pathLength="100" />' +
    '<path class="loader-letter" d="M85,70 L110,20 L135,70 M95,50 H125" pathLength="100" />' +
    '<path class="loader-letter" d="M155,70 V20 L195,70 V20" pathLength="100" />' +
    '<path class="loader-letter" d="M215,20 V70 M215,20 C255,20 255,70 215,70" pathLength="100" />' +
    "</g></svg>";

  document.body.insertBefore(overlay, document.body.firstChild);

  function hide() {
    overlay.classList.add("hidden");
  }

  var loadDone = document.readyState === "complete";
  var timeDone = false;

  function tryHide() {
    if (loadDone && timeDone) hide();
  }

  if (!loadDone) {
    window.addEventListener("load", function () {
      loadDone = true;
      tryHide();
    });
  }

  setTimeout(function () {
    timeDone = true;
    tryHide();
  }, 3200);
})();
