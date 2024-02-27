"use strict";

const Heap = require('heap');
const LogSourceBuffer = require('./log-source-buffer');
// BUFFERSIZE 
let BUFFERSIZE = 3
// Print all entries, across all of the *async* sources, in chronological order.


/* 
optimized approach. In the native approach commented out at the bottom of the file,
I was waiting - in the worst case - 8 ms for every popAsync. 

In the optimized approach, I was experimenting with the following to 
optimized this as much as I can with the use of buffers and processing the popAsyncs
in batches.

1. load the heap with the first entry from every logSource
2. Have the buffers ready. every buffer in buffers corresponds to a logSource
3. since the heap is prepopulated, we could start popping
4. everytime we pop from the heap, we check the corresponding buffer to see if there is 
    a nextEntry from the same source. We also pre populated the buffers to begin with.
    So the nextEntry should be ready, we just push the nextEntry to the heap. 
5. In the case where we find that the buffer is empty, we need to check two cases. (1) the
    buffer is drained or (2) the buffer is loading.
    - if the buffer is empty and is not drained, we have to rehydrate it by populating
    the next batch
6. we keep doing this until we have no more logs to process


Why is this an optimization:
- This is an optimization because in the naive approach, we had to wait 8 ms for each pop. 
In this approach, we take advantage of the fact that popAsync returns a promise, so we push
BUFFERSIZE number of promises into the buffer - all the promises would buffer in parallel.

so for example:
buffer = [Promise1, Promise2, Promise3] -> all three promises - in the worst case - will not
take 24 ms to buffer as they will all buffer in parallel. So all three promises will be
buffered within the span of 8ms.
*/
module.exports = (logSources, printer) => {
  return new Promise(async (resolve, reject) => {

    // initialize the min heap that is sorted by min time
    const minHeap = new Heap((a, b) => {
      return a.log.date.getTime() - b.log.date.getTime();
    });
    
    // list of buffers. Used to buffer a batch of popAsyncs in parallel
    let buffers = logSources.map(logSource => new LogSourceBuffer());

    // pop the first log from each source and put in the correct buffer
    // because need to wait for all the promises to be returned

    // getOneBuffer: takes in a index and populates it with a popAsync()
    async function getOneBuffer(index) {
      const popAsyncResult = await logSources[index].popAsync(); // returns a promise
      if (logSources[index].drained) {
        // Set the buffer to drained if the source is drained
        buffers[index].setDrained()
        return
      }
      return popAsyncResult;
    }

    // helper function _getLogsFromSource
    // returns resolved promises
    // NOTE: will also rehydrate buffers that are not full
    async function _getLogsFromSource(poppedBufferIndices, bufferIndices) {
      let promises = []
      for (let i = 0; i < poppedBufferIndices.length; i++) {
        const bufferIndex = poppedBufferIndices[i]
        let remaining_buffer_length = BUFFERSIZE - buffers[bufferIndex].size()

        if (buffers[bufferIndex].drained) {
          continue;
        }

        for (let j = 0; j < remaining_buffer_length; j++) {
          const popAsyncResult = await getOneBuffer(bufferIndex)
          if (buffers[bufferIndex].drained) {
            break;
          }
          if (popAsyncResult) {
            promises.push(popAsyncResult)
            bufferIndices.push(bufferIndex)
          }
        }
      };
      return Promise.all(promises)
    }

    // will load all the buffers with Promises that are resolved.
    async function loadBuffersFromSource(poppedBufferIndices) {
      const bufferIndices = [];
      const result = await _getLogsFromSource(poppedBufferIndices, bufferIndices);

      result.forEach((obj, i) => {
        if (obj) {
          buffers[bufferIndices[i]].push({log: obj, logSourceIndex: bufferIndices[i]})
        }
      })
    }

    async function loadHeap() {
      for (let i = 0; i < logSources.length; i++) {
        let logEntry = await logSources[i].popAsync()
        minHeap.push({log: logEntry, logSourceIndex: i})
      }
    }

    // put first item in each buffer into the heap
    await loadHeap();

    // load second item from each source into their buffers
    let poppedBufferIndices = [];
    for (let i = 0; i < logSources.length; i++) {
      poppedBufferIndices.push(i)
    }
    await loadBuffersFromSource(poppedBufferIndices)

    // reset the poppedBufferIndices for subsequent pops
    poppedBufferIndices = [];

    
    // while heap is not empty
    while (!minHeap.empty()){
      // pop the top of the heap
      const logNode = minHeap.pop()
      let logEntry = logNode.log
      let logSourceIndex = logNode.logSourceIndex
      // print the log entry
      printer.print(logEntry);

      // buffers[index] will have the next available log
      let nextEntry = await buffers[logSourceIndex].pop()
      if (buffers[logSourceIndex].drained) {
        continue;
      }
      else {
        poppedBufferIndices.push(logSourceIndex)
      }

      if (!nextEntry || !nextEntry.log || !nextEntry.log.date) {
        continue;
      }
      minHeap.push(nextEntry)
      // call loadBuffer on this buffer. load before checking if drained to refresh the drained status
      if (buffers[logSourceIndex].isEmpty() && !buffers[logSourceIndex].drained) {
        await loadBuffersFromSource(poppedBufferIndices)
        poppedBufferIndices = []
      }

    }
    printer.done()
    resolve(console.log("Async sort complete."));
  });

};


// naive approach
// "use strict";

// const Heap = require('heap');

// // Print all entries, across all of the *async* sources, in chronological order.

// module.exports = (logSources, printer) => {
//   return new Promise(async (resolve, reject) => {

//     // create a min heap instance, sorted by log.date.time
//     const minHeap = new Heap((a, b) => {
//         return a.log.date.getTime() - b.log.date.getTime();
//     });

//     // pop the first log from each source
//     const promises = logSources.map(
//       (logSource, i) => logSource.popAsync().then((initialLog => ({log: initialLog, logSourceIndex: i})))
//     );

//     // wait for all the initial pops to complete and push to the heap, heapifies by minimum log.date.time
//     for await (const prom of promises) {
//       if (prom.log != undefined){
//         minHeap.push(prom)
//       }
//     }
    
//     // Until the heap is empty
//     while (!minHeap.empty()) {
//       // pop the top node from the heap, and print
//       const minNode = minHeap.pop()
//       let logEntry = minNode.log
//       let logSourceIndex = minNode.logSourceIndex
//       printer.print(logEntry)
  
//       // pop next log from current souce, this will also refresh .drained status
//       let nextLog = await logSources[logSourceIndex].popAsync()
//       //if current source isn't drained, nextLog will eventually return a log
//       if (!logSources[logSourceIndex].drained){
//         if (nextLog !== undefined){
//           minHeap.push({ log: nextLog, logSourceIndex: logSourceIndex })
//         }
//       }
//     }
//     printer.done()
//     resolve(console.log("Async sort complete."));
//   });

// };
