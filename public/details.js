document.addEventListener("DOMContentLoaded", () => {
  const box = document.getElementById("detailsContent");
  const id = new URLSearchParams(location.search).get("id");
  const report = window.DIGITALCITY.getReports().find(r => String(r.id) === id);
  if (!report) {
    box.innerHTML = '<div class="empty-state"><span>!</span><h2>لم يتم العثور على البلاغ</h2><p>قد يكون البلاغ محذوفًا أو الرابط غير صحيح.</p><a class="main-btn" href="dashboard.html">العودة إلى لوحة التحكم</a></div>';
    return;
  }
  const safe = window.DIGITALCITY.escapeHTML;
  const photo = typeof report.image === "string" && report.image.startsWith("data:image/")
    ? `<img class="details-image" src="${report.image}" alt="صورة البلاغ">` : '<div class="no-image">لا توجد صورة مرفقة</div>';
  box.innerHTML = `<div class="details-heading"><div><p class="tag">REPORT DETAILS</p><h1>تفاصيل البلاغ</h1><p class="muted">رقم البلاغ: ${safe(report.id)}</p></div><span class="status-pill ${safe(report.status)}">${safe(window.DIGITALCITY.statusLabel(report.status))}</span></div>
  <div class="details-grid"><div class="detail-item"><span>نوع المشكلة</span><strong>${safe(report.type)}</strong></div><div class="detail-item"><span>المنطقة أو الشارع</span><strong>${safe(report.area)}</strong></div><div class="detail-item"><span>تاريخ التسجيل</span><strong>${safe(report.date)}</strong></div><div class="detail-item"><span>الحالة</span><strong>${safe(window.DIGITALCITY.statusLabel(report.status))}</strong></div><div class="detail-item full"><span>وصف المشكلة</span><p>${safe(report.description).replace(/\n/g,"<br>")}</p></div><div class="detail-item full"><span>الصورة المرفقة</span>${photo}</div></div>
  <div class="details-actions"><a href="dashboard.html" class="main-btn">العودة إلى البلاغات</a></div>`;
});