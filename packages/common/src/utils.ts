import * as tl from 'azure-pipelines-task-lib/task'
import {isAbsolute} from 'path'

export const getInputValue = (inputKey: string): string => {
  return getInputValue(inputKey) || '';
}

export const getDatabricksHost = (): string => {
  const hostFromInput = getInputValue('databricks-host')
  const hostFromEnv = process.env['DATABRICKS_HOST'] || ''

  if (!hostFromInput && !hostFromEnv) {
    throw new Error(
      'Either databricks-host action input or DATABRICKS_HOST env variable must be set.'
    )
  } else {
    // Host passed as an action input takes president.
    return hostFromInput ? hostFromInput : hostFromEnv
  }
}

export const getWorkspaceTempDir = (): string => {
  const res = getInputValue('workspace-temp-dir')
  if (!res.startsWith('/')) {
    throw new Error(
      `workspace-temp-dir input must be an absolute Databricks workspace path. Got invalid path ${res}`
    )
  }
  return res
}

export const getDatabricksToken = (): string => {
  const tokenFromInput = getInputValue('databricks-token')
  const tokenFromEnv = process.env['DATABRICKS_TOKEN'] || ''

  if (!tokenFromInput && !tokenFromEnv) {
    throw new Error(
      'Either databricks-token action input or DATABRICKS_TOKEN env variable must be set.'
    )
  } else {
    // Token passed as an action input takes president.
    return tokenFromInput ? tokenFromInput : tokenFromEnv
  }
}

export const getNotebookPath = (): string => {
  const localNotebookPath: string = getInputValue('local-notebook-path')
  const workspaceNotebookPath: string = getInputValue('workspace-notebook-path')

  if (!localNotebookPath && !workspaceNotebookPath) {
    throw new Error(
      'Either `local-notebook-path` or `workspace-notebook-path` inputs must be set.'
    )
  } else if (localNotebookPath && workspaceNotebookPath) {
    throw new Error(
      'Only one of `local-notebook-path` and `workspace-notebook-path` must be set, not both.'
    )
  } else if (localNotebookPath) {
    if (isAbsolute(localNotebookPath)) {
      throw new Error(
        `'local-notebook-path' input must be a relative path, instead recieved: ${localNotebookPath}`
      )
    }

    if (isGitRefSpecified()) {
      // Strip the file extension from the notebook path.
      return localNotebookPath.split('.').slice(0, -1).join('.')
    } else {
      return localNotebookPath
    }
  } else {
    if (!isAbsolute(workspaceNotebookPath)) {
      throw new Error(
        `'workspace-notebook-path' input must be an absolute path, instead recieved: ${workspaceNotebookPath}`
      )
    }
    return workspaceNotebookPath
  }
}

export const getClusterSpec = (): object => {
  const existingClusterId: string = getInputValue('existing-cluster-id')
  const newClusterJsonString: string = getInputValue('new-cluster-json')

  if (!newClusterJsonString && !existingClusterId) {
    throw new Error(
      'Either `existing-cluster-id` or `new-cluster-json` inputs must be set.'
    )
  } else if (newClusterJsonString && existingClusterId) {
    throw new Error(
      'Only one of `existing-cluster-id` and `new-cluster-json` must be set, not both.'
    )
  } else if (newClusterJsonString) {
    const newClusterSpec = JSON.parse(newClusterJsonString)
    return {new_cluster: newClusterSpec}
  } else {
    return {existing_cluster_id: existingClusterId}
  }
}

export const getLibrariesSpec = (): object => {
  const librariesJsonString: string = getInputValue('libraries-json')
  return librariesJsonString
    ? {
        libraries: JSON.parse(librariesJsonString)
      }
    : {}
}

export const getNotebookParamsSpec = (): object => {
  const paramsJsonString: string = getInputValue('notebook-params-json')
  return paramsJsonString
    ? {
        base_parameters: JSON.parse(paramsJsonString)
      }
    : {}
}

export const getAclSpec = (): object => {
  const aclJsonString: string = getInputValue('access-control-list-json')
  return aclJsonString
    ? {
        access_control_list: JSON.parse(aclJsonString)
      }
    : {}
}

export const getTimeoutSpec = (): object => {
  const timeoutInSeconds: string = getInputValue('timeout-seconds')
  return timeoutInSeconds
    ? {
        timeout_seconds: Number(timeoutInSeconds)
      }
    : {}
}

export const getRunNameSpec = (): object => {
  const runName: string = getInputValue('run-name')
  return runName
    ? {
        run_name: runName
      }
    : {}
}

export const getGitSourceSpec = (): object => {
  const gitBranch: string = getInputValue('git-branch')
  const gitTag: string = getInputValue('git-tag')
  const gitCommit: string = getInputValue('git-commit')
  const gitRepoUrl: string = getInputValue('git-repo-url')
  const baseGitSourceSpec = {
    git_url: gitRepoUrl,
    git_provider: 'github'
  }

  if (!isGitRefSpecified()) {
    return {}
  } else if (gitBranch && !gitTag && !gitCommit) {
    return {
      git_source: {
        ...baseGitSourceSpec,
        git_branch: gitBranch
      }
    }
  } else if (gitTag && !gitBranch && !gitCommit) {
    return {
      git_source: {
        ...baseGitSourceSpec,
        git_tag: gitTag
      }
    }
  } else if (gitCommit && !gitBranch && !gitTag) {
    return {
      git_source: {
        ...baseGitSourceSpec,
        git_commit: gitCommit
      }
    }
  } else {
    throw new Error(
      'Only one of `git-branch`, `git-tag`, or `git-commit` must be set, not more.'
    )
  }
}

export const isGitRefSpecified = (): boolean => {
  const gitBranch: string = getInputValue('git-branch')
  const gitTag: string = getInputValue('git-tag')
  const gitCommit: string = getInputValue('git-commit')
  return gitBranch !== '' || gitTag !== '' || gitCommit !== ''
}

export const runStepAndHandleFailure = async (
  runStep: () => Promise<void>
): Promise<void> => {
  try {
    await runStep()
  } catch (error) {
    if (error instanceof Error) {
      tl.setResult(tl.TaskResult.Failed, error.message);
    }
    throw error
  }
}

export const logJobRunUrl = (jobRunUrl: string, jobRunStatus: string): void => {
  // Note: For Azure custom pipeline, console.log() is used to log info.
  console.log(`Notebook run has status ${jobRunStatus}. URL: ${jobRunUrl}`)
}
