import { runCommand } from '../tasks-runner/run-command';
import { splitArgsIntoNxArgsAndOverrides } from '../utils/command-line-utils';
import { connectToNxCloudIfExplicitlyAsked } from './connect';
import { performance } from 'perf_hooks';
import {
  createProjectGraphAsync,
  readProjectsConfigurationFromProjectGraph,
} from '../project-graph/project-graph';
import { ProjectGraph } from '../config/project-graph';
import { NxJsonConfiguration } from '../config/nx-json';
import { workspaceRoot } from '../utils/workspace-root';
import { splitTarget } from '../utils/split-target';
import { output } from '../utils/output';
import {
  ProjectConfiguration,
  ProjectsConfigurations,
  TargetDependencyConfig,
} from '../config/workspace-json-project-json';
import { readNxJson } from '../config/configuration';

export async function runOne(
  cwd: string,
  args: { [k: string]: any },
  extraTargetDependencies: Record<
    string,
    (TargetDependencyConfig | string)[]
  > = {},
  extraOptions = { excludeTaskDependencies: false, loadDotEnvFiles: true } as {
    excludeTaskDependencies: boolean;
    loadDotEnvFiles: boolean;
  }
): Promise<void> {
  performance.mark('command-execution-begins');
  performance.measure('code-loading', 'init-local', 'command-execution-begins');

  const nxJson = readNxJson();
  const projectGraph = await createProjectGraphAsync({ exitOnError: true });

  const opts = parseRunOneOptions(cwd, args, projectGraph, nxJson);

  const { nxArgs, overrides } = splitArgsIntoNxArgsAndOverrides(
    {
      ...opts.parsedArgs,
      configuration: opts.configuration,
      targets: [opts.target],
    },
    'run-one',
    { printWarnings: true },
    nxJson
  );
  if (nxArgs.verbose) {
    process.env.NX_VERBOSE_LOGGING = 'true';
  }
  if (nxArgs.help) {
    await (
      await import('./run')
    ).run(cwd, workspaceRoot, opts, {}, false, true);
    process.exit(0);
  }

  await connectToNxCloudIfExplicitlyAsked(nxArgs);

  const { projects } = getProjects(projectGraph, opts.project);

  await runCommand(
    projects,
    projectGraph,
    { nxJson },
    nxArgs,
    overrides,
    opts.project,
    extraTargetDependencies,
    extraOptions
  );
}

function getProjects(projectGraph: ProjectGraph, project: string): any {
  if (!projectGraph.nodes[project]) {
    output.error({
      title: `Cannot find project '${project}'`,
    });
    process.exit(1);
  }
  let projects = [projectGraph.nodes[project]];
  let projectsMap = {
    [project]: projectGraph.nodes[project],
  };

  return { projects, projectsMap };
}

const targetAliases = {
  b: 'build',
  e: 'e2e',
  l: 'lint',
  s: 'serve',
  t: 'test',
};

function parseRunOneOptions(
  cwd: string,
  parsedArgs: { [k: string]: any },
  projectGraph: ProjectGraph,
  nxJson: NxJsonConfiguration
): { project; target; configuration; parsedArgs } {
  const defaultProjectName = calculateDefaultProjectName(
    cwd,
    workspaceRoot,
    readProjectsConfigurationFromProjectGraph(projectGraph),
    nxJson
  );

  let project;
  let target;
  let configuration;

  if (parsedArgs['project:target:configuration'].indexOf(':') > -1) {
    // run case
    [project, target, configuration] = splitTarget(
      parsedArgs['project:target:configuration'],
      projectGraph
    );
    // this is to account for "nx npmsript:dev"
    if (project && !target && defaultProjectName) {
      target = project;
      project = defaultProjectName;
    }
  } else {
    target = parsedArgs['project:target:configuration'];
  }
  if (parsedArgs.project) {
    project = parsedArgs.project;
  }
  if (!project && defaultProjectName) {
    project = defaultProjectName;
  }
  if (!project || !target) {
    throw new Error(`Both project and target have to be specified`);
  }
  if (targetAliases[target]) {
    target = targetAliases[target];
  }
  if (parsedArgs.configuration) {
    configuration = parsedArgs.configuration;
  } else if (parsedArgs.prod) {
    configuration = 'production';
  }

  const res = { project, target, configuration, parsedArgs };
  delete parsedArgs['c'];
  delete parsedArgs['project:target:configuration'];
  delete parsedArgs['configuration'];
  delete parsedArgs['prod'];
  delete parsedArgs['project'];

  return res;
}

export function calculateDefaultProjectName(
  cwd: string,
  root: string,
  projectsConfigurations: ProjectsConfigurations,
  nxJsonConfiguration: NxJsonConfiguration
) {
  let relativeCwd = cwd.replace(/\\/g, '/').split(root.replace(/\\/g, '/'))[1];

  relativeCwd = relativeCwd.startsWith('/')
    ? relativeCwd.substring(1)
    : relativeCwd;
  const matchingProject = Object.keys(projectsConfigurations.projects).find(
    (p) => {
      const projectRoot = projectsConfigurations.projects[p].root;
      return (
        relativeCwd == projectRoot ||
        (relativeCwd == '' && projectRoot == '.') ||
        relativeCwd.startsWith(`${projectRoot}/`)
      );
    }
  );
  if (matchingProject) return matchingProject;
  return (
    (nxJsonConfiguration.cli as { defaultProjectName: string })
      ?.defaultProjectName || nxJsonConfiguration.defaultProject
  );
}
