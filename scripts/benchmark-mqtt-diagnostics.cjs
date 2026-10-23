// Offline VM benchmark of the actual message handler, no broker or real DOM.
// METEO_TEST_HTML=/path/to/baseline.html node --expose-gc scripts/benchmark-mqtt-diagnostics.cjs
const {app}=require('../tests/helpers/app');
const a=app(),results=[];
a.run(`globalThis.NativeDate=Date;globalThis.clock=+new Date(2026,9,23,12);
globalThis.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[clock]))}static now(){return clock}};
CFG={...CFG,source:'both',mqttHost:'fixture.invalid'};connectMQTT();
globalThis.benchClient=mqttClient;benchClient.options.onSuccess();
globalThis.runBatch=valid=>{for(let i=0;i<(valid?100:1000);i++){
 clock+=1000;benchClient.onMessageArrived({payloadString:valid?'{"temp":0,"voltage":"4,2"}':'bad'});
}};`);
for(const count of [1000,10000,100000,250000]){
 a.run(`globalThis.originalRows=Array.from({length:${count}},(_,i)=>({ts:new Date(clock-i*300000),temp:i%7,hum:50,pressure:1010,voltage:null,rain:0,rainInc:0,tank:null}));`);
 const samples={invalid:[],valid:[]};let maxReportBytes=0;
 for(const valid of [false,true]){
  const prepare=()=>a.run('resetStationStore();store.rows=originalRows.slice();store.fullLoaded=true');
  prepare();a.run(`runBatch(${valid})`);
  for(let repeat=0;repeat<5;repeat++){
   prepare();global.gc?.();const start=performance.now();a.run(`runBatch(${valid})`);
   samples[valid?'valid':'invalid'].push(performance.now()-start);
   const extra=valid?100:0;
   if(!a.run(`store.rows.length===originalRows.length+${extra} && originalRows.every((r,i)=>store.rows[i+${extra}]===r)`))throw new Error('Original history changed');
   if(valid&&!a.run('store.rows.slice(0,100).every(r=>r.temp===0 && r.voltage===4.2)'))throw new Error('MQTT values changed');
   if(!a.run(`!dataStatus.mqtt.diagnostics || (dataStatus.mqtt.diagnostics.received===${valid?100:1000} && dataStatus.mqtt.diagnostics.accepted===${extra})`))throw new Error('Incorrect counters');
   maxReportBytes=Math.max(maxReportBytes,a.run('dataStatus.mqtt.diagnostics?new TextEncoder().encode(JSON.stringify(dataStatus.mqtt.diagnostics)).length:0'));
  }
 }
 results.push({rows:count,invalidMessages:1000,acceptedMessages:100,samplesMs:samples,
  invalidMedianMs:+[...samples.invalid].sort((x,y)=>x-y)[2].toFixed(2),validMedianMs:+[...samples.valid].sort((x,y)=>x-y)[2].toFixed(2),maxReportBytes});
}
console.log(JSON.stringify({node:process.version,results},null,2));
