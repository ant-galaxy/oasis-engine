import { AstNodeUtils } from "../AstNodeUtils";
import { DiagnosticSeverity } from "../Constants";
import RuntimeContext from "../RuntimeContext";
import {
  IAddOperatorAstContent,
  IAssignableValueAstContent,
  IBlendFactorAstContent,
  IBlendOperationAstContent,
  IBooleanAstContent,
  ICompareFunctionAstContent,
  IConditionExprAstContent,
  ICullModeAstContent,
  IDeclarationAstContent,
  IFnAddExprAstContent,
  IFnArgAstContent,
  IFnAssignLOAstContent,
  IFnAssignStatementAstContent,
  IFnAstContent,
  IFnAtomicExprAstContent,
  IFnBlockStatementAstContent,
  IFnBodyAstContent,
  IFnCallAstContent,
  IFnConditionStatementAstContent,
  IFnMacroConditionAstContent,
  IFnMacroConditionElifBranchAstContent,
  IFnMacroConditionElseBranchAstContent,
  IFnMacroDefineAstContent,
  IFnMacroIncludeAstContent,
  IFnMacroUndefineAstContent,
  IFnMultiplicationExprAstContent,
  IFnRelationExprAstContent,
  IFnReturnStatementAstContent,
  IFnReturnTypeAstContent,
  IFnVariableAstContent,
  IFnVariableDeclarationAstContent,
  IMultiplicationOperatorAstContent,
  INumberAstContent,
  IPassPropertyAssignmentAstContent,
  IPropertyAstContent,
  IPropertyItemAstContent,
  IRelationOperatorAstContent,
  IRenderStateDeclarationAstContent,
  IRenderStatePropertyItemAstContent,
  IStencilOperationAstContent,
  IStructAstContent,
  ITagAssignmentAstContent,
  ITagAstContent,
  ITupleNumber2,
  ITupleNumber3,
  ITupleNumber4,
  IVariableTypeAstContent
} from "./AstNodeContent";
import {
  Vector4,
  CompareFunction,
  StencilOperation,
  BlendOperation,
  BlendFactor,
  CullMode,
  RenderStateDataKey,
  Color
} from "@galacean/engine";
import { BlendStatePropertyTokens } from "../parser/tokens/render-state";
import { IShaderPassInfo } from "@galacean/engine-design";

export interface IPosition {
  line: number;
  offset: number;
}

export interface IPositionRange {
  start: IPosition;
  end: IPosition;
}

export interface IAstInfo<T = any> {
  position: IPositionRange;
  content: T;
}

export class AstNode<T = any> implements IAstInfo<T> {
  position: IPositionRange;
  content: T;

  /** @internal */
  _isAstNode = true;

  constructor(ast: IAstInfo<T>) {
    this.position = ast.position;
    this.content = ast.content;
  }

  /** @internal */
  _doSerialization(context?: RuntimeContext, args?: any): string {
    return this.content as string;
  }

  /** @internal */
  getContentValue(context?: RuntimeContext): any {
    if (typeof this.content === "string") return this.content.replace(/"(.*)"/, "$1");
    if (typeof this.content !== "object") return this.content;
    throw { message: "NOT IMPLEMENTED", astNode: this, ...this.position };
  }

  /** @internal */
  _beforeSerialization(context?: RuntimeContext, args?: any) {
    context?.setSerializingNode(this);
  }

  /** @internal */
  _afterSerialization(context?: RuntimeContext, args?: any) {
    context?.unsetSerializingNode();
  }

  serialize(context?: RuntimeContext, args?: any): string {
    this._beforeSerialization(context, args);
    const ret = this._doSerialization(context, args);
    this._afterSerialization(context);
    return ret;
  }

  private _jsonifyObject(obj: any, includePos: boolean, withClass = false) {
    if (typeof obj !== "object") return obj;
    const ret = {} as any;
    if (obj?._isAstNode) {
      return obj.toJson(includePos, withClass);
    }
    for (const k in obj) {
      let v = obj[k];
      if (v === null || v === undefined) continue;
      if (v._isAstNode) {
        v = v.toJson(includePos, withClass);
      } else if (Array.isArray(v)) {
        v = v.map((i) => this._jsonifyObject(i, includePos, withClass));
      } else if (typeof v === "object") {
        v = this._jsonifyObject(v, includePos, withClass);
      }
      ret[k] = v;
    }

    return ret;
  }

