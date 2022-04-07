import {ApiClient} from '../../common/src/api-client'

export const deleteTmpNotebooks = async (
  databricksHost: string,
  databricksToken: string,
  tmpNotebookDirectory: string
): Promise<void> => {
  const apiClient = new ApiClient(databricksHost, databricksToken)
  await apiClient.deleteDirectory(tmpNotebookDirectory)
}
