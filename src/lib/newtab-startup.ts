export interface NewtabStartupOptions {
  /** 是否仍挂载；卸载后不再触发 React 状态更新。 */
  isActive: () => boolean
  /** 首屏加载序列；返回时首屏数据已就绪。 */
  load: () => Promise<void>
  /** 依据默认分类落到首个可见分类。 */
  applyDefaultCategory: () => void
  /** 后台元数据同步。 */
  syncMetadataNow: () => Promise<void>
  /** 加载结束（成功或失败）后调用；用于收起骨架屏。 */
  onLoaded: () => void
  /** 后台任务或加载失败时调用，避免未处理的 rejection。 */
  onError?: (cause: unknown) => void
}

/**
 * 首屏启动序列：先恢复本地设置与书签组，再读取原生书签，随即应用默认分类并
 * 结束加载；元数据同步放到加载结束之后在后台执行，且立即消化 rejection，
 * 既不阻塞首屏，也不会产生卸载后 setState 或未处理的 rejection。
 */
export async function runNewtabStartup(
  options: NewtabStartupOptions,
): Promise<void> {
  try {
    await options.load()
    if (options.isActive())
      options.applyDefaultCategory()
  }
  catch (cause) {
    options.onError?.(cause)
  }
  finally {
    if (options.isActive())
      options.onLoaded()
  }

  // 后台执行，绝不阻塞首屏；拒绝在内部立即消化。
  void options.syncMetadataNow().catch((cause) => {
    options.onError?.(cause)
  })
}
