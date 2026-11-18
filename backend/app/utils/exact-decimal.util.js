// Rational arithmetic: no intermediate rounding, including package ceilings.
const gcd = (a, b) => { while (b) [a,b]=[b,a%b]; return a<0n?-a:a; };
class ExactDecimal {
  constructor(numerator, denominator=1n) {
    if (!denominator) throw new RangeError('Không thể chia cho 0');
    if (denominator<0n) { numerator=-numerator;denominator=-denominator; }
    const divisor=gcd(numerator,denominator);this.n=numerator/divisor;this.d=denominator/divisor;
  }
  static from(value) {
    if(value instanceof ExactDecimal)return value;
    if(typeof value==='number'&&Number.isFinite(value)&&String(value).includes('e')){
      const [coefficient,exponent]=String(value).split('e'),base=ExactDecimal.from(coefficient),power=Number(exponent);
      return power>=0?new ExactDecimal(base.n*10n**BigInt(power),base.d):new ExactDecimal(base.n,base.d*10n**BigInt(-power));
    }
    const text=String(value);
    if(!/^-?\d+(?:\.\d+)?$/.test(text)||text.length>100)throw new RangeError('Số thập phân không hợp lệ');
    const [whole,fraction='']=text.split('.');return new ExactDecimal(BigInt(whole+fraction),10n**BigInt(fraction.length));
  }
  add(value){const other=ExactDecimal.from(value);return new ExactDecimal(this.n*other.d+other.n*this.d,this.d*other.d);}
  subtract(value){const other=ExactDecimal.from(value);return new ExactDecimal(this.n*other.d-other.n*this.d,this.d*other.d);}
  multiply(value){const other=ExactDecimal.from(value);return new ExactDecimal(this.n*other.n,this.d*other.d);}
  divide(value){const other=ExactDecimal.from(value);return new ExactDecimal(this.n*other.d,this.d*other.n);}
  compare(value){const other=ExactDecimal.from(value),difference=this.n*other.d-other.n*this.d;return difference<0n?-1:difference>0n?1:0;}
  ceil(){return this.n>=0n?(this.n+this.d-1n)/this.d:this.n/this.d;}
  format(places=12){
    const sign=this.n<0n?'-':'',absolute=this.n<0n?-this.n:this.n,scale=10n**BigInt(places);
    const scaled=(absolute*scale+this.d/2n)/this.d;
    if(absolute>0n&&scaled===0n)return `${sign}<0.${'0'.repeat(places-1)}1`;
    const fraction=(scaled%scale).toString().padStart(places,'0').replace(/0+$/,'');
    return sign+(scaled/scale).toString()+(fraction?'.'+fraction:'');
  }
  exact(){return {numerator:this.n.toString(),denominator:this.d.toString()};}
}
module.exports=ExactDecimal;
