import {
  AstNode,
  PropertyItemAstNode,
  TagAstNode,
  PassPropertyAssignmentAstNode,
  StructAstNode,
  VariableDeclarationAstNode,
  FnAstNode,
  ReturnTypeAstNode,
  FnArgAstNode,
  AssignLoAstNode,
  FnVariableAstNode,
  AddOperatorAstNode,
  MultiplicationExprAstNode,
  MultiplicationOperatorAstNode,
  FnAtomicExprAstNode,
  ObjectAstNode,
  StatePropertyAssignAstNode,
  AssignableValueAstNode,
  VariableTypeAstNode,
  DeclarationAstNode,
  TagAssignmentAstNode
} from "./AstNode";

export interface IShaderAstContent {
  name: string;
  editorProperties?: AstNode<Array<PropertyItemAstNode>>;
  subShader: Array<AstNode<ISubShaderAstContent>>;
}

export interface IPropertyItemAstContent {
  name: string;
  desc: string;
  type: string;
  default: Record<string, any>;
}

export interface ISubShaderAstContent {
  tags?: TagAstNode;
  pass: Array<AstNode<IPassAstContent>>;
}

export interface IFunctionAstContent {
  returnType: AstNode;
  name: string;
  args: Array<AstNode>;
  body: AstNode;
}

export interface IPassAstContent {
  name: string;
  tags: TagAstNode;
  properties: Array<PassPropertyAssignmentAstNode>;
  structs: Array<StructAstNode>;
  variables: Array<VariableDeclarationAstNode>;
  functions: Array<FnAstNode>;
}

export interface ITypeAstContent {
  text: string;
  isCustom: boolean;
}

export interface IFnReturnTypeAstContent {
  text: string;
  isCustom: boolean;
}

export interface IFnAstContent {
  returnType: ReturnTypeAstNode;
  name: string;
  args: Array<FnArgAstNode>;
  body: AstNode;
}

export interface IFnBodyAstContent {
  statements: Array<AstNode>;
  macros: Array<AstNode>;
}

export interface IFnMacroDefineAstContent {
  variable: string;
  value?: AstNode;
}

export interface IFnMacroIncludeAstContent {
  name: string;
}

export interface IFnMacroConditionAstContent {
  command: string;
  identifier: string;
  body: AstNode<IFnBodyAstContent>;
  branch?: AstNode;
}

export interface IFnMacroConditionBranchAstContent {
  declare: string;
  body: AstNode<IFnBodyAstContent>;
}

export interface IFnCallAstContent {
  function: string;
  args: Array<AstNode>;
  isCustom: boolean;
}

export interface IFnConditionStatementAstContent {
  relation: AstNode;
  body: AstNode<IFnBlockStatementAstContent>;
  elseBranch: AstNode<IFnBlockStatementAstContent>;
  elseIfBranches: Array<AstNode<IFnConditionStatementAstContent>>;
}

export interface IFnRelationExprAstContent {
  operands: Array<AstNode>;
  operator: AstNode<IRelationOperatorAstContent>;
}

export type IFnBlockStatementAstContent = AstNode<IFnBodyAstContent>;

export interface IRelationOperatorAstContent {
  text: string;
}

export interface IFnAssignStatementAstContent {
  assignee: AssignLoAstNode | FnVariableAstNode;
  value: AstNode;
  operator: string;
}

export type IFnExpressionAstContent = AstNode<IFnAddExprAstContent>;

export type IFnAddExprAstContent = {
  operators: Array<AddOperatorAstNode>;
  operands: Array<MultiplicationExprAstNode>;
};

export interface IFnMultiplicationExprAstContent {
  operators: Array<MultiplicationOperatorAstNode>;
  operands: Array<FnAtomicExprAstNode>;
}

export type IMultiplicationOperatorAstContent = string;

export type IAddOperatorAstContent = string;

export interface IFnAtomicExprAstContent {
  sign?: AddOperatorAstNode;
  RuleFnAtomicExpr: AstNode;
}

export type INumberAstContent = string;
export type IBooleanAstContent = string;
export type IFnAssignLOAstContent = string;

export type IFnVariableAstContent = Array<string>;
export type IFnReturnStatementAstContent = ObjectAstNode;

export interface IFnArgAstContent {
  name: string;
  type: {
    isCustom: boolean;
    text: string;
  };
}

export interface IRenderStateDeclarationAstContent {
  name: string;
  type: string;
  properties: Array<StatePropertyAssignAstNode>;
}

export interface IStatePropertyAssignAstContent {
  name: string;
  value: AssignableValueAstNode;
}

export type IAssignableValueAstContent = string;

export interface IVariableTypeAstContent {
  text: string;
  isCustom: boolean;
}

export interface IFnVariableDeclarationAstContent {
  type: VariableTypeAstNode;
  variable: string;
  default?: AstNode;
}

export interface IDeclarationAstContent {
  type: VariableTypeAstNode;
  variable: string;
}

export interface IStructAstContent {
  name: string;
  variables: Array<DeclarationAstNode>;
}

export interface IPassPropertyAssignmentAstContent {
  type: string;
  value: string;
}

export interface ITagAssignmentAstContent {
  tag: string;
  value: string;
}

export type ITagAstContent = Array<TagAssignmentAstNode>;

export type IPropertyAstContent = Array<PropertyItemAstNode>;

export type ITupleNumber4 = [number, number, number, number];
export type ITupleNumber3 = [number, number, number];
export type ITupleNumber2 = [number, number];
