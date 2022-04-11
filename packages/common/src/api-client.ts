import {GET_JOB_STATUS_POLL_INTERVAL_SECS, JOB_RUN_TASK_KEY} from './constants'
import {debugLogging, logJobRunUrl} from './utils'
import {Buffer} from 'buffer'
import {JobRunOutput} from './interfaces'
import {extname} from 'path'
import {httpRequest} from './request'
import {readFileSync} from 'fs'

// Copying from https://github.com/databricks/databricks-cli/blob/1e39ccfdbab47ee2ca7f320b81146e2bcabb2f97/databricks_cli/sdk/api_client.py
export class ApiClient {
  host: string
  token: string
  actionVerson: string

  constructor(host: string, token: string) {
    this.host = host
    this.token = token
    this.actionVerson = require('../../../package.json').version
  }

  async request(path: string, method: string, body: object): Promise<object> {
    const headers = {
      Authorization: `Bearer ${this.token}`,
      'User-Agent': `databricks-github-action-run-notebook/${this.actionVerson}`,
      'Content-Type': 'text/json'
    }
    return httpRequest(this.host, path, method, headers, body)
  }

  // Trigger notebook job and return its ID
  async triggerNotebookJob(
    path: string,
    clusterSpec: object,
    librariesSpec?: object,
    paramsSpec?: object,
    aclListSpec?: object,
    timeoutSpec?: object,
    runNameSpec?: object,
    gitSourceSpec?: object
  ): Promise<number> {
    const requestBody = {
      tasks: [
        {
          task_key: JOB_RUN_TASK_KEY,
          notebook_task: {
            notebook_path: path,
            ...paramsSpec
          },
          ...clusterSpec,
          ...librariesSpec
        }
      ],
      ...aclListSpec,
      ...timeoutSpec,
      ...runNameSpec,
      ...gitSourceSpec
    }

    debugLogging(
      `The job spec input to runs/submit is: ${JSON.stringify(requestBody)}`
    )

    const response = (await this.request(
      '/api/2.1/jobs/runs/submit',
      'POST',
      requestBody
    )) as {run_id: number}
    return response.run_id
  }

  async awaitJobAndGetOutput(runId: number): Promise<JobRunOutput> {
    const requestBody = {run_id: runId}
    const response = (await this.request(
      '/api/2.1/jobs/runs/get',
      'GET',
      requestBody
    )) as {
      state: {
        life_cycle_state: string
        result_state: string
        state_message: string
      }
      run_page_url: string
      tasks: {run_id: string}[]
    }

    logJobRunUrl(response.run_page_url, response.state.life_cycle_state)

    const taskRunId = response.tasks[0].run_id
    const terminalStates = new Set(['TERMINATED', 'SKIPPED', 'INTERNAL_ERROR'])
    if (terminalStates.has(response.state.life_cycle_state)) {
      if (response.state.result_state === 'SUCCESS') {
        const outputResponse = (await this.request(
          '/api/2.1/jobs/runs/get-output',
          'GET',
          {run_id: taskRunId}
        )) as {
          notebook_output: {
            result: string
            truncated: boolean
          }
          metadata: {
            run_page_url: string
          }
        }
        return {
          runId,
          runUrl: outputResponse.metadata.run_page_url,
          notebookOutput: {
            result: outputResponse.notebook_output.result,
            truncated: outputResponse.notebook_output.truncated
          }
        }
      } else {
        throw new Error(
          `Job run did not succeed: ${response.state.state_message}`
        )
      }
    } else {
      await new Promise(f =>
        setTimeout(f, GET_JOB_STATUS_POLL_INTERVAL_SECS * 1000)
      )
      return await this.awaitJobAndGetOutput(runId)
    }
  }

  async deleteDirectory(path: string): Promise<void> {
    await this.request('/api/2.0/workspace/delete', 'POST', {
      path,
      recursive: true
    })
  }

  async workspaceMkdirs(path: string): Promise<void> {
    const requestBody = {
      path
    }
    await this.request('/api/2.0/workspace/mkdirs', 'POST', requestBody)
  }

  readNotebookContents(path: string): string {
    try {

      return readFileSync(path, 'utf8')
    } catch (error) {
      throw new Error(
        `Failed to read contents of notebook at local filesystem path ${path}. Original error:\n${error}`
      )
    }
  }

  async importNotebook(srcPath: string, dstPath: string): Promise<void> {
    const fileContents = this.readNotebookContents(srcPath)
    const base64FileContents = new Buffer(fileContents).toString('base64')
    const fileSuffix = extname(srcPath).toLowerCase()
    let format = 'SOURCE'
    let language: string
    switch (fileSuffix) {
      case '.py':
        language = 'PYTHON'
        break
      case '.ipynb':
        format = 'JUPYTER'
        language = 'PYTHON'
        break
      case '.scala':
        language = 'SCALA'
        break
      case '.r':
        language = 'R'
        break
      case '.sql':
        language = 'SQL'
        break
      default:
        throw new Error(
          `Cannot run notebook ${srcPath} with unsupported file extension ${fileSuffix}. Supported file extensions are .py, .ipynb, .scala, .R, and .sql`
        )
    }
    const requestBody = {
      path: dstPath,
      content: base64FileContents,
      format,
      language
    }
    await this.request('/api/2.0/workspace/import', 'POST', requestBody)
  }
}
