/* @flow */

import type Watcher from "./watcher";
import { remove } from "../util/index";
import config from "../config";

let uid = 0;

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 * NOTE: 一个dep是可观察的，并且可以有多个指定它的指令
 * NOTE: 它主要负责管理自身的订阅列表(Watcher列表)，以及提供触发更新的notify实例方法
 */
export default class Dep {
  // NOTE: target是Dep类的一个静态属性
  static target: ?Watcher;
  id: number;
  subs: Array<Watcher>;

  constructor() {
    this.id = uid++;
    this.subs = [];
  }

  addSub(sub: Watcher) {
    this.subs.push(sub);
  }

  removeSub(sub: Watcher) {
    remove(this.subs, sub);
  }

  depend() {
    // NOTE: 如果有目标target，则添加this，即有特定递增实例属性id的dep实例，到target即Watcher的依赖列表中
    if (Dep.target) {
      Dep.target.addDep(this);
    }
  }

  notify() {
    // stabilize the subscriber list first
    // NOTE: 先确保订阅列表是数组
    const subs = this.subs.slice();

    // NOTE: 在开发环境中，如果subs列表中不是异步的，那么需要根据id排序确保最后触发的时候是正确的顺序
    if (process.env.NODE_ENV !== "production" && !config.async) {
      // subs aren't sorted in scheduler if not running async
      // we need to sort them now to make sure they fire in correct
      // order
      subs.sort((a, b) => a.id - b.id);
    }
    for (let i = 0, l = subs.length; i < l; i++) {
      // NOTE: 触发Watcher的update方法
      subs[i].update();
    }
  }
}

// The current target watcher being evaluated.
// This is globally unique because only one watcher
// can be evaluated at a time.
Dep.target = null;
// NOTE: target列表是在栈中统一管理的
const targetStack = [];

export function pushTarget(target: ?Watcher) {
  targetStack.push(target);
  Dep.target = target;
}

export function popTarget() {
  targetStack.pop();
  Dep.target = targetStack[targetStack.length - 1];
}
