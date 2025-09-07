  <a href="https://speclynx.com"><img width="739" height="103" alt="image" src="https://github.com/user-attachments/assets/87c88ea9-5746-497a-8c33-43fa55b72b0b" /></a>
  <p>
    Stop wrestling with OpenAPI specs — SpecLynx OpenAPI Toolkit delivers the most effective way to author and manage your API specs, bringing unprecedented ease, pinpoint accuracy, and unmatched power directly to your VSCode workflow.  
  </p>
  <br>
  <h1>Launching Soon!</h2>
  <p>
  SpecLynx OpenAPI Toolkit will be available during August 2025! Join our <strong><a href="https://speclynx.com?ref=github-waitlist">waitlist</a></strong> to get early access to SpecLynx in August 2025.
  </p>
</div>  

<br>

[![SpecLynx OpenAPI Toolkit](https://speclynx.com/assets/images/speclynx-openapi-toolkit.png)](https://speclynx.com)

## Why Choose SpecLynx OpenAPI Toolkit?  

SpecLynx OpenAPI Toolkit is engineered for clarity, control, and confidence, enabling you to focus on designing exceptional APIs.

### OpenAPI Authoring

Get full YAML/JSON autocompletion, inline documentation hints, validation, linting, and live preview as you type — so you catch errors before they cost you time. OpenAPI Toolkit surfaces context-aware suggestions for paths, parameters, responses, components, ...; flags missing or mismatched fields instantly; and renders a side-by-side spec-to-UI preview that updates with every keystroke. Say goodbye to manual spec checks and hello to a fluid authoring experience that keeps your API specs accurate and up-to-date.

### One-Click Tooling

- Quick Starts & Conversions
- Reformat & Reorder
- Semantic Validation & Linting
- Breaking change detection
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

**JSON and YAML** — OpenAPI Toolkit provides the same level of support for OpenAPI specs written in JSON or YAML. It also aims to provide editor capabilities even for not-well-formed documents (for example, offering completion and syntax highlighting where possible).

**Swagger/OpenAPI 2.0, OpenAPI 3.0, and 3.1** — OpenAPI Toolkit supports all of these versions with a consistent feature set.


<img width="929" height="837" alt="image" src="https://github.com/user-attachments/assets/6a6f45c3-2e00-469f-8b01-aaa1731f750e" />
<img width="929" height="837" alt="image" src="https://github.com/user-attachments/assets/be76e16e-b01e-4697-b392-630e9381bebb" />



**Web support** — OpenAPI Toolkit is designed to run both on Desktop and in Web environments such as [vscode.dev](https://vscode.dev/), [github.dev](https://github.dev/), and [GitHub Codespaces](https://github.com/features/codespaces). It is one of the few extensions that deliver advanced OpenAPI editing and validation/linting in the web environment.&#x20;



#### In-context OpenAPI Documentation (hover)

When you hover over a keyword (node key) in the document, the extension shows full, context-aware documentation in a hover panel that corresponds to the selected construct and matches the official specification.

<img width="1306" height="519" alt="image" src="https://github.com/user-attachments/assets/b3b1de49-de9f-4f9c-a318-11afc00a25b9" />


The same documentation is also shown in the details pane of completion items. See the “Completion / Suggestions” section below.&#x20;

#### Completion / Suggestions

OpenAPI Toolkit provides an enriched completion experience. Under the hood, completion is driven by a semantic understanding of the node where completion is triggered, making suggestions far more precise and useful than standard JSON-Schema-based completion.&#x20;

##### Completion docs

Each completion item includes full documentation (the same content shown in hover).
**Tip:** If the documentation panel doesn’t appear to the right of the completion label, click the `>` icon that appears when you hover the completion entry.&#x20;

<img width="816" height="369" alt="image" src="https://github.com/user-attachments/assets/853d8932-06f8-4964-ac40-f0a16ad06f5e" />

##### References completion

When completion is triggered within the value of a `$ref` field, the editor offers suggestions of compatible targets found in the document (this will be expanded to include documents across the workspace). It also displays the referenced content in the completion box, providing an in-context view of potential references without losing focus&#x20;

<img width="987" height="524" alt="image" src="https://github.com/user-attachments/assets/4d250e05-bc9f-44a5-a22f-ad52412e1157" />


##### Context-aware completion (e.g., `type: integer` → `format`)

Suggestions adapt to related fields. For example, if a schema sets `type: integer`, the `format` suggestions include only compatible values.&#x20;

<img width="942" height="417" alt="image" src="https://github.com/user-attachments/assets/532429ba-59b0-4ebd-b593-05d2e95e291f" />

#### References

##### Reference target content in hover

Hovering over the value of a `$ref` field displays the referenced content in the hover box, providing an in-context view of references without losing focus.&#x20;

<img width="605" height="613" alt="image" src="https://github.com/user-attachments/assets/9a9a1db9-1292-404c-861a-a6ca8d5c34cd" />


##### Go to definition (F3)

Right-click the value of a `$ref` field and choose **Go to Definition** (or press **F3**) to jump to the reference target—either within the current file or in another file in the workspace.&#x20;

<img width="603" height="217" alt="image" src="https://github.com/user-attachments/assets/86fa803e-57fe-4482-9fa3-063501e59cc7" />

##### Go to references

Right-click a key (for example, under `components.schemas`) and choose **Go to References** to open a panel listing available references to jump to.&#x20;

<img width="1699" height="325" alt="image" src="https://github.com/user-attachments/assets/e68591bf-3ef0-4fb1-9aba-579ba2e56d77" />

##### Find all references

Right-click a key (for example, of a schema) and choose **Find All References** to open the References panel listing every usage of the selected target.&#x20;

<img width="890" height="672" alt="image" src="https://github.com/user-attachments/assets/62a8fad3-129e-460c-8c8a-c765beffafe2" />


##### Dereference command

Right-click inside an OpenAPI document or right-click the file in the Explorer, then choose **OpenAPI Toolkit → Dereference API Document** to save a dereferenced copy locally. The default output name is `{filename}-dereferenced.{extension}`.&#x20;

<img width="816" height="429" alt="image" src="https://github.com/user-attachments/assets/a47f3d10-6c16-487d-a7ab-c8121f0c41f6" />

#### Syntax Highlighting

OpenAPI Toolkit provides **semantic** syntax highlighting, going beyond basic keyword coloring. Specific OpenAPI elements—such as operations, schemas, and reference objects—are highlighted with distinct colors and font styles. This helps you quickly recognize and distinguish different parts of an API definition, improving readability and navigation in complex specifications.&#x20;

<img width="819" height="634" alt="image" src="https://github.com/user-attachments/assets/90120937-c759-4399-89e4-4172c38041f3" />


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

<img width="1126" height="1147" alt="image" src="https://github.com/user-attachments/assets/4d5fada5-c1d2-4e22-adc5-337b02383f82" />

##### Default configuration

By default, JSON Schema validation and **semantic linting** are enabled. You can change this in the extension settings. **Semantic validation** is currently disabled by default because it has not yet completed a full compliance test cycle; once complete, it is expected to become the default validation method.&#x20;

##### Spectral validation/linting

To enable Spectral-based checks:

1. Enable **Apply Spectral Validation** in the extension settings.
2. Provide a ruleset by either:
   **(a)** adding a `.spectral.json`, `.spectral.yaml`, or `.spectral.yml` at the root of your workspace, **or**
   **(b)** setting the Spectral ruleset file path in the extension settings, or via the command **OpenAPI Toolkit: Pick Spectral Validation/Linting Rules File** (available from the editor context menu or the Explorer).

Refer to the [Spectral documentation](https://docs.stoplight.io/docs/spectral/) for ruleset format details.&#x20;

<img width="1297" height="342" alt="image" src="https://github.com/user-attachments/assets/10ac8f88-17f0-4b80-8215-29de50b2b636" />

<img width="642" height="548" alt="image" src="https://github.com/user-attachments/assets/1ba22574-7fc3-4708-a3ce-ce85f60f7ac7" />


##### Semantic validation

Enable **Apply Semantic Validation** in the extension settings. No rules file is required to run the built-in semantic validation checks.&#x20;

<img width="1158" height="145" alt="image" src="https://github.com/user-attachments/assets/6c02c589-aaff-411f-b791-058b12f4cc5d" />


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

<img width="515" height="320" alt="image" src="https://github.com/user-attachments/assets/dfe5d693-f293-4b84-b0b7-50f10fa24e64" />

A separate section provides the complete rule schema and examples. *(If you don’t see it yet, it will be added as the rules stabilize.)*&#x20;

##### Supported major element “types” for semantic checks

* callback
* components
* contact
* content
* definitions
* discriminator
* encoding
* example
* external-documentation
* header
* headers
* info
* items
* license
* link
* media-type
* oauth-flow
* oauth-flows
* openapi
* openapi3\_0
* openapi3\_1
* operation
* parameter
* parameters-definitions
* path-item
* paths
* path-template
* reference
* request-body
* response
* responses
* responses-definitions
* schema
* scopes
* security-definitions
* security-requirement
* security-scheme
* server
* server-variable
* swagger
* tag
* xml
  *(These are the current high-level element types recognized by the semantic engine.)*&#x20;

### Preview

The Preview panel (powered by Swagger UI) renders the current OpenAPI document and lets you interact with it:

* **Live rendering** — Quickly verify how changes look without leaving the editor
* **Server selection & auth** — Choose servers and authorize requests where applicable
* **Try it out** — Execute operations directly from the preview to validate requests/responses during development

This helps you validate the specification from both a structural and a consumer point of view.&#x20;
