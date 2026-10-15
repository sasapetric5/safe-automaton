import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function source(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

test('all existing HTML inline scripts parse without syntax errors', async () => {
  for (const file of ['index.html', 'opportunities.html', 'workbench.html', 'execution-lab.html', 'grants-diagnostic.html']) {
    const html = await source(file);
    const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]).filter(script => script.trim());
    assert.ok(scripts.length > 0, `${file} should contain inline JavaScript`);
    scripts.forEach((script, index) => {
      assert.doesNotThrow(() => new vm.Script(script, { filename: `${file} inline script ${index + 1}` }));
    });
  }
});

test('Opportunity Hunter keeps the known public-source integrations and deduplication', async () => {
  const html = await source('opportunities.html');
  for (const marker of [
    'https://remotive.com/api/remote-jobs',
    'https://www.arbeitnow.com/api/job-board-api',
    'api.tech.ec.europa.eu/search-api',
    "fetchJson('/api/grants'",
    'function addResults',
    'function normalizeUrl',
    'safe-automaton-opportunity-hunter-v1'
  ]) assert.ok(html.includes(marker), `Opportunity Hunter is missing expected marker: ${marker}`);
});

test('Opportunity Hunter explicitly forbids unapproved external actions and paid spend', async () => {
  const html = await source('opportunities.html');
  assert.match(html, /Ovlašćena potrošnja je 0 EUR/);
  assert.match(html, /Nema automatskih prijava/);
  assert.match(html, /lokalni Safe Automaton storage/);
  assert.match(html, /nema izmišljenih rezultata/i);
});

test('Task Workbench requires human approval and does not send offers itself', async () => {
  const html = await source('workbench.html');
  assert.match(html, /Potvrđujem — odobri za ručno slanje/);
  assert.match(html, /ne šalje ponude/);
  assert.match(html, /localStorage/);
  assert.match(html, /Nema automatskog prihvatanja ugovora/);
});

test('Execution Lab labels templates and QA as local/manual, not verified AI execution', async () => {
  const html = await source('execution-lab.html');
  assert.match(html, /AI generisanje je opciono i podrazumevano isključeno/i);
  assert.match(html, /Ove kućice nisu automatski dokazi/);
  assert.match(html, /ne pokreće proizvoljan kod/);
  assert.match(html, /safe-automaton-execution-lab-v1/);
});

test('Grants.gov endpoint validates method/input and does not log request body or secrets', async () => {
  const code = await source('functions/api/grants.js');
  assert.match(code, /method !== "POST"/);
  assert.match(code, /request\.json\(\)/);
  assert.match(code, /Math\.min\(50, Math\.max\(1, input\.rows\)\)/);
  assert.match(code, /Never log request bodies, API tokens/);
  assert.match(code, /"Cache-Control": "no-store"/);
  assert.match(code, /upstream_unexpected_payload/);
});


test('Opportunity Hunter scoring prioritizes title matches and does not reward incidental body mentions', async () => {
  const html = await source('opportunities.html');
  const start = html.indexOf('function scoreText(');
  const end = html.indexOf('\nfunction canonical(', start);
  assert.ok(start >= 0 && end > start, 'scoreText function should be present');
  const functionSource = html.slice(start, end) + '\nglobalThis.scoreText = scoreText;';
  const context = {
    document: { createElement: () => ({ _html: '', set innerHTML(v) { this._html = v.replace(/<[^>]*>/g, ' '); }, get value() { return this._html; } }) },
    terms: () => ['ai', 'automation', 'web application'],
    plainText: value => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
  };
  vm.createContext(context);
  vm.runInContext(functionSource, context);
  const relevant = context.scoreText('Role involves building web applications', true, 'jobKeywords', 'Senior Web Application Developer');
  const incidental = context.scoreText('AI automation mentioned once in a generic company description', true, 'jobKeywords', 'Enterprise Account Executive');
  assert.ok(relevant.score > incidental.score, 'title-relevant job should outrank incidental keyword matches');
  assert.ok(relevant.hits.includes('web application'));
});

