import * as utils from '../packages/common/src/utils'
import {
  getDebugMock,
  getInfoMock,
  getIsDebugMock,
  getSetFailedMock
} from './test-utils'

jest.mock('@actions/core', () => {
  return {
    ...jest.requireActual('@actions/core'),
    debug: jest.fn(),
    info: jest.fn(),
    isDebug: jest.fn(),
    setFailed: jest.fn()
  }
})

describe(`input utils`, () => {
  describe(`getDatabricksHost`, () => {
    afterEach(() => {
      delete process.env['INPUT_DATABRICKS-HOST']
      delete process.env['DATABRICKS_HOST']
    })

    test('retrevies host from action input', async () => {
      const dummyHost = 'fakecompanynonexistent.cloud.databricks.com'
      process.env['INPUT_DATABRICKS-HOST'] = dummyHost
      expect(utils.getDatabricksHost()).toEqual(dummyHost)
    })

    test('retrevies host from env if input not set', async () => {
      const dummyHost = 'fakecompanynonexistent.cloud.databricks.com'
      process.env['DATABRICKS_HOST'] = dummyHost
      expect(utils.getDatabricksHost()).toEqual(dummyHost)
    })

    test('throws if netheir input nor env variables are set', async () => {
      try {
        utils.getDatabricksHost()
      } catch (err) {
        expect(err).toEqual(
          new Error(
            'Either databricks-host action input or DATABRICKS_HOST env variable must be set.'
          )
        )
      }
    })
  })

  describe(`getDatabricksToken`, () => {
    afterEach(() => {
      delete process.env['INPUT_DATABRICKS-TOKEN']
      delete process.env['DATABRICKS_TOKEN']
    })

    test('retrevies token from action input', async () => {
      const dummyToken = '1234'
      process.env['INPUT_DATABRICKS-TOKEN'] = dummyToken
      expect(utils.getDatabricksToken()).toEqual(dummyToken)
    })

    test('retrevies token from env if input not set', async () => {
      const dummyToken = '1234'
      process.env['DATABRICKS_TOKEN'] = dummyToken
      expect(utils.getDatabricksToken()).toEqual(dummyToken)
    })

    test('throws if neither input nor env variables are set', async () => {
      try {
        utils.getDatabricksToken()
      } catch (err) {
        expect(err).toEqual(
          new Error(
            'Either databricks-token action input or DATABRICKS_TOKEN env variable must be set.'
          )
        )
      }
    })
  })

  describe(`getNotebookPath`, () => {
    afterEach(() => {
      delete process.env['INPUT_LOCAL-NOTEBOOK-PATH']
      delete process.env['INPUT_WORKSPACE-NOTEBOOK-PATH']
      delete process.env['INPUT_GIT-COMMIT']
    })

    test('retrevies local notebook path from action input', async () => {
      const expectedLocalNotebookPath = 'my/relative/path/notebook.py'
      process.env['INPUT_LOCAL-NOTEBOOK-PATH'] = expectedLocalNotebookPath
      expect(utils.getNotebookPath()).toEqual(expectedLocalNotebookPath)
    })

    test('retrevies local notebook path without file extension if isGitRefSpecified', async () => {
      process.env['INPUT_GIT-COMMIT'] = 'dummy-commit'
      const actualLocalNotebookPath = 'my/relative/path/notebook.py'
      const expectedLocalNotebookPath = 'my/relative/path/notebook'
      process.env['INPUT_LOCAL-NOTEBOOK-PATH'] = actualLocalNotebookPath
      expect(utils.getNotebookPath()).toEqual(expectedLocalNotebookPath)
    })

    test('throws if local-notebook-path is an absolute path', async () => {
      const anAbsolutePath = '/Repos/absolte/path/to/notebook.py'
      process.env['INPUT_LOCAL-NOTEBOOK-PATH'] = anAbsolutePath
      expect(utils.getNotebookPath).toThrow(
        `'local-notebook-path' input must be a relative path, instead recieved: ${anAbsolutePath}`
      )
    })

    test('retrevies workspace notebook path from action input', async () => {
      const expectedWorkspaceNotebookPath = '/Repos/absolte/path/to/notebook.py'
      process.env['INPUT_WORKSPACE-NOTEBOOK-PATH'] =
        expectedWorkspaceNotebookPath
      expect(utils.getNotebookPath()).toEqual(expectedWorkspaceNotebookPath)
    })

    test('throws if workspace-notebook-path is not an absolute path', async () => {
      const aRelativePath = 'my/relative/path/notebook.py'
      process.env['INPUT_WORKSPACE-NOTEBOOK-PATH'] = aRelativePath
      expect(utils.getNotebookPath).toThrow(
        `'workspace-notebook-path' input must be an absolute path, instead recieved: ${aRelativePath}`
      )
    })

    test('throws if neither local-notebook-path nor workspace-notebook-path are set', async () => {
      expect(utils.getNotebookPath).toThrow(
        'Either `local-notebook-path` or `workspace-notebook-path` inputs must be set.'
      )
    })

    test('throws if both local-notebook-path and workspace-notebook-path are set', async () => {
      const expectedLocalNotebookPath = 'my/relative/path/notebook.py'
      const expectedWorkspaceNotebookPath = '/Repos/absolte/path/to/notebook.py'
      process.env['INPUT_LOCAL-NOTEBOOK-PATH'] = expectedLocalNotebookPath
      process.env['INPUT_WORKSPACE-NOTEBOOK-PATH'] =
        expectedWorkspaceNotebookPath

      expect(utils.getNotebookPath).toThrow(
        'Only one of `local-notebook-path` and `workspace-notebook-path` must be set, not both.'
      )
    })
  })

  describe(`getClusterSpec`, () => {
    afterEach(() => {
      delete process.env['INPUT_EXISTING-CLUSTER-ID']
      delete process.env['INPUT_NEW-CLUSTER-JSON']
    })

    test('retrevies new cluster spec from action input', async () => {
      const expectedNewClusterSpec = {
        num_workers: 0,
        autoscale: {
          min_workers: 0,
          max_workers: 0
        }
      }
      process.env['INPUT_NEW-CLUSTER-JSON'] = JSON.stringify(
        expectedNewClusterSpec
      )
      expect(utils.getClusterSpec()).toEqual({
        new_cluster: expectedNewClusterSpec
      })
    })

    test('retrevies existing cluster spec from action input', async () => {
      const existingClusterId = 'fakeId123'
      process.env['INPUT_EXISTING-CLUSTER-ID'] = existingClusterId
      expect(utils.getClusterSpec()).toEqual({
        existing_cluster_id: existingClusterId
      })
    })

    test('getClusterSpec throws if neither existing-cluster-id nor new-cluster-json are set', async () => {
      try {
        utils.getClusterSpec()
      } catch (err) {
        expect(err).toEqual(
          new Error(
            'Either `existing-cluster-id` or `new-cluster-json` inputs must be set.'
          )
        )
      }
    })

    test('getClusterSpec throws if both existing-cluster-id and new-cluster-json are set', async () => {
      process.env['INPUT_NEW-CLUSTER-JSON'] = JSON.stringify({
        num_workers: 0
      })
      process.env['INPUT_EXISTING-CLUSTER-ID'] = 'fakeId1234'
      try {
        utils.getClusterSpec()
      } catch (err) {
        expect(err).toEqual(
          new Error(
            'Only one of `existing-cluster-id` and `new-cluster-json` must be set, not both.'
          )
        )
      }
    })
  })

  describe(`getLibrariesSpec`, () => {
    afterEach(() => {
      delete process.env['INPUT_LIBRARIES-JSON']
    })

    test('retrevies libraries from action input', async () => {
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
      process.env['INPUT_LIBRARIES-JSON'] = JSON.stringify(
        expectedlibrariesSpec
      )
      expect(utils.getLibrariesSpec()).toEqual({
        libraries: expectedlibrariesSpec
      })
    })

    test('returns empty object if input is not set', async () => {
      expect(utils.getLibrariesSpec()).toEqual({})
    })
  })

  describe(`getNotebookParamsSpec`, () => {
    afterEach(() => {
      delete process.env['INPUT_NOTEBOOK-PARAMS-JSON']
    })

    test('retrevies notebook params from action input', async () => {
      const expectedParamsSpec = {
        param1: 'val1',
        param2: 2
      }
      process.env['INPUT_NOTEBOOK-PARAMS-JSON'] =
        JSON.stringify(expectedParamsSpec)
      expect(utils.getNotebookParamsSpec()).toEqual({
        base_parameters: expectedParamsSpec
      })
    })

    test('returns empty object if input is not set', async () => {
      expect(utils.getNotebookParamsSpec()).toEqual({})
    })
  })

  describe(`getAclSpec`, () => {
    afterEach(() => {
      delete process.env['INPUT_ACCESS-CONTROL-LIST-JSON']
    })

    test('retrevies acl from action input', async () => {
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
      process.env['INPUT_ACCESS-CONTROL-LIST-JSON'] =
        JSON.stringify(expectedAclSpec)
      expect(utils.getAclSpec()).toEqual({
        access_control_list: expectedAclSpec
      })
    })

    test('returns empty object if input is not set', async () => {
      expect(utils.getAclSpec()).toEqual({})
    })
  })

  describe(`getTimeoutSpec`, () => {
    afterEach(() => {
      delete process.env['INPUT_TIMEOUT-SECONDS']
    })

    test('retrevies timeout from action input', async () => {
      const expectedTimeout = 1200
      process.env['INPUT_TIMEOUT-SECONDS'] = String(expectedTimeout)
      expect(utils.getTimeoutSpec()).toEqual({
        timeout_seconds: expectedTimeout
      })
    })

    test('returns empty object if input is not set', async () => {
      expect(utils.getTimeoutSpec()).toEqual({})
    })
  })

  describe(`getRunNameSpec`, () => {
    afterEach(() => {
      delete process.env['INPUT_RUN-NAME']
    })

    test('retrevies run name from action input', async () => {
      const expectedRunName = 'My Run'
      process.env['INPUT_RUN-NAME'] = expectedRunName
      expect(utils.getRunNameSpec()).toEqual({
        run_name: expectedRunName
      })
    })

    test('returns empty object if input is not set', async () => {
      expect(utils.getRunNameSpec()).toEqual({})
    })
  })

  describe(`getGitSourceSpec`, () => {
    beforeEach(() => {
      process.env['GITHUB_SERVER_URL'] = 'https://my-git.com'
      process.env['GITHUB_REPOSITORY'] = 'dummyOwner/dummyRepo'
    })
    afterEach(() => {
      delete process.env['INPUT_GIT-BRANCH']
      delete process.env['INPUT_GIT-TAG']
      delete process.env['INPUT_GIT-COMMIT']
      delete process.env['GITHUB_SERVER_URL']
      delete process.env['GITHUB_REPOSITORY']
    })

    test('getGitSourceSpec throws if more than one of git-branch, git-tag, git-commit are set', async () => {
      process.env['INPUT_GIT-BRANCH'] = 'my-branch'
      process.env['INPUT_GIT-TAG'] = 'my-tag'
      try {
        utils.getGitSourceSpec()
      } catch (err) {
        expect(err).toEqual(
          new Error(
            'Only one of `git-branch`, `git-tag`, or `git-commit` must be set, not more.'
          )
        )
      }
    })

    test('git_tag is set in getGitSourceSpec correctly if git-tag is passed as input', async () => {
      var expectedTag = 'my-tag'
      process.env['INPUT_GIT-TAG'] = expectedTag
      expect(utils.getGitSourceSpec()).toEqual({
        git_source: {
          git_tag: expectedTag,
          git_url: 'https://my-git.com/dummyOwner/dummyRepo',
          git_provider: 'github'
        }
      })
    })

    test('git_branch is set in getGitSourceSpec correctly if git-branch is passed as input', async () => {
      var expectedBranch = 'my-branch'
      process.env['INPUT_GIT-BRANCH'] = expectedBranch
      expect(utils.getGitSourceSpec()).toEqual({
        git_source: {
          git_branch: expectedBranch,
          git_url: 'https://my-git.com/dummyOwner/dummyRepo',
          git_provider: 'github'
        }
      })
    })

    test('git_commit is set in getGitSourceSpec correctly if git-commit is passed as input', async () => {
      var expectedCommit = 'my-commit'
      process.env['INPUT_GIT-COMMIT'] = expectedCommit
      expect(utils.getGitSourceSpec()).toEqual({
        git_source: {
          git_commit: expectedCommit,
          git_url: 'https://my-git.com/dummyOwner/dummyRepo',
          git_provider: 'github'
        }
      })
    })

    test('returns empty object if no git source input specified', async () => {
      expect(utils.getGitSourceSpec()).toEqual({})
    })
  })

  describe('getWorkspaceTempDir', () => {
    afterEach(() => {
      delete process.env['INPUT_WORKSPACE-TEMP-DIR']
    })

    test('getWorkspaceTempDir reads input', () => {
      const nbPath = '/Users/me/my-notebook'
      process.env['INPUT_WORKSPACE-TEMP-DIR'] = nbPath
      expect(utils.getWorkspaceTempDir()).toEqual(nbPath)
    })

    test('getWorkspaceTempDir validates workspace path', () => {
      const invalidPath = 'invalid/workspace/path'
      process.env['INPUT_WORKSPACE-TEMP-DIR'] = invalidPath
      expect(utils.getWorkspaceTempDir).toThrow(
        new Error(
          `workspace-temp-dir input must be an absolute Databricks workspace path. Got invalid path ${invalidPath}`
        )
      )
    })
  })
})

describe('utils unit tests', () => {
  test('runStepAndHandleFailure marks Action as failed if provided step fails', async () => {
    const mockStepToRun = async () => {
      throw new Error('step failed')
    }
    await expect(async () => {
      await utils.runStepAndHandleFailure(mockStepToRun)
    }).rejects.toThrow(new Error('step failed'))
    expect(getSetFailedMock()).toBeCalledWith('step failed')
  })

  test('debugLogging does not logs debug statement if debug is disabled', async () => {
    getIsDebugMock().mockImplementation(() => false)

    utils.debugLogging('This statement will not get logged')
    expect(getDebugMock()).toBeCalledTimes(0)
  })

  test('debugLogging logs debug statement if debug is enabled', async () => {
    getIsDebugMock().mockImplementation(() => true)

    utils.debugLogging('This statement will get logged')

    expect(getDebugMock()).toBeCalledWith('This statement will get logged')
  })

  test('logJobRunUrl logs job run url', async () => {
    const myJobUrl = 'my-url.com/jobs/run/1234'
    utils.logJobRunUrl(myJobUrl)

    expect(getInfoMock()).toBeCalledWith(`The notebook run url is: ${myJobUrl}`)
  })
})
