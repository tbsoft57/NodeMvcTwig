import 'reflect-metadata';

function logPropertyType(target : any, key : string) {
  var meta = Reflect.getMetadata("design:type", target, key);
  console.log(`key: ${key} type: ${meta.name}`);
}

function logMethodParamTypes(target : any, key : string) {
  var types = Reflect.getMetadata("design:paramtypes", target, key);
  var s = types.map(a => a.name).join();
  console.log(`${key} param types: ${s}`);
}

class Demo{
  @logPropertyType
  public attr1: string = 'Test';

  @logPropertyType
  public attr2: number = 5;

  @logPropertyType
  public attr3: boolean = true;

  @logPropertyType
  public attr4: object = { test: ''};

  @logPropertyType
  public attr5() { console.log('function') };

  @logPropertyType
  @logMethodParamTypes
  doSomething(
    param6  : string,
    param7  : number,
    param8  : boolean,
    param9  : object,
    param10 : Function
  ) { }
}

const d1 = new Demo();
