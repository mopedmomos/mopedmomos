// Decoded from the owner's supplied QR. Never derive a payee from order/user input.
export const upiPayee={address:'9741092977@kotakbank',name:'AFFROZE A'} as const;
/** UPI amounts use rupees; all application totals use integer paise. */
export function upiPaymentUri(paise:number){
 if(!Number.isSafeInteger(paise)||paise<=0)throw new Error('A positive order amount is required for the payment QR.');
 return 'upi://pay?pa='+encodeURIComponent(upiPayee.address)+'&pn='+encodeURIComponent(upiPayee.name)+'&am='+(paise/100).toFixed(2)+'&cu=INR&tn='+encodeURIComponent('Moped Momos order');
}
