import { Entity, Engine, Loader } from "@galacean/engine-core";
import type { IEntity, IPrefabFile } from "../schema";
import { PrefabParserContext } from "./PrefabParserContext";
import { ReflectionParser } from "./ReflectionParser";

export class PrefabParser {
  /**
   * The promise of parsed prefab.
   */
  readonly promise: Promise<Entity>;
  private _engine: Engine;
  private _resolve: (prefab: Entity) => void;
  private _reject: (reason: any) => void;

  /**
   * Parse scene data.
   * @param engine - the engine of the parser context
   * @param sceneData - scene data which is exported by editor
   * @returns a promise of scene
   */
  static parse(engine: Engine, prefabData: IPrefabFile): Promise<Entity> {
    const prefabEntity = new Entity(engine, "prefab");
    const context = new PrefabParserContext(prefabData, prefabEntity);
    const parser = new PrefabParser(context);
    parser.start();
    return parser.promise;
  }

  constructor(public readonly context: PrefabParserContext) {
    this._engine = this.context.prefabEntity.engine;
    this._organizeEntities = this._organizeEntities.bind(this);
    this._parseComponents = this._parseComponents.bind(this);
    this._clearAndResolvePrefab = this._clearAndResolvePrefab.bind(this);
    this.promise = new Promise<Entity>((resolve, reject) => {
      this._reject = reject;
      this._resolve = resolve;
    });
  }

  /** start parse the prefab */
  start() {
    this._parseEntities()
      .then(this._organizeEntities)
      .then(this._parseComponents)
      .then(this._clearAndResolvePrefab)
      .then(this._resolve)
      .catch(this._reject);
  }

  private _parseEntities(): Promise<Entity[]> {
    const entitiesConfig = this.context.originalData.entities;
    const entityConfigMap = this.context.entityConfigMap;
    const entitiesMap = this.context.entityMap;
    const rootIds = this.context.rootIds;
    const engine = this._engine;
    const promises = entitiesConfig.map((entityConfig) => {
      entityConfigMap.set(entityConfig.id, entityConfig);
      // record root entities
      if (!entityConfig.parent) rootIds.push(entityConfig.id);
      return ReflectionParser.parseEntity(entityConfig, engine);
    });

    return Promise.all(promises).then((entities) => {
      for (let i = 0, l = entities.length; i < l; i++) {
        entitiesMap.set(entitiesConfig[i].id, entities[i]);
      }
      return entities;
    });
  }

  private _organizeEntities() {
    const prefab = this.context.prefabEntity;
    const { entityConfigMap, entityMap, rootIds } = this.context;
    for (const rootId of rootIds) {
      PrefabParser.parseChildren(entityConfigMap, entityMap, rootId);
    }
    const rootEntities = rootIds.map((id) => entityMap.get(id));
    for (let i = 0; i < rootEntities.length; i++) {
      prefab.addChild(rootEntities[i]);
    }
    return prefab;
  }

  private _parseComponents(): Promise<any[]> {
    const entitiesConfig = this.context.originalData.entities;
    const entityMap = this.context.entityMap;

    const promises = [];
    for (let i = 0, l = entitiesConfig.length; i < l; i++) {
      const entityConfig = entitiesConfig[i];
      const entity = entityMap.get(entityConfig.id);
      const len = entityConfig?.components?.length ?? 0;
      for (let i = 0; i < len; i++) {
        const componentConfig = entityConfig.components[i];
        const key = !componentConfig.refId ? componentConfig.class : componentConfig.refId;
        let component;
        // TODO: remove hack code when support additional edit
        if (key === "Animator") {
          component = entity.getComponent(Loader.getClass(key));
        }
        component = component || entity.addComponent(Loader.getClass(key));
        const promise = ReflectionParser.parsePropsAndMethods(component, componentConfig, entity.engine);
        promises.push(promise);
      }
    }
    return Promise.all(promises);
  }

  private _clearAndResolvePrefab() {
    const prefab = this.context.prefabEntity;
    this.context.destroy();
    return prefab;
  }

  static parseChildren(entitiesConfig: Map<string, IEntity>, entities: Map<string, Entity>, parentId: string) {
    const children = entitiesConfig.get(parentId).children;
    if (children && children.length > 0) {
      const parent = entities.get(parentId);
      for (let i = 0; i < children.length; i++) {
        const childId = children[i];
        const entity = entities.get(childId);
        parent.addChild(entity);
        this.parseChildren(entitiesConfig, entities, childId);
      }
    }
  }
}
