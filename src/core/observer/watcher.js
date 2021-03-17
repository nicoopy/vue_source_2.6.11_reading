/* @flow */

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError,
  noop,
} from "../util/index";

import { traverse } from "./traverse";
import { queueWatcher } from "./scheduler";
import Dep, { pushTarget, popTarget } from "./dep";

import type { SimpleSet } from "../util/index";

let uid = 0;

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 * NOTE: 每个Watcher解析一段表达式，收集依赖，并在表达式的值发生变化时触发回调
 * NOTE: 这是用在 $watch() api 还有所有的指令中的
 */
export default class Watcher {
  vm: Component;
  expression: string;
  cb: Function;
  id: number;
  deep: boolean;
  user: boolean;
  lazy: boolean;
  sync: boolean;
  dirty: boolean;
  active: boolean;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: SimpleSet;
  newDepIds: SimpleSet;
  before: ?Function;
  getter: Function;
  value: any;

  /**
   * NOTE: 构造函数主要做一些初始化的工作
   * NOTE: 构造函数入参有：
   * NOTE: vm vue的组件实例
   * NOTE: expOrFn 一段表达式或者一个函数
   * NOTE: cb 回调函数
   * NOTE: options 是可选参数，对象格式
   * NOTE: isRenderWatcher 可选参数，布尔值
   */
  constructor(
    vm: Component,
    expOrFn: string | Function,
    cb: Function,
    options?: ?Object,
    isRenderWatcher?: boolean
  ) {
    this.vm = vm;
    // NOTE: 这里renderWatcher是有什么含义？
    if (isRenderWatcher) {
      vm._watcher = this;
    }
    vm._watchers.push(this);
    // options
    // NOTE: deep为true表示可以监听对象内部属性值的变化
    // NOTE: user为true表示是通过vm.$watch()这个实例方法来监听的 ？
    // NOTE: lazy表示？
    // NOTE: sync表示？
    // NOTE: before表示？
    if (options) {
      this.deep = !!options.deep;
      this.user = !!options.user;
      this.lazy = !!options.lazy;
      this.sync = !!options.sync;
      this.before = options.before;
    } else {
      this.deep = this.user = this.lazy = this.sync = false;
    }
    this.cb = cb;
    this.id = ++uid; // uid for batching NOTE: 用在批处理
    this.active = true;
    this.dirty = this.lazy; // for lazy watchers
    this.deps = [];
    this.newDeps = [];
    this.depIds = new Set();
    this.newDepIds = new Set();
    this.expression =
      process.env.NODE_ENV !== "production" ? expOrFn.toString() : "";
    // parse expression for getter
    // NOTE: 如果expOrFn是函数格式，那么表示监听的是函数的返回值的变化
    if (typeof expOrFn === "function") {
      this.getter = expOrFn;
    }
    // NOTE: 如果是表达式格式，那么对它进行解析
    else {
      this.getter = parsePath(expOrFn);
      if (!this.getter) {
        this.getter = noop;
        process.env.NODE_ENV !== "production" &&
          warn(
            `Failed watching path: "${expOrFn}" ` +
              "Watcher only accepts simple dot-delimited paths. " +
              "For full control, use a function instead.",
            vm
          );
      }
    }
    // NOTE: 如果lazy为true，则this.value赋值undefined，否则执行get函数并把监听的数据赋值给this.value
    this.value = this.lazy ? undefined : this.get();
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   * NOTE: 评估出getter的值，并给this.deep为true的对象进行重新收集依赖
   */
  get() {
    pushTarget(this);
    let value;
    const vm = this.vm;
    try {
      value = this.getter.call(vm, vm);
    } catch (e) {
      // NOTE: 如果this.user为true，则返回详细的错误位置(仅在开发环境this.expression不为空)
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`);
      } else {
        throw e;
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      // NOTE: 如果deep为true，则遍历value并收集依赖
      if (this.deep) {
        traverse(value);
      }
      popTarget();
      // NOTE: 清空依赖
      this.cleanupDeps();
    }
    return value;
  }

  /**
   * Add a dependency to this directive.
   * NOTE: 收集依赖到当前指令
   */
  addDep(dep: Dep) {
    const id = dep.id;
    // NOTE: newDeps主要存储当前收集到的依赖列表
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id);
      this.newDeps.push(dep);
      // NOTE: deps主要存储已经被当前Watcher收集并且订阅了当前Watcher的依赖列表
      // NOTE: 如果depIds列表中没有当前dep的id，表示该dep未把当前Watcher添加到dep的订阅列表
      if (!this.depIds.has(id)) {
        dep.addSub(this);
      }
    }
  }

  /**
   * Clean up for dependency collection.
   * NOTE: 清空当前Watcher收集到的依赖
   * NOTE: 主要完成两件事：
   * NOTE: 1.让当前Watcher不再依赖的dep实例解除订阅当前Watcher
   * NOTE: 2.清空当前Watcher的依赖列表newDeps ？
   */
  cleanupDeps() {
    let i = this.deps.length;
    while (i--) {
      // NOTE: deps表示已经订阅当前Watcher的依赖列表
      const dep = this.deps[i];
      // NOTE: 如果Watcher已经在依赖收集列表newDeps中清除了该依赖，那么该依赖就可以解除订阅当前Watcher
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this);
      }
    }
    let tmp = this.depIds;
    // NOTE: 将depIds指向已经清除部分依赖的newDepIds
    this.depIds = this.newDepIds;
    // 将newDepIds指向原depIds的栈地址，并清空
    this.newDepIds = tmp;
    this.newDepIds.clear();
    tmp = this.deps;
    this.deps = this.newDeps;
    this.newDeps = tmp;
    this.newDeps.length = 0;
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   * NOTE: 依赖变更时，watcher触发更新的函数
   */
  update() {
    /* istanbul ignore else */
    if (this.lazy) {
      this.dirty = true;
    } else if (this.sync) {
      // NOTE: 异步则调用run函数
      this.run();
    } else {
      // NOTE: 否则将当前watcher加入队列中等待进行更新
      queueWatcher(this);
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   */
  run() {
    if (this.active) {
      const value = this.get();
      // NOTE: 三种情况下会触发更新：1.value变化了；2.typeof value === 'object'；3.deep为true
      if (
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        isObject(value) ||
        this.deep
      ) {
        // set new value
        const oldValue = this.value;
        this.value = value;
        // NOTE: this.user为true的话，则捕获并提示错误
        if (this.user) {
          try {
            this.cb.call(this.vm, value, oldValue);
          } catch (e) {
            handleError(
              e,
              this.vm,
              `callback for watcher "${this.expression}"`
            );
          }
        } else {
          // NOTE: 直接触发回调，并传入新值和旧值
          this.cb.call(this.vm, value, oldValue);
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   * NOTE: 如果lazy为true，那么需要另外一个evaluate函数对当前值进行评估，最后将dirty设置为false
   */
  evaluate() {
    this.value = this.get();
    this.dirty = false;
  }

  /**
   * Depend on all deps collected by this watcher.
   * NOTE: 触发当前Watcher收集所有订阅了当前Watcher的依赖
   */
  depend() {
    let i = this.deps.length;
    while (i--) {
      this.deps[i].depend();
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   * 将当前Watcher从依赖的订阅列表移除
   */
  teardown() {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      // NOTE: 在组件销毁前从组件实例中移除当前Watcher
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this);
      }
      let i = this.deps.length;
      // NOTE: 逐步取消订阅，并将active设置为false，回调函数不会再被触发
      while (i--) {
        this.deps[i].removeSub(this);
      }
      this.active = false;
    }
  }
}
