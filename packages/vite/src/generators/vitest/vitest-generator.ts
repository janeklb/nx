import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  joinPathFragments,
  offsetFromRoot,
  readProjectConfiguration,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import {
  addOrChangeTestTarget,
  findExistingTargetsInProject,
  createOrEditViteConfig,
} from '../../utils/generator-utils';
import { VitestGeneratorSchema } from './schema';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import initGenerator from '../init/init';
import {
  vitestCoverageC8Version,
  vitestCoverageIstanbulVersion,
} from '../../utils/versions';

export async function vitestGenerator(
  tree: Tree,
  schema: VitestGeneratorSchema
) {
  const tasks: GeneratorCallback[] = [];

  const { targets, root, projectType } = readProjectConfiguration(
    tree,
    schema.project
  );
  let testTarget =
    schema.testTarget ??
    findExistingTargetsInProject(targets)?.validFoundTargetName?.test ??
    'test';

  addOrChangeTestTarget(tree, schema, testTarget);

  const initTask = initGenerator(tree, {
    uiFramework: schema.uiFramework,
  });
  tasks.push(initTask);

  if (!schema.skipViteConfig) {
    createOrEditViteConfig(
      tree,
      {
        ...schema,
        includeVitest: true,
        includeLib: projectType === 'library',
      },
      true
    );
  }

  createFiles(tree, schema, root);
  updateTsConfig(tree, schema, root);

  const installCoverageProviderTask = addDependenciesToPackageJson(
    tree,
    {},
    schema.coverageProvider === 'istanbul'
      ? {
          '@vitest/coverage-istanbul': vitestCoverageIstanbulVersion,
        }
      : {
          '@vitest/coverage-c8': vitestCoverageC8Version,
        }
  );
  tasks.push(installCoverageProviderTask);

  if (schema.coverageProvider === 'istanbul') {
  }

  await formatFiles(tree);

  return runTasksInSerial(...tasks);
}

function updateTsConfig(
  tree: Tree,
  options: VitestGeneratorSchema,
  projectRoot: string
) {
  updateJson(tree, joinPathFragments(projectRoot, 'tsconfig.json'), (json) => {
    if (
      json.references &&
      !json.references.some((r) => r.path === './tsconfig.spec.json')
    ) {
      json.references.push({
        path: './tsconfig.spec.json',
      });
    }

    if (!json.compilerOptions?.types?.includes('vitest')) {
      if (json.compilerOptions?.types) {
        json.compilerOptions.types.push('vitest');
      } else {
        if (!json.compilerOptions) {
          json.compilerOptions = {};
        }
        json.compilerOptions.types = ['vitest'];
      }
    }
    return json;
  });

  if (options.inSourceTests) {
    const tsconfigLibPath = joinPathFragments(projectRoot, 'tsconfig.lib.json');
    const tsconfigAppPath = joinPathFragments(projectRoot, 'tsconfig.app.json');
    if (tree.exists(tsconfigLibPath)) {
      updateJson(
        tree,
        joinPathFragments(projectRoot, 'tsconfig.lib.json'),
        (json) => {
          (json.compilerOptions.types ??= []).push('vitest/importMeta');
          return json;
        }
      );
    } else if (tree.exists(tsconfigAppPath)) {
      updateJson(
        tree,
        joinPathFragments(projectRoot, 'tsconfig.app.json'),
        (json) => {
          (json.compilerOptions.types ??= []).push('vitest/importMeta');
          return json;
        }
      );
    }
  }
}

function createFiles(
  tree: Tree,
  options: VitestGeneratorSchema,
  projectRoot: string
) {
  generateFiles(tree, joinPathFragments(__dirname, 'files'), projectRoot, {
    tmpl: '',
    ...options,
    projectRoot,
    offsetFromRoot: offsetFromRoot(projectRoot),
  });
}

export default vitestGenerator;
export const vitestSchematic = convertNxGenerator(vitestGenerator);
