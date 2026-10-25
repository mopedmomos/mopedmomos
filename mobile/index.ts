import {registerRootComponent} from 'expo';
// Each build has one fixed role and a distinct native application ID.
if(process.env.EXPO_PUBLIC_APP_VARIANT==='kitchen'){
 registerRootComponent(require('./KitchenApp').default);
}else if(process.env.EXPO_PUBLIC_APP_VARIANT==='wrapper'){
 registerRootComponent(require('./WrapperApp').default);
}else{
 registerRootComponent(require('./App').default);
}
