/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {FiberRoot, SuspenseHydrationCallbacks} from './ReactInternalTypes';
import type {RootTag} from './ReactRootTags';

import {noTimeout, supportsHydration} from './ReactFiberHostConfig';
import {createHostRootFiber} from './ReactFiber.old';
import {
  NoLane,
  NoLanes,
  NoTimestamp,
  TotalLanes,
  createLaneMap,
} from './ReactFiberLane.old';
import {
  enableSuspenseCallback,
  enableCache,
  enableProfilerCommitHooks,
  enableProfilerTimer,
  enableUpdaterTracking,
} from 'shared/ReactFeatureFlags';
import {initializeUpdateQueue} from './ReactUpdateQueue.old';
import {LegacyRoot, ConcurrentRoot} from './ReactRootTags';
import {createCache, retainCache} from './ReactFiberCacheComponent.old';

function FiberRootNode(containerInfo, tag, hydrate, identifierPrefix) {
  //root 节点类型()
  this.tag = tag;
  //root根节点，render方法的第二个参数
  this.containerInfo = containerInfo;
  //在持久更新中会用到，不支持增量更新的平台，react-dom是整个应用更新，所以用不到
  this.pendingChildren = null;
  //当前应用root节点对应的Fiber对象
  /*
  * current 属性既是应用程序中 Fiber树 的入口。
    current 的值是一个 HostRoot 类型的 Fiber 节点，这个 HostRoot 的子节点就是程序的根组件（App）对应的 Fiber 节点。
    在首次渲染调用 React.render 时，应用程序中其实只有一个 HostRoot 的 Fiber 节点，而在 render 过程中，
    * 才会将我们传入的 App 组件构建成 HostRoot 的子 Fiber 节点。
    * 作为已经计算完成并展示到视图中的 Fiber 树，在源码中称为 current 树。
    * 而 current 树的 alternate 指向的另一棵树，就是用来计算变化的，称为 WorkInProgress 树（ WIP ）。
  * */
  this.current = null;
  //缓存
  this.pingCache = null;
  //存储工作循环(workLoop)结束后的副作用列表，用于commit阶段
  //已经完成任务的FiberRoot对象，在commit（提交）阶段之后会处理该值对应的任务
  this.finishedWork = null;
  //在任务倍挂起的时候通过setTimeout设置的返回内容，用来下一次如果有新的任务挂起时，清理还没触发的timeout
  this.timeoutHandle = noTimeout;
  //顶层context对象
  this.context = null;
  this.pendingContext = null;
  //用来确定第一次渲染的时候是否需要融合
  this.isDehydrated = hydrate;
  //回调节点
  this.callbackNode = null;
  //回调属性
  this.callbackPriority = NoLane;
  //
  this.eventTimes = createLaneMap(NoLanes);
  //记录任务的过期时间  例子[ -1, -1, 4395.2254, 3586.2245, -1, -1, -1 ]
  this.expirationTimes = createLaneMap(NoTimestamp);
  //待处理的lanes
  this.pendingLanes = NoLanes;
  this.suspendedLanes = NoLanes;
  this.pingedLanes = NoLanes;
  //记录已经过期的lane
  this.expiredLanes = NoLanes;
  this.mutableReadLanes = NoLanes;
  this.finishedLanes = NoLanes;

  this.entangledLanes = NoLanes;
  this.entanglements = createLaneMap(NoLanes);

  this.identifierPrefix = identifierPrefix;

  if (enableCache) {
    this.pooledCache = null;
    this.pooledCacheLanes = NoLanes;
  }

  if (supportsHydration) {
    this.mutableSourceEagerHydrationData = null;
  }

  if (enableSuspenseCallback) {
    this.hydrationCallbacks = null;
  }

  if (enableProfilerTimer && enableProfilerCommitHooks) {
    this.effectDuration = 0;
    this.passiveEffectDuration = 0;
  }

  if (enableUpdaterTracking) {
    this.memoizedUpdaters = new Set();
    const pendingUpdatersLaneMap = (this.pendingUpdatersLaneMap = []);
    for (let i = 0; i < TotalLanes; i++) {
      pendingUpdatersLaneMap.push(new Set());
    }
  }

  if (__DEV__) {
    switch (tag) {
      case ConcurrentRoot:
        this._debugRootType = hydrate ? 'hydrateRoot()' : 'createRoot()';
        break;
      case LegacyRoot:
        this._debugRootType = hydrate ? 'hydrate()' : 'render()';
        break;
    }
  }
}

export function createFiberRoot(
  containerInfo: any,
  tag: RootTag,
  hydrate: boolean,
  hydrationCallbacks: null | SuspenseHydrationCallbacks,
  isStrictMode: boolean,
  concurrentUpdatesByDefaultOverride: null | boolean,
  identifierPrefix: string,
): FiberRoot {
  const root: FiberRoot = (new FiberRootNode(
    containerInfo,
    tag,
    hydrate,
    identifierPrefix,
  ): any);
  if (enableSuspenseCallback) {
    root.hydrationCallbacks = hydrationCallbacks;
  }

  // Cyclic construction. This cheats the type system right now because
  // stateNode is any.
  const uninitializedFiber = createHostRootFiber(
    tag,
    isStrictMode,
    concurrentUpdatesByDefaultOverride,
  );
  root.current = uninitializedFiber;
  uninitializedFiber.stateNode = root;

  if (enableCache) {
    const initialCache = createCache();
    retainCache(initialCache);

    // The pooledCache is a fresh cache instance that is used temporarily
    // for newly mounted boundaries during a render. In general, the
    // pooledCache is always cleared from the root at the end of a render:
    // it is either released when render commits, or moved to an Offscreen
    // component if rendering suspends. Because the lifetime of the pooled
    // cache is distinct from the main memoizedState.cache, it must be
    // retained separately.
    root.pooledCache = initialCache;
    retainCache(initialCache);
    const initialState = {
      element: null,
      cache: initialCache,
    };
    uninitializedFiber.memoizedState = initialState;
  } else {
    const initialState = {
      element: null,
    };
    uninitializedFiber.memoizedState = initialState;
  }

  initializeUpdateQueue(uninitializedFiber);

  return root;
}
