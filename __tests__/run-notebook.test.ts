import {runAndAwaitNotebook} from '../packages/main/src/run-notebook'
import {
  DATABRICKS_HOST,
  TOKEN,
  getRequestMock,
  mockApiRequest,
  getInfoMock,
  setupExpectedApiCalls
} from './test-utils'
import {JOB_RUN_TASK_KEY} from '../packages/common/src/constants'

// Needs to be at top level of module so that the module-mocking is hoisted
// See https://jestjs.io/docs/manual-mocks#using-with-es-module-imports for details
jest.mock('../packages/common/src/request')
// Mocking timers with jest.useFakeTimers doesn't work reliably because we in some cases recursively create a timer
// from another timer. Instead, we just mock out polling/wait intervals here
jest.mock('../packages/common/src/constants', () => {
  return {
    ...jest.requireActual('../packages/common/src/constants'),
    GET_JOB_STATUS_POLL_INTERVAL_SECS: 0
  }
})

jest.mock('@actions/core', () => {
  return {
    ...jest.requireActual('@actions/core'),
    getState: jest.fn(),
    setFailed: jest.fn(),
    setOutput: jest.fn(),
    info: jest.fn()
  }
})

describe('run-notebook integration tests', () => {
  const runId = 123
  const taskRunId = 456
  const notebookPath = '/Users/mohamad.arabi@databricks.com/Hello World'
  const clusterId = 'fakeclusterid'
  const fakeClusterSpec = {existing_cluster_id: clusterId}
  const runPageUrl = 'http://run-page-url.databricks.com'
  const expectedRunSubmitRequestBody = {
    tasks: [
      {
        task_key: JOB_RUN_TASK_KEY,
        notebook_task: {
          notebook_path: notebookPath
        },
        ...fakeClusterSpec
      }
    ]
  }

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('can run and await job: successful case', async () => {
    setupExpectedApiCalls([
      mockApiRequest(
        '/api/2.1/jobs/runs/submit',
        'POST',
        expectedRunSubmitRequestBody,
        200,
        {run_id: runId}
      ),
      mockApiRequest('/api/2.1/jobs/runs/get', 'GET', {run_id: runId}, 200, {
        tasks: [{run_id: taskRunId}],
        state: {
          life_cycle_state: 'TERMINATED',
          result_state: 'SUCCESS',
          state_message: 'Run succeeded'
        },
        run_page_url: runPageUrl
      }),
      mockApiRequest(
        '/api/2.1/jobs/runs/get-output',
        'GET',
        {run_id: taskRunId},
        200,
        {
          notebook_output: {
            result: 'My output',
            truncated: false
          },
          metadata: {
            run_page_url: 'dummy/Run/Url'
          }
        }
      )
    ])
    await runAndAwaitNotebook(
      DATABRICKS_HOST,
      TOKEN,
      notebookPath,
      fakeClusterSpec
    )
    const apiMock = getRequestMock()
    expect(apiMock).toBeCalledTimes(3)
    const infoMock = getInfoMock()
    expect(infoMock).toBeCalledTimes(1)
    expect(infoMock).toBeCalledWith(
      `Notebook run has status TERMINATED. URL: ${runPageUrl}`
    )
  })

  test('all optional inputs from runAndAwaitNotebook are passed in correctly to request body of runs/submit', async () => {
    const expectedParamsSpec = {
      base_parameters: {
        param1: 'val1',
        param2: 2
      }
    }
    const expectedAclSpec = {
      access_control_list: [
        {
          user_name: 'jsmith@example.com',
          permission_level: 'CAN_MANAGE'
        },
        {
          user_name: 'john.doe@example.com',
          permission_level: 'CAN_EDIT'
        }
      ]
    }
    const expectedlibrariesSpec = {
      libraries: [
        {jar: 'dbfs:/my-jar.jar'},
        {whl: 'dbfs:/my/whl'},
        {
          pypi: {
            package: 'simplejson==3.8.0',
            repo: 'https://my-repo.com'
          }
        }
      ]
    }
    const expectedNewClusterSpec = {
      new_cluster: {
        num_workers: 0,
        autoscale: {
          min_workers: 0,
          max_workers: 0
        }
      }
    }
    const expectedTimeoutSpec = {timeout_seconds: 540}
    const expectedRunNameSpec = {run_name: 'my run'}

    const expectedRequestWithAllInputSpecs = {
      tasks: [
        {
          task_key: JOB_RUN_TASK_KEY,
          notebook_task: {
            notebook_path: notebookPath,
            ...expectedParamsSpec
          },
          ...expectedNewClusterSpec,
          ...expectedlibrariesSpec
        }
      ],
      ...expectedAclSpec,
      ...expectedTimeoutSpec,
      ...expectedRunNameSpec
    }
    setupExpectedApiCalls([
      mockApiRequest(
        '/api/2.1/jobs/runs/submit',
        'POST',
        expectedRequestWithAllInputSpecs,
        200,
        {run_id: runId}
      ),
      mockApiRequest('/api/2.1/jobs/runs/get', 'GET', {run_id: runId}, 200, {
        tasks: [{run_id: taskRunId}],
        state: {
          life_cycle_state: 'TERMINATED',
          result_state: 'SUCCESS',
          state_message: 'Run succeeded'
        },
        run_page_url: runPageUrl
      }),
      mockApiRequest(
        '/api/2.1/jobs/runs/get-output',
        'GET',
        {run_id: taskRunId},
        200,
        {
          notebook_output: {
            result: 'My output',
            truncated: false
          },
          metadata: {
            run_page_url: 'dummy/Run/Url'
          }
        }
      )
    ])
    await runAndAwaitNotebook(
      DATABRICKS_HOST,
      TOKEN,
      notebookPath,
      expectedNewClusterSpec,
      expectedlibrariesSpec,
      expectedParamsSpec,
      expectedAclSpec,
      expectedTimeoutSpec,
      expectedRunNameSpec
    )
    const apiMock = getRequestMock()
    expect(apiMock).toBeCalledTimes(3)
  })

  test('can run and await job: several requests needed to get run status', async () => {
    setupExpectedApiCalls([
      mockApiRequest(
        '/api/2.1/jobs/runs/submit',
        'POST',
        expectedRunSubmitRequestBody,
        200,
        {run_id: runId}
      ),
      mockApiRequest('/api/2.1/jobs/runs/get', 'GET', {run_id: runId}, 200, {
        tasks: [{run_id: taskRunId}],
        state: {
          life_cycle_state: 'PENDING'
        },
        run_page_url: runPageUrl
      }),
      mockApiRequest('/api/2.1/jobs/runs/get', 'GET', {run_id: runId}, 200, {
        tasks: [{run_id: taskRunId}],
        state: {
          life_cycle_state: 'RUNNING'
        },
        run_page_url: runPageUrl
      }),
      mockApiRequest('/api/2.1/jobs/runs/get', 'GET', {run_id: runId}, 200, {
        tasks: [{run_id: taskRunId}],
        state: {
          life_cycle_state: 'RUNNING'
        },
        run_page_url: runPageUrl
      }),
      mockApiRequest('/api/2.1/jobs/runs/get', 'GET', {run_id: runId}, 200, {
        tasks: [{run_id: taskRunId}],
        state: {
          life_cycle_state: 'TERMINATED',
          result_state: 'SUCCESS',
          state_message: 'Run succeeded'
        },
        run_page_url: runPageUrl
      }),
      mockApiRequest(
        '/api/2.1/jobs/runs/get-output',
        'GET',
        {run_id: taskRunId},
        200,
        {
          notebook_output: {
            result: 'My output',
            truncated: false
          },
          metadata: {
            run_page_url: 'dummy/Run/Url'
          }
        }
      )
    ])
    await runAndAwaitNotebook(
      DATABRICKS_HOST,
      TOKEN,
      notebookPath,
      fakeClusterSpec
    )
    const apiMock = getRequestMock()
    expect(apiMock).toBeCalledTimes(6)
    // Expect job URL to be printed on each call to /runs/get
    const infoMock = getInfoMock()
    expect(infoMock.mock.calls).toEqual(
      ['PENDING', 'RUNNING', 'RUNNING', 'TERMINATED'].map(runStatus => [
        `Notebook run has status ${runStatus}. URL: ${runPageUrl}`
      ])
    )
  })

  test.each([
    // Test each failure state from https://docs.databricks.com/dev-tools/api/2.0/jobs.html#runresultstate
    {lifeCycleState: 'SKIPPED', stateMessage: 'Run skipped'},
    {
      lifeCycleState: 'INTERNAL_ERROR',
      stateMessage: 'Run failed with internal error'
    },
    {
      lifeCycleState: 'INTERNAL_ERROR',
      resultState: 'FAILED',
      stateMessage: 'Run failed due to internal error'
    },
    {
      lifeCycleState: 'INTERNAL_ERROR',
      resultState: 'CANCELED',
      stateMessage: 'Run cancelled and then an internal error occurred'
    },
    {
      lifeCycleState: 'INTERNAL_ERROR',
      resultState: 'TIMEDOUT',
      stateMessage: 'Run timed out and then an internal error occurred'
    },
    {
      lifeCycleState: 'TERMINATED',
      resultState: 'FAILED',
      stateMessage: 'Run failed'
    },
    {
      lifeCycleState: 'TERMINATED',
      resultState: 'CANCELED',
      stateMessage: 'Run cancelled'
    },
    {
      lifeCycleState: 'TERMINATED',
      resultState: 'TIMEDOUT',
      stateMessage: 'Run timed out'
    }
  ])(
    'run and await job: handles job failures (result_state = $resultState)',
    async ({lifeCycleState, resultState, stateMessage}) => {
      setupExpectedApiCalls([
        mockApiRequest(
          '/api/2.1/jobs/runs/submit',
          'POST',
          expectedRunSubmitRequestBody,
          200,
          {run_id: runId}
        ),
        mockApiRequest('/api/2.1/jobs/runs/get', 'GET', {run_id: runId}, 200, {
          tasks: [{run_id: taskRunId}],
          state: {
            life_cycle_state: 'PENDING'
          }
        }),
        mockApiRequest('/api/2.1/jobs/runs/get', 'GET', {run_id: runId}, 200, {
          tasks: [{run_id: taskRunId}],
          state: {
            life_cycle_state: 'RUNNING'
          }
        }),
        mockApiRequest('/api/2.1/jobs/runs/get', 'GET', {run_id: runId}, 200, {
          tasks: [{run_id: taskRunId}],
          state: {
            life_cycle_state: 'RUNNING'
          }
        }),
        mockApiRequest('/api/2.1/jobs/runs/get', 'GET', {run_id: runId}, 200, {
          tasks: [{run_id: taskRunId}],
          state: {
            ...(resultState ? {result_state: resultState} : {}),
            life_cycle_state: lifeCycleState,
            state_message: stateMessage
          }
        })
      ])
      await expect(async () => {
        await runAndAwaitNotebook(
          DATABRICKS_HOST,
          TOKEN,
          notebookPath,
          fakeClusterSpec
        )
      }).rejects.toThrow(new Error(`Job run did not succeed: ${stateMessage}`))
      const apiMock = getRequestMock()
      expect(apiMock).toBeCalledTimes(5)
    }
  )

  test('run and await job: handles API failures', async () => {
    setupExpectedApiCalls([
      mockApiRequest(
        '/api/2.1/jobs/runs/submit',
        'POST',
        expectedRunSubmitRequestBody,
        200,
        {run_id: runId}
      ),
      mockApiRequest('/api/2.1/jobs/runs/get', 'GET', {run_id: runId}, 200, {
        tasks: [{run_id: taskRunId}],
        state: {
          life_cycle_state: 'PENDING'
        }
      }),
      mockApiRequest('/api/2.1/jobs/runs/get', 'GET', {run_id: runId}, 200, {
        tasks: [{run_id: taskRunId}],
        state: {
          life_cycle_state: 'RUNNING'
        }
      }),
      mockApiRequest('/api/2.1/jobs/runs/get', 'GET', {run_id: runId}, 403, {
        errorCode: 'INVALID_PARAMETER_VALUE',
        message: 'Invalid API token'
      })
    ])
    await expect(async () => {
      await runAndAwaitNotebook(
        DATABRICKS_HOST,
        TOKEN,
        notebookPath,
        fakeClusterSpec
      )
    }).rejects.toThrow(
      new Error(
        'Request failed with error code 403. Response body: {"errorCode":"INVALID_PARAMETER_VALUE","message":"Invalid API token"}'
      )
    )
    const apiMock = getRequestMock()
    expect(apiMock).toBeCalledTimes(4)
  })
})
