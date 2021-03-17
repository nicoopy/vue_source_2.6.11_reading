/* @flow */

import { _Set as Set, isObject } from "../util/index";
import type { SimpleSet } from "../util/index";
import VNode from "../vdom/vnode";

const seenObjects = new Set();

/**
 * Recursively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 * NOTE: 递归遍历一个对象触发所有子对象的getter，以便对象中的嵌套属性可以作为深层依赖项被收集
 */
export function traverse(val: any) {
  _traverse(val, seenObjects);
  seenObjects.clear();
}

function _traverse(val: any, seen: SimpleSet) {
  let i, keys;
  const isA = Array.isArray(val);
  // NOTE: 如果非数组非对象，或者该对象调用了freeze方法冻结了无法修改，或者是VNode节点，则直接返回
  if (
    (!isA && !isObject(val)) ||
    Object.isFrozen(val) ||
    val instanceof VNode
  ) {
    return;
  }
  if (val.__ob__) {
    // NOTE: 避免递归中同个依赖重复添加
    const depId = val.__ob__.dep.id;
    if (seen.has(depId)) {
      return;
    }
    seen.add(depId);
  }
  if (isA) {
    i = val.length;
    while (i--) _traverse(val[i], seen);
  } else {
    keys = Object.keys(val);
    i = keys.length;
    while (i--) _traverse(val[keys[i]], seen);
  }
}
