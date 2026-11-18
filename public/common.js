(() => {
  const nav = document.getElementById("mainNav");
  const toggle = document.getElementById("menuToggle");
  if (nav && toggle) {
    toggle.addEventListener("click", () => nav.classList.toggle("nav-open"));
    nav.querySelectorAll("a").forEach(a => a.addEventListener("click", () => nav.classList.remove("nav-open")));
  }
  window.DIGITALCITY = {
    getReports() {
      try {
        const data = JSON.parse(localStorage.getItem("digitalcityReports") || "[]");
        return Array.isArray(data) ? data : [];
      } catch (e) { console.error(e); return []; }
    },
    saveReports(reports) { localStorage.setItem("digitalcityReports", JSON.stringify(reports)); },
    statusLabel(status) { return ({pending:"جديد",processing:"قيد المعالجة",solved:"تم الحل"})[status] || "جديد"; },
    escapeHTML(value) {
      return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
    }
  };
})();