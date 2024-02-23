"use strict";

// Import the 'heap' module
const Heap = require('heap');

module.exports = (logSources, printer) => {

  const minHeap = new Heap((a, b) => {
    return a.log.date.getTime() - b.log.date.getTime();
  });

  // pop the first log from each source and push into heap
  logSources.map(
    (logSource, i) => minHeap.push({ log: logSource.pop(), logSourceIndex: i }))

  // Until the heap is empty
  while (!minHeap.empty()) {
    // pop the top node from the heap, and print
    const logNode = minHeap.pop()
    let logEntry = logNode.log
    let logSourceIndex = logNode.logSourceIndex
    printer.print(logEntry)

    // pop the source to refresh the status of .drained
    let logSource = logSources[logSourceIndex];
    let newEntry = logSources[logSourceIndex].pop()
    // If not drained, newEntry is garanteed to be a log. Push to heap
    if (!logSource.drained) {
        minHeap.push({ log: newEntry, logSourceIndex: logSourceIndex });
    }
  }

  printer.done()
  return console.log("Sync sort complete.");
};
