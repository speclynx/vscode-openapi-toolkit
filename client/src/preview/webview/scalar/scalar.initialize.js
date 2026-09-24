const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : globalThis;
let scalarInstance;

// Mount with the first document. Mounting an empty reference lets upstream's
// temporary default configuration start optional agent/font requests before the
// document-specific privacy settings become active.
globalThis.addEventListener('message', (event) => {
  const { data: message } = event;
  if (message.command !== 'preview') return;
  const configuration = {
    content: message.text,
    agent: { disabled: true },
    telemetry: false,
    withDefaultFonts: false,
    hideModels: false,
    hideDownloadButton: true,
    showSidebar: true,
    baseServerURL: 'https://speclynx.com',
    proxyUrl: 'https://proxy.scalar.com',
  };
  try {
    if (scalarInstance) scalarInstance.updateConfiguration(configuration);
    else scalarInstance = globalThis.Scalar.createApiReference('#root', configuration);
  } catch (error) {
    console.error('Scalar preview update failed:', error);
  }
});

vscode.postMessage({ command: 'init' });
