import LocRange from "./common/LocRange";
import Position from "./common/Position";
import { EKeyword, ETokenType, TokenType } from "./common/types";

export class BaseToken<T> {
  readonly type: T;
  readonly lexeme: string;
  readonly location?: LocRange;

  // get sourceLoc() {
  //   return SourceMapSingleton.map(this.location);
  // }

  constructor(type: T, lexeme: string, start?: Position);
  constructor(type: T, lexeme: string, location?: LocRange);
  constructor(type: T, lexeme: string, arg?: LocRange | Position) {
    this.type = type;
    this.lexeme = lexeme;
    if (arg instanceof LocRange) {
      this.location = arg;
    } else if (arg instanceof Position) {
      const end = new Position(arg.index + lexeme.length, arg.line, arg.column + lexeme.length);
      this.location = new LocRange(arg, end);
    }
  }
}

export default class Token extends BaseToken<TokenType> {
  override toString() {
    return `<${ETokenType[this.type] ?? EKeyword[this.type]}, ${this.lexeme}>`;
  }
}

export const EOF = new Token(ETokenType.EOF, "/EOF");