import {test} from 'node:test';
import assert from 'node:assert/strict';
import {upiPayee,upiPaymentUri} from '../src/lib/upi';
test('amount QR preserves supplied payee and converts integer paise exactly',()=>{
 const uri=new URL(upiPaymentUri(24700));
 assert.equal(uri.protocol,'upi:');assert.equal(uri.host,'pay');
 assert.equal(uri.searchParams.get('pa'),upiPayee.address);assert.equal(uri.searchParams.get('pn'),'AFFROZE A');
 assert.equal(uri.searchParams.get('am'),'247.00');assert.equal(uri.searchParams.get('cu'),'INR');
 assert.equal(new URL(upiPaymentUri(1050)).searchParams.get('am'),'10.50');
 assert.notEqual(upiPaymentUri(100),upiPaymentUri(200));
 for(const invalid of [0,-1,1.5,NaN,Infinity])assert.throws(()=>upiPaymentUri(invalid));
});
