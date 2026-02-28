<div>
  <a href="https://speclynx.com">
    <img width="739" height="103" alt="SpecLynx OpenAPI Toolkit" src="https://raw.githubusercontent.com/speclynx/vscode-openapi-toolkit/main/assets/openapi-toolkit.png" />
  </a>
  <br><br>
  <p>
    Stop wrestling with OpenAPI specs — SpecLynx OpenAPI Toolkit delivers an effective way to author and manage API specs, bringing ease, accuracy, and power directly to your VS Code workflow.
  </p>
</div>

<br>

# OpenAPI Toolkit for VS Code

[![Marketplace](https://img.shields.io/visual-studio-marketplace/v/SpecLynx.vscode-openapi-toolkit?label=Marketplace)](https://marketplace.visualstudio.com/items?itemName=SpecLynx.vscode-openapi-toolkit)
[![Open VSX](https://img.shields.io/open-vsx/v/SpecLynx/vscode-openapi-toolkit?label=Open%20VSX)](https://open-vsx.org/extension/SpecLynx/vscode-openapi-toolkit)
[![Open VSX installs](https://img.shields.io/open-vsx/dt/SpecLynx/vscode-openapi-toolkit?label=Open%20VSX%20installs)](https://open-vsx.org/extension/SpecLynx/vscode-openapi-toolkit)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

📖 **Documentation:** [speclynx.com/openapi-toolkit](https://speclynx.com/openapi-toolkit/)  
🛍️ **Install:** [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=SpecLynx.vscode-openapi-toolkit) · [Open VSX](https://open-vsx.org/extension/SpecLynx/vscode-openapi-toolkit) (for VS Code–compatible editors like VSCodium/Cursor)  
🚀 **Releases:** [GitHub releases](https://github.com/speclynx/vscode-openapi-toolkit/releases)  
🧾 **Changelog:** [VS Code Marketplace changelog](https://marketplace.visualstudio.com/items/SpecLynx.vscode-openapi-toolkit/changelog)

---

## What it does

SpecLynx OpenAPI Toolkit adds semantic editing, validation/linting, preview, and utility commands for OpenAPI in VS Code — on desktop and on the web ([vscode.dev](https://vscode.dev) / [github.dev](https://github.dev) / [Codespaces](https://github.com/features/codespaces)).

---

## Requirements

- VS Code **1.75.0+**
- Node.js **16.14.2+** (VS Code desktop only)

---

## Preview

[![OpenAPI preview inside VS Code](https://speclynx.com/assets/images/openapi-toolkit/main-screenshot.png)](https://speclynx.com/openapi-toolkit/)

---

## Quick start

Works with OpenAPI specs in YAML (`.yaml`, `.yml`) and JSON (`.json`).

1. Install the extension from the VS Code Marketplace (or Open VSX).
2. Open an OpenAPI file.
3. Open the Command Palette (`Ctrl+Shift+P`) and run:
   - **OpenAPI Toolkit: Show API Document Preview**
   - **OpenAPI Toolkit: Format Document**
   - **OpenAPI Toolkit: Convert to YAML** / **OpenAPI Toolkit: Convert to JSON**

Choose the preview renderer in settings (Scalar or Swagger UI). See the documentation for configuration details: [speclynx.com/openapi-toolkit](https://speclynx.com/openapi-toolkit/).

---

## Features

### Editor
- **Hover documentation** for OpenAPI keywords and schema elements (incl. `$ref` targets)
- **Semantic autocompletion** with inline docs and context-aware suggestions
- **`$ref` support**: completion + preview + navigation across files
- **Navigation & outline**: Go to Definition / Find References + Document Symbols

### Preview
- **Live API docs preview** inside VS Code
- Renderers: **Scalar API Reference** (default) or **Swagger UI**
- Interactive experience (auth, server selection, try-it / execute requests where supported)

### Formatting & conversion
- **Format Document** for OpenAPI YAML/JSON (respects VS Code formatting settings)
- **Convert JSON ↔ YAML** (creates a new file with the target extension)

### Validation & linting
- **OpenAPI validation** with editor diagnostics
- Modes (can be combined):
  - **JSON Schema validation**
  - **Spectral** validation/linting (custom rulesets)
  - **Semantic validation** (deep checks beyond schema)
  - **Semantic linting** (custom rules targeting semantic elements / JSONPath)

### Rulesets
- Configure **Spectral rulesets** via workspace files or settings
- Configure **SpecLynx semantic rules** via workspace files or settings
- Optional command to select a ruleset file (see docs)

---

## Supported OpenAPI versions

This extension supports the following OpenAPI versions:
- [**OpenAPI 3.1**](https://spec.openapis.org/oas/v3.1.2.html)
- [**OpenAPI 3.0**](https://spec.openapis.org/oas/v3.0.4.html)
- [**OpenAPI 2.0**](https://spec.openapis.org/oas/v2.0.html)

---

## Documentation

Complete documentation (configuration, settings, commands, rulesets, troubleshooting, and examples) is available at
[speclynx.com/openapi-toolkit](https://speclynx.com/openapi-toolkit/).

---

## Privacy

This extension does **not** collect telemetry.

---

## Support / feedback

Report bugs or request features on [GitHub Issues](https://github.com/speclynx/vscode-openapi-toolkit/issues).

---

## License

Licensed under the **Apache License 2.0**. See [LICENSE](LICENSE).
