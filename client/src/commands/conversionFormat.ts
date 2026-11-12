import type { Format } from '@speclynx/api-languageservice';

// The language service's Format values that apidom/convert requests carry. Importing
// its enum at runtime would bundle the whole language service into the client; the
// member types keep these values checked against the enum.
export const ConversionFormat: { readonly JSON: Format.JSON; readonly YAML: Format.YAML } = {
  JSON: 0,
  YAML: 1,
};