  toJson(includePos = false, withClass = false) {
    let res: any;
    if (Array.isArray(this.content)) {
      res = this.content.map((item) => this._jsonifyObject(item, includePos, withClass));
    } else if (typeof this.content === "object") {
      res = this._jsonifyObject(this.content, includePos, withClass);
    } else {
      res = this.content;
    }
    let ret: any = { content: res };
    if (includePos) {
      ret.position = this.position;
    }
    if (withClass) {
      ret.Class = this.constructor.name;
    }
    return ret;
  }
}

export class ReturnTypeAstNode extends AstNode<IFnReturnTypeAstContent> {
  override _doSerialization(context: RuntimeContext): string {
    return this.content.text;
  }
}

export class ObjectAstNode<T = any> extends AstNode<Record<string, AstNode<T>>> {
  override _doSerialization(context: RuntimeContext): string {
    const astList = Object.values(this.content)
      .sort(AstNodeUtils.astSortAsc)
      .filter((item) => item._isAstNode);

    return astList.map((ast) => ast.serialize(context)).join("\n");
  }
}

export class FnAstNode extends AstNode<IFnAstContent> {
  override _doSerialization(context: RuntimeContext): string {
    context.functionAstStack.push({ fnAst: this, localDeclaration: [] });

    let returnType: string;
    let args: string;
    let fnName: string;

    if (context.currentMainFnAst === this) {
      returnType = "void";
      args = "";
      fnName = "main";
    } else {
      returnType = this.content.returnType.serialize(context);
      args = this.content.args.map((arg) => arg.serialize(context)).join(", ");
      fnName = this.content.name;
    }
    const body = this.content.body.serialize(context);

    context.functionAstStack.pop();
    return `${returnType} ${fnName} (${args}) {\n${body}\n}`;
  }
}

export class FnBodyAstNode extends AstNode<IFnBodyAstContent> {
  override _doSerialization(context: RuntimeContext): string {
    const statements = [...(this.content.macros ?? []), ...(this.content.statements ?? [])].sort(
      (a, b) => a.position.start.line - b.position.start.line
    );
    return statements.map((s) => s.serialize(context)).join("\n");
  }
}

export class FnMacroDefineAstNode extends AstNode<IFnMacroDefineAstContent> {
  override _doSerialization(context?: RuntimeContext, args?: any): string {
    context.referenceGlobal(this.content.variable);
    return `#define ${this.content.variable} ${this.content.value.serialize(context) ?? ""}`;
  }
}

export class FnMacroUndefineAstNode extends AstNode<IFnMacroUndefineAstContent> {
  override _doSerialization(context?: RuntimeContext, args?: any): string {
    return `#undef ${this.content.variable}`;
  }
}

export class FnMacroIncludeAstNode extends AstNode<IFnMacroIncludeAstContent> {}

export class FnMacroConditionAstNode extends AstNode<IFnMacroConditionAstContent> {
  override _doSerialization(context: RuntimeContext): string {
    const body = this.content.body.serialize(context);
    const elifBranch = this.content.elifBranch?.serialize(context) ?? "";
    const elseBranch = this.content.elseBranch?.serialize(context) ?? "";
    return `${this.content.command} ${this.content.condition.serialize(context)}\n ${[body, elifBranch, elseBranch]
      .filter((item) => item)
      .join("\n")}\n#endif`;
  }
}

export class FnMacroConditionElifBranchAstNode extends AstNode<IFnMacroConditionElifBranchAstContent> {
  override _doSerialization(context?: RuntimeContext, args?: any): string {
    return `#elif ${this.content.condition.serialize(context)}\n  ${this.content.body.serialize(context)}`;
  }
}

export class FnMacroConditionElseBranchAstNode extends AstNode<IFnMacroConditionElseBranchAstContent> {
  override _doSerialization(context?: RuntimeContext, args?: any): string {
    return `#else\n  ${this.content.body.serialize(context)}`;
  }
}

export class DiscardStatementAstNode extends AstNode {
  override _doSerialization(context?: RuntimeContext, args?: any): string {
    return "discard;";
  }
}

