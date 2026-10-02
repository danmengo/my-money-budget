import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTS } from './load-ts.mjs';
const { categoryBudgets, parseBudgetPlans, budgetPlanKey } = loadTS('lib/budget-planning.ts');
const budgets = [{ category: 'Travel', amount: 10000 }];
const tx = (date, amount) => ({ date, amount, type: 'expense', category: 'Travel', name: 'Travel' });
const plan = (month, rollover, amount = 10000, reset = false) => ({ month, rollover, amount, category: 'Travel', reset });

test('unused amounts accumulate and edits recalculate in cents', () => {
  const plans = [plan('2026-09', 'unused')];
  const transactions = [tx('2026-09-03', 3000), tx('2026-10-02', 5000)];
  assert.deepEqual(categoryBudgets('2026-11', budgets, transactions, plans)[0], {
    category: 'Travel', base: 10000, amount: 22000, carry: 12000, spent: 0, remaining: 22000, rollover: 'unused', recorded: true,
  });
  transactions.push(tx('2026-09-20', 2000));
  assert.equal(categoryBudgets('2026-11', budgets, transactions, plans)[0].amount, 20000);
});
test('overspending reduces subsequent allowance even below zero and recovers with future funding', () => {
  const plans = [plan('2026-12', 'overspending')];
  const transactions = [tx('2026-12-02', 35000)];
  assert.equal(categoryBudgets('2027-01', budgets, transactions, plans)[0].amount, -15000);
  assert.equal(categoryBudgets('2027-02', budgets, transactions, plans)[0].amount, -5000);
  assert.equal(categoryBudgets('2027-03', budgets, transactions, plans)[0].amount, 5000);
});
test('future limit changes preserve history; no-rollover and reset clear carry', () => {
  const plans = [plan('2026-09', 'unused'), plan('2026-11', 'none', 5000)];
  assert.equal(categoryBudgets('2026-10', budgets, [], plans)[0].amount, 20000);
  assert.equal(categoryBudgets('2026-11', budgets, [], plans)[0].amount, 5000);
  assert.equal(categoryBudgets('2026-08', budgets, [], plans)[0].recorded, false);
  assert.equal(categoryBudgets('2026-10', budgets, [], [...plans, plan('2026-10','none',0,true)])[0].amount, 0);
});
test('setting keys round-trip custom categories and ignore malicious or malformed settings', () => {
  const category = 'Car: repairs / trips';
  assert.equal(parseBudgetPlans([{key:budgetPlanKey(category,'2026-10'),value:JSON.stringify({amount:12345,rollover:'unused'})}])[0].category, category);
  assert.deepEqual(parseBudgetPlans([{key:budgetPlanKey(category,'2026-13'),value:'{}'}, {key:budgetPlanKey(category,'2026-10'),value:'{"amount":-1,"rollover":"unused"}'}]), []);
});
test('investing budgets count investing transactions without treating income as spending', () => {
  const result=categoryBudgets('2026-10',[{category:'Investing',amount:10000}],[{date:'2026-10-01',amount:8000,type:'investing',category:'investing',name:'Invest'},{date:'2026-10-01',amount:9000,type:'income',category:'income',name:'Pay'}],[]);
  assert.equal(result[0].spent,8000);
});
