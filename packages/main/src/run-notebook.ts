import * as tl from "azure-pipelines-task-lib";
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
      tl.setResult(tl.TaskResult.Failed, error.message)
    }
    throw error
  }
}
