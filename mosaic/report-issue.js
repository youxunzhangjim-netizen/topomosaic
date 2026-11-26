const link = document.querySelector('[data-issue-report]');
if (link) {
  // Do not copy query strings, puzzle progress, or private data into the draft.
  const page = location.origin + location.pathname;
  const body = "Project / 專案: TopoMosaic\n\nWhat happened? / 遇到什麼問題？\n\nSteps to reproduce / 重現步驟:\n1. \n2. \n\nExpected result / 預期結果:\n\nBrowser or device / 瀏覽器或裝置:\n" + '\nPage / 頁面: ' + page;
  link.href = 'mailto:youxunzhangjim@gmail.com?subject='
    + encodeURIComponent('[TopoMosaic] Problem report / 問題回報')
    + '&body=' + encodeURIComponent(body);
}
