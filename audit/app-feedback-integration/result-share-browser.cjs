const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const room={roomId:'qa-room',inviteCode:'QA42',roomTitle:'Private Journey',status:'active',journeyStatus:'in_progress',category:'arrival_time',startingPointLabel:'Station',destinationLabel:'Cafe',creator:{userId:'host',name:'Host'},closureReasonCode:'plans_changed',cancelledAt:'2026-10-29T10:00:00Z'};
room.route={latitude:12.345678,longitude:76.543219};
room.startingPointLabel='12.345678, 76.543219';room.destinationLabel='23.456789, 87.654321';
const predictions=[{predictionId:'p',status:'visible',user:{userId:'guest',name:'Alice'},predictedReachedTime:'2026-10-29T12:00:00Z',auraEligible:false},{predictionId:'p2',status:'submitted',user:{userId:'guest2',name:'Bob'}}];
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
await page.goto('http://localhost:18789');await page.waitForTimeout(1500);
await navigate('RoomCreated',{roomId:'qa-room'});await page.getByText('Your journey is live 🎉').waitFor();
assert.equal(await page.getByText('Telegram',{exact:true}).count(),0);
await page.getByText('Copy Code',{exact:true}).click();await page.waitForTimeout(50);assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'QA42');
await page.getByText('Copy Invite Link',{exact:true}).click();await page.waitForTimeout(50);assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'http://localhost:18789?joinCode=QA42');
console.log('PASS Copy Code and Copy Invite Link');
await page.getByText('Share invite',{exact:true}).click();assert.ok(await page.evaluate(()=>window.shared.text.includes('Exact location is hidden.')));
await page.getByRole('button',{name:'More ways to share',exact:true}).click();
for(const [label,origin] of [['WhatsApp','https://wa.me'],['Telegram','https://t.me'],['SMS','null'],['Email','null'],['X / Twitter','https://twitter.com'],['Facebook','https://www.facebook.com']]){
 await page.getByText(label,{exact:true}).click();await page.waitForTimeout(30);
 const target=await page.evaluate(()=>window.launches.at(-1));const url=new URL(target);assert.equal(url.origin,origin);
 assert.ok(!/Private Journey|12\.345678|76\.543219|23\.456789|87\.654321/.test(decodeURIComponent(target)));assert.ok(decodeURIComponent(target).includes('joinCode=QA42'));
 console.log('PASS target',label);
}
await page.getByText('Instagram · Copy Caption',{exact:true}).click();await page.waitForTimeout(100);
assert.equal(await page.evaluate(()=>window.launches.at(-1)),'instagram://app');assert.ok((await page.evaluate(()=>navigator.clipboard.readText())).includes('Exact location is hidden.'));
let count=await page.evaluate(()=>window.launches.length);
await page.getByText('WeChat · Copy Invite',{exact:true}).click();await page.waitForTimeout(100);
assert.equal(await page.evaluate(()=>window.launches.length),count);assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'http://localhost:18789?joinCode=QA42');
await page.getByPlaceholder('+919876543210').fill('+919876543210');await page.getByText('Create WhatsApp Invite',{exact:true}).click();await page.waitForTimeout(100);
const manual=new URL(await page.evaluate(()=>window.launches.at(-1)));assert.equal(manual.pathname,'/919876543210');assert.ok(manual.searchParams.get('text').includes('joinCode=QA42'));
const copied=await page.evaluate(()=>navigator.clipboard.readText());const shared=await page.evaluate(()=>window.shared);
assert.ok(!/12\.345678|76\.543219|23\.456789|87\.654321/.test(JSON.stringify({manual:manual.href,copied,shared})));
console.log('PASS manual WhatsApp and coordinate-like labels excluded from share payloads');
await page.evaluate(()=>{window.blockPopups=true;window.shared=null;});
await page.getByText('WhatsApp',{exact:true}).click();await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>!!window.shared));
await page.getByText('Email',{exact:true}).click();await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'http://localhost:18789?joinCode=QA42');
assert.ok((await page.locator('body').innerText()).includes('could not open'));
await page.getByText('Instagram · Copy Caption',{exact:true}).click();await page.waitForTimeout(100);assert.ok((await page.locator('body').innerText()).includes('Instagram could not open'));
await page.evaluate(()=>{navigator.share=async()=>{throw Error('unavailable')};});
await page.getByText('Native Share',{exact:true}).click();await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'http://localhost:18789?joinCode=QA42');
console.log('PASS primary Share, Instagram copy before open, WeChat copy only, blocked handoff and share fallbacks');
await page.screenshot({path:'/tmp/app-feedback-integration/sharing.png',fullPage:true});
room.startingPointLabel='Station';room.destinationLabel='Cafe';
for(const closure of ['cancelled','cancelled_by_host','plan_changed','auto_closed','abandoned']){
 room.status=closure;room.journeyStatus='completed';await page.goto('http://localhost:18789');await page.waitForTimeout(1500);
 await navigate('Result',{roomId:'qa-room'});await page.getByText('Submitted predictions',{exact:true}).waitFor();await page.getByText('Alice',{exact:true}).first().waitFor();
 const text=await page.locator('body').innerText();for(const value of ['Station','Cafe','Host','Alice','Bob','plans changed','Closed:','value unavailable or withheld'])assert.ok(text.includes(value),value);
 assert.ok(!/Pending|winner|podium|Aura|Rizz|confetti|Run It Back|Share receipt|999/i.test(text),text);
 console.log('PASS neutral closure',closure);await page.screenshot({path:`/tmp/app-feedback-integration/${closure}.png`,fullPage:true});
}
room.status='completed';room.journeyStatus='completed';room.actualEndTime='2026-10-29T12:00:00Z';await page.goto('http://localhost:18789');await page.waitForTimeout(1500);
await navigate('Result',{roomId:'qa-room'});await page.getByText('Scoreboard',{exact:true}).waitFor();assert.equal(await page.getByText('Submitted predictions',{exact:true}).count(),0);
console.log('PASS scored completed room retains deployed scoreboard');assert.deepEqual(errors,[]);console.log('PASS no browser errors');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
