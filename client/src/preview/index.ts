import * as vscode from 'vscode';
import { Utils as UriUtils } from 'vscode-uri';
import debounce from 'lodash.debounce';
import pkg from '../../../package.json';
import { dereference } from './dereference';

interface WebviewMessage {
  command: 'init';
}

type PreviewRenderer = 'scalar' | 'swagger-ui';

function getRendererSetting(): PreviewRenderer {
  const config = vscode.workspace.getConfiguration('speclynx.openapi.preview');
  return config.get<PreviewRenderer>('renderer', 'scalar');
}

class PreviewPanel {
  initP: Promise<undefined> | null = null;

  panel: vscode.WebviewPanel | null = null;

  output: vscode.OutputChannel;

  context: vscode.ExtensionContext;

  previewURI: string | null = null;

  closedBy: 'human' | 'active-text-editor' | null = null;

  currentRenderer: PreviewRenderer | null = null;

  constructor(context: vscode.ExtensionContext, output: vscode.OutputChannel) {
    this.context = context;
    this.output = output;
  }

  isOpen() {
    return this.panel !== null;
  }

  isClosed() {
    return !this.isOpen();
  }

  private getAssetUri(...pathSegments: string[]): vscode.Uri {
    return vscode.Uri.joinPath(
      this.context.extensionUri,
      'client',
      pkg.main.includes('/dist/') ? 'dist' : 'out',
      'preview',
      'webview',
      ...pathSegments,
    );
  }

  private getRendererTitle(renderer: PreviewRenderer): string {
    switch (renderer) {
      case 'scalar':
        return 'OpenAPI Toolkit Preview (Scalar)';
      case 'swagger-ui':
        return 'OpenAPI Toolkit Preview (SwaggerUI)';
      default:
        return 'OpenAPI Toolkit Preview';
    }
  }

