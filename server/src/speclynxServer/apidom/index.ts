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
import { options } from '@speclynx/apidom-reference';
import type { Connection } from 'vscode-languageserver';

import { FileResolver } from './fileResolver';
import type { ServerRuntime } from '../../runtime';

export function configure(connection: Connection, runtime?: ServerRuntime) {
  options.parse.parsers = [
    new OpenAPIJSON2Parser({ allowEmpty: true, sourceMap: false }),
    new OpenAPIYAML2Parser({ allowEmpty: true, sourceMap: false }),
    new OpenAPIJSON3_0Parser({ allowEmpty: true, sourceMap: false }),
    new OpenAPIYAML3_0Parser({ allowEmpty: true, sourceMap: false }),
    new OpenAPIJSON3_1Parser({ allowEmpty: true, sourceMap: false }),
    new OpenAPIYAML3_1Parser({ allowEmpty: true, sourceMap: false }),
    new JSONParser({ allowEmpty: true, sourceMap: false }),
    new YAMLParser({ allowEmpty: true, sourceMap: false }),
    new BinaryParser({ allowEmpty: true }),
  ];

  options.resolve.resolvers = [
    new FileResolver({ connection, runtime }),
    new HTTPResolverAxios({ timeout: 5000, redirects: 5, withCredentials: false }),
  ];

  options.resolve.strategies = [];

  options.dereference.strategies = [
    new OpenAPI2DereferenceStrategy(),
    new OpenAPI3_0DereferenceStrategy(),
    new OpenAPI3_1DereferenceStrategy(),
  ];

  options.bundle.strategies = [];
}
