// Preview/browser sessions stay in memory; never persist bearer credentials in localStorage.
const values=new Map<string,string>();
export const readSecret=async(key:string)=>values.get(key)??null;
export const writeSecret=async(key:string,value:string)=>{values.set(key,value);};
export const deleteSecret=async(key:string)=>{values.delete(key);};
