import {OutgoingHttpHeaders} from 'http'

export const DATABRICKS_HOST = 'fakecompanynonexistent.cloud.databricks.com'
export const TOKEN = 'abcd'
const actionVersion = require('../package.json').version

class MockApiRequest {
  hostname: string
  token: string
  path: string
  method: string
  reqBody: object
  responseStatus: number
  responseBody: object

  constructor(
    hostname: string,
    token: string,
    path: string,
    method: string,
    reqBody: object,
    responseStatus: number,
    responseBody: object
  ) {
    this.hostname = hostname
    this.token = token
    this.path = path
    this.method = method
    this.reqBody = reqBody
    this.responseStatus = responseStatus
    this.responseBody = responseBody
  }
}

export const setupExpectedApiCalls = (expectedApiCalls: MockApiRequest[]) => {
  let requestCounter = 0
  getRequestMock().mockImplementation(
    async (
      hostname: string,
      path: string,
      method: string,
      headers: OutgoingHttpHeaders,
      reqBody: object
    ) => {
      const nextExpectedApiCall = expectedApiCalls[requestCounter++]
      expect(nextExpectedApiCall).toBeDefined()
      const expectedFields = {
        hostname: nextExpectedApiCall.hostname,
        path: nextExpectedApiCall.path,
        method: nextExpectedApiCall.method,
        headers: getExpectedHeaders(nextExpectedApiCall.token),
        reqBody: nextExpectedApiCall.reqBody
      }
      const actualFields = {
        hostname,
        path,
        method,
        headers,
        reqBody
      }
      expect(actualFields).toEqual(expectedFields)
      if (nextExpectedApiCall.responseStatus === 200) {
        return Promise.resolve(nextExpectedApiCall.responseBody)
      } else {
        return Promise.reject(
          new Error(
            `Request failed with error code ${nextExpectedApiCall.responseStatus}. Response` +
              ` body: ${JSON.stringify(nextExpectedApiCall.responseBody)}`
          )
        )
      }
    }
  )
}

export const getGetStateMock = (): jest.Mock => {
  return require('@actions/core').getState as jest.Mock
}

export const getSetOutputMock = (): jest.Mock => {
  return require('@actions/core').setOutput as jest.Mock
}

export const getSaveStateMock = (): jest.Mock => {
  return require('@actions/core').saveState as jest.Mock
}

export const getSetFailedMock = (): jest.Mock => {
  return require('@actions/core').setFailed as jest.Mock
}

export const getRequestMock = (): jest.Mock => {
  return require('../packages/common/src/request').httpRequest as jest.Mock
}

export const getInfoMock = (): jest.Mock => {
  return require('@actions/core').info as jest.Mock
}

export const getIsDebugMock = (): jest.Mock => {
  return require('@actions/core').isDebug as jest.Mock
}

export const getDebugMock = (): jest.Mock => {
  return require('@actions/core').debug as jest.Mock
}

export const getGitRefMock = (): jest.Mock => {
  return require('../packages/common/src/utils').isGitRefSpecified as jest.Mock
}

const getExpectedHeaders = (token: string) => {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'text/json',
    'User-Agent': `databricks-github-action-run-notebook/${actionVersion}`
  }
}

export const mockApiRequest = (
  path: string,
  method: string,
  reqBody: object,
  responseStatus: number,
  responseBody: object
): MockApiRequest => {
  return new MockApiRequest(
    DATABRICKS_HOST,
    TOKEN,
    path,
    method,
    reqBody,
    responseStatus,
    responseBody
  )
}
