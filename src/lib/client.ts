export class ApiError extends Error {constructor(message:string,public status:number){super(message);}}
export async function api<T>(path:string,method='GET',body?:unknown,token?:string):Promise<T> {
 const response=await fetch('/api/'+path,{method,cache:'no-store',credentials:'same-origin',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{'X-Kitchen-Token':token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)});
 const result=await response.json();if(!response.ok){if(response.status===401&&path.startsWith('admin/'))window.location.assign('/login');throw new ApiError(result.error??'Something went wrong. Try again.',response.status);}return result.data;
}
