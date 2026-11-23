'use strict';
// Datos ficticios; ejecutar solo con el perfil temporal de Electron o la APK .audit.
const assert = require('node:assert/strict');
const path = require('node:path');
const KEY = '工V龱尺ㄚ㇌7_data_v1';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function scenarios(evaluate, reload) {
  const run = code => evaluate(`(async()=>{await window.IVORY37Storage.ready;try {return await (async()=>{${code}})();} finally {await window.IVORY37Storage.flush();await new Promise(r=>setTimeout(r,50));}})()`);
  await run(`window.IVORY37Storage.clear();window.IVORY37Storage.setItem(${JSON.stringify(KEY)},JSON.stringify({jornadas:[],viajes:[],pagos:[],ausencias:[],ajustes:[{clave:'auto_fichaje',valor:'0'},{clave:'user_name',valor:'Marina · Auditoría'}]}));`);
  await reload();
  const ready = await run(`return Boolean(window.IVORY37CloudSync && document.getElementById('hero-clock-action'));`);
  assert.equal(ready,true);
  const first = await run(`const panel=document.querySelector('[data-tab-panel="dashboard"]');const button=document.getElementById('hero-clock-action');return {count:panel.querySelectorAll('[data-action="clock-in"],[data-action="clock-out"]').length,action:button.dataset.action};`);
  assert.deepEqual(first,{count:1,action:'clock-in'});
  await run(`document.getElementById('hero-clock-action').click();`);
  assert.equal(await run(`return document.getElementById('hero-clock-action').dataset.action;`),'clock-out');
  await run(`document.getElementById('hero-clock-action').click();`);
  assert.equal(await run(`return document.getElementById('hero-clock-action').hidden;`),true);
  assert.equal(await run(`return document.getElementById('hero-manual-action').dataset.action;`),'edit-jornada');
  await run(`document.getElementById('hero-manual-action').click();const fields={'f-entrada':'08:00','f-salida':'17:00','f-normales':'8','f-extra':'1','f-pausa':'0','f-estado':'confirmado','f-notas':'<img id="qa-xss" src=x onerror="window.qaXSS=true">'};for(const [id,value] of Object.entries(fields))document.getElementById(id).value=value;document.getElementById('modal-save').click();`);
  const saved = await run(`const d=JSON.parse(window.IVORY37Storage.getItem(${JSON.stringify(KEY)}));return {count:d.jornadas.length,extra:d.jornadas[0].horas_extra,normal:d.jornadas[0].horas_normales};`);
  assert.deepEqual(saved,{count:1,extra:1,normal:8});
  await run(`document.querySelector('[data-tab-panel="dashboard"] [data-action="new-trip"]').click();document.getElementById('t-concepto').value='Visita ficticia';document.getElementById('t-importe').value='12,50';document.getElementById('t-notas').value='<img id="qa-xss-trip" src=x onerror="window.qaXSS=true">';document.getElementById('modal-save').click();`);
  for (const tab of ['jornadas','viajes','pagos','ajustes','dashboard']) {
    const result=await run(`document.querySelector('[data-action="tab"][data-tab="${tab}"]').click();return {visible:[...document.querySelectorAll('[data-tab-panel]')].filter(el=>!el.hidden).map(el=>el.dataset.tabPanel),overflow:document.documentElement.scrollWidth>innerWidth+1,xss:Boolean(document.getElementById('qa-xss')||document.getElementById('qa-xss-trip')||window.qaXSS)};`);
    assert.deepEqual(result.visible,[tab]);assert.equal(result.overflow,false,tab+' overflow');assert.equal(result.xss,false);
  }
  await run(`document.querySelector('[data-action="tab"][data-tab="pagos"]').click();document.querySelector('[data-action="confirm-payroll"]').click();`);
  assert.equal(await run(`return JSON.parse(window.IVORY37Storage.getItem(${JSON.stringify(KEY)})).pagos.some(row=>row.confirmado);`), true);
  await run(`document.querySelector('[data-action="tab"][data-tab="viajes"]').click();document.querySelector('[data-action="delete-trip"]').click();document.getElementById('modal-save').click();`);
  assert.equal(await run(`return JSON.parse(window.IVORY37Storage.getItem(${JSON.stringify(KEY)})).viajes.length;`), 0);
  await run(`document.querySelector('[data-action="tab"][data-tab="ajustes"]').click();document.getElementById('undo-delete').click();`);
  assert.equal(await run(`return JSON.parse(window.IVORY37Storage.getItem(${JSON.stringify(KEY)})).viajes.length;`), 1);
  const backup=await run(`return window.IVORY37BackupTools.create(JSON.parse(window.IVORY37Storage.getItem(${JSON.stringify(KEY)})),'2026-11-19');`);
  await run(`const input=document.getElementById('import-file');const transfer=new DataTransfer();transfer.items.add(new File([${JSON.stringify(JSON.stringify(backup))}],'auditoria.json',{type:'application/json'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));`);
  await pause(100);
  assert.equal(await run(`return document.getElementById('modal').hidden;`),false);
  await run(`document.getElementById('modal-save').click();`);
  await reload();
  const restored=await run(`const d=JSON.parse(window.IVORY37Storage.getItem(${JSON.stringify(KEY)}));return {jornadas:d.jornadas.length,viajes:d.viajes.length,extra:d.jornadas[0].horas_extra,importe:d.viajes[0].importe,modal:document.getElementById('modal').hidden};`);
  assert.deepEqual(restored,{jornadas:1,viajes:1,extra:1,importe:12.5,modal:true});
  return {clock:'PASS',manualEdit:'PASS',payrollConfirmation:'PASS',deleteAndUndo:'PASS',fiveTabs:'PASS',htmlEscaping:'PASS',backupRestoreAndRestart:'PASS',restored};
}
async function android() {
  const {execFileSync}=require('node:child_process');
  const adb=path.join(process.env.LOCALAPPDATA,'Android','Sdk','platform-tools','adb.exe');
  let pid='';
  for(let attempt=0;attempt<60;attempt++) {
    try { pid=execFileSync(adb,['-s','emulator-5554','shell','pidof','com.ivory37.controllaboral.audit'],{encoding:'utf8'}).trim(); if(/^\d+$/.test(pid)) break; } catch (_) {}
    await pause(500);
  }
  assert.match(pid,/^\d+$/,'Solo se permite el proceso de la APK .audit');
  execFileSync(adb,['-s','emulator-5554','forward','tcp:9228','localabstract:webview_devtools_remote_'+pid]);
  let pages;
  for(let attempt=0;attempt<60;attempt++) {
    try { pages=await (await fetch('http://127.0.0.1:9228/json/list')).json(); if(pages.some(page=>page.url.startsWith('https://appassets.androidplatform.net/'))) break; }
    catch(error) { if(attempt===59) throw error; }
    await pause(500);
  }
  const page=pages.find(p=>p.url.startsWith('https://appassets.androidplatform.net/'));
  assert.ok(page,'WebView de auditoría disponible');
  const socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  let id=0;const pending=new Map();
  socket.onmessage=event=>{const message=JSON.parse(event.data);const request=pending.get(message.id);if(request){pending.delete(message.id);message.error?request.reject(Error(message.error.message)):request.resolve(message.result);}};
  socket.onclose=()=>{for(const request of pending.values())request.reject(Error('Android audit debugging connection closed'));pending.clear();};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;const timer=setTimeout(()=>{pending.delete(n);reject(Error('Android command timed out: '+method));},30000);pending.set(n,{resolve(value){clearTimeout(timer);resolve(value)},reject(error){clearTimeout(timer);reject(error)}});socket.send(JSON.stringify({id:n,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  try {
    let isolated=false;
    for(let attempt=0;attempt<60;attempt++) {
      isolated=await evaluate(`Boolean(window.AndroidBridge)&&location.hostname==='appassets.androidplatform.net'`);
      if(isolated) break;
      await pause(500);
    }
    assert.ok(isolated);
    // El puerto debe apuntar al PID de com.ivory37.controllaboral.audit.
    const reload=async()=>{
      const previousOrigin = await evaluate('performance.timeOrigin');
      await send('Page.reload');
      const deadline=Date.now()+30000;
      while(Date.now()<deadline){
        await pause(250);
        try { if(await evaluate(`Boolean(performance.timeOrigin!==${previousOrigin} && window.IVORY37AppReady && window.IVORY37Storage?.isReady && window.IVORY37CloudSync && document.readyState==='complete')`)) return; } catch (_) {}
      }
      throw Error('Android audit WebView did not finish loading within 30 seconds');
    };
    await reload();
    const result=process.argv.includes('--verify-only') ? {upgradePreservation:'PASS'} : await scenarios(evaluate,reload);
    await send('Network.enable');
    try {
      await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
      await reload();
      const stored=await evaluate(`(()=>{const d=JSON.parse(window.IVORY37Storage.getItem(${JSON.stringify(KEY)}));return {jornadas:d.jornadas.length,viajes:d.viajes.length,extra:d.jornadas[0].horas_extra,version:document.querySelector('meta[name="app-version"]').content,ready:!!window.IVORY37CloudSync};})()`);
      assert.equal(stored.jornadas,1);assert.equal(stored.viajes,1);assert.equal(stored.extra,1);assert.equal(stored.ready,true);
      console.log(JSON.stringify({platform:'Android audit WebView',...result,offlineRestart:stored}));
      const screenshot=await send('Page.captureScreenshot',{format:'png'});
      require('node:fs').writeFileSync(path.resolve(__dirname,'../.codex-attachments/audit-android.png'),Buffer.from(screenshot.data,'base64'));
    }finally{await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});}
  } finally {socket.close();}
}
async function desktop() {
  const {app,BrowserWindow}=require('electron');
  app.setPath('userData',path.join(require('node:os').tmpdir(),'control-laboral-ui-'+Date.now()));
  await app.whenReady();
  const window=new BrowserWindow({show:false,width:390,height:860,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});
  const errors=[];window.webContents.on('render-process-gone',(_e,details)=>errors.push(details.reason));
  const evaluate=expression=>window.webContents.executeJavaScript(expression);
  const reload=async()=>{await window.loadFile(path.resolve(__dirname,'../index.html'));};
  try {await reload();const result=await scenarios(evaluate,reload);
    for(const width of [320,768,1440]){window.setSize(width,960);await pause(150);assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+1'),false,'width '+width);}
    require('node:fs').writeFileSync(path.resolve(__dirname,'../.codex-attachments/audit-desktop.png'),(await window.webContents.capturePage()).toPNG());
    assert.deepEqual(errors,[]);console.log(JSON.stringify({platform:'Electron',...result,responsive:[320,390,768,1440]}));
  }finally{window.destroy();app.quit();}
}
(process.argv.includes('--android')?android():desktop()).catch(error=>{console.error(error);process.exitCode=1;if(process.versions.electron)require('electron').app.quit();});
