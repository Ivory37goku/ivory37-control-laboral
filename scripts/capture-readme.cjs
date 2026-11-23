'use strict';
// Capturas reales de la app con un perfil temporal y datos exclusivamente ficticios.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
const root=path.resolve(__dirname,'..');const out=path.join(root,'docs');
const KEY='工V龱尺ㄚ㇌7_data_v1';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const jornadas=[];
function month(month,days,extras,paid){days.forEach((day,i)=>{
 const fecha=`2026-${month}-${String(day).padStart(2,'0')}`;const extra=extras[i]||0;
 const end=16*60+Math.round(extra*60);const salida=String(Math.floor(end/60)).padStart(2,'0')+':'+String(end%60).padStart(2,'0');
 jornadas.push({id:'demo-'+fecha,fecha,entrada:'08:00',salida,horas_normales:8,horas_extra:extra,descanso_minutos:0,estado:'confirmado',notas:i%4===0?'Instalación y revisión de equipos.':'Mantenimiento programado.',pagado_extras:paid||false,fecha_pago_extras:paid?`2026-${month}-28`:'',creado:fecha+'T16:00:00Z'});
});}
month('09',[1,2,3,4,7,8,9,10,11],[0,1,0,2,0,1,0,0,2],true);
month('10',[1,2,5,6,7,8,9,13,14,15,16,19],[1,0,2,0,1,0,0,2,0,1,0,1],false);
month('11',[2,3,4,5,6,10,11,12,13,16,17,18,19],[0,0,1,0,0,2,0,1.5,0,1.5,0,0,3],false);
const night=jornadas.find(j=>j.fecha==='2026-11-18');night.entrada='22:00';night.salida='06:00';night.notas='Turno nocturno · revisión de instalaciones.';
const settings={user_name:'Marina Soler',user_role:'Técnica de instalaciones',auto_fichaje:'0',horario_habitual:'08:00-16:00',pausa_habitual_minutos:'0',hora_normal_euros:'12.50',hora_extra_euros:'19.69',horas_normales_dia:'8',estimation:'0',setup_dismissed:'1',overtime_received_2026_09:'118.14',overtime_received_2026_10:'140',overtime_received_2026_11:'120'};
// Las claves mensuales usan guion en el formato real de la aplicación.
for(const m of ['09','10','11']){settings['overtime_received_2026-'+m]=settings['overtime_received_2026_'+m];delete settings['overtime_received_2026_'+m];}
const fixture={jornadas,viajes:[
 {id:'trip-sept',fecha:'2026-09-10',concepto:'Desplazamiento · instalación centro',importe:45,pagado:1,notas:'45 km y aparcamiento.'},
 {id:'trip-oct',fecha:'2026-10-15',concepto:'Visita técnica · oficina norte',importe:32,pagado:0,notas:'Dieta y desplazamiento.'},
 {id:'trip-nov-1',fecha:'2026-11-17',concepto:'Revisión · centro logístico',importe:18.5,pagado:0,notas:'Kilometraje de la visita.'},
 {id:'trip-nov-2',fecha:'2026-11-19',concepto:'Desplazamiento · taller sur',importe:12.8,pagado:0,notas:'Transporte y aparcamiento.'}
],pagos:[
 {id:'pay-sept',fecha:'2026-09-30',mes_key:'2026-09',concepto:'Nómina septiembre de 2026',importe:900,tipo:'nomina_auto',confirmado:true,horas_normales_mes:72,dias_laborables:9},
 {id:'pay-oct',fecha:'2026-10-31',mes_key:'2026-10',concepto:'Nómina octubre de 2026',importe:1200,tipo:'nomina_auto',confirmado:true,horas_normales_mes:96,dias_laborables:12}
],ausencias:[{id:'calendar-1',fecha:'2026-11-09',tipo:'vacaciones',concepto:'Día de vacaciones',notas:'Ejemplo ficticio.',grupo:'vacaciones-demo'},{id:'calendar-2',fecha:'2026-11-20',tipo:'descanso',concepto:'Descanso programado',notas:'Anotación de calendario.',grupo:'descanso-demo'}],ajustes:Object.entries(settings).map(([clave,valor])=>({clave,valor}))};
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'control-laboral-readme-')));
app.whenReady().then(async()=>{
 const win=new BrowserWindow({show:false,width:1440,height:1000,webPreferences:{offscreen:true,nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});
 const execute=code=>win.webContents.executeJavaScript(code);
 const shot=async name=>{await pause(1200);fs.writeFileSync(path.join(out,name),(await win.webContents.capturePage()).toJPEG(88));};
 const tab=async name=>{await execute(`document.querySelector('[data-action="tab"][data-tab="${name}"]').click()`);await pause(650);};
 const scroll=async selector=>{await execute(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'start',behavior:'instant'});window.scrollBy(0,-12);`);await pause(100);};
 const crop=async(selector,name)=>{await scroll(selector);const r=await execute(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:Math.max(0,Math.floor(r.x)),y:Math.max(0,Math.floor(r.y)),width:Math.ceil(r.width),height:Math.min(innerHeight-Math.max(0,Math.floor(r.y)),Math.ceil(r.height))};})()`);fs.writeFileSync(path.join(out,name),(await win.webContents.capturePage(r)).toJPEG(90));};
 try {
  await win.loadFile(path.join(root,'index.html'));
  await execute(`(async()=>{await window.IVORY37Storage.ready; window.IVORY37Storage.setItem(${JSON.stringify(KEY)},${JSON.stringify(JSON.stringify(fixture))}); await window.IVORY37Storage.flush();})()`);
  await win.loadFile(path.join(root,'index.html'));await pause(1200);
  const info=await execute(`({version:document.querySelector('meta[name="app-version"]').content,name:document.getElementById('hero-name').textContent,count:document.querySelector('[data-tab-panel="dashboard"]').querySelectorAll('[data-action="clock-in"],[data-action="clock-out"]').length,month:document.getElementById('bars-extra-details').innerText})`);
  if(info.version!==require('../package.json').version||info.count!==1||!info.month.includes('9,00 h'))throw Error(JSON.stringify(info));
  await shot('windows.jpg');await shot('dashboard.jpg');
  await crop('.dash-overtime','extras-mensuales.jpg');
  for(const name of ['jornadas','pagos','viajes','ajustes']){await tab(name);await shot(name+'.jpg');}
  await crop('#cloud-password-help','password-policy-hint.jpg');
  await execute(`document.getElementById('cloud-password').closest('article').scrollIntoView({block:'start',behavior:'instant'})`);await shot('nube.jpg');
  await tab('jornadas');
  await execute(`document.querySelector('[data-action="edit-jornada"]').click()`);
  await shot('formulario-jornada.jpg');
  await execute(`document.querySelector('#modal [data-action="close-modal"]').click()`);
  win.setSize(390,920);await pause(300);await tab('dashboard');await execute('window.scrollTo({top:0,behavior:"instant"})');await pause(500);await shot('mobile.jpg');
  await scroll('.dash-cash');await shot('mobile-cash.jpg');
  console.log(JSON.stringify({version:info.version,profile:info.name,clockControls:info.count,output:'docs/',novemberExtraHours:9,novemberExpected:177.21,novemberReceived:120}));
 }catch(error){console.error(error);process.exitCode=1;}finally{win.destroy();app.quit();}
});
