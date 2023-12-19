import { Entity, Engine, Loader, Scene } from "@galacean/engine-core";
import type { IEntity, IPrefabEntity, IPrefabFile, IRefEntity, IStrippedEntity } from "../schema";
import { ReflectionParser } from "./ReflectionParser";
import { ParserContext } from "./ParserContext";
import { PrefabParserContext } from "../prefab/PrefabParserContext";

/** @Internal */
export default abstract class HierarchyParser<T extends Scene | Entity, V extends ParserContext<IPrefabFile, T>> {
  /**
   * The promise of parsed object.
   */
  readonly promise: Promise<T>;

  protected _resolve: (item: T) => void;
  protected _reject: (reason: any) => void;
  protected _engine: Engine;
  protected _reflectionParser: ReflectionParser;

  private prefabContextMap = new WeakMap<Entity, ParserContext<IPrefabFile, Entity>>();

  private prefabPromiseMap = new Map<
    string,
    {
      resolve: (context: PrefabParserContext) => void;
      reject: (reason: any) => void;
    }
  >();

  constructor(public readonly context: V) {
    this._engine = this.context.engine;
    this._organizeEntities = this._organizeEntities.bind(this);
    this._parseComponents = this._parseComponents.bind(this);
    this._parsePrefabModification = this._parsePrefabModification.bind(this);
    this._parsePrefabRemovedComponents = this._parsePrefabRemovedComponents.bind(this);
    this._clearAndResolve = this._clearAndResolve.bind(this);
    this.promise = new Promise<T>((resolve, reject) => {
      this._reject = reject;
      this._resolve = resolve;
    });
    this._reflectionParser = new ReflectionParser(context);
  }

  /** start parse the scene or prefab or others */
  public start() {
    this._parseEntities()
      .then(this._organizeEntities)
      .then(this._parseComponents)
      .then(this._parsePrefabModification)
      .then(this._parsePrefabRemovedComponents)
      .then(this._clearAndResolve)
      .then(this._resolve)
      .catch(this._reject);
  }

  protected abstract handleRootEntity(id: string): void;

  private _parseEntities(): Promise<Entity[]> {
    const entitiesConfig = this.context.originalData.entities;
    const entityConfigMap = this.context.entityConfigMap;
    const entitiesMap = this.context.entityMap;
    const engine = this._engine;
    const promises = entitiesConfig.map((entityConfig) => {
      entityConfigMap.set(entityConfig.id, entityConfig);

      return this._getEntityByConfig(entityConfig, engine);
    });

    return Promise.all(promises).then((entities) => {
      for (let i = 0, l = entities.length; i < l; i++) {
        entitiesMap.set(entitiesConfig[i].id, entities[i]);
      }

      return entities;
    });
  }

  private _parseComponents(): Promise<any[]> {
    const entitiesConfig = this.context.originalData.entities;
    const entityMap = this.context.entityMap;
    const components = this.context.components;

    const promises = [];
    for (let i = 0, l = entitiesConfig.length; i < l; i++) {
      const entityConfig = entitiesConfig[i];
      const entity = entityMap.get(entityConfig.id);
      for (let i = 0; i < entityConfig.components.length; i++) {
        const componentConfig = entityConfig.components[i];
        const key = !componentConfig.refId ? componentConfig.class : componentConfig.refId;
        let component;
        // TODO: remove hack code when support additional edit
        if (key === "Animator") {
          component = entity.getComponent(Loader.getClass(key));
        }
        component = component || entity.addComponent(Loader.getClass(key));
        components.set(componentConfig.id, component);
        const promise = this._reflectionParser.parsePropsAndMethods(component, componentConfig);
        promises.push(promise);
      }
    }
    return Promise.all(promises);
  }

  private _parsePrefabModification() {
    const entitiesConfig = this.context.originalData.entities;
    const entityMap = this.context.entityMap;

    const promises = [];
    for (let i = 0, l = entitiesConfig.length; i < l; i++) {
      const entityConfig = entitiesConfig[i];
      const { id, modifications } = entityConfig as IPrefabEntity;

      if (modifications?.length) {
        const rootEntity = entityMap.get(id);
        promises.push(
          ...modifications.map((modification) => {
            const { target, props, methods } = modification;
            const { entityId, componentId } = target;
            const context = this.prefabContextMap.get(rootEntity);
            const targetEntity = context.entityMap.get(entityId);
            const targetComponent = context.components.get(componentId);
            if (targetComponent) {
              return this._reflectionParser.parsePropsAndMethods(targetComponent, {
                props,
                methods
              });
            } else if (targetEntity) {
              return Promise.resolve(this._applyEntityData(targetEntity, props));
            }
          })
        );
      }
    }

    return Promise.all(promises);
  }

  private _parsePrefabRemovedComponents() {
    const entitiesConfig = this.context.originalData.entities;
    const entityMap = this.context.entityMap;

    const promises = [];
    for (let i = 0, l = entitiesConfig.length; i < l; i++) {
      const entityConfig = entitiesConfig[i];
      const { id, removedComponents } = entityConfig as IPrefabEntity;

      if (removedComponents?.length) {
        const rootEntity = entityMap.get(id);
        promises.concat(
          ...removedComponents.map((target) => {
            const { componentId } = target;
            const context = this.prefabContextMap.get(rootEntity);
            const targetComponent = context.components.get(componentId);
            if (targetComponent) {
              targetComponent.destroy();
            }
          })
        );
      }
    }

    return Promise.all(promises);
  }

