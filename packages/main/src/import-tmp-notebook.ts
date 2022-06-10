import * as path from 'path'
import * as tl from 'azure-pipelines-task-lib/task'
import {DATABRICKS_TMP_NOTEBOOK_UPLOAD_DIR_STATE_KEY} from '../../common/src/constants'
import {ApiClient} from '../../common/src/api-client'
import {randomUUID} from 'crypto'
import {isAbsolute} from 'path'
import {isGitRefSpecified} from '../../common/src/utils'

const getNotebookUploadDirectory = (workspaceTempDir: string): string => {
  const baseDir = workspaceTempDir.endsWith('/')
    ? workspaceTempDir
    : `${workspaceTempDir}/`
  return `${baseDir}${randomUUID()}`
}

const importTmpNotebook0 = async (
  databricksHost: string,
  databricksToken: string,
  localNotebookPath: string,
  workspaceTempDir: string
): Promise<{tmpNotebookPath: string; tmpNotebookDirectory: string}> => {
  const tmpNotebookDirectory = getNotebookUploadDirectory(workspaceTempDir)
  const apiClient = new ApiClient(databricksHost, databricksToken)
  await apiClient.workspaceMkdirs(tmpNotebookDirectory)
  tl.setTaskVariable(
    DATABRICKS_TMP_NOTEBOOK_UPLOAD_DIR_STATE_KEY,
    tmpNotebookDirectory
  )
  const notebookFilename = path.basename(localNotebookPath)
  const tmpNotebookPath = path.join(tmpNotebookDirectory, notebookFilename)
  await apiClient.importNotebook(localNotebookPath, tmpNotebookPath)
  return {tmpNotebookPath, tmpNotebookDirectory}
}

const importTmpNotebook = async (
  databricksHost: string,
  databricksToken: string,
  localNotebookPath: string,
  workspaceTempDir: string
): Promise<{tmpNotebookPath: string; tmpNotebookDirectory: string}> => {
  try {
    return await importTmpNotebook0(
      databricksHost,
      databricksToken,
      localNotebookPath,
      workspaceTempDir
    )
  } catch (error) {
    if (error instanceof Error) {
      tl.setResult(tl.TaskResult.Failed, error.message)
    }
    throw error
  }
}

export const importNotebookIfNeeded = async (
  databricksHost: string,
  databricksToken: string,
  notebookPath: string,
  workspaceTmpDir: string
): Promise<{notebookPath: string; tmpNotebookDirectory?: string}> => {
  if (isAbsolute(notebookPath) || isGitRefSpecified()) {
    return {notebookPath}
  }
  const {tmpNotebookPath, tmpNotebookDirectory} = await importTmpNotebook(
    databricksHost,
    databricksToken,
    notebookPath,
    workspaceTmpDir
  )
  return {notebookPath: tmpNotebookPath, tmpNotebookDirectory}
}
