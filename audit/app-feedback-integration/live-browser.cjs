const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const room={roomId:'qa-room',inviteCode:'QA42',roomTitle:'Private Journey',status:'active',journeyStatus:'in_progress',category:'arrival_time',startingPointLabel:'Station',destinationLabel:'Cafe',creator:{userId:'host',name:'Host'},closureReasonCode:'plans_changed',cancelledAt:'2026-10-29T10:00:00Z'};
const predictions=[{predictionId:'p',status:'visible',user:{userId:'guest',name:'Alice'},predictedReachedTime:'2026-10-29T12:00:00Z',auraEligible:false},{predictionId:'p2',status:'submitted',user:{userId:'guest2',name:'Bob'}}];
let live={};
const findings=[];
(async()=>{
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},permissions:['clipboard-read','clipboard-write']});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
await page.addInitScript(()=>{
 const user={userId:'qa-user',name:'QA',totalAura:0,weeklyAura:0,cloutBalance:0,winsCount:0};
 localStorage.setItem('predikt.auth.session.v1',JSON.stringify({user,accessToken:'qa',refreshToken:'qa',accessTokenExpiresAt:'2099-01-01',refreshTokenExpiresAt:'2099-01-01'}));
 window.launches=[];window.open=()=>{if(window.blockPopups)return null;return {opener:'parent',location:{set href(url){window.launches.push(url);}}};};
 navigator.share=async data=>{window.shared=data;};
});
await page.route('http://localhost:3000/**',async r=>{
 const p=new URL(r.request().url()).pathname;let body=[];
 if(p==='/rooms/qa-room')body=room;
 else if(p.endsWith('/live-state'))body=live;
 else if(p.endsWith('/predictions'))body=predictions;
 else if(p.endsWith('/leaderboard'))body=[{userId:'guest',name:'Alice',rankInRoom:1,totalRoomAura:999,predictedReachedTime:'2026-10-29T12:00:00Z'}];
 else if(p==='/dashboard/summary')body={};
 await r.fulfill({json:body,headers:{'Access-Control-Allow-Origin':'*'}});
});
async function navigate(screen,params){await page.evaluate(({screen,params})=>{
 const seen=new Set();let nav;
 function walk(f){if(!f||seen.has(f)||nav)return;seen.add(f);if(f.memoizedProps?.navigation?.navigate)nav=f.memoizedProps.navigation;walk(f.child);walk(f.sibling);}
 const el=document.querySelector('#root').firstElementChild;const key=Object.keys(el).find(k=>k.startsWith('__reactFiber'));let root=el[key];while(root?.return)root=root.return;walk(root);if(!nav)throw Error('No nav');nav.navigate(screen,params);
},{screen,params});}

async function openLive(width,isCreator){
 await page.setViewportSize({width,height:900});
 await page.goto('http://localhost:18789');await page.waitForTimeout(450);
 await navigate('LiveRoom',{roomId:'qa-room',isCreator});
 await page.getByText('Station',{exact:false}).first().waitFor();
 await page.waitForTimeout(200);
}
function liveFixture(status,journeyStatus,waiting=false){
 room.status=status;room.journeyStatus=journeyStatus;
 live={roomId:'qa-room',status,journeyStatus,plannedStartTime:null,startTime:null,
 visibleMovementStartTime:waiting?new Date(Date.now()+180000).toISOString():null,
 secondsUntilStart:waiting?180:0,progressPercentage:0,etaMinutes:null,
 locationDisplayMode:'hidden',safetyMessage:'Exact location is hidden.',waitingForDelayedStart:waiting};
}
for(const width of [390,1440]){
 for(const [status,journeyStatus] of [['cancelled','cancelled_by_host'],['completed','completed'],['result_ready','arrived_verified'],...['auto_closed','abandoned','plan_changed','cancelled_by_host','arrived_verified'].map(s=>['predictions_locked',s])]){
  liveFixture(status,journeyStatus);
  await openLive(width,true);
  const starts=await page.getByRole('button',{name:/Start Journey|Start journey|Start now/i}).count();
  assert.equal(starts,0,`${width} ${status}/${journeyStatus}`);
  await page.getByText('View Result',{exact:true}).first().waitFor();
  console.log('PASS no Start',width,status,journeyStatus);
 }
 liveFixture('live','started',true);
 // Creator countdown uses its own start time; guest uses delayed visible timestamp.
 live.startTime=new Date(Date.now()+60000).toISOString();
 await openLive(width,true);
 let text=await page.locator('body').innerText();
 assert.ok(!text.includes('Journey starts in'),text);
 console.log('PASS creator distinct delay view',width);
 await page.screenshot({path:`/tmp/app-feedback-integration/creator-delay-${width}.png`,fullPage:true});
 await openLive(width,false);
 text=await page.locator('body').innerText();assert.ok(text.includes('Journey starts in'),text);
 assert.equal(await page.getByRole('button',{name:/Start Journey/i}).count(),0);
 console.log('PASS guest waiting view',width);
 await page.screenshot({path:`/tmp/app-feedback-integration/guest-delay-${width}.png`,fullPage:true});
}
// Numeric coordinate properties must not enter visible UI or accessible labels.
liveFixture('live','started',true);room.route={latitude:12.345678,longitude:76.543219};
await openLive(1440,true);
let html=await page.locator('body').innerHTML();assert.ok(!/12\.345678|76\.543219/.test(html));
console.log('PASS raw coordinate properties excluded');
// Probe label contamination separately: this is the missing privacy patch's release gate.
room.startingPointLabel='12.345678, 76.543219';room.destinationLabel='23.456789, 87.654321';
await page.goto('http://localhost:18789');await page.waitForTimeout(450);
await navigate('LiveRoom',{roomId:'qa-room',isCreator:true});await page.waitForTimeout(500);
html=await page.locator('body').innerHTML();
const leaked=/12\.345678|76\.543219|23\.456789|87\.654321/.test(html);
findings.push({check:'coordinate-like route labels excluded from LiveRoom UI/accessibility',pass:!leaked});
console.log(leaked?'BLOCKER coordinate-like route labels enter LiveRoom UI/accessibility':'PASS coordinate-like route labels excluded');
room.status='cancelled';room.journeyStatus='cancelled_by_host';
await page.goto('http://localhost:18789');await page.waitForTimeout(450);
await navigate('Result',{roomId:'qa-room'});await page.getByText('Submitted predictions',{exact:true}).waitFor();
html=await page.locator('body').innerHTML();
const summaryLeak=/12\.345678|76\.543219|23\.456789|87\.654321/.test(html);
findings.push({check:'coordinate-like route labels excluded from neutral summary',pass:!summaryLeak});
console.log(summaryLeak?'BLOCKER coordinate-like route labels enter neutral summary':'PASS coordinate-like route labels excluded from summary');
assert.deepEqual(errors,[]);console.log('PASS no browser errors');
require('node:fs').writeFileSync('/tmp/app-feedback-integration/privacy-findings.json',JSON.stringify(findings,null,2));
await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
