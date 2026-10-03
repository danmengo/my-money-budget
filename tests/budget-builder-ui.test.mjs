import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { loadTS } from './load-ts.mjs';
const require=createRequire(import.meta.url);
// Exercise the actual component and event handlers with a deterministic hook
// harness. This tests the review/save flow, not browser layout or focus behavior.
function harness(overrides={}) {
 const state=[];let cursor=0;const saves=[];
 const dependencies={
  react:{useState(initial){const index=cursor++;if(!(index in state))state[index]=typeof initial==='function'?initial():initial;return [state[index],value=>{state[index]=typeof value==='function'?value(state[index]):value;}];}},
  'react/jsx-runtime':require('react/jsx-runtime'),
  '@/components/ui/button':{Button:'button'},'@/components/ui/input':{Input:'input'},
  '@/components/ui/dialog':Object.fromEntries(['Dialog','DialogContent','DialogHeader','DialogTitle','DialogDescription'].map(name=>[name,name])),
  '@/lib/budget-builder':loadTS('lib/budget-builder.ts'),
 };
 const {outputText}=ts.transpileModule(readFileSync(new URL('../app/budget-builder.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}});
 const exports={};new Function('require','exports',outputText)(name=>{assert.ok(name in dependencies,name);return dependencies[name];},exports);
 const props={month:'2026-10',currentMonth:'2026-10',income:300000,saving:0,budgets:[{category:'Food',base:50000,amount:50000,carry:0,spent:0,remaining:50000,rollover:'none',recorded:false},{category:'Entertainment',base:30000,amount:30000,carry:0,spent:0,remaining:30000,rollover:'none',recorded:false}],recurring:[],transactions:[],busy:false,onClose(){},async onApply(payload){saves.push(payload);return true;},...overrides};
 function render(){cursor=0;return exports.default(props);}
 function all(node,result=[]){if(node&&typeof node==='object'){result.push(node);for(const child of [node.props?.children].flat(Infinity))all(child,result);}return result;}
 const text=node=>node==null||typeof node==='boolean'?'':typeof node!=='object'?String(node):[node.props?.children].flat(Infinity).map(text).join('');
 const button=label=>all(render()).find(n=>n.type==='button'&&text(n)===label);
 const input=predicate=>all(render()).find(n=>n.type==='input'&&predicate(n.props));
 return {render,all,text,button,input,saves,props};
}
test('builder previews replacements and saves integer cents only after review acknowledgement',async()=>{
 const h=harness();assert.equal(h.saves.length,0);
 h.button('Build my starting plan').props.onClick();
 assert.match(h.text(h.render()),/Left to assign/);
 h.input(p=>p['aria-label']==='Food budget dollars').props.onChange({target:{value:'1499.99'}});
 h.button('Review changes').props.onClick();
 assert.match(h.text(h.render()),/Current base → New base/);assert.equal(h.button('Apply budget').props.disabled,true);assert.equal(h.saves.length,0);
 h.input(p=>p.type==='checkbox').props.onChange({target:{checked:true}});
 assert.equal(h.button('Apply budget').props.disabled,false);await h.button('Apply budget').props.onClick();
 assert.deepEqual(h.saves,[{action:'budgetBuilder',month:'2026-10',income:300000,saving:60000,rows:[{category:'Food',amount:149999},{category:'Entertainment',amount:90000}]}]);
 assert.match(h.text(h.render()),/Your budget is ready/);
});
test('invalid amounts block review and a save failure keeps the draft visible for retry',async()=>{
 const h=harness({onApply:async()=>false});h.button('Build my starting plan').props.onClick();
 const amount=h.input(p=>p['aria-label']==='Food budget dollars');amount.props.onChange({target:{value:'-1'}});
 assert.equal(h.button('Review changes').props.disabled,true);
 amount.props.onChange({target:{value:'123.45'}});h.button('Review changes').props.onClick();h.input(p=>p.type==='checkbox').props.onChange({target:{checked:true}});
 await h.button('Apply budget').props.onClick();assert.match(h.text(h.render()),/Your draft is still here/);assert.match(h.text(h.render()),/123.45/);
});
test('cancel does not write and empty categories give actionable guidance',()=>{
 let closed=false;const h=harness({budgets:[],onClose(){closed=true;}});
 h.button('Build my starting plan').props.onClick();assert.match(h.text(h.render()),/Add a budget category/);
 h.render().props.onOpenChange(false);assert.equal(closed,true);assert.equal(h.saves.length,0);
});
test('funding warnings and busy state are visible without changing actual financial data',()=>{
 const h=harness({income:0});h.button('Build my starting plan').props.onClick();
 h.input(p=>p['aria-label']==='Food budget dollars').props.onChange({target:{value:'500'}});
 assert.match(h.text(h.render()),/500.00 over your income/);
 h.button('Review changes').props.onClick();assert.match(h.text(h.render()),/funding warnings/);
 h.input(p=>p.type==='checkbox').props.onChange({target:{checked:true}});h.props.busy=true;
 assert.equal(h.button('Applying…').props.disabled,true);assert.equal(h.button('Back').props.disabled,true);assert.equal(h.saves.length,0);
});
