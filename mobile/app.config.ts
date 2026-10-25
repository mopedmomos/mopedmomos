import type {ConfigContext,ExpoConfig} from 'expo/config';
export default ({config}:ConfigContext):ExpoConfig=>{
 const role=process.env.APP_VARIANT??process.env.EXPO_PUBLIC_APP_VARIANT??'orders';
 if(!['orders','kitchen','wrapper'].includes(role))throw new Error('Choose orders, kitchen or wrapper.');
 if((process.env.EXPO_PUBLIC_APP_VARIANT??'orders')!==role)throw new Error('Native identity and app entry role must match.');
 const kitchen=role==='kitchen',wrapper=role==='wrapper',id=wrapper?'in.mopedmomos.orders.wrapper':`in.mopedmomos.${role}`;
 const plugins:NonNullable<ExpoConfig['plugins']>=[...(config.plugins??[]),'expo-web-browser',...(!kitchen&&!wrapper?[["expo-image-picker",{photosPermission:'Choose photos for your menu items.',cameraPermission:false,microphonePermission:false}] as [string,Record<string,unknown>]]:[])];
 return {...config,name:kitchen?'Moped Kitchen':wrapper?'Moped Orders Web':'Moped Orders',slug:'moped-momos-counter',version:'3.0.0',scheme:wrapper?'mopedmomos-wrapper':`mopedmomos-${role}`,plugins,ios:{...config.ios,bundleIdentifier:id,supportsTablet:true,infoPlist:{...config.ios?.infoPlist,ITSAppUsesNonExemptEncryption:false}},android:{...config.android,package:id},extra:{...config.extra,appRole:role,description:kitchen?'View-only kitchen without login':wrapper?'Secure iOS Orders web wrapper':'Google owner Orders app'}} as ExpoConfig;
};
