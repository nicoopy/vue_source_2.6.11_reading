/* @flow */

import Dep from "./dep";
import VNode from "../vdom/vnode";
import { arrayMethods } from "./array";
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering,
} from "../util/index";

const arrayKeys = Object.getOwnPropertyNames(arrayMethods);

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true;

export function toggleObserving(value: boolean) {
  shouldObserve = value;
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 * NOTE: Observer类主要绑定到每个需要observe的对象，并给对象定义响应式的属性
 */
export class Observer {
  value: any;
  dep: Dep; // 实例属性dep是Dep类的实例类型，在构造函数中定义
  vmCount: number; // number of vms that have this object as root $data

  constructor(value: any) {
    this.value = value;
    this.dep = new Dep();
    this.vmCount = 0;
    def(value, "__ob__", this);
    if (Array.isArray(value)) {
      // NOTE: hasProto用于判断__proto__属性是否为空
      if (hasProto) {
        // NOTE: 将value的__proto__属性指向数组的原型对象Array.prototype，原型方法是已经被修改的
        protoAugment(value, arrayMethods);
      } else {
        // NOTE: 否则将数组的原型对象Array.prototype的已被重新修改的不可枚举的方法都复制到value上来
        copyAugment(value, arrayMethods, arrayKeys);
      }
      this.observeArray(value);
    } else {
      this.walk(value);
    }
  }

  /**
   * Walk through all properties and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   * NOTE: 对对象属性进行遍历并定义响应式属性
   */
  walk(obj: Object) {
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i]);
    }
  }

  /**
   * Observe a list of Array items.
   * NOTE: 对数组项都进行observe,如果数组项是对象或者数组则将一个Observer实例赋值给__ob__属性
   * NOTE: 如果是数组类型的话则一直observe直到子项都不是数组类型为止
   * NOTE: 如果是停在一个子项是对象类型这里，且子项有数组类型的属性，那么需要在defineReactive中拦截然后对该数组类型属性进行observe
   */
  observeArray(items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i]);
    }
  }
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 * NOTE: 将target的__proto__属性指向某个对象
 */
function protoAugment(target, src: Object) {
  /* eslint-disable no-proto */
  target.__proto__ = src;
  /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 * NOTE: 将某个对象的不可枚举属性都复制到target上来
 */
/* istanbul ignore next */
function copyAugment(target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i];
    def(target, key, src[key]);
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 * NOTE: 检测value是否需要被observe
 * NOTE: 如果不需要则直接return，如果需要且自身__ob__属性为空则返回一个Observer实例，否则返回__ob__属性的值即可
 * NOTE: 最终返回 空 或者 Observer实例
 */
export function observe(value: any, asRootData: ?boolean): Observer | void {
  // NOTE: 如果value不为空且typeof value是object，或者value是一个VNode节点，则不需要observe，直接返回
  if (!isObject(value) || value instanceof VNode) {
    return;
  }
  let ob: Observer | void;
  // NOTE: 为了避免重复observe，如果value已经有定义了__ob__属性，且是Observer的实例，那么直接返回该属性值即可
  if (hasOwn(value, "__ob__") && value.__ob__ instanceof Observer) {
    ob = value.__ob__;
  }
  // NOTE: 如果shouldObserve为true，且value是对象或者数组，且value允许被添加属性值(__ob__)，且value不是vue实例
  // NOTE: 则返回一个Observer实例：new Observer(value)
  else if (
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    ob = new Observer(value);
  }
  // NOTE: 如果是根数据，则计数属性vmCount加1
  if (asRootData && ob) {
    ob.vmCount++;
  }
  return ob;
}

/**
 * Define a reactive property on an Object.
 * NOTE: 给对象定义响应式属性的函数：在getter时收集依赖，setter时触发更新
 * NOTE: 1. Watcher中收到的依赖如果来自defineReactive中的dep实例，则表示绑定的是$data的根属性或者某个子对象的属性
 * NOTE: 如 { a: { b: {c: 1} } }中的 vm.a 和 vm.a.b.c 这两个依赖就来自defineReactive中的dep实例
 * NOTE: 2. Watcher中收到的依赖如果来自对象或者数组的__ob__属性的dep子实例属性，则表示绑定的是某个类型为数组或对象的除根属性外的子属性
 * NOTE: 如 { a: { b: { c: 1, d: [1，2，3] }} }中的 vm.a.b 和 vm.a.b.d 这两个依赖就来自 vm.a.b.__ob__.dep和vm.a.b.d.__ob__.dep
 */
export function defineReactive(
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  // NOTE: 定义一个dep实例
  const dep = new Dep();

  const property = Object.getOwnPropertyDescriptor(obj, key);
  if (property && property.configurable === false) {
    return;
  }

  // cater for pre-defined getter/setters
  const getter = property && property.get;
  const setter = property && property.set;
  // NOTE: 当只有obj和key这两个入参 且 没有定义getter或者有定义setter，设置val为obj[key]
  // NOTE: 排除有getter而没setter即只读属性的情况，其他都要先获取属性值方便observe子属性
  // NOTE: 并且当对象属性还没有定义getter的时候，提前获取属性值，后面在定义setter时获取旧属性值时也可以避免重复触发getter
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key];
  }

  // NOTE: 如果不是浅拷贝，则observe val
  // NOTE: 如果不为空，那么childObj是一个Observer实例
  // NOTE: 进行这一步后所有该定义响应的属性都绑定Observer实例到其__ob__子属性了
  let childOb = !shallow && observe(val);
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter() {
      const value = getter ? getter.call(obj) : val;
      // NOTE:如果Dep类的静态属性target不为空，则说明当前有Watcher想添加该对象属性obj[key]到自身的依赖列表中
      if (Dep.target) {
        // NOTE: 触发depend实例方法，将当前在defineReactive函数定义的dep实例添加到target即Watcher的依赖列表中
        dep.depend();

        // NOTE: 如果childObj存在，那么也将子对象绑定的__ob__属性的的dep实例属性添加到target即Watcher的依赖列表中
        if (childOb) {
          childOb.dep.depend();
          // NOTE: 因为Observer类只对对象类型的项调用defineReactive函数，而数组类型的都是跳过了
          // NOTE: 所以这里递归地对所有数组类型的项的__ob__属性的dep子属性给收集到Watcher的依赖列表中，
          // NOTE: 不过这里有个问题:
          // NOTE: 数组中的对象或者数组类型的项本身都通过xx.__ob__.dep添加依赖了,调用vm.$set(this.xx[index], ‘option’, value)触发更新
          // NOTE: 但数组的直接子项并没有像对象那样在defineReactive中收集依赖，而是在Observer类的observeArray方法中跳过了,
          // NOTE: 所以vue中无法检测到通过索引或者.length的方式访问或者修改数组
          if (Array.isArray(value)) {
            dependArray(value);
          }
        }
      }
      return value;
    },
    set: function reactiveSetter(newVal) {
      const value = getter ? getter.call(obj) : val;
      /* eslint-disable no-self-compare */
      // NOTE: 新值跟旧值相等的情况下直接返回，这里有个特殊情况NaN，如果新值跟旧值都是NaN也直接返回
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return;
      }
      /* eslint-enable no-self-compare */
      // NOTE: customSetter用于在开发环境中触发set函数时另外做一些事情，比如打印警告信息等
      if (process.env.NODE_ENV !== "production" && customSetter) {
        customSetter();
      }
      // #7981: for accessor properties without setter
      // NOTE: 作者的注释是说用于没有setter的访问器属性（issue #7981 原文：make the set method more reasonable）
      // NOTE: 只定义getter没定义setter在原生js默认是只读属性，直接跳出不赋值也不触发收集依赖
      if (getter && !setter) return;

      // NOTE: 如果有自定义的setter，则调用自定的setter去赋新值，否则直接用新值覆盖val值，下一次调用getter就会传入新的val值
      if (setter) {
        setter.call(obj, newVal);
      } else {
        val = newVal;
      }
      // NOTE: 如果不是浅拷贝，则observe新值并赋值给childObj
      childOb = !shallow && observe(newVal);
      // NOTE: 通知依赖进行更新
      dep.notify();
    },
  });
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 * NOTE: 常用在响应式地修改或者新增数组某一项的值或者响应式地为对象添加新属性并赋值
 */
