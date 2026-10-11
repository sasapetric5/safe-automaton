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
  assert.match(html, /nije povezana sa AI modelom/);
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
