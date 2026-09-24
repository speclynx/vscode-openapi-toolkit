#!/usr/bin/env node
/**
 * The executable `bin` names. Everything it needs is in the bundle beside it,
 * which webpack leaves as an external here so that this launcher stays a few
 * bytes rather than a second copy of the server.
 */
import { runCli } from './bin';

runCli();