export class FnCallAstNode extends AstNode<IFnCallAstContent> {
  override _doSerialization(context: RuntimeContext): string {
    if (this.content.isCustom) {
      if (!context.referenceGlobal(this.content.function)) {
        context.diagnostics.push({
          severity: DiagnosticSeverity.Warning,
          message: `Not found function definition: ${this.content.function}`,
          token: this.position
        });
      }
    }
    const args = this.content.args.map((item) => item.serialize(context)).join(", ");
    return `${this.content.function}(${args})`;
  }

  override getContentValue(context: RuntimeContext) {
    switch (this.content.function) {
      case "vec4":
        const args1 = this.content.args.map((item) => item.getContentValue());
        if (context.payload?.parsingRenderState) {
          return new Color(...args1);
        }
        return new Vector4(...args1);
      case "Color":
        const args2 = this.content.args.map((item) => item.getContentValue());
        return new Color(...args2);
      default:
        throw `Not supported builtin function ${this.content.function}`;
    }
  }
}

export class FnConditionStatementAstNode extends AstNode<IFnConditionStatementAstContent> {
  override _doSerialization(context?: RuntimeContext, args?: any): string {
    const elseIfBranches = this.content.elseIfBranches?.map((item) => "else " + item.serialize(context)) ?? "";
    const elseBranch = this.content.elseBranch ? "else " + this.content.elseBranch?.serialize(context) : "";
    const body = this.content.body.serialize(context);
    const relation = this.content.relation.serialize(context);
    return `if (${relation}) 
${body}
${elseIfBranches}
${elseBranch}`;
  }
}

export class FnBlockStatementAstNode extends AstNode<IFnBlockStatementAstContent> {
  override _doSerialization(context?: RuntimeContext, args?: any): string {
    return `{ 
  ${this.content.serialize(context)}
}`;
  }
}

export class RelationOperatorAstNode extends AstNode<IRelationOperatorAstContent> {
  override _doSerialization(context: RuntimeContext): string {
    return this.content;
  }
}

export class ConditionExprAstNode extends AstNode<IConditionExprAstContent> {
  override _doSerialization(context?: RuntimeContext, args?: any): string {
    let ret = this.content.leftExpr.serialize(context);
    if (this.content.operator) {
      ret += ` ${this.content.operator?.serialize(context)} ${this.content.rightExpr.serialize(context)}`;
    }
    return ret;
  }
}

export class RelationExprAstNode extends AstNode<IFnRelationExprAstContent> {
  override _doSerialization(context?: RuntimeContext, args?: any): string {
    let ret = this.content.leftOperand.serialize(context);
    if (this.content.operator) {
      ret += ` ${this.content.operator?.serialize(context)} ${this.content.rightOperand?.serialize(context)}`;
    }
    return ret;
  }
}

export class FnAssignStatementAstNode extends AstNode<IFnAssignStatementAstContent> {
  override _doSerialization(context: RuntimeContext): string {
    const { value } = this.content;
    const valueStr = value.serialize(context);
    return `${this.content.assignee.serialize(context)} ${this.content.operator} ${valueStr};`;
  }
}

export class AddOperatorAstNode extends AstNode<IAddOperatorAstContent> {
  override _doSerialization(context: RuntimeContext): string {
    return this.content;
  }
}

export class MultiplicationOperatorAstNode extends AstNode<IMultiplicationOperatorAstContent> {
  override _doSerialization(context: RuntimeContext): string {
    return this.content;
  }
}

export class AddExprAstNode extends AstNode<IFnAddExprAstContent> {
  override _doSerialization(context: RuntimeContext): string {
    const orderItemList = [...this.content.operands, ...this.content.operators].sort(AstNodeUtils.astSortAsc);
    return orderItemList.map((item) => item.serialize(context)).join(" ");
  }
}

export class MultiplicationExprAstNode extends AstNode<IFnMultiplicationExprAstContent> {
  override _doSerialization(context: RuntimeContext): string {
    const orderItemList = [...this.content.operands, ...this.content.operators].sort(AstNodeUtils.astSortAsc);
    return orderItemList.map((item) => item.serialize(context)).join(" ");
  }
}

export class FnAtomicExprAstNode extends AstNode<IFnAtomicExprAstContent> {
  override _doSerialization(context: RuntimeContext): string {
    const signStr = this.content.sign?.serialize(context) ?? "";
    return signStr + this.content.RuleFnAtomicExpr.serialize(context);
  }

