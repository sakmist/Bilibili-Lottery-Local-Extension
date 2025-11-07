const ENTRY_PAGE = 'index.html';

chrome.runtime.onInstalled.addListener(() => {
  console.log('Bilibili Lottery Local extension installed');
});

function logIfError(action) {
  return () => {
    if (chrome.runtime.lastError) {
      console.error(`Failed to ${action}:`, chrome.runtime.lastError);
    }
  };
}

function openOrFocusAppTab() {
  const targetUrl = chrome.runtime.getURL(ENTRY_PAGE);

  chrome.tabs.query({ url: targetUrl }, (tabs) => {
    if (chrome.runtime.lastError) {
      console.error('Failed to query existing tabs:', chrome.runtime.lastError);
      chrome.tabs.create({ url: targetUrl }, logIfError('create tab'));
      return;
    }

    const existingTab = Array.isArray(tabs) ? tabs[0] : null;
    if (existingTab) {
      chrome.tabs.update(existingTab.id, { active: true }, logIfError('activate tab'));
      chrome.windows.update(existingTab.windowId, { focused: true }, logIfError('focus window'));
      return;
    }

    chrome.tabs.create({ url: targetUrl }, logIfError('create tab'));
  });
}

chrome.action.onClicked.addListener(() => {
  openOrFocusAppTab();
});
