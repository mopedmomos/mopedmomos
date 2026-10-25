import * as SecureStore from 'expo-secure-store';
export const readSecret=(key:string)=>SecureStore.getItemAsync(key);
export const writeSecret=(key:string,value:string)=>SecureStore.setItemAsync(key,value,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});
export const deleteSecret=(key:string)=>SecureStore.deleteItemAsync(key);
