import { describe, expect, it, vi } from 'vitest'
import { runNewtabStartup } from './newtab-startup'

function createDeferred<T = void>() {
  let resolve!: (value: T) => void
  let reject!: (cause: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function baseOptions() {
  return {
    isActive: () => true,
    load: vi.fn(async () => {}),
    applyDefaultCategory: vi.fn(),
    syncMetadataNow: vi.fn(async () => {}),
    onLoaded: vi.fn(),
    onError: vi.fn(),
  }
}

describe('runNewtabStartup', () => {
  it('applies the default category and ends loading before metadata sync resolves', async () => {
    const options = baseOptions()
    const sync = createDeferred()
    options.syncMetadataNow = vi.fn(() => sync.promise)
    const order: string[] = []
    options.load = vi.fn(async () => {
      order.push('load')
    })
    options.applyDefaultCategory = vi.fn(() => {
      order.push('applyDefaultCategory')
    })
    options.onLoaded = vi.fn(() => {
      order.push('onLoaded')
    })

    const startup = runNewtabStartup(options)
    // 加载结束不依赖同步完成：在这里就应看到启动序列结算。
    await startup

    // 元数据同步仍在挂起，但加载已经结束。
    expect(order).toEqual(['load', 'applyDefaultCategory', 'onLoaded'])
    expect(options.syncMetadataNow).toHaveBeenCalledTimes(1)

    sync.resolve()
  })

  it('does not block loading when the background metadata sync rejects', async () => {
    const options = baseOptions()
    options.syncMetadataNow = vi.fn(async () => {
      throw new Error('sync offline')
    })

    await expect(runNewtabStartup(options)).resolves.toBeUndefined()
    expect(options.applyDefaultCategory).toHaveBeenCalledTimes(1)
    expect(options.onLoaded).toHaveBeenCalledTimes(1)
    expect(options.onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'sync offline' }),
    )
  })

  it('captures a load failure, still ends loading, and never rejects', async () => {
    const options = baseOptions()
    options.load = vi.fn(async () => {
      await Promise.resolve()
      throw new Error('bookmarks unavailable')
    })

    await expect(runNewtabStartup(options)).resolves.toBeUndefined()
    expect(options.onLoaded).toHaveBeenCalledTimes(1)
    expect(options.applyDefaultCategory).not.toHaveBeenCalled()
    expect(options.onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'bookmarks unavailable' }),
    )
    // 加载失败不在首屏阶段，后台同步依然尝试执行。
    expect(options.syncMetadataNow).toHaveBeenCalledTimes(1)
  })

  it('skips React state updates once the page has unmounted', async () => {
    const options = baseOptions()
    options.isActive = () => false
    const sync = createDeferred()
    options.syncMetadataNow = vi.fn(() => sync.promise)

    const startup = runNewtabStartup(options)
    sync.resolve()
    await startup

    expect(options.applyDefaultCategory).not.toHaveBeenCalled()
    expect(options.onLoaded).not.toHaveBeenCalled()
  })

  it('captures a background metadata sync rejection even after unmount', async () => {
    const options = baseOptions()
    options.isActive = () => false
    options.syncMetadataNow = vi.fn(async () => {
      throw new Error('late sync failure')
    })

    await expect(runNewtabStartup(options)).resolves.toBeUndefined()
    expect(options.onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'late sync failure' }),
    )
  })
})
