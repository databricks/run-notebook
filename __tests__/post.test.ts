import {
  DATABRICKS_HOST,
  TOKEN,
  getGetStateMock,
  getRequestMock,
  mockApiRequest,
  setupExpectedApiCalls
} from './test-utils'
import {deleteTmpNotebooks} from '../packages/post/src/delete-tmp-notebook'
import {DATABRICKS_TMP_NOTEBOOK_UPLOAD_DIR_STATE_KEY} from '../packages/common/src/constants'
import {runPost} from '../packages/post/src/run-post'

// Needs to be at top level of module so that the module-mocking is hoisted
// See https://jestjs.io/docs/manual-mocks#using-with-es-module-imports for details
jest.mock('../packages/common/src/request')

jest.mock('@actions/core', () => {
  return {
    ...jest.requireActual('@actions/core'),
    getState: jest.fn()
  }
})

describe('post-step unit tests', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  const mockUuid = 'MOCK_UUID_FOR_TESTS'
  test.each([
    {
      tmpNotebookDirectory: `/databricks-github-actions/${mockUuid}`
    },
    {
      tmpNotebookDirectory: `/databricks-github-actions/${mockUuid}/`
    }
  ])(
    'deleteTmpNotebooks: successful deletion of directory of notebooks',
    async ({tmpNotebookDirectory}) => {
      setupExpectedApiCalls([
        mockApiRequest(
          '/api/2.0/workspace/delete',
          'POST',
          {path: tmpNotebookDirectory, recursive: true},
          200,
          {}
        )
      ])
      await deleteTmpNotebooks(DATABRICKS_HOST, TOKEN, tmpNotebookDirectory)
      const apiMock = getRequestMock()
      expect(apiMock).toBeCalledTimes(1)
    }
  )

  test('deleteTmpNotebooks: handles API failures', async () => {
    const tmpNotebookDirectory = `/databricks-github-actions/${mockUuid}`
    setupExpectedApiCalls([
      mockApiRequest(
        '/api/2.0/workspace/delete',
        'POST',
        {path: `/databricks-github-actions/${mockUuid}`, recursive: true},
        400,
        {}
      )
    ])
    await expect(async () => {
      await deleteTmpNotebooks(DATABRICKS_HOST, TOKEN, tmpNotebookDirectory)
    }).rejects.toThrow(
      new Error('Request failed with error code 400. Response body: {}')
    )
    const apiMock = getRequestMock()
    expect(apiMock).toBeCalledTimes(1)
  })
})

describe('post step integration tests', () => {
  const workspaceTmpdir = '/databricks-github-actions'
  const nbPath = '__tests__/resources/python-notebook.py'
  const uploadedTmpDir = `${workspaceTmpdir}/mockUuid`

  beforeEach(() => {
    process.env['INPUT_NOTEBOOK-PATH'] = nbPath
    process.env['INPUT_DATABRICKS-HOST'] = DATABRICKS_HOST
    process.env['INPUT_DATABRICKS-TOKEN'] = TOKEN
    process.env['INPUT_WORKSPACE-TEMP-DIR'] = workspaceTmpdir
    getGetStateMock().mockImplementation((key: string) => {
      if (key === DATABRICKS_TMP_NOTEBOOK_UPLOAD_DIR_STATE_KEY) {
        return uploadedTmpDir
      }
      throw new Error(`Tests attempted to fetch unexpected state key ${key}`)
    })
  })

  afterEach(() => {
    delete process.env['INPUT_NOTEBOOK-PATH']
    delete process.env['INPUT_DATABRICKS-HOST']
    delete process.env['INPUT_DATABRICKS-TOKEN']
    delete process.env['INPUT_WORKSPACE-TEMP-DIR']
    jest.resetAllMocks()
  })

  test('post step integration tests', async () => {
    setupExpectedApiCalls([
      mockApiRequest(
        '/api/2.0/workspace/delete',
        'POST',
        {path: uploadedTmpDir, recursive: true},
        200,
        {}
      )
    ])
    await runPost()
    const apiMock = getRequestMock()
    expect(apiMock).toBeCalledTimes(1)
    expect(getGetStateMock()).toBeCalledWith(
      DATABRICKS_TMP_NOTEBOOK_UPLOAD_DIR_STATE_KEY
    )
  })
})
