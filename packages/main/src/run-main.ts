import * as tl from 'azure-pipelines-task-lib/task'
import {runAndAwaitNotebook} from './run-notebook'
import {
  DATABRICKS_RUN_NOTEBOOK_OUTPUT_KEY,
  DATABRICKS_OUTPUT_TRUNCATED_KEY,
  DATABRICKS_RUN_ID_KEY,
  DATABRICKS_RUN_URL_KEY,
  DATABRICKS_TMP_NOTEBOOK_UPLOAD_DIR_STATE_KEY
} from '../../common/src/constants'
import * as utils from '../../common/src/utils'
import {JobRunOutput} from '../../common/src/interfaces'
import {importNotebookIfNeeded} from './import-tmp-notebook'

async function runHelper(): Promise<void> {
  const databricksHost: string = utils.getDatabricksHost()
  const databricksToken: string = utils.getDatabricksToken()
  const clusterSpec: object = utils.getClusterSpec()
  const librariesSpec: object = utils.getLibrariesSpec()
  const notebookParamsSpec: object = utils.getNotebookParamsSpec()
  const aclSpec: object = utils.getAclSpec()
  const timeoutSpec: object = utils.getTimeoutSpec()
  const runNameSpec: object = utils.getRunNameSpec()
  const gitSourceSpec: object = utils.getGitSourceSpec()

  const nbPath: string = utils.getNotebookPath()
  const workspaceTempDir: string = utils.getWorkspaceTempDir()
  const {notebookPath, tmpNotebookDirectory} = await importNotebookIfNeeded(
    databricksHost,
    databricksToken,
    nbPath,
    workspaceTempDir
  )
  if (tmpNotebookDirectory) {
    tl.setTaskVariable(
      DATABRICKS_TMP_NOTEBOOK_UPLOAD_DIR_STATE_KEY,
      tmpNotebookDirectory
    )
  }

  const runOutput: JobRunOutput = await runAndAwaitNotebook(
    databricksHost,
    databricksToken,
    notebookPath,
    clusterSpec,
    librariesSpec,
    notebookParamsSpec,
    aclSpec,
    timeoutSpec,
    runNameSpec,
    gitSourceSpec
  )
  tl.setVariable(
    DATABRICKS_RUN_NOTEBOOK_OUTPUT_KEY,
    runOutput.notebookOutput.result,
    false,
    true
  )
  tl.setVariable(
    DATABRICKS_OUTPUT_TRUNCATED_KEY,
    String(runOutput.notebookOutput.truncated),
    false,
    true
  )
  tl.setVariable(DATABRICKS_RUN_ID_KEY, String(runOutput.runId), false, true)
  tl.setVariable(DATABRICKS_RUN_URL_KEY, runOutput.runUrl, false, true)
}

export async function runMain(): Promise<void> {
  await utils.runStepAndHandleFailure(runHelper)
}
