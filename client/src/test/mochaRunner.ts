import Mocha from 'mocha';

/**
 * Runs the given compiled test files in the extension host.  Shared by the two
 * entry points below it, which differ only in which files they select.
 */
export function runMocha(files: string[]): Promise<void> {
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
  });
  mocha.timeout(100000);
  files.forEach((file) => mocha.addFile(file));

  return new Promise((resolve, reject) => {
    try {
      mocha.run((failures) => {
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          resolve();
        }
      });
    } catch (err) {
      console.error(err);
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