  override getContentValue() {
    const expressionValue = this.content.RuleFnAtomicExpr.getContentValue();
    if (typeof expressionValue === "number") {
      return expressionValue * (this.content.sign?.content === "-" ? -1 : 1);
    }
    return expressionValue;
  }
}

export class NumberAstNode extends AstNode<INumberAstContent> {
  override _doSerialization(context: RuntimeContext): string {
    return this.content.text;
  }

  override getContentValue() {
    return this.content.value;
  }
}

export class BooleanAstNode extends AstNode<IBooleanAstContent> {
  override _doSerialization(context: RuntimeContext): string {
    return this.content.text;
  }

  override getContentValue() {
    return this.content.value;
  }
}

export class AssignLoAstNode extends AstNode<IFnAssignLOAstContent> {
  override _doSerialization(context: RuntimeContext): string {
    return this.content;
  }
}

export class FnVariableAstNode extends AstNode<IFnVariableAstContent> {
  override _doSerialization(context: RuntimeContext): string {
    const objName = this.content[0];
    const propName = this.content[1];
    if (propName) {
      if (objName === context.varyingStructInfo.objectName) {
        const ref = context.varyingStructInfo.reference.find((ref) => ref.property.content.variable === propName);
        ref && (ref.referenced = true);
        return this.content.slice(1).join(".");
      } else {
        const attribStruct = context.attributeStructListInfo.find((struct) => struct.objectName === objName);
        if (attribStruct) {
          const ref = attribStruct.reference.find((ref) => ref.property.content.variable === propName);
          ref && (ref.referenced = true);
          return this.content.slice(1).join(".");
        }
      }
    }

    if (!context.findLocal(objName)) {
      if (!context.referenceGlobal(objName)) {
        context.diagnostics.push({
          severity: DiagnosticSeverity.Error,
          message: `Not found variable definition: ${objName}`,
          token: this.position
        });
      }
    }

    return this.content.join(".");
  }
}

export class FnReturnStatementAstNode extends AstNode<IFnReturnStatementAstContent> {
  override _doSerialization(context: RuntimeContext): string {
    if (context.currentFunctionInfo.fnAst === context.currentMainFnAst) {
      return "";
    }
    return `return ${this.content.serialize(context)};`;
  }
}

export class FnArgAstNode extends AstNode<IFnArgAstContent> {
  override _doSerialization(context: RuntimeContext, args?: any): string {
    context.currentFunctionInfo.localDeclaration.push(
      new DeclarationAstNode({
        position: this.position,
        content: {
          variable: this.content.name,
          type: new VariableTypeAstNode({ position: this.position, content: this.content.type })
        }
      })
    );
    return `${this.content.type.text} ${this.content.name}`;
  }
}

export class RenderStateDeclarationAstNode extends AstNode<IRenderStateDeclarationAstContent> {
  override getContentValue(context?: RuntimeContext): {
    variable: string;
    properties: IShaderPassInfo["renderStates"];
    renderStateType: string;
  } {
    const properties: IShaderPassInfo["renderStates"] = [{}, {}];
    for (const prop of this.content.properties) {
      const propContent = prop.getContentValue(context);
      let _propertyKey = this.content.renderStateType + propContent.property;
      if (
        this.content.renderStateType === "BlendState" &&
        (!!BlendStatePropertyTokens[propContent.property] || propContent.property === "Enabled")
      ) {
        _propertyKey += propContent.index ?? "0";
      }
      const renderStateKey = RenderStateDataKey[_propertyKey];
      if (renderStateKey === undefined) {
        context?.diagnostics.push({
          severity: DiagnosticSeverity.Error,
          message: "invalid render state key",
          token: prop.position
        });
        return;
      }

      if (propContent.isVariable) {
        properties[1][renderStateKey] = propContent.value;
      } else {
        properties[0][renderStateKey] = propContent.value;
      }
    }

    return {
      renderStateType: this.content.renderStateType as any,
      properties,
      variable: this.content.variable
    };
  }
}

export class RenderStatePropertyItemAstNode extends AstNode<IRenderStatePropertyItemAstContent> {
  /** Where the value is a variable */
  isVariable: boolean;

