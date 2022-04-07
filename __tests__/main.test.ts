import {
  DATABRICKS_HOST,
  TOKEN,
  getGetStateMock,
  getRequestMock,
  getSetOutputMock,
  mockApiRequest,
  setupExpectedApiCalls,
  getSaveStateMock
} from './test-utils'
import {runMain} from '../packages/main/src/run-main'
import {
  JOB_RUN_TASK_KEY,
  DATABRICKS_RUN_NOTEBOOK_OUTPUT_KEY,
  DATABRICKS_OUTPUT_TRUNCATED_KEY,
  DATABRICKS_RUN_ID_KEY,
  DATABRICKS_RUN_URL_KEY,
  DATABRICKS_TMP_NOTEBOOK_UPLOAD_DIR_STATE_KEY
} from '../packages/common/src/constants'

const mockUuid = 'MOCK_UUID_FOR_TESTS'
jest.mock('crypto', () => {
  return {
    ...jest.requireActual('crypto'),
    randomUUID: () => 'MOCK_UUID_FOR_TESTS'
  }
})

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
    setOutput: jest.fn()
  }
})

describe(`main's runner integration tests`, () => {
  const workspaceTmpdir = '/databricks-github-actions'
  const expectedNotebookUploadPath = `${workspaceTmpdir}/${mockUuid}/python-notebook.py`

  afterEach(() => {
    delete process.env['INPUT_NOTEBOOK-PATH']
    delete process.env['INPUT_WORKSPACE-TEMP-DIR']
    delete process.env['INPUT_EXISTING-CLUSTER-ID']
    delete process.env['INPUT_NEW-CLUSTER-JSON']
    delete process.env['INPUT_LIBRARIES-JSON']
    delete process.env['INPUT_NOTEBOOK-PARAMS-JSON']
    delete process.env['INPUT_ACCESS-CONTROL-LIST-JSON']
    delete process.env['INPUT_TIMEOUT-SECONDS']
    delete process.env['INPUT_RUN-NAME']
    delete process.env['INPUT_DATABRICKS-HOST']
    delete process.env['INPUT_DATABRICKS-TOKEN']
    delete process.env['INPUT_LOCAL-NOTEBOOK-PATH']
    delete process.env['INPUT_WORKSPACE-NOTEBOOK-PATH']
    jest.restoreAllMocks()
  })

  test('reads all optional inputs, runs notebook, and sets output', async () => {
    const notebookPath = '__tests__/resources/python-notebook.py'
    const expectedRunName = 'My python-notebook run'
    const dummyRunId = 123
    const dummyTaskRunId = 456
    const dummyRunUrl = 'databricks.com/url/to/job/run/'
    const expectedParamsSpec = {
      param1: 'val1',
      param2: 2
    }
    const expectedAclSpec = [
      {
        user_name: 'jsmith@example.com',
        permission_level: 'CAN_MANAGE'
      },
      {
        user_name: 'john.doe@example.com',
        permission_level: 'CAN_EDIT'
      }
    ]
    const expectedlibrariesSpec = [
      {
        jar: 'dbfs:/my-jar.jar',
        whl: 'dbfs:/my/whl',
        pypi: {
          package: 'simplejson==3.8.0',
          repo: 'https://my-repo.com'
        }
      }
    ]
    const expectedNewClusterSpec = {
      num_workers: 0,
      autoscale: {
        min_workers: 0,
        max_workers: 0
      }
    }
    const expectedTimeout = 540

    const expectedRequestWithAllInputSpecs = {
      tasks: [
        {
          task_key: JOB_RUN_TASK_KEY,
          notebook_task: {
            base_parameters: expectedParamsSpec,
            notebook_path: expectedNotebookUploadPath
          },
          new_cluster: expectedNewClusterSpec,
          libraries: expectedlibrariesSpec
        }
      ],
      run_name: expectedRunName,
      access_control_list: expectedAclSpec,
      timeout_seconds: expectedTimeout
    }
    process.env['INPUT_NOTEBOOK-PARAMS-JSON'] =
      JSON.stringify(expectedParamsSpec)
    process.env['INPUT_ACCESS-CONTROL-LIST-JSON'] =
      JSON.stringify(expectedAclSpec)
    process.env['INPUT_LIBRARIES-JSON'] = JSON.stringify(expectedlibrariesSpec)
    process.env['INPUT_NEW-CLUSTER-JSON'] = JSON.stringify(
      expectedNewClusterSpec
    )
    process.env['INPUT_TIMEOUT-SECONDS'] = String(expectedTimeout)
    process.env['INPUT_RUN-NAME'] = expectedRunName
    process.env['INPUT_DATABRICKS-HOST'] = DATABRICKS_HOST
    process.env['INPUT_DATABRICKS-TOKEN'] = TOKEN
    process.env['INPUT_LOCAL-NOTEBOOK-PATH'] = notebookPath
    process.env['INPUT_WORKSPACE-TEMP-DIR'] = workspaceTmpdir

    process.env['INPUT_DATABRICKS-HOST'] = DATABRICKS_HOST
    process.env['INPUT_DATABRICKS-TOKEN'] = TOKEN
    process.env['INPUT_WORKSPACE-TEMP-DIR'] = workspaceTmpdir
    const expectedContent = 'cHJpbnQoIkhlbGxvIHdvcmxkIikK'
    const expectedLanguage = 'PYTHON'
    const expectedWorkspaceMkdir = `${workspaceTmpdir}/${mockUuid}`
    const expectedFormat = 'SOURCE'

    setupExpectedApiCalls([
      mockApiRequest(
        '/api/2.0/workspace/mkdirs',
        'POST',
        {path: expectedWorkspaceMkdir},
        200,
        {}
      ),
      mockApiRequest(
        '/api/2.0/workspace/import',
        'POST',
        {
          path: expectedNotebookUploadPath,
          format: expectedFormat,
          language: expectedLanguage,
          content: expectedContent
        },
        200,
        {}
      ),
      mockApiRequest(
        '/api/2.1/jobs/runs/submit',
        'POST',
        expectedRequestWithAllInputSpecs,
        200,
        {run_id: dummyRunId}
      ),
      mockApiRequest(
        '/api/2.1/jobs/runs/get',
        'GET',
        {run_id: dummyRunId},
        200,
        {
          state: {
            life_cycle_state: 'TERMINATED',
            result_state: 'SUCCESS',
            state_message: 'Run succeeded'
          },
          tasks: [{run_id: dummyTaskRunId}]
        }
      ),
      mockApiRequest(
        '/api/2.1/jobs/runs/get-output',
        'GET',
        {run_id: dummyTaskRunId},
        200,
        {
          notebook_output: {
            result: 'My output',
            truncated: false
          },
          metadata: {
            run_page_url: dummyRunUrl
          }
        }
      )
    ])

    await runMain()
    const apiMock = getRequestMock()
    expect(apiMock).toBeCalledTimes(5)
    expect(getSetOutputMock()).toBeCalledWith(
      DATABRICKS_RUN_NOTEBOOK_OUTPUT_KEY,
      'My output'
    )
    expect(getSetOutputMock()).toBeCalledWith(
      DATABRICKS_OUTPUT_TRUNCATED_KEY,
      false
    )
    expect(getSetOutputMock()).toBeCalledWith(DATABRICKS_RUN_ID_KEY, dummyRunId)
    expect(getSetOutputMock()).toBeCalledWith(
      DATABRICKS_RUN_URL_KEY,
      dummyRunUrl
    )
  })
})
