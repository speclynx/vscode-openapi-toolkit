import * as vscode from 'vscode';
import { Utils as UriUtils } from 'vscode-uri';
import * as openapi2AdapterJson from '@speclynx/apidom-parser-adapter-openapi-json-2';
import * as openapi2AdapterYaml from '@speclynx/apidom-parser-adapter-openapi-yaml-2';
import * as openapi30xAdapterJson from '@speclynx/apidom-parser-adapter-openapi-json-3-0';
import * as openapi30xAdapterYaml from '@speclynx/apidom-parser-adapter-openapi-yaml-3-0';
import * as openapi31xAdapterJson from '@speclynx/apidom-parser-adapter-openapi-json-3-1';
import * as openapi31xAdapterYaml from '@speclynx/apidom-parser-adapter-openapi-yaml-3-1';

export const fileExtensions = ['json', 'yaml', 'yml'];

export function isCanonicalFilename(doc: vscode.TextDocument): boolean {
  if (!doc.uri) return false;

  const basename = UriUtils.basename(doc.uri);

  return (
    (basename.includes('openapi') || basename.includes('swagger')) && hasRecognizedExtension(doc)
  );
}

export function hasRecognizedExtension(doc: vscode.TextDocument): boolean {
  if (!doc.uri) return false;

  const ext = UriUtils.extname(doc.uri).toLowerCase();
  const extNormalized = ext.startsWith('.') ? ext.slice(1) : ext;

  return fileExtensions.includes(extNormalized);
}

export async function isOpenAPI(doc: vscode.TextDocument): Promise<boolean> {
  return (await isOpenAPIJSON(doc)) || (await isOpenAPIYAML(doc));
}

export async function isOpenAPIJSON(doc: vscode.TextDocument): Promise<boolean> {
  const docText = doc.getText();

  return (
    (await openapi2AdapterJson.detect(docText)) ||
    (await openapi30xAdapterJson.detect(docText)) ||
    (await openapi31xAdapterJson.detect(docText))
  );
}

export async function isOpenAPIYAML(doc: vscode.TextDocument): Promise<boolean> {
  const docText = doc.getText();

  return (
    (await openapi2AdapterYaml.detect(docText)) ||
    (await openapi30xAdapterYaml.detect(docText)) ||
    (await openapi31xAdapterYaml.detect(docText))
  );
}
