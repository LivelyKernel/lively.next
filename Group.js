// show-in-doc
// A Grouping is created by arr.groupBy and maps keys to Arrays.

import { groupBy } from "./array.js";

export default class Group {

  static get by() { return groupBy; }

  static fromArray(array, hashFunc, context) {
    // Example:
    // Group.fromArray([1,2,3,4,5,6], function(n) { return n % 2; })
    // // => {"0": [2,4,6], "1": [1,3,5]}
    var grouping = new Group();
    for (var i = 0, len = array.length; i < len; i++) {
      var hash = hashFunc.call(context, array[i], i);
      if (!grouping[hash]) grouping[hash] = [];
      grouping[hash].push(array[i]);
    }
    return grouping;
  }

  toArray() {
    // Example:
    // var group = arr.groupBy([1,2,3,4,5], function(n) { return n % 2; })
    // group.toArray(); // => [[2,4],[1,3,5]]
    return this.reduceGroups(function(all, _, group) {
      return all.concat([group]); }, []);
  }
  
  forEach(iterator, context) {
    // Iteration for each item in each group, called like `iterator(groupKey, groupItem)`
    var groups = this;
    Object.keys(groups).forEach(function(groupName) {
      groups[groupName].forEach(iterator.bind(context, groupName));
    });
    return groups;
  }
  
  forEachGroup(iterator, context) {
    // Iteration for each group, called like `iterator(groupKey, group)`
    var groups = this;
    Object.keys(groups).forEach(function(groupName) {
      iterator.call(context, groupName, groups[groupName]);
    });
    return groups;
  }
  
  map(iterator, context) {
    // Map for each item in each group, called like `iterator(groupKey, group)`
    var result = new Group();
    this.forEachGroup(function(groupName, group) {
      result[groupName] = group.map(iterator.bind(context, groupName));
    });
    return result;
  }
  
  mapGroups(iterator, context) {
    // Map for each group, called like `iterator(groupKey, group)`
    var result = new Group();
    this.forEachGroup(function(groupName, group) {
      result[groupName] = iterator.call(context, groupName, group);
    });
    return result;
  }
  
  keys() {
    // show-in-docs
    return Object.keys(this);
  }
  
  reduceGroups(iterator, carryOver, context) {
    // Reduce/fold for each group, called like `iterator(carryOver, groupKey, group)`
    this.forEachGroup(function(groupName, group) {
      carryOver = iterator.call(context, carryOver, groupName, group); });
    return carryOver;
  }
  
  count() {
    // counts the elements of each group
    return this.reduceGroups(function(groupCount, groupName, group) {
      groupCount[groupName] = group.length;
      return groupCount;
    }, {});
  }

}
