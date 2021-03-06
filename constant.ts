import { ParseNode } from "./parsenode.ts";
import { Visitor } from "./visitor.ts";
import { Scanner, Token, TokenError } from "./deps.ts";
import { expectFullIdent } from "./util.ts";

/**
 * Represents a Constant, aka a Literal value.
 *
 * https://developers.google.com/protocol-buffers/docs/reference/proto3-spec#constant
 */
export class Constant extends ParseNode {
  /**
   * The value of the Constant, converted to a first class JS type.
   */
  public value: boolean | string | number | null;
  constructor(
    /**
     * What ProtoBuf type the value of the Constant is.
     */
    public literalType: "identifier" | "string" | "int" | "float" | "boolean",
    /**
     * A raw string containing the contents of the Constant value, including delimiters.
     */
    private raw: string,
    /**
     * The starting [line, column]
     */
    public start: [number, number] = [0, 0],
    /**
     * The ending [line, column]
     */
    public end: [number, number] = [0, 0],
  ) {
    super();
    this.value = this.raw;
    if (this.literalType === "int" || this.literalType === "float") {
      this.value = Number(this.value);
      if (!Number.isFinite(this.value) || Number.isNaN(this.value)) {
        this.value = null;
      }
    } else if (this.literalType === "string") {
      this.value = this.value.slice(1, -1);
    } else if (this.literalType === "boolean") {
      this.value = this.value === "true";
    }
  }

  toProto() {
    return this.raw;
  }

  toJSON() {
    return {
      type: "Constant",
      start: this.start,
      end: this.end,
      literalType: this.literalType,
      raw: this.raw,
      value: this.value,
    };
  }

  accept(visitor: Visitor) {
    visitor.visit?.(this);
    visitor.visitConstant?.(this);
  }

  static async parse(scanner: Scanner): Promise<Constant> {
    const token = await scanner.scan();
    const start = scanner.startPos;
    let value = scanner.contents;
    let type: "identifier" | "int" | "float" | "string" | "boolean" = "string";
    if (token === Token.string) {
      type = "string";
    } else if (
      token === Token.identifier && value === "false" || value === "true"
    ) {
      type = "boolean";
    } else if (token === Token.identifier) {
      type = "identifier";
      await expectFullIdent(scanner, false);
    } else if (token === Token.int) {
      type = "int";
    } else if (token === Token.float) {
      type = "float";
    } else if (token === Token.token && (value === "-" || value === "+")) {
      const sign = value;
      const token = await scanner.scan();
      if (token === Token.keyword && scanner.contents === "inf") {
        type = "int";
        value = `${sign}${scanner.contents}`;
      }
    } else if (
      token === Token.keyword && (value === "inf" || value === "nan")
    ) {
      type = "int";
    } else {
      throw new TokenError(scanner, token);
    }
    return new Constant(type, value, start, scanner.endPos);
  }
}
