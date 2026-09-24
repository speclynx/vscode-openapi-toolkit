const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : globalThis;
const ui = globalThis.SwaggerUIBundle({
  dom_id: '#root',
  presets: [globalThis.SwaggerUIBundle.presets.apis],
});

globalThis.addEventListener('message', (event) => {
  const { data: message } = event;
  switch (message.command) {
    case 'preview': {
      ui.specActions.updateSpec(message.text);
    }
  }
});

vscode.postMessage({ command: 'init' });
