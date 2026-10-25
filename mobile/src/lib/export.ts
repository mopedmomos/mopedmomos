import {File,Paths} from 'expo-file-system';
import * as Sharing from 'expo-sharing';
export async function shareCsv(name:string,contents:string){const file=new File(Paths.cache,name);file.write(contents);if(!await Sharing.isAvailableAsync())throw new Error('File sharing is not available on this device.');await Sharing.shareAsync(file.uri,{mimeType:'text/csv',dialogTitle:'Export sales report',UTI:'public.comma-separated-values-text'});}