  private _clearAndResolve() {
    const { target } = this.context;
    return target;
  }

  private _organizeEntities(): void {
    const { rootIds, strippedIds } = this.context;
    const parentIds = rootIds.concat(strippedIds);
    for (const parentId of parentIds) {
      this._parseChildren(parentId);
    }
    for (let i = 0; i < rootIds.length; i++) {
      this.handleRootEntity(rootIds[i]);
    }
  }

  private _getEntityByConfig(entityConfig: IEntity, engine: Engine): Promise<Entity> {
    let entityPromise: Promise<Entity>;
    if ((<IPrefabEntity>entityConfig).prefabSource) {
      entityPromise = this._parsePrefab(<IPrefabEntity>entityConfig, engine);
    } else if ((<IRefEntity>entityConfig).assetRefId) {
      entityPromise = this._parseGLTF(<IRefEntity>entityConfig, engine);
    } else if ((<IStrippedEntity>entityConfig).strippedId || (<IStrippedEntity>entityConfig).strippedPath) {
      entityPromise = this._parseStrippedEntity(<IStrippedEntity>entityConfig);
    } else {
      entityPromise = this._parseEntity(entityConfig, engine);
    }
    return entityPromise.then((entity) => {
      return this._applyEntityData(entity, entityConfig);
    });
  }

  private _parseEntity(entityConfig: IEntity, engine: Engine): Promise<Entity> {
    const entity = new Entity(engine, entityConfig.name);
    if (!entityConfig.parent) this.context.rootIds.push(entityConfig.id);

    return Promise.resolve(entity);
  }

  private _parseGLTF(entityConfig: IRefEntity, engine: Engine): Promise<Entity> {
    const assetRefId: string = entityConfig.assetRefId;
    const context = new ParserContext<IPrefabFile, Entity>(null, engine);

    return (
      engine.resourceManager
        // @ts-ignore
        .getResourceByRef<Entity>({
          refId: assetRefId,
          key: entityConfig.key,
          isClone: entityConfig.isClone
        })
        .then((entity) => {
          if (!entityConfig.parent) this.context.rootIds.push(entityConfig.id);

          this._traverseAddEntityToMap(entity, context, "");

          this.prefabContextMap.set(entity, context);
          this.prefabPromiseMap.get(entityConfig.id)?.resolve(context);
          return entity;
        })
    );
  }

  private _parsePrefab(entityConfig: IPrefabEntity, engine: Engine): Promise<Entity> {
    const assetRefId: string = entityConfig.prefabSource?.assetId;
    const context = new ParserContext<IPrefabFile, Entity>(null, engine);

    return (
      engine.resourceManager
        // @ts-ignore
        .getResourceByRef<Entity>({
          refId: assetRefId
        })
        .then((entity: Entity) => {
          if (!entityConfig.parent) this.context.rootIds.push(entityConfig.id);

          this._traverseAddEntityToMap(entity, context, "");

          this.prefabContextMap.set(entity, context);
          this.prefabPromiseMap.get(entityConfig.id)?.resolve(context);
          return entity;
        })
    );
  }

  private _parseStrippedEntity(entityConfig: IStrippedEntity): Promise<Entity> {
    this.context.strippedIds.push(entityConfig.id);

    return new Promise<PrefabParserContext>((resolve, reject) => {
      this.prefabPromiseMap.set((<IStrippedEntity>entityConfig).prefabInstanceId, { resolve, reject });
    }).then((context) => {
      const { strippedId, strippedPath } = entityConfig;

      if (strippedId) return context.entityMap.get(strippedId);
      else if (strippedPath) return context.entityMap.get(strippedPath);
    });
  }

  private _parseChildren(parentId: string) {
    const { entityConfigMap, entityMap } = this.context;
    const children = entityConfigMap.get(parentId).children;
    if (children && children.length > 0) {
      const parent = entityMap.get(parentId);
      for (let i = 0; i < children.length; i++) {
        const childId = children[i];
        const entity = entityMap.get(childId);
        parent.addChild(entity);
        this._parseChildren(childId);
      }
    }
  }

  private _applyEntityData(entity: Entity, entityConfig: IEntity): Entity {
    entity.isActive = entityConfig.isActive ?? entity.isActive;
    entity.name = entityConfig.name ?? entity.name;
    const { position, rotation, scale } = entityConfig;
    if (position) entity.transform.position.copyFrom(position);
    if (rotation) entity.transform.rotation.copyFrom(rotation);
    if (scale) entity.transform.scale.copyFrom(scale);
    return entity;
  }

  private _traverseAddEntityToMap(entity: Entity, context: ParserContext<IPrefabFile, Entity>, path: string) {
    const { entityMap, components } = context;
    entityMap.set(path, entity);
    // @ts-ignore
    entity._components.forEach((component) => {
      // @ts-ignore
      const name = Loader.getClassName(component.constructor);
      components.set(`${path}:${name}`, component);
    });
    for (let i = 0; i < entity.children.length; i++) {
      const child = entity.children[i];
      const childPath = path ? `${path}/${child.name}` : child.name;

      this._traverseAddEntityToMap(child, context, childPath);
    }
  }
}