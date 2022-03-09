/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { execSync } from 'child_process';
import nodeModule from 'module';
import { resolve } from 'path';
import { Argv } from 'yargs';
import { CommandModule, CommandModuleImplementation } from '../../command-builder/command-module';
import { colors } from '../../utilities/color';

interface PartialPackageInfo {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Major versions of Node.js that are officially supported by Angular.
 */
const SUPPORTED_NODE_MAJORS = [14, 16];

const PACKAGE_PATTERNS = [
  /^@angular\/.*/,
  /^@angular-devkit\/.*/,
  /^@bazel\/.*/,
  /^@ngtools\/.*/,
  /^@nguniversal\/.*/,
  /^@schematics\/.*/,
  /^rxjs$/,
  /^typescript$/,
  /^ng-packagr$/,
  /^webpack$/,
];

export class VersionCommandModule extends CommandModule implements CommandModuleImplementation {
  command = 'version';
  aliases = ['v'];
  describe = 'Outputs Angular CLI version.';
  longDescriptionPath?: string | undefined;

  builder(localYargs: Argv): Argv {
    return localYargs;
  }

  async run(): Promise<void> {
    const logger = this.context.logger;
    const localRequire = nodeModule.createRequire(resolve(__filename, '../../../'));
    // Trailing slash is used to allow the path to be treated as a directory
    const workspaceRequire = nodeModule.createRequire(this.context.root + '/');

    const cliPackage: PartialPackageInfo = localRequire('./package.json');
    let workspacePackage: PartialPackageInfo | undefined;
    try {
      workspacePackage = workspaceRequire('./package.json');
    } catch {}

    const [nodeMajor] = process.versions.node.split('.').map((part) => Number(part));
    const unsupportedNodeVersion = !SUPPORTED_NODE_MAJORS.includes(nodeMajor);

    const packageNames = [
      ...Object.keys(cliPackage.dependencies || {}),
      ...Object.keys(cliPackage.devDependencies || {}),
      ...Object.keys(workspacePackage?.dependencies || {}),
      ...Object.keys(workspacePackage?.devDependencies || {}),
    ];

    const versions = packageNames
      .filter((x) => PACKAGE_PATTERNS.some((p) => p.test(x)))
      .reduce((acc, name) => {
        if (name in acc) {
          return acc;
        }

        acc[name] = this.getVersion(name, workspaceRequire, localRequire);

        return acc;
      }, {} as { [module: string]: string });

    const ngCliVersion = cliPackage.version;
    let angularCoreVersion = '';
    const angularSameAsCore: string[] = [];

    if (workspacePackage) {
      // Filter all angular versions that are the same as core.
      angularCoreVersion = versions['@angular/core'];
      if (angularCoreVersion) {
        for (const angularPackage of Object.keys(versions)) {
          if (
            versions[angularPackage] == angularCoreVersion &&
            angularPackage.startsWith('@angular/')
          ) {
            angularSameAsCore.push(angularPackage.replace(/^@angular\//, ''));
            delete versions[angularPackage];
          }
        }

        // Make sure we list them in alphabetical order.
        angularSameAsCore.sort();
      }
    }

    const namePad = ' '.repeat(
      Object.keys(versions).sort((a, b) => b.length - a.length)[0].length + 3,
    );
    const asciiArt = `
     _                      _                 ____ _     ___
    / \\   _ __   __ _ _   _| | __ _ _ __     / ___| |   |_ _|
   / △ \\ | '_ \\ / _\` | | | | |/ _\` | '__|   | |   | |    | |
  / ___ \\| | | | (_| | |_| | | (_| | |      | |___| |___ | |
 /_/   \\_\\_| |_|\\__, |\\__,_|_|\\__,_|_|       \\____|_____|___|
                |___/
    `
      .split('\n')
      .map((x) => colors.red(x))
      .join('\n');

    logger.info(asciiArt);
    logger.info(
      `
      Angular CLI: ${ngCliVersion}
      Node: ${process.versions.node}${unsupportedNodeVersion ? ' (Unsupported)' : ''}
      Package Manager: ${this.getPackageManagerVersion()}
      OS: ${process.platform} ${process.arch}

      Angular: ${angularCoreVersion}
      ... ${angularSameAsCore
        .reduce<string[]>((acc, name) => {
          // Perform a simple word wrap around 60.
          if (acc.length == 0) {
            return [name];
          }
          const line = acc[acc.length - 1] + ', ' + name;
          if (line.length > 60) {
            acc.push(name);
          } else {
            acc[acc.length - 1] = line;
          }

          return acc;
        }, [])
        .join('\n... ')}

      Package${namePad.slice(7)}Version
      -------${namePad.replace(/ /g, '-')}------------------
      ${Object.keys(versions)
        .map((module) => `${module}${namePad.slice(module.length)}${versions[module]}`)
        .sort()
        .join('\n')}
    `.replace(/^ {6}/gm, ''),
    );

    if (unsupportedNodeVersion) {
      logger.warn(
        `Warning: The current version of Node (${process.versions.node}) is not supported by Angular.`,
      );
    }
  }

  private getVersion(
    moduleName: string,
    workspaceRequire: NodeRequire,
    localRequire: NodeRequire,
  ): string {
    let packageInfo: PartialPackageInfo | undefined;
    let cliOnly = false;

    // Try to find the package in the workspace
    try {
      packageInfo = workspaceRequire(`${moduleName}/package.json`);
    } catch {}

    // If not found, try to find within the CLI
    if (!packageInfo) {
      try {
        packageInfo = localRequire(`${moduleName}/package.json`);
        cliOnly = true;
      } catch {}
    }

    // If found, attempt to get the version
    if (packageInfo) {
      try {
        return packageInfo.version + (cliOnly ? ' (cli-only)' : '');
      } catch {}
    }

    return '<error>';
  }

  private getPackageManagerVersion(): string {
    try {
      const manager = this.context.packageManager;
      const version = execSync(`${manager} --version`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        env: {
          ...process.env,
          //  NPM updater notifier will prevents the child process from closing until it timeout after 3 minutes.
          NO_UPDATE_NOTIFIER: '1',
          NPM_CONFIG_UPDATE_NOTIFIER: 'false',
        },
      }).trim();

      return `${manager} ${version}`;
    } catch {
      return '<error>';
    }
  }
}