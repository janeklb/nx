import { ExecutorContext, logger } from '@nrwl/devkit';
import * as build from '@storybook/core-server';
import { CLIOptions } from '@storybook/types'; // TODO (katerina): Remove when Storybook 7
import 'dotenv/config';
import { storybookConfigExistsCheck } from '../../utils/utilities';
import { CommonNxStorybookConfig } from '../models';
import {
  getStorybookFrameworkPath,
  isStorybookV7,
  runStorybookSetupCheck,
} from '../utils';

export default async function buildStorybookExecutor(
  options: CLIOptions & CommonNxStorybookConfig,
  context: ExecutorContext
) {
  storybookConfigExistsCheck(options.configDir, context.projectName);
  const storybook7 = isStorybookV7();
  if (storybook7) {
    const buildOptions: CLIOptions = options;
    logger.info(`NX Storybook builder starting ...`);
    await runInstance(buildOptions, storybook7);
    logger.info(`NX Storybook builder finished ...`);
    logger.info(`NX Storybook files available in ${buildOptions.outputDir}`);
    return { success: true };
  } else {
    // TODO (katerina): Remove when Storybook 7
    // print warnings
    runStorybookSetupCheck(options);

    logger.info(`NX ui framework: ${options.uiFramework}`);

    const frameworkPath = getStorybookFrameworkPath(options.uiFramework);
    const { default: frameworkOptions } = await import(frameworkPath);

    const buildOptions: CLIOptions = {
      ...options,
      ...frameworkOptions,
      frameworkPresets: [...(frameworkOptions.frameworkPresets || [])],
    };

    logger.info(`NX Storybook builder starting ...`);
    await runInstance(buildOptions, storybook7);
    logger.info(`NX Storybook builder finished ...`);
    logger.info(`NX Storybook files available in ${buildOptions.outputDir}`);
    return { success: true };
  }
}

function runInstance(options: CLIOptions, storybook7: boolean): Promise<void> {
  const env = process.env.NODE_ENV ?? 'production';
  process.env.NODE_ENV = env;

  if (storybook7) {
    return build['build']({
      ...options,
      mode: 'static',
    } as any); // TODO (katerina): Change to actual types when Storybook 7
  } else {
    return build.buildStaticStandalone({
      ...options,
      ci: true,
    } as any); // TODO (katerina): Remove when Storybook 7
  }
}
