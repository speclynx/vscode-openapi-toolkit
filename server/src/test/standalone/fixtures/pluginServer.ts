/**
 * A server embedding a metadata plugin, spawned by the standalone tests to
 * exercise the programmatic entry point the way a specialized server built on
 * top of this package would use it.
 *
 * It imports the package by name rather than by relative path, which resolves
 * through the `exports` map to the bundle that is actually published — so the
 * suite covers what a consumer gets, not what the sources say.
 */
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';
import { startServer, NodeServerRuntime } from '@speclynx/api-language-server';
import { pluginMetadata } from './pluginRule';

const connection = createConnection(ProposedFeatures.all, process.stdin, process.stdout);

startServer(connection, new NodeServerRuntime({ metadataPlugins: [{ config: pluginMetadata }] }));
