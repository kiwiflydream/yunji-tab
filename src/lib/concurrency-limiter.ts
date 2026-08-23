interface PendingTask<T> {
  run: () => Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: unknown) => void
}

export function createConcurrencyLimiter(concurrency: number) {
  const limit = Math.max(1, Math.floor(concurrency))
  const queue: Array<PendingTask<unknown>> = []
  let activeCount = 0

  const drain = () => {
    while (activeCount < limit && queue.length > 0) {
      const task = queue.shift()
      if (!task)
        return
      activeCount += 1
      void task.run()
        .then(task.resolve, task.reject)
        .finally(() => {
          activeCount -= 1
          drain()
        })
    }
  }

  return function runLimited<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push({ run: task, resolve, reject } as PendingTask<unknown>)
      drain()
    })
  }
}
