export class addViewModel {
    a: number;
    b: number;
    get total() { return this.a + this.b; }
    constructor(a:number, b:number) {
        this.a = a;
        this.b = b;
    }
};
