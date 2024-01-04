class CustomCache {
    constructor(capacity) {
      this.capacity = capacity;
      // 使用Map存储键值对，便于O(1)时间复杂度查找
      this.cacheMap = new Map();
      // 使用最小堆存储元素，按照level由大到小排序，并在level相同时按index由小到大排序
      this.priorityQueue = [];
    }
  
    add(key, value, level, freq) {
      if (this.cacheMap.size === this.capacity) {
        // 如果缓存已满，则移除优先级最低的元素
        this.removeLowestPriority();
      }
      level = Number(level);
      freq = Number(freq);
      const entry = { key, value, level, freq };
      this.cacheMap.set(key, entry);
      this.insertIntoPriorityQueue(entry);
    }
  
    get(key) {
      if (!this.cacheMap.has(key)) return null; // 或者返回其他表示键不存在的值
  
      const entry = this.cacheMap.get(key);
      // 更新entry在优先队列中的位置
      this.updatePriorityQueuePosition(entry);
      return entry.value;
    }
  
    insertIntoPriorityQueue(entry) {
      this.priorityQueue.push(entry);
      this.bubbleUp(this.priorityQueue.length - 1);
    }
  
    bubbleUp(index) {
      while (index > 0) {
        const parentIndex = Math.floor((index - 1) / 2);
        const parent = this.priorityQueue[parentIndex];
        const current = this.priorityQueue[index];
  
        if (this.compareEntries(parent, current) < 0) break;
  
        [this.priorityQueue[parentIndex], this.priorityQueue[index]] = [current, parent];
        index = parentIndex;
      }
    }
  
    compareEntries(a, b) {
      if (a.level !== b.level) return b.level - a.level; // 先比较level，level越大越优先删除
      return a.freq - b.freq; // level相同情况下，freq越小越优先删除
    }
  
    updatePriorityQueuePosition(entry) {
      this.bubbleUp(this.priorityQueue.indexOf(entry));
      this.bubbleDown(this.priorityQueue.indexOf(entry));
    }
  
    bubbleDown(index) {
      let childIndex;
      while ((childIndex = this.getLeftChildIndex(index)) < this.priorityQueue.length) {
        const rightChildIndex = this.getRightChildIndex(index);
        let swapIndex = childIndex;
  
        if (
          rightChildIndex < this.priorityQueue.length &&
          this.compareEntries(this.priorityQueue[rightChildIndex], this.priorityQueue[childIndex]) < 0
        ) {
          swapIndex = rightChildIndex;
        }
  
        if (this.compareEntries(this.priorityQueue[swapIndex], this.priorityQueue[index]) >= 0) break;
  
        [this.priorityQueue[index], this.priorityQueue[swapIndex]] = [this.priorityQueue[swapIndex], this.priorityQueue[index]];
        index = swapIndex;
      }
    }
  
    getLeftChildIndex(index) {
      return 2 * index + 1;
    }
  
    getRightChildIndex(index) {
      return 2 * index + 2;
    }
  
    removeLowestPriority() {
      const removedEntry = this.priorityQueue.shift();
      this.cacheMap.delete(removedEntry.key);
    }
  }
  
  // 使用示例：
  const cache = new CustomCache(3);
  cache.add('key1', 'value1', 1, 0);
  cache.add('key2', 'value2', 2, 1);
  cache.add('key3', 'value3', 3, 4);
  console.log(cache.get('key1')); // 返回 'value1'
  cache.add('key4', 'value4', 4, 1); 
  cache.add('key5', 'value5', 3, 2); 
//   cache.add('key5', 'value5', 3, 5); 
  console.log(cache); 