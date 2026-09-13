import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const context = vm.createContext({
  Date, Map, Set, AbortController, setTimeout, clearTimeout,
  fetch: async path => ({ ok: true, text: () => readFile(new URL(path, root), 'utf8') }),
});
for (const file of ['csv.js', 'camp-data.js']) vm.runInContext(await readFile(new URL(file, root), 'utf8'), context);
const data = await vm.runInContext('CampData.load()', context);
const dates = data.byDate;
const matches = (day, age = 5, multi = false) => (dates.get(day) || []).filter(s =>
  Number(s.provider.Minimum_Age) <= age && (multi || s.Booking_Type === 'single-day'));
const has = (day, id, age = 5, multi = false) => matches(day, age, multi).some(s => s.Provider_ID === id);

assert.equal(data.providers.length, 18);
assert.equal(data.sessions.length, 177);
assert.equal(data.sessions.filter(s => s.Booking_Type === 'single-day').length, 155);
assert.equal(data.sessions.filter(s => s.Booking_Type === 'multi-day').length, 22);
assert.equal(data.providers.filter(p => p.Status === 'dated').length, 10);
assert.equal(new Set(data.sessions.map(s => [s.Provider_ID,s.Start_Date,s.End_Date,s.Program].join('|'))).size, data.sessions.length);
for (const session of data.sessions) {
  assert.ok(session.Start_Date >= '2026-09-01' && session.End_Date <= '2027-05-31', 'session stays within school-year scope');
  assert.equal(session.provider.County, 'Durham');
  assert.ok(!/CIT|Kids.? Night Out/.test(session.Program), 'no teen or evening programs');
  for (const field of ['Registration_URL','Source_URL']) assert.equal(new URL(session[field]).protocol, 'https:');
}
assert.equal(matches('2026-09-21').length, 7, 'seven published age-five single-day options on September 21');
assert.equal(matches('2026-09-21',6).length, 8, 'six-year-olds add Ninja');
assert.ok(!has('2026-09-21','jcc'), 'no inference of JCC care on Yom Kippur');
assert.ok(has('2026-09-30','jcc'));
assert.ok(!has('2027-03-01','jcc'), 'preschool-only JCC date excluded');
assert.ok(has('2026-09-28','museum',5,true), 'museum booking portal start date preferred');
assert.ok(!has('2026-09-30','museum'), 'museum week cannot be booked as a single day');
assert.ok(has('2026-09-30','museum',5,true));
assert.ok(!has('2026-09-28','ninja',6,true), 'conflicting Ninja session omitted');
assert.ok(!has('2026-09-29','ninja',6,true));
assert.ok(has('2026-11-11','boulder'), 'fresh Boulder registration list used');
assert.ok(!has('2026-09-07','boulder'), 'stale Boulder listing not carried forward');
assert.ok(has('2026-12-18','schoolhouse'));
assert.ok(!has('2026-12-19','schoolhouse'), 'no weekend extrapolation');
assert.ok(!has('2027-03-15','soccer'), 'no stale soccer spring date');
assert.ok(data.sessions.filter(s=>s.Provider_ID==='soccer').every(s=>s.Cost==='$70 per day'));
assert.match(data.sessions.find(s=>s.Provider_ID==='pwc' && s.Start_Date==='2026-09-21').Availability,/Waitlist/);
assert.match(data.sessions.find(s=>s.Provider_ID==='museum' && s.Start_Date==='2026-10-05').Availability,/Waitlist/);
assert.match(data.sessions.find(s=>s.Provider_ID==='jcc' && s.Start_Date==='2026-11-25').Notes,/no aftercare/);
assert.equal(data.sessions.find(s=>s.Provider_ID==='dac' && s.Start_Date==='2027-04-28').Registration_Opens,'2026-12-04');
for (const p of data.providers.filter(p=>p.Status!=='dated')) assert.ok(!data.sessions.some(s=>s.Provider_ID===p.Provider_ID), 'undated/restricted leads have no date matches');

const schools = vm.runInContext('parseCSV',context)(await readFile(new URL('triangle_school_closures_2026_2027.csv',root),'utf8'));
assert.equal(schools.length,137);
const workdays=schools.filter(s=>s.School.startsWith('Durham Public') && /Workday/.test(s.Closure_Type));
assert.equal(workdays.length,11);
assert.ok(workdays.every(s=>matches(s.Date).length>0),'each DPS workday has a published age-five option');
assert.throws(()=>vm.runInContext('CampData.date("2027-02-29")',context));
assert.throws(()=>vm.runInContext('parseCSV("Date,School,Closure_Type\\n2026-09-21,\\\"unclosed")',context));
const parsed=vm.runInContext('parseCSV("\\uFEFFID,Note\\r\\n1,\\\"a comma, and \\\"\\\"quote\\\"\\\"\\\"\\r\\n",["ID"])',context);
assert.equal(parsed[0].Note,'a comma, and "quote"');
console.log(`PASS: ${data.providers.length} providers, ${data.sessions.length} sessions, eligibility/date boundaries, source links, waitlists, multi-day rules and all ${workdays.length} DPS workdays.`);
