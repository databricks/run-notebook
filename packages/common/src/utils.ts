import * as core from '@actions/core'
import * as github from '@actions/github'
import {isAbsolute} from 'path'

export const getDatabricksHost = (): string => {
  const hostFromInput = core.getInput('databricks-host')
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
  const res = core.getInput('workspace-temp-dir')
  if (!res.startsWith('/')) {
    throw new Error(
      `workspace-temp-dir input must be an absolute Databricks workspace path. Got invalid path ${res}`
    )
  }
  return res
}

export const getDatabricksToken = (): string => {
  const tokenFromInput = core.getInput('databricks-token')
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
  const localNotebookPath: string = core.getInput('local-notebook-path')
  const workspaceNotebookPath: string = core.getInput('workspace-notebook-path')

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
  const existingClusterId: string = core.getInput('existing-cluster-id')
  const newClusterJsonString: string = core.getInput('new-cluster-json')

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
  const librariesJsonString: string = core.getInput('libraries-json')
  return librariesJsonString
    ? {
        libraries: JSON.parse(librariesJsonString)
      }
    : {}
}

export const getNotebookParamsSpec = (): object => {
  const paramsJsonString: string = core.getInput('notebook-params-json')
  return paramsJsonString
    ? {
        base_parameters: JSON.parse(paramsJsonString)
      }
    : {}
}

export const getAclSpec = (): object => {
  const aclJsonString: string = core.getInput('access-control-list-json')
  return aclJsonString
    ? {
        access_control_list: JSON.parse(aclJsonString)
      }
    : {}
}

export const getTimeoutSpec = (): object => {
  const timeoutInSeconds: string = core.getInput('timeout-seconds')
  return timeoutInSeconds
    ? {
        timeout_seconds: Number(timeoutInSeconds)
      }
    : {}
}

export const getRunNameSpec = (): object => {
  const runName: string = core.getInput('run-name')
  return runName
    ? {
        run_name: runName
      }
    : {}
}

export const getGitSourceSpec = (): object => {
  const gitBranch: string = core.getInput('git-branch')
  const gitTag: string = core.getInput('git-tag')
  const gitCommit: string = core.getInput('git-commit')
  const gitProvider: string = core.getInput('git-provider')
  const githubServerUrl: string = process.env['GITHUB_SERVER_URL'] || ''
  const githubRepo: string = process.env['GITHUB_REPOSITORY'] || ''
  const baseGitSourceSpec = {
    git_url: `${githubServerUrl}/${githubRepo}`,
    git_provider: gitProvider
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
  const gitBranch: string = core.getInput('git-branch')
  const gitTag: string = core.getInput('git-tag')
  const gitCommit: string = core.getInput('git-commit')
  return gitBranch !== '' || gitTag !== '' || gitCommit !== ''
}

export const runStepAndHandleFailure = async (
  runStep: () => Promise<void>
): Promise<void> => {
  try {
    await runStep()
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    }
    throw error
  }
}

export const debugLogging = (logStatement: string): void => {
  if (core.isDebug()) {
    core.debug(logStatement)
  }
}

export const logJobRunUrl = (jobRunUrl: string, jobRunStatus: string): void => {
  core.info(`Notebook run has status ${jobRunStatus}. URL: ${jobRunUrl}`)
}

export const commentToPr = async (
  notebookResult: string,
  notebookPath: string,
  runUrl: string
): Promise<void> => {
  try {
    const prCommentGithubToken: string = core.getInput(
      'pr-comment-github-token'
    )
    const octokit = github.getOctokit(prCommentGithubToken)
    const githubContext = github.context
    const issueNumber = githubContext.issue?.number
    const body = `### run-notebook github action results:
#### Notebook path: 
${notebookPath}
#### Notebook run url: 
${runUrl}
#### Notebook Output:
${notebookResult}`

    // Only attempt to comment on PR if able to retrieve pull request info from context.
    if (issueNumber) {
      await octokit.rest.issues.createComment({
        issue_number: issueNumber,
        owner: githubContext.repo.owner,
        repo: githubContext.repo.repo,
        body: body
      })
    } else {
      const docLink =
        'https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#pull_request'
      core.info(`
        No issue number was found to use for commenting on pull request.
        Please use 'pull_request' as workflow dispatch to add
        a PR comment containing the notebook run result.(${docLink})
      `)
    }
  } catch (e) {
    core.warning(
      `An error occurred when attempting to add a PR comment containing the notebook run result: ${e}`
    )
  }
}

export const shouldCommentToPr = (): boolean => {
  const prCommentGithubToken: string =
    core.getInput('pr-comment-github-token') || ''
  return prCommentGithubToken !== ''
}
