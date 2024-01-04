class CacheNode {
    constructor(key, value, level, freq) {
      this.key = key;
      this.value = value;
      this.level = level;
      this.freq = freq;
      this.prev = null;
      this.next = null;
    }
  }
  
  class CustomCache {
    constructor(capacity) {
      this.capacity = capacity;
      this.cacheMap = new Map();
      this.head = null;
      this.tail = null;
    }
  
    // 查询数据
    get(key) {
      if (this.cacheMap.has(key)) {
        const node = this.cacheMap.get(key);
        // 查询时不会改变节点位置
        return node.value;
      }
      return null;
    }
  
    // 插入数据
    insert(key, value, level, freq) {
      if (this.cacheMap.has(key)) {
        // 如果缓存中已存在该键，更新值并调整顺序
        const node = this.cacheMap.get(key);
        node.value = value;
        this.updateNodeOrder(node);
      } else {
        // 如果缓存满了，先移出最不符合条件的数据
        if (this.cacheMap.size >= this.capacity) {
          this.evict();
        }
  
        // 插入新数据并调整顺序
        const newNode = new CacheNode(key, value, level, freq);
        this.cacheMap.set(key, newNode);
        this.addToSortedPosition(newNode);
      }
    }
  
    evict() {
        if (this.head) {
        // 移除第一个节点
        this.cacheMap.delete(this.head.key);
        if (this.head.next) {
            // 如果有后一个节点，将头部指向后一个节点
            this.head.next.prev = null;
            this.head = this.head.next;
        } else {
            // 如果只有一个节点，则头尾都为null
            this.head = null;
            this.tail = null;
        }
        }
    }
  
  
    // 将节点插入到适当的位置
    addToSortedPosition(node) {
      let current = this.head;
  
      while (
        current &&
        (current.level > node.level ||
          (current.level === node.level && current.freq <= node.freq))
      ) {
        current = current.next;
      }
  
      if (!current) {
        // 插入到链表尾部
        this.addToEnd(node);
      } else {
        // 插入到链表中间
        node.prev = current.prev;
        node.next = current;
  
        if (current.prev) {
          current.prev.next = node;
        } else {
          this.head = node;
        }
  
        current.prev = node;
      }
    }
  
    // 将节点插入到链表尾部
    addToEnd(node) {
      if (!this.head) {
        this.head = node;
        this.tail = node;
      } else {
        node.prev = this.tail;
        this.tail.next = node;
        this.tail = node;
      }
    }
  
    updateNodeOrder(node) {
      // 在插入时已调整顺序
    }
  }
  
  const cache = new CustomCache(3);
  
  cache.insert("key1", "value1", 1, 3);
  cache.insert("key2", "value2", 2, 1);
  cache.insert("key3", "value3", 3, 2);
  
  cache.insert("key4", "value4", 2, 4);
  cache.insert("key5", "value5", 2, 3);
  cache.insert("key6", "value6", 0, 2);
  cache.insert("key7", "value7", 5, 4);

  