test('Opportunity Hunter geography distinguishes Europe, Americas, global and US federal grants', async () => {
  const html = await source('opportunities.html');
  const start = html.indexOf('function geoAssessment(');
  const end = html.indexOf('\nfunction saveOpportunity(', start);
  assert.ok(start >= 0 && end > start, 'geoAssessment function should be present');
  const functionSource = html.slice(start, end) + '\nglobalThis.geoAssessment = geoAssessment;';
  const context = {};
  vm.createContext(context);
  vm.runInContext(functionSource, context);
  assert.match(context.geoAssessment({kind:'job', source:'Remotive (javni API)', location:'Europe, USA, Canada, APAC'}).scope, /Više regiona/);
  assert.match(context.geoAssessment({kind:'job', source:'Remotive (javni API)', location:'Worldwide'}).scope, /Globalni/);
  assert.match(context.geoAssessment({kind:'job', source:'Arbeitnow (javni API)', location:'Remote Deutschland'}).scope, /Evropa/);
  assert.match(context.geoAssessment({kind:'grant', source:'Grants.gov (zvanični javni API)', location:'Sjedinjene Američke Države'}).scope, /SAD — federalni poziv/);
});

test('notification UI does not claim server push is already connected', async () => {
  const html = await source('index.html');
  const worker = await source('sw.js');
  assert.match(html, /server za udaljeni push još nije povezan/);
  assert.match(html, /udaljeni push još zahteva serversko povezivanje/);
  assert.match(worker, /addEventListener\(["']push["']/);
  assert.match(worker, /addEventListener\(["']notificationclick["']/);
});



test('Opportunity Hunter scoring prioritizes title relevance and keyword boundaries', async () => {
 const html=await source('opportunities.html');
 const start=html.indexOf('function scoreText('),end=html.indexOf('\nfunction canonical(',start);
 assert.ok(start>=0&&end>start);
 const context={terms:()=>['ai','automation','web application','seo','market research'],plainText:value=>String(value??'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim()};
 vm.createContext(context);
 vm.runInContext(html.slice(start,end)+'\nglobalThis.scoreText=scoreText;',context);
 const relevant=context.scoreText('Generic description',true,'jobKeywords','Senior React Full-stack Developer');
 const incidental=context.scoreText('Paid invoices; automation mentioned incidentally',true,'jobKeywords','Enterprise Account Executive');
 assert.ok(relevant.score>incidental.score);
 assert.ok(relevant.hits.includes('web application'));
 assert.ok(!incidental.hits.includes('ai'));
});
test('Opportunity Hunter keeps country restrictions and does not equate Remote with worldwide', async () => {
 const html=await source('opportunities.html');
 const start=html.indexOf('function geoAssessment('),end=html.indexOf('\nfunction saveOpportunity(',start);
 assert.ok(start>=0&&end>start);
 const context={};vm.createContext(context);
 vm.runInContext(html.slice(start,end)+'\nglobalThis.geoAssessment=geoAssessment;',context);
 assert.match(context.geoAssessment({kind:'job',source:'Arbeitnow',location:'Remote Deutschland'}).scope,/Germany|zemlje/);
 assert.match(context.geoAssessment({kind:'job',source:'Arbeitnow',location:'United Kingdom (Remote)'}).scope,/United Kingdom|zemlje/);
 assert.match(context.geoAssessment({kind:'job',source:'Arbeitnow',location:'Remote'}).scope,/dozvoljene zemlje nisu navedene/);
});

test('EU Funding & Tenders request uses JSON multipart parts and normalized keyword phrases', async () => {
 const html=await source('opportunities.html');
 assert.ok(html.includes('const searchText=q.split(/[,;]+/)'));
 assert.match(html,/form\.append\('query',new Blob\(\[JSON\.stringify\(/);
 assert.match(html,/form\.append\('languages',new Blob\(\[JSON\.stringify\(\['en'\]\)/);
 assert.match(html,/form\.append\('displayLanguage','en'\)/);
 assert.match(html,/setStatus\('euGrantStatus'/);
 assert.match(html,/setStatus\('usGrantStatus'/);
 assert.match(html,/id="euGrantStatus"/);
 assert.match(html,/id="usGrantStatus"/);
});
test('EU grant keywords score independently instead of becoming one space-separated phrase', async () => {
 const html=await source('opportunities.html');
 const start=html.indexOf('function scoreText('),end=html.indexOf('\nfunction canonical(',start);
 assert.ok(start>=0&&end>start);
 const context={
  terms:id=>id==='grantKeywords'?['artificial intelligence','automation','digital']:['ai','automation','web application','seo','market research'],
  plainText:value=>String(value??'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/\\s+/g,' ').trim()
 };
 vm.createContext(context);
 vm.runInContext(html.slice(start,end)+'\nglobalThis.scoreText=scoreText;',context);
 const scored=context.scoreText('Artificial Intelligence and Cybersecurity Education Innovation',false,'grantKeywords','Artificial Intelligence and Cybersecurity Education Innovation');
 assert.ok(scored.score>0);
 assert.ok(scored.hits.includes('artificial intelligence'));
});

test('grant scoring treats AI and artificial intelligence as equivalent and ranks relevant titles above incidental mentions', async () => {
 const html=await source('opportunities.html');
 const start=html.indexOf('function scoreText('),end=html.indexOf('\nfunction canonical(',start);
 assert.ok(start>=0&&end>start);
 const context={terms:id=>id==='grantKeywords'?['artificial intelligence','automation','digital']:['ai','automation','web application','seo','market research'],plainText:value=>String(value??'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/\\s+/g,' ').trim()};
 vm.createContext(context);
 vm.runInContext(html.slice(start,end)+'\nglobalThis.scoreText=scoreText;',context);
 const aiTitle=context.scoreText('AI for advanced and collective perception and decision making',false,'grantKeywords','AI for advanced and collective perception and decision making');
 const aiLongForm=context.scoreText('Artificial intelligence and cybersecurity education innovation',false,'grantKeywords','Artificial Intelligence and Cybersecurity Education Innovation');
 const irrelevant=context.scoreText('Generic administrative notice',false,'grantKeywords','Generic administrative notice');
 assert.ok(aiTitle.score>0,'AI acronym should match the artificial intelligence query');
 assert.ok(aiLongForm.score>irrelevant.score);
 assert.ok(aiTitle.hits.includes('artificial intelligence'));
});
test('expired grant deadlines are visibly classified as historical and sort behind non-expired opportunities', async () => {
 const html=await source('opportunities.html');
 const start=html.indexOf('function opportunityStatus('),end=html.indexOf('\nfunction deadlineState(',start);
 assert.ok(start>=0&&end>start);
 const context={Date};
 vm.createContext(context);
 vm.runInContext(html.slice(start,end)+'\nglobalThis.opportunityStatus=opportunityStatus;',context);
 const now=Date.parse('2026-10-11T12:00:00Z');
 assert.match(context.opportunityStatus({deadline:'2026-03-20'},now).label,/ROK ISTEKAO/);
 assert.equal(context.opportunityStatus({deadline:'2026-11-18'},now).expired,false);
 const sameDay=context.opportunityStatus({deadline:'2026-10-11'},Date.parse('2026-10-11T12:00:00Z'));
 assert.equal(sameDay.expired,false,'a date-only deadline remains open through the end of that date');
 assert.equal(context.opportunityStatus({deadline:''},now).expired,false);
});



test('grant scoring ranks specific AI and automation titles above broad digital and body-only mentions', async () => {
 const html=await source('opportunities.html');
 const start=html.indexOf('function scoreText('),end=html.indexOf('\nfunction canonical(',start);
 assert.ok(start>=0&&end>start);
 const context={terms:id=>id==='grantKeywords'?['artificial intelligence','automation','digital']:['ai','automation','web application','seo','market research'],plainText:value=>String(value??'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim()};
 vm.createContext(context);
 vm.runInContext(html.slice(start,end)+'\nglobalThis.scoreText=scoreText;',context);
 const specific=context.scoreText('AI automation research programme',false,'grantKeywords','AI automation research programme');
 const broad=context.scoreText('Digital transformation programme',false,'grantKeywords','Digital Transformation Programme');
 const incidental=context.scoreText('Artificial intelligence mentioned in a general notice',false,'grantKeywords','General Administrative Notice');
 assert.ok(specific.score>broad.score);
 assert.ok(broad.score>incidental.score);
});
test('Grants.gov excludes zero-relevance records and reports the filtered count', async () => {
 const html=await source('opportunities.html');
 assert.match(html,/const usable=mapped\.filter\(x=>x\.url&&x\.score>0\)/);
 assert.match(html,/Izostavljeno zbog niskog poklapanja sa ključnim rečima/);
});

test('expired opportunities are hidden by default while unknown deadlines remain visible and history is opt-in', async () => {
 const html=await source('opportunities.html');
 const start=html.indexOf('function opportunityStatus('),end=html.indexOf('\nfunction deadlineState(',start);
 assert.ok(start>=0&&end>start);
 const context={Date};vm.createContext(context);
 vm.runInContext(html.slice(start,end)+'\nglobalThis.visibleOpportunities=visibleOpportunities;',context);
 const now=Date.parse('2026-10-11T12:00:00Z');
 const items=[{id:'old',deadline:'2026-03-20'},{id:'active',deadline:'2026-11-18'},{id:'unknown',deadline:''}];
 assert.deepEqual(Array.from(context.visibleOpportunities(items,false,now),x=>x.id),['active','unknown']);
 assert.equal(context.visibleOpportunities(items,true,now).length,3);
 assert.match(html,/id="showExpired" type="checkbox"/);
 assert.match(html,/list=visibleOpportunities\(list,\$\('showExpired'\)\.checked\)/);
});


test('forecasted grants are clearly marked as not confirmed open, and grant numbers do not influence relevance', async () => {
 const html=await source('opportunities.html');
 const start=html.indexOf('function opportunityStatus('),end=html.indexOf('\nfunction deadlineState(',start);
 assert.ok(start>=0&&end>start);
 const context={Date};vm.createContext(context);
 vm.runInContext(html.slice(start,end)+'\nglobalThis.opportunityStatus=opportunityStatus;',context);
 assert.match(context.opportunityStatus({sourceStatus:'forecasted',deadline:''}).label,/nije potvrđeno da je otvoren/i);
 assert.match(html,/scoreText\(\[title,agencyName,sourceSummary\]\.join\(' '\)/);
 assert.match(html,/sourceStatus:String\(get\('status','statusLabel','callStatus'\)\|\|''\)/);
});



test('Task Workbench blocks scoring until capability, deadline, and mandatory requirements pass preflight', async () => {
 const html=await source('workbench.html');
 for (const id of ['capabilityGate','deadlineGate','requirementsGate']) assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/function preflight\(\)/);
 assert.match(html,/checks\.includes\('unknown'\)/);
 assert.match(html,/checks\.includes\('no'\)/);
 assert.match(html,/a\.score<70/);
 assert.match(html,/if\(!a\.preflight\.ok\)/);
 assert.match(html,/['"]capabilityGate['"],['"]deadlineGate['"],['"]requirementsGate['"]/);
});

test('Task Workbench requires preflight and a minimum score before creating an offer draft', async () => {
 const html=await source('workbench.html');
 const start=html.indexOf('function draftText()');
 const end=html.indexOf('\nfunction saveDraft()',start);
 assert.ok(start>=0&&end>start);
 const draft=html.slice(start,end);
 assert.match(draft,/!a\.preflight\.ok/);
 assert.match(draft,/a\.score===null\|\|a\.score<70/);
 assert.match(draft,/a\.net<=0/);
 assert.match(html,/Ovlašćena potrošnja: 0 EUR/);
 assert.match(html,/slanje je ručno van ove aplikacije/);
});


test('Task Workbench does not treat language or country alone as automatic rejection criteria', async () => {
 const html=await source('workbench.html');
 assert.match(html,/Jezik i zemlja sami po sebi nisu eliminacioni uslovi/i);
 assert.match(html,/stvarna ograničenja naručioca ili zakona/i);
 assert.doesNotMatch(html, /id="(?:languageGate|geographyGate)"/);
});

test('Opportunity Hunter labels job capability as unverified and distinguishes procurement/research calls from general funding', async () => {
 const html=await source('opportunities.html');
 assert.match(html,/function classifyOpportunity\(item\)/);
 assert.match(html,/IZVODLJIVOST NIJE PROVERENA/);
 assert.match(html,/NABAVKA \/ STUDIJA — nije nužno grant/);
 assert.match(html,/ISTRAŽIVAČKI \/ INSTITUCIONALNI POZIV/);
 assert.match(html,/Poklapanje ključnih reči, ne procena stvarne sposobnosti/);
 const start=html.indexOf('function classifyOpportunity('),end=html.indexOf('\nfunction canonical(',start);
 assert.ok(start>=0&&end>start);
 const context={plainText:value=>String(value??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()};
 vm.createContext(context);
 vm.runInContext(html.slice(start,end)+'\nglobalThis.classifyOpportunity=classifyOpportunity;',context);
 assert.match(context.classifyOpportunity({kind:'job',title:'AI automation engineer',summary:'Build web tools'}).label,/IZVODLJIVOST NIJE PROVERENA/);
 assert.match(context.classifyOpportunity({kind:'grant',title:'Study on the adoption of automation technologies'}).label,/NABAVKA \/ STUDIJA/);
 assert.match(context.classifyOpportunity({kind:'grant',title:'Precision Medicine with AI Clinical Trial'}).label,/ISTRAŽIVAČKI \/ INSTITUCIONALNI POZIV/);
 assert.match(context.classifyOpportunity({kind:'grant',title:'Digital innovation support for small companies'}).label,/MOGUĆE FINANSIRANJE/);
});


test('saved opportunities preserve kind, source status and machine-readable deadline', async () => {
  const html = await source('opportunities.html');
  assert.match(html, /kind:item\.kind\|\|'research',sourceStatus:item\.sourceStatus\|\|'',deadline:item\.deadline\|\|''/);
});

test('Task Workbench blocks expired and forecasted non-job opportunities before scoring, task creation or offers', async () => {
  const html = await source('workbench.html');
  assert.match(html, /function opportunityGate\(item=currentOpportunity\)/);
  assert.match(html, /item\.kind!==\'job\'&&\/forecasted\|forecast\|anticipated\|planned\//);
  assert.match(html, /item\.kind!==\'job\'&&item\.deadline/);
  assert.match(html, /function preflight\(\)\{const sourceGate=opportunityGate\(\);if\(!sourceGate\.ok\)/);
  assert.match(html, /function addTaskFromAssessment\(\)\{if\(!currentOpportunity\).*?const sourceGate=opportunityGate\(\);if\(!sourceGate\.ok\)/);
  assert.match(html, /function draftText\(\)[\s\S]*?const sourceGate=opportunityGate\(\);if\(!sourceGate\.ok\)/);
  assert.match(html, /function saveDraft\(\)\{if\(!currentOpportunity\).*?const sourceGate=opportunityGate\(\);if\(!sourceGate\.ok\)/);
  assert.match(html, /function approveOffer\(\)\{const sourceGate=opportunityGate\(\);if\(!sourceGate\.ok\)/);
});


test('portable marketing skill packs preserve zero-cost, evidence and no-external-action constraints', async () => {
  const readme = await source('skills/README.md');
  const seo = await source('skills/seo-audit/SKILL.md');
  const copy = await source('skills/copywriting/SKILL.md');
  const research = await source('skills/customer-research/SKILL.md');
  const license = await source('skills/LICENSE-MARKETING-SKILLS');
  for (const skill of [seo, copy, research]) {
    assert.match(skill, /Zero-cost and safety constraints/);
    assert.match(skill, /Do not|Never/);
  }
  assert.match(readme, /not yet wired into the current static UI/);
  assert.match(readme, /0 EUR/);
  assert.match(license, /MIT License/);
});

test('SEO Evidence Audit report ranks actionable findings and keeps evidence scope explicit', async () => {
  const html = await source('execution-lab.html');
  assert.match(html, /function formatSeoAudit\(data,title='SEO provera'\)/);
  assert.match(html, /const actionable=findings\.filter\(f=>f\.status==='FAIL'\|\|f\.status==='WARN'\)/);
  assert.match(html, /## Prioritetni sledeći koraci/);
  assert.match(html, /## Nalazi zasnovani na preuzetom HTML-u/);
  assert.match(html, /## Ograničenja/);
  assert.match(html, /Nije poslato klijentu/);
  assert.match(html, /artifact=formatSeoAudit\(data,\$\('title'\)\.value\.trim\(\)\|\|'SEO provera'\)/);
  const start=html.indexOf('function formatSeoAudit('),end=html.indexOf("\n$('audit').addEventListener",start);
  assert.ok(start>=0&&end>start);
  const context={};
  vm.createContext(context);
  vm.runInContext(html.slice(start,end)+'\nglobalThis.formatSeoAudit=formatSeoAudit;',context);
  const result=context.formatSeoAudit({
    checkedAt:'2026-10-11T10:00:00.000Z',requestedUrl:'https://savremenikoreni.com/',finalUrl:'https://savremenikoreni.com/',
    httpStatus:200,contentType:'text/html',htmlCharacters:2000,
    auditScope:{evidenceSource:'initial_html',javascriptExecuted:false,renderedDomChecked:false},
    summary:{pass:1,warn:1,fail:1,notChecked:1,highPriority:1,mediumPriority:1,reviewPriority:1},
    findings:[
      {status:'PASS',priority:'INFO',label:'HTTP',evidence:'HTTP 200',recommendation:'Pregledaj sadržaj.'},
      {status:'WARN',priority:'MEDIUM',label:'Meta opis',evidence:'Nedostaje',recommendation:'Dodaj relevantan opis.'},
      {status:'FAIL',priority:'HIGH',label:'Robots',evidence:'noindex',recommendation:'Potvrdi da li je nameran.'}
    ],
    limitations:['JavaScript nije izvršen.']
  });
  assert.ok(result.indexOf('Robots')<result.indexOf('Meta opis'),'high-priority findings should appear first');
  assert.match(result,/## Prioritetni sledeći koraci/);
  assert.match(result,/## Plan popravki i provera uspeha/);
  assert.match(result,/Proveri da je opis jedinstven/);
  assert.match(result,/Napomena za Savremeni Koreni/);
  assert.match(result,/JavaScript nije izvršen/);
  assert.match(result,/Nije poslato klijentu/);
});

test('SEO audit endpoint enforces method, origin and strict host allowlist without fetching blocked targets', async () => {
  const api = await source('functions/api/seo-audit.js');
  const context = { URL, Response, AbortSignal, TextDecoder, Uint8Array, Date, fetch: () => { throw new Error('fetch must not run for blocked requests'); } };
  vm.createContext(context);
  vm.runInContext(api.replace('export async function onRequest', 'async function onRequest') + '\nglobalThis.onRequest=onRequest;', context);
  const handler = context.onRequest;
  const get = await handler({request:new Request('https://safe-automaton.pages.dev/api/seo-audit',{method:'GET'} )});
  assert.equal(get.status,405);
  const foreignOrigin = await handler({request:new Request('https://safe-automaton.pages.dev/api/seo-audit',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:JSON.stringify({url:'https://savremenikoreni.com/'})})});
  assert.equal(foreignOrigin.status,403);
  const blockedHost = await handler({request:new Request('https://safe-automaton.pages.dev/api/seo-audit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:'https://127.0.0.1/admin'})})});
  assert.equal(blockedHost.status,400);
});

test('SEO audit endpoint returns evidence scope and findings for allowed HTML without claiming browser rendering', async () => {
  const api = await source('functions/api/seo-audit.js');
  const html = '<!doctype html><html lang="sr"><head><title>Test naslov stranice koji je dovoljno opisni</title><meta name="description" content="Opis stranice za testiranje sadržaja i metapodataka"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="canonical" href="https://savremenikoreni.com/"></head><body><h1>Test naslov</h1><img src="/photo.jpg" alt="Opis fotografije"><a href="/kontakt">Kontakt</a></body></html>';
  const context = { URL, Response, AbortSignal, TextDecoder, Uint8Array, Date, fetch: async (url, options) => new Response(html,{status:200,headers:{'Content-Type':'text/html; charset=utf-8'}}) };
  vm.createContext(context);
  vm.runInContext(api.replace('export async function onRequest', 'async function onRequest') + '\nglobalThis.onRequest=onRequest;', context);
  const response = await context.onRequest({request:new Request('https://safe-automaton.pages.dev/api/seo-audit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:'https://savremenikoreni.com/'})})});
  assert.equal(response.status,200);
  const data = await response.json();
  assert.equal(data.ok,true);
  assert.equal(data.auditScope.javascriptExecuted,false);
  assert.equal(data.auditScope.renderedDomChecked,false);
  assert.ok(data.findings.some(f=>f.id==='title'));
  assert.ok(data.findings.some(f=>f.id==='images'));
  assert.ok(data.limitations.some(s=>s.includes('JavaScript-renderovani sadržaj')));
});

test('Execution Lab selects a task-specific skill procedure and QA checklist without claiming autonomous execution', async () => {
  const html = await source('execution-lab.html');
  assert.match(html, /const procedures=\{/);
  for (const key of ['seo','research','qa','scope']) assert.match(html,new RegExp('^\\s*'+key+':\\{name:', 'm'));
  assert.match(html,/function renderProcedure\(\)/);
  assert.match(html,/Otvori instrukcije/);
  assert.match(html,/Ovo je lokalna kontrolna lista; ne pokreće AI model/);
  assert.match(html,/renderProcedure\(\);qa\(\)/);
  const start=html.indexOf('const procedures={'),end=html.indexOf('\nfunction qa()',start);
  assert.ok(start>=0&&end>start);
  const context={esc:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))};
  const elements={
    taskType:{value:'seo'},
    skillInfo:{innerHTML:''},
    qaChecks:{innerHTML:''},
    qaStatus:{innerHTML:''}
  };
  context.$=id=>elements[id];
  context.getChecks=()=>[];
  context.qa=()=>{};
  vm.createContext(context);
  vm.runInContext(html.slice(start,end)+'\nglobalThis.procedures=procedures;globalThis.renderProcedure=renderProcedure;',context);
  for (const key of ['seo','research','qa','scope']) {
    elements.taskType.value=key;
    context.renderProcedure();
    assert.ok(elements.skillInfo.innerHTML.includes(context.procedures[key].name));
    assert.ok(elements.qaChecks.innerHTML.includes('checkbox'));
    assert.ok(elements.qaChecks.innerHTML.includes(context.procedures[key].checks[0][0]));
  }
});


test('Execution Lab collects real SEO audit evidence before either AI path and never reuses stale output as evidence', async () => {
  const html = await source('execution-lab.html');
  assert.match(html, /async function evidenceForAi\(taskType,source\)/);
  assert.match(html, /await evidenceForAi\(taskType,sourceUrl\)/);
  assert.doesNotMatch(html, /\$\('facts'\)\.value\.trim\(\)\|\|artifact/);
  const agentStart = html.indexOf("$('agentRun').addEventListener");
  const draftStart = html.indexOf("$('aiDraft').addEventListener");
  const auditStart = html.indexOf("$('audit').addEventListener");
  assert.ok(agentStart >= 0 && draftStart >= 0 && auditStart >= 0);
  assert.ok(html.indexOf('evidence=await evidenceForAi(taskType,sourceUrl)', draftStart) < html.indexOf("fetch('/api/ai-task'", draftStart));
  assert.ok(html.indexOf('evidence=await evidenceForAi(taskType,sourceUrl)', agentStart) < html.indexOf("fetch('/api/ai-pool'", agentStart));
  assert.match(html, /seoAuditEvidence=null;seoAuditSource='';\$\('audit'\)\.hidden/);
  assert.match(html, /\$\('source'\)\.addEventListener\('input',\(\)=>\{seoAuditEvidence=null;seoAuditSource='';\}\)/);

  const helperStart = html.indexOf('function formatSeoEvidenceForAgents(');
  const helperEnd = html.indexOf('\nfunction formatSeoAudit(', helperStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart);
  const fields = {
    taskType: { value: 'seo' },
    source: { value: 'https://savremenikoreni.com/' },
    facts: { value: '' },
    auditStatus: { textContent: '' }
  };
  let calls = 0;
  const audit = {
    ok: true, requestedUrl: 'https://savremenikoreni.com/', finalUrl: 'https://savremenikoreni.com/',
    checkedAt: '2026-10-15T12:00:00.000Z', httpStatus: 200, contentType: 'text/html',
    summary: { pass: 1, warn: 1, fail: 0, notChecked: 1 },
    auditScope: { note: 'Samo početni HTML.' },
    findings: [{ id: 'title', label: 'HTML title', status: 'PASS', evidence: 'Naslov pronađen', recommendation: 'Pregledaj relevantnost.' }],
    limitations: ['JavaScript nije izvršen.']
  };
  const context = {
    fetch: async (url, options) => {
      calls++;
      assert.equal(url, '/api/seo-audit');
      assert.equal(options.method, 'POST');
      assert.equal(JSON.parse(options.body).url, 'https://savremenikoreni.com/');
      return { ok: true, status: 200, json: async () => audit };
    },
    $: id => fields[id]
  };
  vm.createContext(context);
  vm.runInContext("var seoAuditEvidence=null; var seoAuditSource='';\n" + html.slice(helperStart, helperEnd) + '\nglobalThis.evidenceForAi=evidenceForAi;globalThis.resetAuditEvidence=()=>{seoAuditEvidence=null;seoAuditSource=""};', context);
  const evidence = await context.evidenceForAi('seo', 'https://savremenikoreni.com/');
  assert.equal(calls, 1);
  assert.match(evidence, /SEO AUDIT DOKAZI/);
  assert.match(evidence, /HTML title: Naslov pronađen/);
  assert.match(evidence, /HTTP status: 200/);
  assert.doesNotMatch(evidence, /neka prethodna AI analiza/);

  context.fetch = async () => ({ ok: false, status: 502, json: async () => ({ ok: false, error: 'SEO audit nije dostupan' }) });
  context.resetAuditEvidence();
  await assert.rejects(() => context.evidenceForAi('seo', 'https://savremenikoreni.com/'), /SEO audit nije dostupan/);
});
