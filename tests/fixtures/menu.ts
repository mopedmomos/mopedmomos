import type { MenuOption } from '../../src/lib/domain';
const option=(id:string,name:string,variant:string,portion:string,pieces:number|null,price:number,category:string,sort:number,image:string):MenuOption=>({id,productId:name.toLowerCase().replaceAll(' ','-'),name,variant,portion,pieces,price:price*100,category,sort,available:true,image});
export const seedMenu:MenuOption[]=[
 option('chicken-steam-6','Chicken Momos','Steamed','Full plate',6,69,'Momos',1,'steam'),
 option('chicken-fried-6','Chicken Momos','Fried','Full plate',6,79,'Momos',2,'fried'),
 option('chicken-peri-6','Chicken Momos','Peri Peri','Full plate',6,89,'Momos',3,'peri'),
 option('chicken-kurkure-3','Chicken Momos','Kurkure','Half plate',3,49,'Momos',4,'kurkure'),
 option('chicken-kurkure-6','Chicken Momos','Kurkure','Full plate',6,99,'Momos',5,'kurkure'),
 option('chicken-kurkure-peri-3','Chicken Momos','Kurkure + Peri Peri','Half plate',3,59,'Momos',6,'kurkure-peri'),
 option('chicken-kurkure-peri-6','Chicken Momos','Kurkure + Peri Peri','Full plate',6,109,'Momos',7,'kurkure-peri'),
 option('potato-twister','Potato Twister','Classic','Regular',null,49,'Sides',8,'twister'),
 option('french-fries','French Fries','Classic','Regular',null,49,'Sides',9,'fries'),
 option('blue-mojito','Blue Lagoon Mojito','Chilled','Regular',null,40,'Drinks',10,'blue'),
 option('lime-mojito','Lime Mojito','Chilled','Regular',null,40,'Drinks',11,'lime'),
 option('vanilla-mojito','Vanilla Mojito','Chilled','Regular',null,40,'Drinks',12,'vanilla'),
 option('special-mojito','Special Mojito','Chilled','Regular',null,50,'Drinks',13,'special'),
 option('potato-twister-peri','Potato Twister','Peri Peri (+₹10)','Regular',null,59,'Sides',14,'twister-peri'),
 option('french-fries-peri','French Fries','Peri Peri (+₹10)','Regular',null,59,'Sides',15,'fries-peri')
];
