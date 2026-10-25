import type {PaymentMethod} from './domain';
export interface PaymentState {method:PaymentMethod;pending:boolean;qrVisible:boolean;}
export type PaymentAction={type:'select';method:PaymentMethod}|{type:'pending';value:boolean}|{type:'received'}|{type:'dismiss'}|{type:'keep-pending'}|{type:'reset'};
export const initialPayment:PaymentState={method:'cash',pending:true,qrVisible:false};
export function paymentReducer(state:PaymentState,action:PaymentAction):PaymentState {
 switch(action.type){case 'select':return {method:action.method,pending:state.method===action.method?state.pending:true,qrVisible:action.method==='upi'};
 case 'pending':return {...state,pending:action.value};case 'received':return {...state,pending:false,qrVisible:false};case 'dismiss':return {...state,qrVisible:false};case 'keep-pending':return {...state,pending:true,qrVisible:false};case 'reset':return {...initialPayment};}
}
export function paymentPayload(state:PaymentState){return {paymentMethod:state.method,paid:!state.pending};}
