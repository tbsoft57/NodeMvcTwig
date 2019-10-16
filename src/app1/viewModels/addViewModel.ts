export class addViewModel {
  a: number;
  b: number;
  get total(): number { return this.a + this.b; }
  constructor(body: any) {
    this.a = Number(body.a);
    this.b = Number(body.b);
  }
}
