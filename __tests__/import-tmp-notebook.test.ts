import {
  DATABRICKS_HOST,
  TOKEN,
  getGitRefMock,
  getRequestMock,
  mockApiRequest,
  setupExpectedApiCalls
} from './test-utils'
import {DATABRICKS_TMP_NOTEBOOK_UPLOAD_DIR_STATE_KEY} from '../packages/common/src/constants'
import {runStepAndHandleFailure} from '../packages/common/src/utils'
import {importNotebookIfNeeded} from '../packages/main/src/import-tmp-notebook'

// Needs to be at top level of module so that the module-mocking is hoisted
// See https://jestjs.io/docs/manual-mocks#using-with-es-module-imports for details
jest.mock('../packages/common/src/request')

jest.mock('crypto', () => {
  return {
    ...jest.requireActual('crypto'),
    randomUUID: () => 'MOCK_UUID_FOR_TESTS'
  }
})

jest.mock('../packages/common/src/utils', () => {
  return {
    ...jest.requireActual('../packages/common/src/utils'),
    isGitRefSpecified: jest.fn()
  }
})

const mockUuid = 'MOCK_UUID_FOR_TESTS'

describe('import-tmp-notebook unit tests', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  test.each([
    {
      workspaceTmpdir: '/databricks-github-actions',
      nbPath: '__tests__/resources/python-notebook.py',
      expectedContent: 'cHJpbnQoIkhlbGxvIHdvcmxkIikK',
      expectedLanguage: 'PYTHON',
      expectedWorkspaceMkdir: `/databricks-github-actions/${mockUuid}`,
      expectedNotebookUploadPath: `/databricks-github-actions/${mockUuid}/python-notebook.py`,
      expectedFormat: 'SOURCE'
    },
    {
      workspaceTmpdir: '/databricks-github-actions/',
      nbPath: '__tests__/resources/python-notebook.py',
      expectedContent: 'cHJpbnQoIkhlbGxvIHdvcmxkIikK',
      expectedLanguage: 'PYTHON',
      expectedWorkspaceMkdir: `/databricks-github-actions/${mockUuid}`,
      expectedNotebookUploadPath: `/databricks-github-actions/${mockUuid}/python-notebook.py`,
      expectedFormat: 'SOURCE'
    },
    {
      workspaceTmpdir: '/databricks-github-actions/',
      nbPath: '__tests__/resources/r-notebook.R',
      expectedContent: 'cHJpbnQoIkhlbGxvIHdvcmxkIikK',
      expectedLanguage: 'R',
      expectedWorkspaceMkdir: `/databricks-github-actions/${mockUuid}`,
      expectedNotebookUploadPath: `/databricks-github-actions/${mockUuid}/r-notebook.R`,
      expectedFormat: 'SOURCE'
    },
    {
      workspaceTmpdir: '/databricks-github-actions/',
      nbPath: '__tests__/resources/scala-notebook.scala',
      expectedContent: 'cHJpbnRsbigiSGVsbG8gd29ybGQiKQo=',
      expectedLanguage: 'SCALA',
      expectedWorkspaceMkdir: `/databricks-github-actions/${mockUuid}`,
      expectedNotebookUploadPath: `/databricks-github-actions/${mockUuid}/scala-notebook.scala`,
      expectedFormat: 'SOURCE'
    },
    {
      workspaceTmpdir: '/databricks-github-actions/',
      nbPath: '__tests__/resources/sql-notebook.sql',
      expectedContent:
        'Q1JFQVRFIFRBQkxFIGRhdGFicmlja3NfZ2l0aHViX2FjdGlvbnM7Cg==',
      expectedLanguage: 'SQL',
      expectedWorkspaceMkdir: `/databricks-github-actions/${mockUuid}`,
      expectedNotebookUploadPath: `/databricks-github-actions/${mockUuid}/sql-notebook.sql`,
      expectedFormat: 'SOURCE'
    },
    {
      workspaceTmpdir: '/databricks-github-actions/',
      nbPath: '__tests__/resources/ipython-notebook.ipynb',
      expectedContent: 'cHJpbnQoIkhlbGxvIHdvcmxkIikK',
      expectedLanguage: 'PYTHON',
      expectedWorkspaceMkdir: `/databricks-github-actions/${mockUuid}`,
      expectedNotebookUploadPath: `/databricks-github-actions/${mockUuid}/ipython-notebook.ipynb`,
      expectedFormat: 'JUPYTER'
    }
  ])(
    'create temporary directory and upload notebook (notebook path = $notebookPath, workspaceTmpdir =' +
      ' $workspaceTmpdir)',
    async ({
      workspaceTmpdir,
      nbPath,
      expectedContent,
      expectedLanguage,
      expectedNotebookUploadPath,
      expectedWorkspaceMkdir,
      expectedFormat
    }) => {
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
        )
      ])
      const {notebookPath, tmpNotebookDirectory} = await importNotebookIfNeeded(
        DATABRICKS_HOST,
        TOKEN,
        nbPath,
        workspaceTmpdir
      )
      expect(notebookPath).toBe(expectedNotebookUploadPath)
      expect(tmpNotebookDirectory).toBe(expectedWorkspaceMkdir)
      const apiMock = getRequestMock()
      expect(apiMock).toBeCalledTimes(2)
    }
  )
  test.each([
    {
      notebookPath: '__tests__/resources/text-notebook.txt',
      fileExtension: '.txt'
    },
    {
      notebookPath: '__tests__/resources/html-notebook.html',
      fileExtension: '.html'
    },
    {
      notebookPath: '__tests__/resources/dbc-notebook.dbc',
      fileExtension: '.dbc'
    }
  ])(
    'throws exception if notebook has unknown file format (notebook path = $notebookPath)',
    async ({notebookPath, fileExtension}) => {
      setupExpectedApiCalls([
        mockApiRequest(
          '/api/2.0/workspace/mkdirs',
          'POST',
          {path: `/tmp/${mockUuid}`},
          200,
          {}
        )
      ])
      await expect(async () => {
        await importNotebookIfNeeded(
          DATABRICKS_HOST,
          TOKEN,
          notebookPath,
          '/tmp'
        )
      }).rejects.toThrow(
        new Error(
          `Cannot run notebook ${notebookPath} with unsupported file extension ${fileExtension}. Supported file extensions are .py, .ipynb, .scala, .R, and .sql`
        )
      )
      const apiMock = getRequestMock()
      expect(apiMock).toBeCalledTimes(1)
    }
  )

  test('importNotebookIfNeeded: handles API failures', async () => {
    setupExpectedApiCalls([
      mockApiRequest(
        '/api/2.0/workspace/mkdirs',
        'POST',
        {path: `/tmp/${mockUuid}`},
        400,
        {}
      )
    ])
    await expect(async () => {
      await importNotebookIfNeeded(
        DATABRICKS_HOST,
        TOKEN,
        '__tests__/resources/python-notebook.py',
        '/tmp'
      )
    }).rejects.toThrow(
      new Error('Request failed with error code 400. Response body: {}')
    )
    const apiMock = getRequestMock()
    expect(apiMock).toBeCalledTimes(1)
  })

  test('importNotebookIfNeeded: handles nonexistent notebook path', async () => {
    setupExpectedApiCalls([
      mockApiRequest(
        '/api/2.0/workspace/mkdirs',
        'POST',
        {path: `/tmp/${mockUuid}`},
        200,
        {}
      )
    ])
    await expect(async () => {
      await importNotebookIfNeeded(
        DATABRICKS_HOST,
        TOKEN,
        './nonexistent-local-path',
        '/tmp'
      )
    }).rejects.toThrow(
      new Error(
        'Failed to read contents of notebook at local filesystem path ./nonexistent-local-path. Original error:\n' +
          "Error: ENOENT: no such file or directory, open './nonexistent-local-path'"
      )
    )
    const apiMock = getRequestMock()
    expect(apiMock).toBeCalledTimes(1)
  })

  test.each([
    {
      notebookPath: '/Workspace/Shared/python-notebook.py'
    },
    {
      notebookPath: '/Repos/Shared/my-ml-repo/model-training.py'
    },
    {
      notebookPath: '/Users/me/my-notebook.R'
    }
  ])(
    'importNotebookIfNeeded does not try to import notebook if it already exists in the workspace (notebook path =' +
      ' $notebookPath)',
    async ({notebookPath}) => {
      await importNotebookIfNeeded(DATABRICKS_HOST, TOKEN, notebookPath, '/tmp')
      const apiMock = getRequestMock()
      expect(apiMock).not.toBeCalled()
    }
  )

  test('importNotebookIfNeeded does not try to import notebook if git-ref is provided', async () => {
    const relativeNotebookPath = '__tests__/resources/python-notebook.py'
    getGitRefMock().mockImplementation(() => true)
    const {notebookPath, tmpNotebookDirectory} = await importNotebookIfNeeded(
      DATABRICKS_HOST,
      TOKEN,
      relativeNotebookPath,
      '/tmp'
    )
    expect(notebookPath).toBe(relativeNotebookPath)
    expect(tmpNotebookDirectory).toBeUndefined()
    const apiMock = getRequestMock()
    expect(apiMock).not.toBeCalled()
  })
})
