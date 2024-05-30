class CustomCache {
    constructor(capacity) {
      this.capacity = capacity;
      this.cacheMap = new Map();
      this.head = null;
      this.tail = null;
      this.indexPointsMap = new Map();  
    }
  
    gett(key) {
      if (this.cacheMap.has(key)) {
        const node = this.cacheMap.get(key);
        node.freq++;
        return node;
      }
      return null;
    }
  
    insert(key, value) {
      if(!this.indexPointsMap.has(value.level)){
        this.indexPointsMap.set(value.level, value);
      }
      if (this.cacheMap.has(key)) {
        // 如果缓存中已存在该键，更新值并调整顺序
        const node = this.cacheMap.get(key);
        node.freq += 1;
        return;
        // this.updateNodeOrder(node);
      } 
      this.cacheMap.set(key, value);
      this.addToSortedPosition(value);
      // 如果缓存满了，先移出最不符合条件的数据
      if (this.cacheMap.size >= this.capacity) {
        this.evict();
      }
    }
  
    getMaxKey() {
      let maxKey = 0;
      for (let [key, value] of this.indexPointsMap.entries()) {
        if (maxKey === 0 || key > maxKey) {
          maxKey = key;
        }
      }
      return maxKey;
    }

    evict() {
      let maxKey = this.getMaxKey();
      while(this.cacheMap.size >= this.capacity)
      {
        for(let i = maxKey; i >= 0; i--){
          let currentHead = this.indexPointsMap.get(i);
          if (currentHead) {
            // 移除第一个节点
            // this.cacheMap.delete(this.head.level+'_'+this.head.yArray[1]+'_'+this.head.yArray[2]);
            this.cacheMap.delete(currentHead.level+'_'+currentHead.index);
            if (currentHead.next) {
                // 如果有后一个节点，将头部指向后一个节点
                // this.head.next.prev = null;
                this.indexPointsMap.set(i, currentHead.next);
            } else {
                // 如果只有一个节点，则头尾都为null
                // this.head = null;
                // this.tail = null;
                this.indexPointsMap.delete(i);
            }
          }
          break;
        }
      }
    }
  
    changeFreq(node){
      let prev = this.indexPointsMap.get(node.level);
      if(prev == node){
        // console.log(0)
        let later = node.next;
        if(later === undefined) return;
        // if(later.freq < node.freq||(later.freq === node.freq && later.index < node.index)){
        if(later.freq < node.freq){
          // this.head = later;
          this.indexPointsMap.set(node.level, later);
          node.next = later.next;
          later.next.last = node;
          later.next = node;
          node.last = later;
        }
        prev = later;
        later = node.next;
        
        while(node.next!==undefined){
          if(later.freq < node.freq){
            prev.next = later;
            later.last = prev;
            node.next = later.next;
            later.next.last = node;
            later.next = node;
            node.last = later
            prev = prev.next;
            // node = node.next;
            later = node.next;
          }
          else{
            break;
          }
        }
        return;
      }

      // while(prev.next != node){
      //   prev = prev.next;
      // }
      prev = node.last;
      let later = node.next;
      if(later === undefined) return;
      while(node.next!==undefined){
        // console.log(1);
        if(later.freq < node.freq){
          console.log(2);
          prev.next = later;
          later.last = prev;
          node.next = later.next;
          later.next.last = node;
          later.next = node;
          node.last = later
          prev = prev.next;
          // node = node.next;
          later = node.next;
        }
        else{
          break;
        }
      }
    }
  
    // 将节点插入到适当的位置
    addToSortedPosition(node) {
      let level = node.level;
      // let current = this.head;
      let current = this.indexPointsMap.get(level);
      let prev = null;
      if(current === node) return;
  
      while (
        current &&
        // (current.level > node.level ||
          // (current.level === node.level && current.freq < node.freq) ||(current.freq === node.freq && current.index < node.index))
          (current.freq < node.freq)
      ) {
        // console.log(0);
        prev = current;
        current = current.next;
        current.last = prev;
      }
  
      if (!current) {
        // 插入到链表尾部
        // this.addToEnd(level, node);
        current = node;
        prev.next = current;
        current.last = prev;
      } else {
        // if(current === this.head){
        if(current === this.indexPointsMap.get(level)){
          this.indexPointsMap.set(level,node);
          node.next = current;
          current.last = node;
        }
        else{
          prev.next = node;
          node.next = current;
          current.last = node;
          node.last = prev;
        }
      }
    }
  
    // 将节点插入到链表尾部
    addToEnd(level, node) {
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

const testCache = new CustomCache(50000);
const streamCache = new CustomCache(200000);
// testCache.insert("key1", "value1");

module.exports = { testCache, streamCache }