"use strict";

const Heap = require('heap');

// Print all entries, across all of the *async* sources, in chronological order.

module.exports = (logSources, printer) => {
  return new Promise(async (resolve, reject) => {

    // create a min heap instance, sorted by log.date.time
    const minHeap = new Heap((a, b) => {
        return a.log.date.getTime() - b.log.date.getTime();
    });

    // pop the first log from each source
    const promises = logSources.map(
      (logSource, i) => logSource.popAsync().then((initialLog => ({log: initialLog, logSourceIndex: i})))
    );

    // wait for all the initial pops to complete and push to the heap, heapifies by minimum log.date.time
    for await (const prom of promises) {
      if (prom.log != undefined){
        minHeap.push(prom)
      }
    }
    
    // Until the heap is empty
    while (!minHeap.empty()) {
      // pop the top node from the heap, and print
      const minNode = minHeap.pop()
      let logEntry = minNode.log
      let logSourceIndex = minNode.logSourceIndex
      printer.print(logEntry)
  
      // pop next log from current souce, this will also refresh .drained status
      let nextLog = await logSources[logSourceIndex].popAsync()
      //if current source isn't drained, nextLog will eventually return a log
      if (!logSources[logSourceIndex].drained){
        if (nextLog !== undefined){
          minHeap.push({ log: nextLog, logSourceIndex: logSourceIndex })
        }
      }
    }
    printer.done()
    resolve(console.log("Async sort complete."));
  });

};
