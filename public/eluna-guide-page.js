/* Renders the "Como usar" guide into #elunaGuide and keeps it in sync with <html lang>.
   Needs eluna-ui.js and the app's guide-content.js (window.ElunaGuideContent, optional window.ElunaGuideDemo).
   #elunaGuide attributes: data-panel-href (default "/"), data-locale-param (e.g. "locale"). */
(function () {
  "use strict";
  function init() {
    var host = document.getElementById("elunaGuide");
    if (!host || !window.ElunaUI || !window.ElunaGuideContent) return;
    var last = "";
    function render() {
      var locale = window.ElunaUI.locale();
      if (locale === last) return;
      last = locale;
      window.ElunaUI.renderGuide(host, window.ElunaGuideContent, {
        locale: locale,
        panelHref: host.getAttribute("data-panel-href") || "/",
        localeParam: host.getAttribute("data-locale-param") || "",
        demo: window.ElunaGuideDemo,
        setTitle: host.getAttribute("data-set-title") !== "false"
      });
    }
    render();
    new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  }
  if (window.ElunaUI && document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
