import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTS } from './load-ts.mjs';
const { enrichGoalData }=loadTS('lib/goal-tracking.ts');
const goals=[{id:1,name:'Reserve',type:'saving',target:100000,current:5000},{id:2,name:'IRA',type:'investing',target:200000,current:0}];
const tx=(id,amount,extra={})=>({id,date:'2026-09-01',type:'saving',amount,...extra});
const settings=[{key:'plan:goal-mode:1',value:'linked'},{key:'plan:tx-goal:1',value:'1'}];
test('automatic progress is derived once and recalculates after edit, delete, and unlink',()=>{
 const compute=(transactions,rows=settings)=>enrichGoalData(transactions,[],goals,rows,'2026-10-01').goals[0];
 assert.equal(compute([tx(1,3000)]).current,8000);
 assert.equal(compute([tx(1,3000)]).current,8000);
 assert.equal(compute([tx(1,1000)]).current,6000);
 assert.equal(compute([]).current,5000);
 assert.equal(compute([tx(1,3000)],[settings[0],{key:'plan:tx-goal:1',value:'0'}]).current,5000);
});
test('manual mode preserves current value and type/deleted goal mismatches do not count',()=>{
 const result=enrichGoalData([tx(1,3000),tx(2,7000),tx(3,9000)],[],goals,[{key:'plan:tx-goal:1',value:'1'},{key:'plan:tx-goal:2',value:'2'},{key:'plan:tx-goal:3',value:'999'}],'2026-10-01');
 assert.equal(result.goals[0].current,5000);assert.equal(result.goals[0].linked_total,3000);
 assert.equal(result.transactions[1].goal_id,null);assert.equal(result.transactions[2].goal_id,null);
});
test('recurring rules start at an effective month and explicit unlink takes precedence',()=>{
 const rows=[...settings,{key:'plan:recurring-goal:8:2026-10',value:'1'},{key:'plan:tx-goal:3',value:'0'}];
 const transactions=[tx(2,1000,{recurring_item_id:8}),tx(3,1000,{date:'2026-10-01',recurring_item_id:8}),tx(4,1000,{date:'2026-11-01',recurring_item_id:8})];
 const result=enrichGoalData(transactions,[],goals,rows,'2026-11-01');
 assert.deepEqual(result.transactions.map(x=>x.goal_id),[null,null,1]);assert.equal(result.goals[0].current,6000);
});
test('future-dated linked transactions do not increase today’s goal progress',()=>{
 assert.equal(enrichGoalData([tx(1,3000,{date:'2026-12-01'})],[],goals,settings,'2026-10-01').goals[0].current,5000);
});
