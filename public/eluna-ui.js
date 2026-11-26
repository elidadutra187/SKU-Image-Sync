/* ElunaLab shared UI: "Como usar" guide renderer, help "?" icons and globe language control.
   Same file in every app. App-specific text lives in each app's guide-content.js. */
(function () {
  "use strict";
  var SUPPORT_URL = "https://elunalab.com.br/suporte";
  var GLOBE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
  var LABELS = {
    pt: { lang: "Idioma", help: "Ajuda: ", support: "Suporte", stepWord: "Passo", tipWord: "Dica", go: "Fazer isso no painel", toc: "Nesta página", glossary: "Palavras que aparecem no painel", steps: "Passo a passo", features: "O que cada função faz", faq: "Dúvidas comuns", helpTitle: "Ainda com dúvida?", helpText: "Fale com a gente pela página de suporte da ElunaLab. Respondemos o mais rápido possível.", helpButton: "Ir para o suporte", open: "Abrir o painel", eyebrow: "Como usar" },
    es: { lang: "Idioma", help: "Ayuda: ", support: "Soporte", stepWord: "Paso", tipWord: "Consejo", go: "Hacerlo en el panel", toc: "En esta página", glossary: "Palabras que aparecen en el panel", steps: "Paso a paso", features: "Qué hace cada función", faq: "Preguntas frecuentes", helpTitle: "¿Todavía tienes dudas?", helpText: "Escríbenos desde la página de soporte de ElunaLab. Respondemos lo antes posible.", helpButton: "Ir al soporte", open: "Abrir el panel", eyebrow: "Cómo usar" },
    en: { lang: "Language", help: "Help: ", support: "Support", stepWord: "Step", tipWord: "Tip", go: "Do this in the panel", toc: "On this page", glossary: "Words you will see in the panel", steps: "Step by step", features: "What each feature does", faq: "Common questions", helpTitle: "Still have questions?", helpText: "Reach us through the ElunaLab support page. We reply as soon as possible.", helpButton: "Go to support", open: "Open the panel", eyebrow: "How to use" }
  };
  function setText(n, v) { if (n.textContent !== v) n.textContent = v; }
  function setAttr(n, k, v) { if (n.getAttribute(k) !== v) n.setAttribute(k, v); }
  function lang(locale) { var l = String(locale || "pt").slice(0, 2).toLowerCase(); return LABELS[l] ? l : "pt"; }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined && text !== null) n.textContent = text; return n; }
  function link(cls, text, href, external) {
    var a = el("a", cls, text); a.href = href;
    if (external) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
    return a;
  }
  function withLocale(href, locale, param) {
    if (!href || /^https?:/i.test(href) || !param) return href;
    var hash = "", i = href.indexOf("#");
    if (i >= 0) { hash = href.slice(i); href = href.slice(0, i); }
    return href + (href.indexOf("?") >= 0 ? "&" : "?") + param + "=" + encodeURIComponent(locale) + hash;
  }

  /* Render the guide. content = { pt:{...}, es:{...}, en:{...} } ; options = { locale, panelHref, localeParam, demo(container, locale) } */
  function renderGuide(container, content, options) {
    options = options || {};
    var l = lang(options.locale), g = content[l] || content.pt, L = LABELS[l];
    var panelHref = withLocale(options.panelHref || "/", l, options.localeParam);
    container.replaceChildren();
    var root = el("div", "eluna-guide"); container.appendChild(root);
    if (g.pageTitle && options.setTitle !== false) document.title = g.pageTitle;

    var hero = el("div", "eluna-guide-hero");
    hero.appendChild(el("span", "eluna-guide-eyebrow", L.eyebrow));
    hero.appendChild(el("h1", "", g.title));
    hero.appendChild(el("p", "", g.intro));
    var actions = el("div", "eluna-guide-actions");
    actions.appendChild(link("eluna-btn", g.openLabel || L.open, panelHref));
    actions.appendChild(link("eluna-btn is-secondary", L.support, SUPPORT_URL, true));
    hero.appendChild(actions); root.appendChild(hero);

    var toc = el("ul", "eluna-guide-toc"); toc.setAttribute("aria-label", L.toc);
    function tocItem(id, text) { var li = el("li"); li.appendChild(link("", text, "#" + id)); toc.appendChild(li); }
    if (g.glossary && g.glossary.length) tocItem("vocabulario", L.glossary);
    tocItem("passo-a-passo", L.steps);
    if (g.features && g.features.length) tocItem("funcoes", L.features);
    if (g.faq && g.faq.length) tocItem("duvidas", L.faq);
    root.appendChild(toc);

    if (g.demo || options.demo) {
      var demo = el("section", "eluna-guide-demo"); demo.id = "exemplo";
      if (g.demo && g.demo.title) demo.appendChild(el("h3", "", g.demo.title));
      if (g.demo && g.demo.help) demo.appendChild(el("p", "eluna-guide-help", g.demo.help));
      if (typeof options.demo === "function") options.demo(demo, l);
      else if (g.demo && g.demo.image) { var im = el("img", "eluna-guide-shot"); im.src = g.demo.image; im.alt = g.demo.alt || g.demo.title || ""; im.loading = "lazy"; demo.appendChild(im); }
      root.appendChild(demo);
    }

    if (g.glossary && g.glossary.length) {
      var gl = el("section"); gl.id = "vocabulario"; gl.appendChild(el("h3", "", g.glossaryTitle || L.glossary));
      var terms = el("div", "eluna-guide-terms");
      g.glossary.forEach(function (t) { var c = el("div", "eluna-guide-term"); c.appendChild(el("strong", "", t[0])); c.appendChild(el("p", "", t[1])); terms.appendChild(c); });
      gl.appendChild(terms); root.appendChild(gl);
    }

    var stepsSec = el("section"); stepsSec.id = "passo-a-passo"; stepsSec.appendChild(el("h3", "", L.steps));
    var ol = el("ol", "eluna-guide-steps");
    g.steps.forEach(function (s, i) {
      var li = el("li", "eluna-guide-step"); li.id = "passo-" + (i + 1);
      li.appendChild(el("span", "eluna-guide-num", String(i + 1)));
      var box = el("div", "eluna-guide-step-body");
      box.appendChild(el("h3", "", L.stepWord + " " + (i + 1) + " · " + s.title));
      box.appendChild(el("p", "", s.text));
      if (s.list && s.list.length) { var ul = el("ul", "eluna-guide-list"); s.list.forEach(function (x) { ul.appendChild(el("li", "", x)); }); box.appendChild(ul); }
      if (s.image) { var img = el("img", "eluna-guide-shot"); img.src = s.image; img.alt = s.imageAlt || s.title; img.loading = "lazy"; box.appendChild(img); }
      if (s.tip) { var tip = el("p", "eluna-guide-tip"); tip.appendChild(el("strong", "", L.tipWord + ": ")); tip.appendChild(document.createTextNode(s.tip)); box.appendChild(tip); }
      if (s.go !== false) box.appendChild(link("eluna-guide-go", (s.goLabel || g.goLabel || L.go) + " →", withLocale(s.go || options.panelHref || "/", l, options.localeParam)));
      li.appendChild(box); ol.appendChild(li);
    });
    stepsSec.appendChild(ol); root.appendChild(stepsSec);

    if (g.features && g.features.length) {
      var fs = el("section"); fs.id = "funcoes"; fs.appendChild(el("h3", "", g.featuresTitle || L.features));
      var grid = el("div", "eluna-guide-features");
      g.features.forEach(function (f) { var c = el("div", "eluna-guide-feature"); c.appendChild(el("strong", "", f[0])); c.appendChild(el("p", "", f[1])); grid.appendChild(c); });
      fs.appendChild(grid); root.appendChild(fs);
    }

    if (g.faq && g.faq.length) {
      var fq = el("section"); fq.id = "duvidas"; fq.appendChild(el("h3", "", L.faq));
      g.faq.forEach(function (q) { var d = el("details", "eluna-guide-q"); d.appendChild(el("summary", "", q[0])); d.appendChild(el("p", "", q[1])); fq.appendChild(d); });
      root.appendChild(fq);
    }

    var help = el("section", "eluna-guide-support"); help.id = "suporte";
    help.appendChild(el("h3", "", L.helpTitle)); help.appendChild(el("p", "", L.helpText));
    help.appendChild(link("eluna-btn", L.helpButton, SUPPORT_URL, true));
    root.appendChild(help);

    if (location.hash) { var target = document.getElementById(location.hash.slice(1)); if (target && target.scrollIntoView) target.scrollIntoView({ block: "start" }); }
    return root;
  }

  /* Add "?" links next to every [data-guide-step] element. options = { href:"/how-to-use", locale, localeParam } */
  function helpIcons(options) {
    options = options || {};
    var l = lang(options.locale), L = LABELS[l], base = options.href || "/how-to-use";
    document.querySelectorAll("[data-guide-step]").forEach(function (host) {
      var step = host.getAttribute("data-guide-step");
      var a = host.querySelector(":scope > .eluna-help");
      if (!a) { a = el("a", "eluna-help", "?"); host.appendChild(a); }
      setAttr(a, "href", withLocale(base, l, options.localeParam) + "#passo-" + step);
      setAttr(a, "target", "_blank"); setAttr(a, "rel", "noopener");
      var label = L.help + L.stepWord.toLowerCase() + " " + step;
      setAttr(a, "aria-label", label); setAttr(a, "title", label);
    });
  }

  /* Wrap a language <select> (or a .locale-switcher of [data-locale] buttons) in a globe pill. */
  function globe(target) {
    var host = typeof target === "string" ? document.querySelector(target) : target;
    if (!host || host.closest(".eluna-lang")) return;
    var wrap = el("span", "eluna-lang"); wrap.innerHTML = GLOBE;
    host.parentNode.insertBefore(wrap, host);
    if (host.tagName === "SELECT") { wrap.appendChild(host); return host; }
    var buttons = Array.prototype.slice.call(host.querySelectorAll("[data-locale]"));
    var select = el("select"); select.setAttribute("aria-label", LABELS[lang(document.documentElement.lang)].lang);
    var names = { pt: "Português", es: "Español", en: "English" };
    buttons.forEach(function (b) { var o = el("option", "", names[b.dataset.locale] || b.dataset.locale); o.value = b.dataset.locale; select.appendChild(o); });
    function sync() { var active = buttons.filter(function (b) { return b.classList.contains("is-active") || b.getAttribute("aria-pressed") === "true"; })[0]; if (active && select.value !== active.dataset.locale) select.value = active.dataset.locale; setAttr(select, "aria-label", LABELS[lang(document.documentElement.lang)].lang); }
    select.addEventListener("change", function () { var b = buttons.filter(function (x) { return x.dataset.locale === select.value; })[0]; if (b) b.click(); sync(); });
    wrap.appendChild(select); wrap.appendChild(host);
    new MutationObserver(sync).observe(host, { subtree: true, attributes: true, attributeFilter: ["class", "aria-pressed"] });
    sync();
    return select;
  }

  /* Connection pill at the right of the topbar.
     <button data-eluna-connection data-connected-when="#disconnectButton" data-connect="#connectButton">
     Connected when the data-connected-when element exists and is not hidden (or has data-connected-text-match in its text).
     When not connected, a click triggers the app's own connect control (or follows href). */
  var CONN = { pt: ["Loja conectada", "Conectar loja"], es: ["Tienda conectada", "Conectar tienda"], en: ["Store connected", "Connect store"] };
  function connection(btn) {
    function isVisible(n) { return !!n && !n.hidden && !n.closest("[hidden]") && getComputedStyle(n).display !== "none"; }
    function update() {
      var src = document.querySelector(btn.getAttribute("data-connected-when"));
      var on = isVisible(src);
      var match = btn.getAttribute("data-connected-text-match");
      if (match && src) on = new RegExp(match, "i").test(src.textContent || "");
      var t = CONN[currentLocale()];
      if (btn.classList.contains("eluna-status") !== on) btn.classList.toggle("eluna-status", on);
      if (btn.classList.contains("eluna-connect") === on) btn.classList.toggle("eluna-connect", !on);
      setText(btn, on ? t[0] : t[1]);
      setAttr(btn, "aria-pressed", on ? "true" : "false");
      setAttr(btn, "data-connected", on ? "true" : "false");
    }
    if (!btn.dataset.elunaWired) {
      btn.dataset.elunaWired = "1";
      btn.addEventListener("click", function (e) {
        if (btn.dataset.connected === "true") { var card = document.querySelector(btn.getAttribute("data-card") || ""); if (card && card.scrollIntoView) { e.preventDefault(); card.scrollIntoView({ block: "center", behavior: "smooth" }); } return; }
        var target = document.querySelector(btn.getAttribute("data-connect") || "");
        if (target) { e.preventDefault(); if (isVisible(target)) target.click(); else if (target.scrollIntoView) target.scrollIntoView({ block: "center", behavior: "smooth" }); }
      });
      var src = document.querySelector(btn.getAttribute("data-connected-when"));
      if (src) new MutationObserver(update).observe(src, { attributes: true, childList: true, characterData: true, subtree: true });
      var root = src && src.parentNode; if (root) new MutationObserver(update).observe(root, { attributes: true, attributeFilter: ["hidden", "class", "style"] });
    }
    update();
  }

  /* Auto wiring from markup, re-run whenever <html lang> changes:
     [data-eluna-support]  -> central support link (new tab, localized text)
     [data-eluna-lang]     -> globe pill around a language <select> or [data-locale] buttons
     [data-guide-step]     -> "?" link to the guide step (body[data-guide-href], body[data-guide-locale-param]) */
  function currentLocale() { return lang(document.documentElement.lang); }
  function wire() {
    var l = currentLocale(), L = LABELS[l], body = document.body;
    document.querySelectorAll("[data-eluna-support]").forEach(function (a) {
      setAttr(a, "href", SUPPORT_URL); setAttr(a, "target", "_blank"); setAttr(a, "rel", "noopener noreferrer");
      if (!a.hasAttribute("data-keep-text")) setText(a, L.support);
    });
    document.querySelectorAll("[data-eluna-lang]").forEach(function (n) { globe(n); });
    document.querySelectorAll("[data-eluna-connection]").forEach(connection);
    if (body && document.querySelector("[data-guide-step]")) helpIcons({ locale: l, href: body.getAttribute("data-guide-href") || "/how-to-use", localeParam: body.getAttribute("data-guide-locale-param") || "" });
  }
  function start() {
    var last = document.documentElement.lang;
    wire();
    /* Some apps re-set <html lang> on every DOM change: only rewire when the value really changes. */
    new MutationObserver(function () { var now = document.documentElement.lang; if (now === last) return; last = now; wire(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  }
  /* Start after every deferred/module script ran (apps build language controls in them). */
  var started = false;
  function startOnce() { if (started) return; started = true; start(); }
  if (document.readyState === "complete") startOnce();
  else { document.addEventListener("DOMContentLoaded", startOnce); window.addEventListener("load", startOnce); }

  window.ElunaUI = { SUPPORT_URL: SUPPORT_URL, renderGuide: renderGuide, helpIcons: helpIcons, globe: globe, labels: LABELS, wire: wire, locale: currentLocale };
})();
