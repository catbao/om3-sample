import TrendTree from "../helper/tend-query-tree";
export default class MinHeap<TrendTree> {  
    private heap: TrendTree[] = [];  
  
    // 插入元素  
    push(element: TrendTree): void {  
        this.heap.push(element);  
        this.siftUp(this.heap.length - 1);  
    }  
  
    // 弹出最小元素  
    pop(): TrendTree | null {  
        if (this.heap.length === 0) {  
            return null;  
        }  
        if (this.heap.length === 1) {  
            return this.heap.pop()!;  
        }  
        const top = this.heap[0];  
        this.heap[0] = this.heap.pop()!;  
        this.siftDown(0);  
        return top;  
    }  
  
    // 上滤操作，保证父节点小于或等于子节点  
    private siftUp(index: number): void {  
        const parent = Math.floor((index - 1) / 2);  
        if (index <= 0 || this.compare(this.heap[parent], this.heap[index]) <= 0) {  
            return;  
        }  
        [this.heap[parent], this.heap[index]] = [this.heap[index], this.heap[parent]];  
        this.siftUp(parent);  
    }  
  
    // 下滤操作，保证父节点小于或等于子节点  
    private siftDown(index: number): void {  
        const length = this.heap.length;  
        let smallest = index;  
        const left = 2 * index + 1;  
        const right = 2 * index + 2;  
  
        if (left < length && this.compare(this.heap[left], this.heap[smallest]) < 0) {  
            smallest = left;  
        }  
  
        if (right < length && this.compare(this.heap[right], this.heap[smallest]) < 0) {  
            smallest = right;  
        }  
  
        if (smallest !== index) {  
            [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];  
            this.siftDown(smallest);  
        }  
    }  
  
    // 自定义比较函数  
    private compare(a: TrendTree, b: TrendTree): number {  
        return this.computeError(b) - this.computeError(a);  
    }  
  
    computeError(t:any){
        let count = t.timeRange[1] - t.timeRange[0] + 1;
        return (count - 2)*(t.yArray[2] - t.yArray[1]);
    }

    // 获取最小元素，但不弹出  
    peek(): TrendTree | null {  
        return this.heap.length > 0 ? this.heap[0] : null;  
    }  
  
    // 获取堆的大小  
    size(): number {  
        return this.heap.length;  
    }  

    toArray(): TrendTree[] {  
        return [...this.heap]; // 返回一个浅拷贝  
    }  
}  

