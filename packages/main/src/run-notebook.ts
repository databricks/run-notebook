import * as core from '@actions/core'
import {ApiClient} from '../../common/src/api-client'
import {JobRunOutput} from '../../common/src/interfaces'

export const runAndAwaitNotebook = async (
  databricksHost: string,
  databricksToken: string,
  notebookPath: string,
  clusterSpec: object,
  librariesSpec?: object,
  notebookParamsSpec?: object,
  aclSpec?: object,
  timeoutSpec?: object,
  runNameSpec?: object,
  gitSourceSpec?: object
): Promise<JobRunOutput> => {
  try {
    const apiClient = new ApiClient(databricksHost, databricksToken)
    const triggeredJobRunId = await apiClient.triggerNotebookJob(
      notebookPath,
      clusterSpec,
      librariesSpec,
      notebookParamsSpec,
      aclSpec,
      timeoutSpec,
      runNameSpec,
      gitSourceSpec
    )
    return await apiClient.awaitJobAndGetOutput(triggeredJobRunId)
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    }
    throw error
  }
}
