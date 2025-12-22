<div>
  <a href="https://speclynx.com"><img width="739" height="103" alt="image" src="https://github.com/user-attachments/assets/87c88ea9-5746-497a-8c33-43fa55b72b0b" /></a>
  <br><br>
  <p>
    Stop wrestling with OpenAPI specs — SpecLynx OpenAPI Toolkit delivers the most effective way to author and manage your API specs, bringing unprecedented ease, pinpoint accuracy, and unmatched power directly to your VSCode workflow.  
  </p>
</div>  

<br>

[![SpecLynx OpenAPI Toolkit](https://speclynx.com/assets/images/speclynx-openapi-toolkit.png)](https://speclynx.com)

## Why Choose SpecLynx OpenAPI Toolkit?

SpecLynx OpenAPI Toolkit is engineered for clarity, control, and confidence, enabling you to focus on designing exceptional APIs.

### OpenAPI Authoring

Get full YAML/JSON autocompletion, inline documentation hints, validation, linting, and live preview as you type — so you catch errors before they cost you time. OpenAPI Toolkit surfaces context-aware suggestions for paths, parameters, responses, components, ...; flags missing or mismatched fields instantly; and renders a side-by-side spec-to-UI preview that updates with every keystroke. Say goodbye to manual spec checks and hello to a fluid authoring experience that keeps your API specs accurate and up-to-date.

### One-Click Tooling

- Powered by a powerful [Language Server](https://microsoft.github.io/language-server-protocol/)
- JSON Schema Validation
- Semantic Validation & Linting
- Spectral Validation & Linting
- OpenAPI Description dereferencing
- JSON <-> YAML Conversion
- Workspace-Wide Operations

All these commands — and more — are just a keystroke away in VS Code, so you can focus on designing great APIs instead of wrestling with tooling.

### Built by Veterans

SpecLynx OpenAPI Toolkit is crafted by industry veterans, [Vladimír Gorej](https://vladimirgorej.com) and [Francesco Tumanischvili](https://github.com/frantuma), who bring over **15 years of dedicated experience maintaining and evolving Swagger/OpenAPI tools**. Their unparalleled expertise ensures you receive a solution with battle-tested reliability and best practices meticulously baked into every feature.

## What is it?

OpenAPI Toolkit provides advanced editing, processing, rendering, and execution capabilities for Swagger/OpenAPI files (2.0, 3.0, 3.1). These include an editor experience — offering validation/linting, completion, documentation, syntax highlighting, reference navigation, and more — along with a preview panel (based on Swagger UI) for rendering the OpenAPI document and allowing interaction and execution.

Several capabilities are unique in the VS Code OpenAPI ecosystem, such as Spectral support in the web, custom semantic linting, in-context documentation (including in completion items), full JSON/YAML parity, and rich reference handling.

We are actively expanding the feature set and fixing bugs; this documentation will be updated accordingly.&#x20;

## Capabilities

### Editor

#### Foreword

**JSON and YAML** — OpenAPI Toolkit provides the same level of support for OpenAPI specs written in JSON or YAML format. It also aims to provide editor capabilities even for not-well-formed documents (for example, offering completion and syntax highlighting where possible).

OpenAPI Toolkit supports following OpenAPI versions with a consistent feature set:

- [OpenAPI 2.0 (Swagger)](https://spec.openapis.org/oas/v2.0.html)
- [OpenAPI 3.0.x](https://spec.openapis.org/oas/v3.0.4.html)
- [OpenAPI 3.1.x](https://spec.openapis.org/oas/v3.1.1.html)

###### OpenAPI 2.0 (Swagger)

![OpenAPI (Swagger) 2.0 support](https://github.com/user-attachments/assets/c1d7d002-97e8-48cc-a64d-30e4c8987655)

###### OpenAPI 3.0.x

![OpenAPI 3.0.x support](https://github.com/user-attachments/assets/cfcc92af-648b-41d4-bddf-e74fdd493645)

###### OpenAPI 3.1.x

![OpenAPI 3.1.x support](https://github.com/user-attachments/assets/0e0e7017-e4f9-40e7-b7ad-303b8934d582)

**Web support** — OpenAPI Toolkit is designed to run both on Desktop and in Web environments such as [vscode.dev](https://vscode.dev/), [github.dev](https://github.dev/), and [GitHub Codespaces](https://github.com/features/codespaces). It is one of the few extensions that deliver advanced OpenAPI editing and validation/linting in the web environment.&#x20;

#### In-context OpenAPI Documentation (hover)

When you hover over a keyword (node key) in the document, the extension shows full, context-aware documentation in a hover panel that corresponds to the selected construct and matches the official specification.

![In-context OpenAPI Documentation ](https://github.com/user-attachments/assets/7aaf568d-9a2f-4d4f-bb63-9d38db654579)

The same documentation is also shown in the details pane of completion items. See the “Completion / Suggestions” section below.&#x20;

#### Completion / Suggestions

OpenAPI Toolkit provides an enriched completion experience. Under the hood, completion is driven by a semantic understanding of the node where completion is triggered, making suggestions far more precise and useful than standard JSON-Schema-based completion.&#x20;

##### Completion documentation

Each completion item includes full documentation (the same content shown in hover).
**Tip:** If the documentation panel doesn’t appear to the right of the completion label, click the `>` icon that appears when you hover the completion entry.&#x20;

![Completion documentation](https://github.com/user-attachments/assets/1d90a38b-427a-4b23-a8f8-aeaa1aa2d448)

##### References completion

When completion is triggered within the value of a `$ref` field, the editor offers suggestions of compatible targets found in the document (this will be expanded to include documents across the workspace). It also displays the referenced content in the completion box, providing an in-context view of potential references without losing focus&#x20;

![References completion](https://github.com/user-attachments/assets/d293593c-332a-4183-abca-5cbf944176cb)

##### Context-aware completion (e.g., `type: integer` → `format`)

Suggestions adapt to related fields. For example, if a schema sets `type: integer`, the `format` suggestions include only compatible values.&#x20;

![Context-aware completion](https://github.com/user-attachments/assets/6ef34a33-f7b4-4341-9edb-e8641e626914)

#### References

##### Reference target content in hover

Hovering over the value of a `$ref` field displays the referenced content in the hover box, providing an in-context view of references without losing focus.&#x20;

![Preview reference target](https://github.com/user-attachments/assets/4882f6e3-7b13-4cd7-84ab-8ce2e3a4081c)


##### Go to definition (F3)

Right-click the value of a `$ref` field and choose **Go to Definition** (or press **F3**) to jump to the reference target—either within the current file or in another file in the workspace.&#x20;

![Go to definition](https://github.com/user-attachments/assets/a5c1610a-1c06-4c8d-8316-46f953755cd8)

##### Go to references

Right-click a key (for example, under `components.schemas`) and choose **Go to References** to open a panel listing available references to jump to.&#x20;

![Go to references](https://github.com/user-attachments/assets/2cb17ad2-cd43-4945-94a7-746c6397a82a)

##### Find all references

Right-click a key (for example, of a schema) and choose **Find All References** to open the References panel listing every usage of the selected target.&#x20;

![Find all references](https://github.com/user-attachments/assets/9b00b3b1-03f3-4252-b7b9-4a853f00783d)

##### Dereference command

Right-click inside an OpenAPI document or right-click the file in the Explorer, then choose **OpenAPI Toolkit → Dereference API Document** to save a dereferenced copy locally. The default output name is `{filename}-dereferenced.{extension}`.&#x20;

![Dereference command](https://github.com/user-attachments/assets/e7bc9c2b-95be-4508-8212-1f2dd99334c3)

#### Syntax Highlighting

OpenAPI Toolkit provides **semantic** syntax highlighting, going beyond basic keyword coloring. Specific OpenAPI elements—such as operations, schemas, and reference objects—are highlighted with distinct colors and font styles. This helps you quickly recognize and distinguish different parts of an API definition, improving readability and navigation in complex specifications.&#x20;

![Semantic Syntax Highlighting](https://github.com/user-attachments/assets/b67c64b5-771d-4eb1-81d3-359872e7607b)

#### Validation and Linting

##### Definitions

* **Validation** — Checks that the document conforms to the OpenAPI and JSON Schema specifications.
* **Linting** — Analyzes an OpenAPI document against a configurable ruleset. Unlike validation (which only checks spec conformance), linting enforces best practices, style guidelines, and quality standards. It can catch issues such as inconsistent naming, missing descriptions, or patterns that harm API usability—even when the document is technically valid.
* **Semantic validation** — Validates using rules that target semantic properties of elements (e.g., `operation`, `schema`) rather than only applying JSON Schema. This enables more precise checks and clearer diagnostics (including highlighting the exact key, value, or child node that’s wrong).
* **Semantic linting** — Lints using rules that can target semantic element types and/or JSONPath expressions. Compared to tools that only support JSONPath, this hybrid approach simplifies writing targeted rules (including for nested elements) and yields more precise editor markings.&#x20;

##### Validation/Linting modes

OpenAPI Toolkit supports three modes, which you can combine:

1. **JSON Schema validation** — Standard validation based on OpenAPI JSON Schemas
2. **Spectral validation and linting**
3. **Semantic validation and linting**&#x20;

![Validation/Linting modes](https://github.com/user-attachments/assets/36d55b1d-6cfa-41db-8656-1242e3e946c0)

##### Default configuration

By default, JSON Schema validation and **semantic linting** are enabled. You can change this in the extension settings. **Semantic validation** is currently disabled by default because it has not yet completed a full compliance test cycle; once complete, it is expected to become the default validation method.&#x20;

##### Spectral validation/linting

To enable Spectral-based checks:

1. Enable **Apply Spectral Validation** in the extension settings.
2. Provide a ruleset by either:
   **(a)** adding a `.spectral.json`, `.spectral.yaml`, or `.spectral.yml` at the root of your workspace, **or**
   **(b)** setting the Spectral ruleset file path in the extension settings, or via the command **OpenAPI Toolkit: Pick Spectral Validation/Linting Rules File** (available from the editor context menu or the Explorer).

Refer to the [Spectral documentation](https://docs.stoplight.io/docs/spectral/) for ruleset format details.&#x20;

###### Create a Spectral ruleset
![Create a Spectral ruleset](https://github.com/user-attachments/assets/1cb7691d-7fba-4b82-96b8-3a0344aa2ba4)

###### Use a Spectral ruleset
![Use a Spectral ruleset](https://github.com/user-attachments/assets/2bfd9175-a42b-43e2-96ad-1217b60bebcd)

##### Semantic validation

Enable **Apply Semantic Validation** in the extension settings. No rules file is required to run the built-in semantic validation checks.&#x20;

![Semantic Validation](https://github.com/user-attachments/assets/6245a7f4-71d2-46f9-a271-b031728ace4c)

##### Semantic linting

To run semantic linting:

1. Enable **Apply Semantic Linting** in the extension settings.
2. Provide a ruleset by either:
   **(a)** adding a rules file at the workspace root named `.speclynx.json`, `.speclynx.yaml`, `.speclynx.yml` (or without the leading dot), **or**
   **(b)** setting the semantic ruleset file path in the extension settings, or via the command **OpenAPI Toolkit: Pick Semantic Validation/Linting Rules File** (available from the editor context menu or the Explorer).&#x20;

##### Semantic linting rules (overview)

Semantic lint rules are defined in JSON or YAML. A ruleset typically includes:

* **Rule ID** and **description/message**
* **Severity** (e.g., error, warning, info)
* **Target selector**: a semantic **element type** (e.g., `operation`, `schema`, `parameter`, etc.) and/or a **JSONPath** for precise targeting
* **Condition(s)** to evaluate (e.g., required fields, naming patterns, min/max constraints)
* **Optional fixes** or suggestions (when applicable)

![Semantic linting rules](https://github.com/user-attachments/assets/a2f3e0d8-8178-43a6-b26c-f1678b3a7622)

A separate section provides the complete rule schema and examples. *(If you don’t see it yet, it will be added as the rules stabilize.)*&#x20;

##### Supported major element “types” for semantic checks

These are the current high-level element types recognized by the semantic engine.

| &nbsp;            | &nbsp;                  | &nbsp;                   |
|-------------------|-------------------------|--------------------------|
| `callback`        | `components`            | `contact`                |
| `content`         | `definitions`           | `discriminator`          |
| `encoding`        | `example`               | `external-documentation` |
| `header`          | `headers`               | `info`                   |
| `items`           | `license`               | `link`                   |
| `media-type`      | `oauth-flow`            | `oauth-flows`            |
| `openapi`         | `openapi3_0`            | `openapi3_1`             |
| `operation`       | `parameter`             | `parameters-definitions` |
| `path-item`       | `paths`                 | `path-template`          |
| `reference`       | `request-body`          | `response`               |
| `responses`       | `responses-definitions` | `schema`                 |
| `scopes`          | `security-definitions`  | `security-requirement`   |
| `security-scheme` | `server`                | `server-variable`        |
| `swagger`         | `tag`                   | `xml`                    |

### Formatting

SpecLynx OpenAPI Toolkit is capable of formatting your OpenAPI Documents, whether they are written
in JSON or YAML. Formatting preferences, like `tabSize` or whether to use tabs or spaces (`insertSpaces`)
are read directly from your VSCode settings.

![JSON/YAML Formatting](https://github.com/user-attachments/assets/06f21516-7380-4e47-ac77-31a515cd1885)


### JSON <-> YAML Conversion

Right-click inside an OpenAPI document or right-click the file in the Explorer, then choose **OpenAPI Toolkit → Convert to YAML / Convert to JSON** to convert the document from one format to the other and save locally. The default output name is `{filename}.{target-extension}`

![JSON <-> YAML Conversion](https://github.com/user-attachments/assets/50a11c4f-b0c1-4861-8e1f-589389524653)

### Preview

The Preview panel renders the current OpenAPI document and lets you interact with it.
Preview panel can be opened by opening the Command Palette (CTRL+Shift+P) and running the `OpenAPI Toolkit: Show API Document preview` command.

The extension supports multiple OpenAPI preview renderers. You can switch between them by setting `speclynx.openapi.preview.renderer` in your VS Code settings:

| Renderer    | Description | Default |
|-------------|-------------|---------|
| **scalar**  | [Scalar API Reference](https://github.com/scalar/scalar/tree/main/packages/api-reference#readme) | ✅ |
| **swagger-ui** | [Swagger UI](https://github.com/swagger-api/swagger-ui) |  |

> In VS Code, go to **File → Preferences → Settings**, then search for **@ext:SpecLynx.vscode-openapi-toolkit**.
>  
> This will display all settings provided by the extension.

###### Scalar API Reference
![Scalar API Reference Preview](https://github.com/user-attachments/assets/176f07bf-b54a-42d7-91c3-d3d745017e5e)

###### SwaggerUI
![SwaggerUI Preview](https://github.com/user-attachments/assets/67c4e9a9-9084-41ab-bbbe-a01bb50d3457)


Preview interactions include:

* **Live rendering** — Quickly verify how changes look without leaving the editor
* **Server selection & auth** — Choose servers and authorize requests where applicable
* **Try it out / Test request** — Execute operations directly from the preview to validate requests/responses during development

This helps you validate the specification from both a structural and a consumer point of view.&#x20;
