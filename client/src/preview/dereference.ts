import * as vscode from 'vscode';
import { ObjectElement } from '@speclynx/apidom-datamodel';
import { toValue } from '@speclynx/apidom-core';
import ApiDOMParser from '@speclynx/apidom-parser';
import * as openAPI2JSONAdapter from '@speclynx/apidom-parser-adapter-openapi-json-2';
import * as openAPI2YAMLAdapter from '@speclynx/apidom-parser-adapter-openapi-yaml-2';
import * as openAPI30JSONAdapter from '@speclynx/apidom-parser-adapter-openapi-json-3-0';
import * as openAPI30YAMLAdapter from '@speclynx/apidom-parser-adapter-openapi-yaml-3-0';
import * as openAPI31JSONAdapter from '@speclynx/apidom-parser-adapter-openapi-json-3-1';
import * as openAPI31YAMLAdapter from '@speclynx/apidom-parser-adapter-openapi-yaml-3-1';
import * as jsonParserAdapter from '@speclynx/apidom-parser-adapter-json';
import * as yamlParserAdapter from '@speclynx/apidom-parser-adapter-yaml-1-2';
import HTTPResolverAxios from '@speclynx/apidom-reference/resolve/resolvers/http-axios';
import OpenAPIJSON2Parser from '@speclynx/apidom-reference/parse/parsers/openapi-json-2';
import OpenAPIYAML2Parser from '@speclynx/apidom-reference/parse/parsers/openapi-yaml-2';
import OpenAPIJSON3_0Parser from '@speclynx/apidom-reference/parse/parsers/openapi-json-3-0';
import OpenAPIYAML3_0Parser from '@speclynx/apidom-reference/parse/parsers/openapi-yaml-3-0';
import OpenAPIJSON3_1Parser from '@speclynx/apidom-reference/parse/parsers/openapi-json-3-1';
import OpenAPIYAML3_1Parser from '@speclynx/apidom-reference/parse/parsers/openapi-yaml-3-1';
import JSONParser from '@speclynx/apidom-reference/parse/parsers/json';
import YAMLParser from '@speclynx/apidom-reference/parse/parsers/yaml-1-2';
import BinaryParser from '@speclynx/apidom-reference/parse/parsers/binary';
import OpenAPI2DereferenceStrategy from '@speclynx/apidom-reference/dereference/strategies/openapi-2';
import OpenAPI3_0DereferenceStrategy from '@speclynx/apidom-reference/dereference/strategies/openapi-3-0';
import OpenAPI3_1DereferenceStrategy from '@speclynx/apidom-reference/dereference/strategies/openapi-3-1';
import {
  dereference as baseDereference,
  Resolver,
  ResolverError,
  Reference,
  ReferenceSet,
  url,
  ResolverOptions,
  File,
} from '@speclynx/apidom-reference/configuration/empty';
import { getFileService } from '../services/fileService';
import type { FileService } from '../speclynxClient';

class FileResolver extends Resolver {
  public readonly fileService: FileService;

  constructor(options?: ResolverOptions) {
    super({ ...options, name: 'VSCodeFileResolver' });
    this.fileService = getFileService();
  }

  canRead(file: File): boolean {
    // VS Code file providers also serve virtual workspace schemes. HTTP stays
    // with the HTTP resolver; client-side providers retain their own URI.
    return url.isFileSystemPath(file.uri) || !url.isHttpUrl(file.uri);
  }

  async read(file: File) {
    const fileSystemPath = url.isFileSystemPath(file.uri)
      ? `file://${url.toFileSystemPath(file.uri, { keepFileProtocol: false })}`
      : file.uri;

    try {
      const buffer = await this.fileService.getContent(fileSystemPath);
      return buffer as Buffer;
    } catch (error: unknown) {
      throw new ResolverError(`Error opening file "${file.uri}"`, { cause: error });
    }
  }
}

function circularReplacer(element: ObjectElement) {
  return new ObjectElement({
    $ref: toValue(element.get('$ref')),
  });
}

const parser = new ApiDOMParser();
parser.use(openAPI2JSONAdapter);
parser.use(openAPI2YAMLAdapter);
parser.use(openAPI30JSONAdapter);
parser.use(openAPI30YAMLAdapter);
parser.use(openAPI31JSONAdapter);
parser.use(openAPI31YAMLAdapter);
parser.use(jsonParserAdapter);
parser.use(yamlParserAdapter);

export async function dereference(document: vscode.TextDocument) {
  const documentURI = String(document.uri);
  const parseResult = await parser.parse(document.getText());
  const reference = new Reference({ uri: documentURI, value: parseResult });
  const refSet = new ReferenceSet({ refs: [reference] });
  const dereferencedApiDOM = await baseDereference(documentURI, {
    parse: {
      parsers: [
        new OpenAPIJSON2Parser({ allowEmpty: true, sourceMap: false }),
        new OpenAPIYAML2Parser({ allowEmpty: true, sourceMap: false }),
        new OpenAPIJSON3_0Parser({ allowEmpty: true, sourceMap: false }),
        new OpenAPIYAML3_0Parser({ allowEmpty: true, sourceMap: false }),
        new OpenAPIJSON3_1Parser({ allowEmpty: true, sourceMap: false }),
        new OpenAPIYAML3_1Parser({ allowEmpty: true, sourceMap: false }),
        new JSONParser({ allowEmpty: true, sourceMap: false }),
        new YAMLParser({ allowEmpty: true, sourceMap: false }),
        new BinaryParser({ allowEmpty: true }),
      ],
    },
    resolve: {
      baseURI: documentURI,
      resolvers: [
        new FileResolver(),
        new HTTPResolverAxios({ timeout: 5000, redirects: 5, withCredentials: false }),
      ],
      strategies: [],
    },
    dereference: {
      immutable: false,
      circular: 'replace',
      circularReplacer,
      refSet,
      strategies: [
        new OpenAPI2DereferenceStrategy(),
        new OpenAPI3_0DereferenceStrategy(),
        new OpenAPI3_1DereferenceStrategy(),
      ],
    },
    bundle: {
      strategies: [],
    },
  });

  return toValue(dereferencedApiDOM.api) as object;
}