  private getWebviewContent(renderer: PreviewRenderer): string {
    const cspSource = this.panel!.webview.cspSource;

    if (renderer === 'swagger-ui') {
      const swaggerUIJSAsset = this.panel!.webview.asWebviewUri(
        this.getAssetUri('swagger-ui', 'swagger-ui.js'),
      );
      const swaggerUIInitializeJSAsset = this.panel!.webview.asWebviewUri(
        this.getAssetUri('swagger-ui', 'swagger-ui.initialize.js'),
      );
      const swaggerUICSSAsset = this.panel!.webview.asWebviewUri(
        this.getAssetUri('swagger-ui', 'swagger-ui.css'),
      );
      const swaggerUIOverrideCSSAsset = this.panel!.webview.asWebviewUri(
        this.getAssetUri('swagger-ui', 'swagger-ui.override.css'),
      );

      return `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https: data:; script-src ${cspSource} 'unsafe-eval'; style-src ${cspSource}; connect-src self http: https: blob: data:;" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <link rel="stylesheet" href="${swaggerUICSSAsset.toString()}" />
            <link rel="stylesheet" href="${swaggerUIOverrideCSSAsset.toString()}" />
          </head>
          <body>
            <div id="root"></div>
            <script src="${swaggerUIJSAsset.toString()}"></script>
            <script src="${swaggerUIInitializeJSAsset.toString()}"></script>
          </body>
        </html>`;
    }

    // scalar renderer (default)
    // CSP Note: 'unsafe-inline' for style-src is required because Scalar uses inline styles internally.
    // 'unsafe-eval' for script-src is required for Scalar's Vue.js runtime.
    // These weaken security posture but are necessary for Scalar to function.
    // Nonces/hashes are not feasible since we don't control Scalar's internal style injection.
    const scalarJSAsset = this.panel!.webview.asWebviewUri(this.getAssetUri('scalar', 'scalar.js'));
    const scalarInitializeJSAsset = this.panel!.webview.asWebviewUri(
      this.getAssetUri('scalar', 'scalar.initialize.js'),
    );
    const scalarCSSAsset = this.panel!.webview.asWebviewUri(
      this.getAssetUri('scalar', 'scalar.css'),
    );
    const scalarOverrideCSSAsset = this.panel!.webview.asWebviewUri(
      this.getAssetUri('scalar', 'scalar.override.css'),
    );

    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
         <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https: data:; script-src ${cspSource} 'unsafe-eval' blob:; style-src ${cspSource} 'unsafe-inline'; connect-src self http: https: blob: data:; font-src ${cspSource} https: data:; frame-src ${cspSource} https: blob: data:; worker-src ${cspSource} blob:;" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <link rel="stylesheet" href="${scalarCSSAsset.toString()}" />
          <link rel="stylesheet" href="${scalarOverrideCSSAsset.toString()}" />
        </head>
        <body>
          <div id="root"></div>
          <script src="${scalarJSAsset.toString()}"></script>
          <script src="${scalarInitializeJSAsset.toString()}"></script>
        </body>
      </html>`;
  }

  open() {
    let disposable: vscode.Disposable;
    const renderer = getRendererSetting();
    this.currentRenderer = renderer;
    this.closedBy = null; // Reset so onDidDispose can detect manual close

    this.panel = vscode.window.createWebviewPanel(
      'openapiToolkit.previewPanel',
      this.getRendererTitle(renderer),
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    this.initP = new Promise((resolve) => {
      disposable = this.panel!.webview.onDidReceiveMessage(
        (message: WebviewMessage) => {
          switch (message.command) {
            case 'init': {
              resolve(undefined);
              this.initP = null;
            }
          }
        },
        undefined,
        this.context.subscriptions,
      );
      this.context.subscriptions.push(disposable);
    });

    disposable = this.panel.onDidDispose(
      () => {
        this.panel = null;
        this.previewURI = null;
        // closedBy is set by close()/reopen() before dispose, or defaults to 'human' for manual close
        this.closedBy ??= 'human';
        this.initP = null;
        this.currentRenderer = null;
        this.output.appendLine('Closing preview');
      },
      undefined,
      this.context.subscriptions,
    );
    this.context.subscriptions.push(disposable);

    this.panel.webview.html = this.getWebviewContent(renderer);

    this.output.appendLine(`Opening preview with ${renderer} renderer`);
  }

  async preview(document: vscode.TextDocument) {
    if (this.isOpen()) {
      await this.initP;

      let text: string;

      try {
        const dereferencedDocument = await dereference(document);
        text = JSON.stringify(dereferencedDocument);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error && error.stack ? `\n${error.stack}` : '';
        this.output.appendLine(
          `Error while dereferencing or serializing document; falling back to raw text: ${errorMessage}${errorStack}`,
        );
        text = document.getText();
      }

      this.previewURI = document.uri.toString();
      this.output.appendLine(`Updating preview with text from ${this.previewURI}.`);
      this.panel!.webview.postMessage({
        command: 'preview',
        text,
      });
    } else {
      this.output.appendLine('Skipping updating the preview as it is closed.');
    }
  }

  close() {
    this.closedBy = 'active-text-editor';
    this.panel!.dispose();
  }

  async reopen() {
    const savedPreviewURI = this.previewURI;
    this.output.appendLine('Reopening preview with new renderer');

    // Close without triggering auto-reopen logic
    // Set closedBy before dispose() since onDidDispose handler fires immediately
    this.closedBy = 'human';
    this.panel!.dispose();

    // Open with new renderer
    this.open();

    // Re-preview the document if we had one
    if (savedPreviewURI) {
      const document = vscode.workspace.textDocuments.find(
        (doc) => doc.uri.toString() === savedPreviewURI,
      );
      if (document) {
        await this.preview(document);
      }
    }
  }
}

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel('OpenAPI Toolkit');
  const allowedExtnames = ['.json', '.yaml', '.yml'];
  const previewPanel = new PreviewPanel(context, output);
  const previewDebounced = debounce(previewPanel.preview.bind(previewPanel), 1000);
  let disposable: vscode.Disposable;

  disposable = vscode.commands.registerTextEditorCommand(
    'openapiToolkit.preview',
    (textEditor: vscode.TextEditor) => {
      const { document } = textEditor;
      const extname = UriUtils.extname(document.uri);

      void (async () => {
        try {
          if (extname === '' || allowedExtnames.includes(extname)) {
            if (previewPanel.isClosed()) {
              previewPanel.open();
            }
            await previewPanel.preview(document);
          }
        } catch (error: unknown) {
          console.error('Failed to execute command:', error);
        }
      })();
    },
  );
  context.subscriptions.push(disposable);

  // tracking changes in a currently tracked document
  disposable = vscode.workspace.onDidChangeTextDocument((changeEvent) => {
    const { document } = changeEvent;
    const uri = document.uri.toString();

    if (previewPanel.isOpen() && previewPanel.previewURI === uri) {
      void previewDebounced(document);
    }
  });
  context.subscriptions.push(disposable);

  // set current active tab to tracking mode
  disposable = vscode.window.onDidChangeActiveTextEditor(async (changeEvent) => {
    if (typeof changeEvent === 'undefined') return;

    const { document } = changeEvent;
    const extname = UriUtils.extname(document.uri);

    if (extname === '' || allowedExtnames.includes(extname)) {
      // track documents without extensions or with all allowed extensions
      if (previewPanel.isClosed() && previewPanel.closedBy === 'active-text-editor') {
        previewPanel.open();
      }
      if (previewPanel.isOpen()) {
        await previewPanel.preview(document);
      }
    } else if (previewPanel.isOpen()) {
      // hide preview for files with unsupported extensions
      previewPanel.close();
    }
  });
  context.subscriptions.push(disposable);

  // reopen preview when renderer setting changes
  disposable = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('speclynx.openapi.preview.renderer')) {
      if (previewPanel.isOpen()) {
        const newRenderer = getRendererSetting();
        if (previewPanel.currentRenderer !== newRenderer) {
          void previewPanel.reopen();
        }
      }
    }
  });
  context.subscriptions.push(disposable);
}
