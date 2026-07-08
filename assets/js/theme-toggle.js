(function () {
  var STORAGE_KEY = "theme";
  var button = document.querySelector(".theme-toggle");
  if (!button) return;
  button.addEventListener("click", function () {
    var current = document.documentElement.getAttribute("data-theme");
    var next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(STORAGE_KEY, next);

    var giscusFrame = document.querySelector("iframe.giscus-frame");
    if (giscusFrame) {
      giscusFrame.contentWindow.postMessage(
        { giscus: { setConfig: { theme: next } } },
        "https://giscus.app"
      );
    }
  });
})();
