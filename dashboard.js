
document.addEventListener("DOMContentLoaded", () => {
  const $ = id => document.getElementById(id);

  const table = $("reportsTable");
  const empty = $("emptyMessage");
  const search = $("searchInput");
  const typeFilter = $("typeFilter");
  const statusFilter = $("statusFilter");

  let reports = [];

  function cell(value) {
    const td = document.createElement("td");
    td.textContent = value ?? "";
    return td;
  }

  async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      }
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.message || "حدث خطأ في الاتصال بالخادم.");
    }

    return result;
  }

  function updateStats() {
    const pending = reports.filter(r => r.status === "pending").length;
    const processing = reports.filter(r => r.status === "processing").length;
    const solved = reports.filter(r => r.status === "solved").length;

    $("dashTotal").textContent = reports.length;
    $("dashPending").textContent = pending;
    $("dashProcessing").textContent = processing;
    $("dashSolved").textContent = solved;

    $("completionRate").textContent =
      reports.length
        ? Math.round(solved / reports.length * 100) + "%"
        : "0%";

    const chart = $("statusChart");
    chart.replaceChildren();

    [
      ["جديد", pending, "pending"],
      ["قيد المعالجة", processing, "processing"],
      ["تم الحل", solved, "solved"]
    ].forEach(([label, count, cls]) => {
      const wrap = document.createElement("div");
      wrap.className = "chart-row";

      const head = document.createElement("div");
      head.className = "chart-label";

      const name = document.createElement("span");
      name.textContent = label;

      const num = document.createElement("b");
      num.textContent = count;

      head.append(name, num);

      const track = document.createElement("div");
      track.className = "chart-track";

      const bar = document.createElement("div");
      bar.className = "chart-bar " + cls;
      bar.style.width =
        (count / Math.max(reports.length, 1) * 100) + "%";

      track.appendChild(bar);
      wrap.append(head, track);
      chart.appendChild(wrap);
    });
  }

  function render() {
    updateStats();

    const term = search.value.trim().toLocaleLowerCase("ar");

    const shown = reports.filter(r =>
      [r.id, r.type, r.area, r.description]
        .join(" ")
        .toLocaleLowerCase("ar")
        .includes(term) &&
      (!typeFilter.value || r.type === typeFilter.value) &&
      (!statusFilter.value || r.status === statusFilter.value)
    );

    table.replaceChildren();

    $("reportCount").textContent =
      `عرض ${shown.length} من ${reports.length} بلاغ`;

    empty.style.display = shown.length ? "none" : "block";

    empty.querySelector("h3").textContent =
      reports.length ? "لا توجد نتائج مطابقة" : "لا توجد بلاغات حتى الآن";

    empty.querySelector("p").textContent =
      reports.length
        ? "جرّب تغيير كلمات البحث أو الفلاتر."
        : "عند تقديم بلاغ جديد سيظهر هنا.";

    shown.forEach(r => {
      const tr = document.createElement("tr");

      const date = r.createdAt
        ? new Date(r.createdAt).toLocaleString("ar-EG")
        : "—";

      tr.append(
        cell(String(r.id).slice(0, 8)),
        cell(r.type),
        cell(r.area),
        cell(date)
      );

      // صورة البلاغ
      const photo = document.createElement("td");

      if (
        typeof r.image === "string" &&
        r.image.startsWith("data:image/")
      ) {
        const img = document.createElement("img");
        img.src = r.image;
        img.alt = "صورة البلاغ";
        img.className = "table-thumb";
        photo.appendChild(img);
      } else {
        photo.textContent = "—";
      }

      tr.appendChild(photo);

      // حالة البلاغ
      const statusTd = document.createElement("td");
      const select = document.createElement("select");

      select.className = "status-select";
      select.setAttribute("aria-label", "تغيير حالة البلاغ");

      [
        ["pending", "جديد"],
        ["processing", "قيد المعالجة"],
        ["solved", "تم الحل"]
      ].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        select.appendChild(option);
      });

      select.value = r.status;
      select.addEventListener("change", async () => {
        const newStatus = select.value;
        select.disabled = true;

        try {
          await apiRequest(`/api/reports/${r.id}`, {
            method: "PATCH",
            body: JSON.stringify({ status: newStatus })
          });

          r.status = newStatus;
          render();

        } catch (error) {
          alert(error.message);
          select.value = r.status;
          select.disabled = false;
        }
      });

      statusTd.appendChild(select);
      tr.appendChild(statusTd);

      // التفاصيل
      const detailTd = document.createElement("td");
      const link = document.createElement("a");

      link.className = "table-link";
      link.href = "details.html?id=" + encodeURIComponent(r.id);
      link.textContent = "عرض التفاصيل";

      detailTd.appendChild(link);
      tr.appendChild(detailTd);

      // حذف البلاغ
      const actionTd = document.createElement("td");
      const del = document.createElement("button");

      del.className = "delete-btn";
      del.textContent = "حذف";

      del.addEventListener("click", async () => {
        if (!confirm("هل تريد حذف هذا البلاغ؟")) return;

        del.disabled = true;

        try {
          await apiRequest(`/api/reports/${r.id}`, {
            method: "DELETE"
          });

          reports = reports.filter(x => x.id !== r.id);
          render();

        } catch (error) {
          alert(error.message);
          del.disabled = false;
        }
      });

      actionTd.appendChild(del);
      tr.appendChild(actionTd);

      table.appendChild(tr);
    });
  }

  async function loadReports() {
    const refresh = $("refreshBtn");
    refresh.disabled = true;

    try {
      reports = await apiRequest("/api/reports");
      render();

    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
      refresh.disabled = false;
    }
  }

  search.addEventListener("input", render);
  typeFilter.addEventListener("change", render);
  statusFilter.addEventListener("change", render);

  $("resetFilters").addEventListener("click", () => {
    search.value = "";
    typeFilter.value = "";
    statusFilter.value = "";
    render();
  });

  $("refreshBtn").addEventListener("click", loadReports);

  loadReports();
});
