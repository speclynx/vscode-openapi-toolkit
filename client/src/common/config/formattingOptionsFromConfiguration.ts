import { FormattingOptions } from 'vscode-languageserver-types';
import * as vscode from 'vscode';

export function createFormattingOptions(
  document: vscode.TextDocument,
  format: 'yaml' | 'json',
): FormattingOptions {
  const editorConfig = vscode.workspace.getConfiguration('editor', document);
  const languageConfig = vscode.workspace.getConfiguration(`[${format}]`, document);

  const tabSize =
    languageConfig.get<number>('editor.tabSize') ?? editorConfig.get<number>('tabSize', 2);

  const insertSpaces =
    languageConfig.get<boolean>('editor.insertSpaces') ??
    editorConfig.get<boolean>('insertSpaces', true);

  const trimTrailingWhitespace =
    languageConfig.get<boolean>('editor.trimAutoWhitespace') ??
    editorConfig.get<boolean>('trimAutoWhitespace', true);

  const insertFinalNewline =
    languageConfig.get<boolean>('editor.insertFinalNewline') ??
    editorConfig.get<boolean>('insertFinalNewline', false);

  const trimFinalNewlines =
    languageConfig.get<boolean>('editor.trimFinalNewlines') ??
    editorConfig.get<boolean>('trimFinalNewlines', true);

  return {
    tabSize,
    insertSpaces,
    trimTrailingWhitespace,
    insertFinalNewline,
    trimFinalNewlines,
  };
}
