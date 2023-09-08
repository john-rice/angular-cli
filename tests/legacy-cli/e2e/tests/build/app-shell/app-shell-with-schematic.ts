import { getGlobalVariable } from '../../../utils/env';
import { appendToFile, expectFileToMatch } from '../../../utils/fs';
import { installPackage } from '../../../utils/packages';
import { ng } from '../../../utils/process';
import { updateJsonFile } from '../../../utils/project';

const snapshots = require('../../../ng-snapshot/package.json');

export default async function () {
  await appendToFile('src/app/app.component.html', '<router-outlet></router-outlet>');
  await ng('generate', 'app-shell', '--project', 'test-project');
  // Setup webpack builder if esbuild is not requested on the commandline
  const useWebpackBuilder = !getGlobalVariable('argv')['esbuild'];

  const isSnapshotBuild = getGlobalVariable('argv')['ng-snapshots'];
  if (isSnapshotBuild) {
    const packagesToInstall: string[] = [];
    await updateJsonFile('package.json', (packageJson) => {
      const dependencies = packageJson['dependencies'];
      // Iterate over all of the packages to update them to the snapshot version.
      for (const [name, version] of Object.entries(
        snapshots.dependencies as { [p: string]: string },
      )) {
        if (name in dependencies && dependencies[name] !== version) {
          packagesToInstall.push(version);
        }
      }
    });

    for (const pkg of packagesToInstall) {
      await installPackage(pkg);
    }
  }

  if (useWebpackBuilder) {
    await ng('run', 'test-project:app-shell:development');
    await expectFileToMatch('dist/test-project/browser/index.html', /app-shell works!/);

    await ng('run', 'test-project:app-shell');
    await expectFileToMatch('dist/test-project/browser/index.html', /app-shell works!/);
  } else {
    await ng('build');
    await expectFileToMatch('dist/test-project/index.html', 'app-shell works!');
  }
}
