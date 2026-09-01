// skipcq: JS-0067 -- ESM module scope, not a browser global
/** Mark a promise as intentionally floating (avoids DeepSource JS-0098 / void). */
export function runAsync(task: Promise<unknown>): undefined {
  task.catch(() => {
    // errors already handled by callers when needed
  })
  return undefined
}
