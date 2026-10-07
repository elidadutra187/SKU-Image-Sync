(function () {
  "use strict";
  if (document.getElementById("elunalab-credit")) return;
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "/elunalab-footer.css";
  document.head.appendChild(stylesheet);
  const footer = document.createElement("footer");
  footer.id = "elunalab-credit";
  footer.className = "elunalab-credit";
  const link = document.createElement("a");
  link.href = "https://elunalab.onrender.com/";
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  const logo = document.createElement("img");
  logo.src = "/elunalab-logo.png";
  logo.alt = "";
  logo.width = 32;
  logo.height = 32;
  logo.loading = "lazy";
  const text = document.createElement("span");
  const credit = document.createTextNode("Criado pela ");
  text.append(credit);
  const name = document.createElement("strong");
  name.textContent = "ElunaLab";
  text.appendChild(name);
  link.append(logo, text);
  footer.appendChild(link);
  document.body.appendChild(footer);
  footer.setAttribute('data-no-translate', '');
  function localize() {
    const language=document.documentElement.lang;
    credit.textContent=language.startsWith('en')?'Created by ':language.startsWith('es')?'Creado por ':'Criado pela ';
    link.setAttribute('aria-label',language.startsWith('en')?'Created by ElunaLab. Open website in a new tab.':language.startsWith('es')?'Creado por ElunaLab. Abrir sitio en una nueva pestaña.':'Criado pela ElunaLab. Abrir site em uma nova aba.');
  }
  localize();
  new MutationObserver(localize).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
})();
