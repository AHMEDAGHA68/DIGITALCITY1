document.addEventListener("DOMContentLoaded", () => {
  const reports = window.DIGITALCITY.getReports();
  document.getElementById("total").textContent = reports.length;
  document.getElementById("pending").textContent = reports.filter(r => r.status !== "solved").length;
  document.getElementById("solved").textContent = reports.filter(r => r.status === "solved").length;
});