export function set(target: Array<any> | Object, key: any, val: any): any {
  // NOTE: 在开发环境对错误的入参进行警告
  if (
    process.env.NODE_ENV !== "production" &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(
      `Cannot set reactive property on undefined, null, or primitive value: ${target}`
    );
  }
  // NOTE: 如果是数组类型则索引值是合法的，则修改target的长度并通过splice修改值，并返回val
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key);
    target.splice(key, 1, val);
    return val;
  }
  // NOTE: 修改对象的已有的属性的值，并返回val
  if (key in target && !(key in Object.prototype)) {
    target[key] = val;
    return val;
  }
  const ob = target.__ob__;
  // NOTE: 如果target是vue实例或者是vm.$data，则警在开发环境下进行警告
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== "production" &&
      warn(
        "Avoid adding reactive properties to a Vue instance or its root $data " +
          "at runtime - declare it upfront in the data option."
      );
    return val;
  }
  // NOTE: 如果对象没有__ob__属性，则不是vm.$data中的对象，直接赋值并返回val
  if (!ob) {
    target[key] = val;
    return val;
  }
  // NOTE: 如果对象有有__ob__属性，则将key定义为响应式属性，同时触发更新，最后返回val
  defineReactive(ob.value, key, val);
  ob.dep.notify();
  return val;
}

/**
 * Delete a property and trigger change if necessary.
 * NOTE: 常用在响应式地删除对象的属性或者数组的某一项
 */
export function del(target: Array<any> | Object, key: any) {
  if (
    process.env.NODE_ENV !== "production" &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(
      `Cannot delete reactive property on undefined, null, or primitive value: ${target}`
    );
  }
  // NOTE: 如果是数组类型则索引值是合法的，则通过splice删除某一项，并返回
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1);
    return;
  }
  const ob = target.__ob__;
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== "production" &&
      warn(
        "Avoid deleting properties on a Vue instance or its root $data " +
          "- just set it to null."
      );
    return;
  }
  // NOTE: 如果不是对象本身的属性，则直接返回
  if (!hasOwn(target, key)) {
    return;
  }
  // NOTE: 删除对象对应的某一项，如果该对象不是来自$data，则删除后直接返回，否则触发更新
  delete target[key];
  if (!ob) {
    return;
  }
  ob.dep.notify();
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 * NOTE: 递归给所有数组类型的属性添加依赖，使得给该属性赋值变成响应式的
 */
function dependArray(value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i];
    e && e.__ob__ && e.__ob__.dep.depend();
    if (Array.isArray(e)) {
      dependArray(e);
    }
  }
}
