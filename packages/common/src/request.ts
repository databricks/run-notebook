import {OutgoingHttpHeaders} from 'http'
import https from 'https'

// Logic copied & coverted from https://nodejs.dev/learn/making-http-requests-with-nodejs
export const httpRequest = async (
  baseUrl: string,
  path: string,
  method: string,
  headers: OutgoingHttpHeaders,
  reqBody: object
): Promise<object> => {
  const hostname = new URL(baseUrl).host
  const requestBody = JSON.stringify(reqBody)
  headers['Content-Type'] = headers['Content-Type']
    ? headers['Content-Type']
    : 'application/json'
  headers['Content-Length'] = Buffer.byteLength(requestBody)
  const options = {
    hostname,
    path,
    method,
    headers
  }

  return new Promise((resolve, reject) => {
    let result = ''
    const req = https.request(options, res => {
      res.on('data', chunk => {
        result += chunk
      })

      res.on('error', err => {
        reject(err)
      })

      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            resolve(JSON.parse(result))
          } else {
            reject(new Error(result))
          }
        } catch (err) {
          reject(err)
        }
      })
    })

    req.on('error', err => {
      reject(err)
    })

    if (reqBody) {
      req.write(requestBody)
    }
    req.end()
  })
}
