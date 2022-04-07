export interface JobRunOutput {
  runId: number
  runUrl: string
  notebookOutput: {
    result: string
    truncated: boolean
  }
}