  override getContentValue(context?: RuntimeContext) {
    const isVariable = this.isVariable;
    if (isVariable && context) {
      const global = context.findGlobal(this.content.value.content);
      if (!global) {
        context.diagnostics.push({
          severity: DiagnosticSeverity.Warning,
          message: "not found variable definition",
          token: this.content.value.position
        });
      }
    }
    return {
      property: this.content.property,
      index: this.content.index,
      value: this.content.value.getContentValue(context),
      isVariable
    };
  }
}

export class AssignableValueAstNode extends AstNode<IAssignableValueAstContent> {
  override _doSerialization(context: RuntimeContext): string {
    return this.content;
  }
}
export class VariableTypeAstNode extends AstNode<IVariableTypeAstContent> {
  override _doSerialization(context: RuntimeContext): string {
    return this.content.text;
  }
}

export class VariableDeclarationAstNode extends AstNode<IFnVariableDeclarationAstContent> {
  override _doSerialization(context: RuntimeContext, opts?: { global: boolean }): string {
    if (context.currentFunctionInfo) {
      context.currentFunctionInfo.localDeclaration.push(this);
    }
    const typeNode = this.content.type;
    if (typeNode.content.text === context.varyingTypeAstNode.content.text) {
      if (this.content.default) {
        context.diagnostics.push({
          severity: DiagnosticSeverity.Error,
          message: "should not assign values to varying objects",
          token: this.content.default.position
        });
      }
      context.varyingStructInfo.objectName = this.content.variable;

      return "";
    }
    if (typeNode.content.isCustom) {
      if (!context.referenceGlobal(typeNode.content.text)) {
        context.diagnostics.push({
          severity: DiagnosticSeverity.Error,
          message: `Undefined type ${typeNode.content.text}`,
          token: this.position
        });
      }
    }
    let ret = `${typeNode.content.text} ${this.content.variable}`;
    if (opts?.global) {
      ret = "uniform " + ret;
    }
    if (this.content.default) {
      ret += " = " + this.content.default.serialize(context);
    }
    return ret + ";";
  }
}

export class DeclarationAstNode extends AstNode<IDeclarationAstContent> {}

export class StructAstNode extends AstNode<IStructAstContent> {}

export class PassPropertyAssignmentAstNode extends AstNode<IPassPropertyAssignmentAstContent> {}

export class TagAssignmentAstNode extends AstNode<ITagAssignmentAstContent> {
  override _doSerialization(context: RuntimeContext): string {
    return `${this.content.tag} = ${this.content.value}`;
  }
}

export class TagAstNode extends AstNode<ITagAstContent> {
  override getContentValue(context?: RuntimeContext) {
    const ret = {} as IShaderPassInfo["tags"];
    for (const t of this.content) {
      ret[t.content.tag] = t.content.value.getContentValue();
    }
    return ret;
  }
}

export class PropertyItemAstNode extends AstNode<IPropertyItemAstContent> {}

export class PropertyAstNode extends AstNode<IPropertyAstContent> {}

export class TupleNumber4AstNode extends AstNode<ITupleNumber4> {}

export class TupleNumber3AstNode extends AstNode<ITupleNumber3> {}

export class TupleNumber2AstNode extends AstNode<ITupleNumber2> {}

export class RangeAstNode extends AstNode<ITupleNumber2> {}

export class CullModeAstNode extends AstNode<ICullModeAstContent> {
  override getContentValue() {
    const prop = this.content.split(".")[1];
    return CullMode[prop];
  }
}

export class BlendFactorAstNode extends AstNode<IBlendFactorAstContent> {
  override getContentValue() {
    const prop = this.content.split(".")[1];
    return BlendFactor[prop];
  }
}

export class BlendOperationAstNode extends AstNode<IBlendOperationAstContent> {
  override getContentValue() {
    const prop = this.content.split(".")[1];
    return BlendOperation[prop];
  }
}

export class StencilOperationAstNode extends AstNode<IStencilOperationAstContent> {
  override getContentValue() {
    const prop = this.content.split(".")[1];
    return StencilOperation[prop];
  }
}

export class CompareFunctionAstNode extends AstNode<ICompareFunctionAstContent> {
  override getContentValue() {
    const prop = this.content.split(".")[1];
    return CompareFunction[prop];
  }
}
