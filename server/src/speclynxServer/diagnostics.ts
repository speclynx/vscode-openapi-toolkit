import type { Diagnostic } from 'vscode-languageserver';

type ServiceDiagnostic = Omit<Diagnostic, 'message'> & {
  message: string | { kind: string; value: string };
};

/** The server supports LSP 3.17 clients, which require plain diagnostic messages. */
export function plainDiagnostic(diagnostic: ServiceDiagnostic): Diagnostic {
  return {
    ...diagnostic,
    message: typeof diagnostic.message === 'string' ? diagnostic.message : diagnostic.message.value,
  };
}
