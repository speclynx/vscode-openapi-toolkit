import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { DocumentLink } from 'vscode-languageserver-types';
import type { Element } from '@speclynx/apidom-datamodel';
import { ProviderMode, MergeStrategy, OpenAPITargetSpecs } from '@speclynx/api-languageservice';
import { url as urlUtils } from '@speclynx/apidom-reference';

export class RefLinksProvider {
  break() {
    return false;
  }

  providerMode() {
    return ProviderMode.REF;
  }

  configure(): void {
    return undefined;
  }

  doRefLinks(textDocument: TextDocument, api: Element, refLinks: DocumentLink[]) {
    for (const link of refLinks) {
      if (link.target) {
        link.target = urlUtils.resolve(textDocument.uri, link.target);
      }
    }
    return {
      mergeStrategy: MergeStrategy.IGNORE,
      links: [],
    };
  }

  name() {
    return 'VSCodeRefLinksProvider';
  }

  namespaces() {
    return [...OpenAPITargetSpecs.OpenAPI2, ...OpenAPITargetSpecs.OpenAPI3];
  }
}
