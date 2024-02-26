class CustomCache {
    constructor(capacity) {
      this.capacity = capacity;
      this.cacheMap = new Map();
      this.head = null;
      this.tail = null;
    }
  
    get(key) {
      if (this.cacheMap.has(key)) {
        const node = this.cacheMap.get(key);
        node.freq++;
        return node;
      }
      return null;
    }
  
    insert(key, value) {
      if (this.cacheMap.has(key)) {
        // 如果缓存中已存在该键，更新值并调整顺序
        const node = this.cacheMap.get(key);
        node.freq += 1;
        // this.updateNodeOrder(node);
      } else {
        this.cacheMap.set(key, value);
        this.addToSortedPosition(value);
        // 如果缓存满了，先移出最不符合条件的数据
        if (this.cacheMap.size >= this.capacity) {
          this.evict();
        }
      }
    }
  
    evict() {
        while(this.cacheMap.size >= this.capacity)
        {
          if (this.head) {
            // 移除第一个节点
            this.cacheMap.delete(this.head.key);
            if (this.head.next) {
                // 如果有后一个节点，将头部指向后一个节点
                // this.head.next.prev = null;
                this.head = this.head.next;
            } else {
                // 如果只有一个节点，则头尾都为null
                this.head = null;
                this.tail = null;
            }
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
        // node.prev = current.prev;
        node.next = current.next;
        current.next = node;
  
        // if (current.prev) {
        //   current.prev.next = node;
        // } else {
        //   this.head = node;
        // }
  
        // current.prev = node;
      }
    }
  
    // 将节点插入到链表尾部
    addToEnd(node) {
      if (!this.head) {
        this.head = node;
        this.tail = node;
      } else {
        // node.prev = this.tail;
        this.tail.next = node;
        this.tail = node;
      }
    }
  
    updateNodeOrder(node) {
      // 在插入时已调整顺序
    }
}

const testCache = new CustomCache(64);
// testCache.insert("key1", "value1");

module.exports = { testCache }