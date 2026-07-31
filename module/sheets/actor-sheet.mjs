const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const { DialogV2 } = foundry.applications.api;
const TextEditorImpl = foundry.applications.ux.TextEditor.implementation;

/**
 * ApplicationV2 actor sheet for Holy Lands RPG.
 * A single class serves both actor types; the rendered template is chosen
 * per-actor in _configureRenderParts.
 */
export class HolyLandsActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["holy-lands-rpg", "sheet", "actor"],
    position: { width: 720, height: 800 },
    form: { submitOnChange: true },
    window: { resizable: true },
    actions: {
      editImage: HolyLandsActorSheet.#onEditImage,
      itemCreate: HolyLandsActorSheet.#onItemCreate,
      itemEdit: HolyLandsActorSheet.#onItemEdit,
      itemDelete: HolyLandsActorSheet.#onItemDelete,
      roll: HolyLandsActorSheet.#onRoll,
      rollAttribute: HolyLandsActorSheet.#onRollAttribute,
      rollAbility: HolyLandsActorSheet.#onRollAbility,
      rollSkill: HolyLandsActorSheet.#onRollSkill,
      rollSave: HolyLandsActorSheet.#onRollSave,
      rollAttack: HolyLandsActorSheet.#onRollAttack,
      rollDamage: HolyLandsActorSheet.#onRollDamage,
      castMiracle: HolyLandsActorSheet.#onCastMiracle,
      useBlessing: HolyLandsActorSheet.#onUseBlessing,
      forfeitAdvantage: HolyLandsActorSheet.#onForfeitAdvantage,
      declareRetreat: HolyLandsActorSheet.#onDeclareRetreat,
      npcSkillAdd: HolyLandsActorSheet.#onNpcSkillAdd,
      npcSkillDelete: HolyLandsActorSheet.#onNpcSkillDelete,
      levelUp: HolyLandsActorSheet.#onLevelUp,
      rollStartingLifeFaith: HolyLandsActorSheet.#onRollStartingLifeFaith,
      rollCreationAttributes: HolyLandsActorSheet.#onRollCreationAttributes,
      unlockCreationAttributes: HolyLandsActorSheet.#onUnlockCreationAttributes,
      rollStep2A: HolyLandsActorSheet.#onRollStep2A
    }
  };

  /** @override */
  static PARTS = {
    // Template is replaced per-actor-type in _configureRenderParts
    body: {
      template: "systems/holy-lands-rpg/templates/actor/actor-character-sheet.hbs",
      scrollable: [".sheet-body"]
    }
  };

  /** Active tab state for the primary group. */
  tabGroups = { primary: "attributes" };

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @override */
  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);
    parts.body.template = `systems/holy-lands-rpg/templates/actor/actor-${this.actor.type}-sheet.hbs`;
    return parts;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;

    context.actor = actor;
    context.system = actor.system;
    context.flags = actor.flags;
    context.editable = this.isEditable;
    context.owner = actor.isOwner;
    context.rollData = actor.getRollData();

    // Enriched biography for the prose-mirror editor
    context.enrichedBiography = await TextEditorImpl.enrichHTML(actor.system.biography ?? "", {
      relativeTo: actor,
      rollData: context.rollData,
      secrets: actor.isOwner
    });

    // Tab state (active classes on first render; changeTab handles the rest)
    context.tabs = this.#prepareTabs();

    if (actor.type === "character") this.#prepareCharacterContext(context);
    if (actor.type === "npc") this.#prepareNpcContext(context);
    this.#prepareItems(context);

    return context;
  }

  /** Build a simple tabs context from the current tab group state. */
  #prepareTabs() {
    const tabIds = ["attributes", "skills", "combat", "equipment", "miracles", "biography"];
    const active = this.tabGroups.primary;
    return tabIds.reduce((tabs, id) => {
      tabs[id] = { id, group: "primary", cssClass: (id === active) ? "active" : "" };
      return tabs;
    }, {});
  }

  /** All class keys and labels. */
  static CLASSES = {
    adventurer: "Adventurer",
    bard: "Bard",
    cleric: "Cleric",
    devilHunter: "Devil Hunter",
    fighter: "Fighter",
    jester: "Jester",
    knight: "Knight",
    saint: "Saint",
    saisier: "Saisier",
    scout: "Scout",
    spy: "Spy",
    voyager: "Voyager",
    warrior: "Warrior"
  };

  /** Which classes each Stature can be (Genesis p.53, Step 1). */
  static STATURE_CLASSES = {
    weeFolk: ["adventurer", "bard", "fighter", "jester", "saint", "scout", "spy", "voyager"],
    dwarfolk: ["adventurer", "cleric", "devilHunter", "fighter", "knight", "warrior"],
    commonFolk: Object.keys(HolyLandsActorSheet.CLASSES),
    giantFolk: ["adventurer", "fighter", "knight", "warrior"]
  };

  /** Selection choices for character sheets. */
  #prepareCharacterContext(context) {
    context.classItem = this.actor.classItem;
    context.isGM = game.user.isGM;
    context.attributesLocked = !!this.actor.system.creation?.attributesRolled;
    context.unmetRequirements = context.attributesLocked ? this.actor.getUnmetClassRequirements() : [];
    context.statures = {
      weeFolk: "WeeFolk",
      dwarfolk: "Dwarfolk",
      commonFolk: "CommonFolk",
      giantFolk: "GiantFolk"
    };

    // Limit class choices to those the current Stature can be. If the
    // stored class is not valid for the Stature (e.g. the Stature was just
    // changed), keep it selectable but flagged, so re-rendering the sheet
    // never silently rewrites the character's class.
    const allClasses = HolyLandsActorSheet.CLASSES;
    const allowed = HolyLandsActorSheet.STATURE_CLASSES[this.actor.system.stature]
      ?? Object.keys(allClasses);

    // A dropped Class item is authoritative: warn if the current Stature
    // isn't in the item's statures list (Ch7 per-class lists).
    const clsItem = context.classItem;
    if (clsItem) {
      const okStatures = clsItem.system.statures ?? [];
      context.classStatureInvalid = okStatures.length
        && !okStatures.includes(this.actor.system.stature);
    }
    context.classes = {};
    for (const key of allowed) context.classes[key] = allClasses[key];
    const current = this.actor.system.class;
    if (current && !(current in context.classes)) {
      context.classes[current] = `${allClasses[current] ?? current} (invalid for Stature)`;
    }
  }

  /** Selection choices for NPC/Monster sheets. */
  #prepareNpcContext(context) {
    context.npcKinds = { human: "Human NPC", monster: "Monster" };
    context.categories = {
      christian: "Christian",
      nonChristian: "Non-Christian",
      demon: "Demon"
    };
    context.isMonster = this.actor.system.npcKind === "monster";
  }

  /** Organize embedded items for the sheet. */
  #prepareItems(context) {
    const buckets = { weapon: [], armor: [], equipment: [], miracle: [], blessing: [], skill: [] };
    for (const item of this.actor.items) {
      if (buckets[item.type]) buckets[item.type].push(item);
    }
    for (const list of Object.values(buckets)) {
      list.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    }
    context.weapons = buckets.weapon;
    context.armor = buckets.armor;
    context.equipment = buckets.equipment;
    context.miracles = buckets.miracle;
    context.blessings = buckets.blessing;
    context.skillItems = buckets.skill;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    // Enable item rows to be dragged to the macro hotbar
    if (this.actor.isOwner) {
      for (const li of this.element.querySelectorAll("li.item[data-item-id]")) {
        li.setAttribute("draggable", "true");
        li.addEventListener("dragstart", this.#onDragItemStart.bind(this));
      }
    }

    // NPC CS skills are an ArrayField: nameless inputs, rebuilt on change
    // (numeric-key form paths don't merge reliably into arrays).
    for (const input of this.element.querySelectorAll(".npc-skill-field")) {
      input.addEventListener("change", this.#onNpcSkillChange.bind(this));
    }
  }

  /** Persist an edit to one CS skill row. */
  async #onNpcSkillChange(event) {
    const input = event.currentTarget;
    const index = Number(input.dataset.index);
    const field = input.dataset.field;
    const skills = foundry.utils.deepClone(this.actor.system.skills ?? []);
    if (!skills[index]) return;
    skills[index][field] = (field === "value") ? (Number(input.value) || 0) : input.value;
    await this.actor.update({ "system.skills": skills });
  }

  /** Provide standard Item drag data. */
  #onDragItemStart(event) {
    const li = event.currentTarget;
    const item = this.actor.items.get(li.dataset.itemId);
    if (!item) return;
    event.dataTransfer.setData("text/plain", JSON.stringify(item.toDragData()));
  }

  /** @override Enforce a single Class item and sync the class key on drop. */
  async _onDropItem(event, item) {
    if ((item?.type === "class") && (this.actor.type === "character")) {
      const existing = this.actor.items.filter(i => i.type === "class");
      if (existing.length) await this.actor.deleteEmbeddedDocuments("Item", existing.map(i => i.id));
      const [created] = await this.actor.createEmbeddedDocuments("Item", [item.toObject()]);
      const key = created.system.key;
      if (key) await this.actor.update({ "system.class": key });

      const rollNow = await DialogV2.confirm({
        window: { title: created.name },
        content: `<p><strong>${created.name}</strong> assigned. Roll starting Life and Faith from the class formulas now? (Overwrites current values - intended for new characters.)</p>`,
        rejectClose: false
      });
      if (rollNow) await this.actor.rollStartingLifeFaith();
      return created;
    }
    return super._onDropItem(event, item);
  }

  /* -------------------------------------------- */
  /*  Action Handlers                             */
  /* -------------------------------------------- */

  /** Retrieve the Item document for the row containing the action target. */
  #getItemForTarget(target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    return itemId ? this.actor.items.get(itemId) : null;
  }

  static async #onEditImage(event, target) {
    const attr = target.dataset.edit || "img";
    const current = foundry.utils.getProperty(this.document, attr);
    const fp = new foundry.applications.apps.FilePicker.implementation({
      type: "image",
      current,
      callback: path => this.document.update({ [attr]: path })
    });
    return fp.browse();
  }

  static async #onItemCreate(event, target) {
    const type = target.dataset.type;
    const itemData = {
      name: `New ${type.capitalize()}`,
      type
    };
    return Item.create(itemData, { parent: this.actor });
  }

  static #onItemEdit(event, target) {
    const item = this.#getItemForTarget(target);
    item?.sheet.render(true);
  }

  static async #onItemDelete(event, target) {
    const item = this.#getItemForTarget(target);
    if (!item) return;
    await item.delete();
  }

  /** Generic data-roll / item roll handler. */
  static #onRoll(event, target) {
    const dataset = target.dataset;

    if (dataset.rollType === "item") {
      const item = this.#getItemForTarget(target);
      if (item) return item.roll();
    }

    if (dataset.roll) {
      const label = dataset.label ?? "";
      const roll = new Roll(dataset.roll, this.actor.getRollData());
      return roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: label,
        rollMode: game.settings.get("core", "rollMode")
      });
    }
  }

  static async #onRollAttribute(event, target) {
    return this.actor.rollAttribute(target.dataset.attribute);
  }

  static async #onRollAbility(event, target) {
    const df = await this.#getDifficultyFactor();
    if (df === null) return;
    return this.actor.rollAbility(target.dataset.ability, df);
  }

  static async #onRollSkill(event, target) {
    const df = await this.#getDifficultyFactor();
    if (df === null) return;
    return this.actor.rollSkill(target.dataset.skill, df);
  }

  static async #onRollSave(event, target) {
    const saveKey = target.dataset.save;

    // Automatic DF from the save definition; Shift-click to override
    if (event.shiftKey) {
      const df = await this.#getDifficultyFactor();
      if (df === null) return;
      return this.actor.rollSave(saveKey, df);
    }
    return this.actor.rollSave(saveKey);
  }

  static async #onRollAttack(event, target) {
    const weapon = this.#getItemForTarget(target);
    const options = await this.#promptAttackOptions(weapon);
    if (!options) return;
    const targetActor = await this.#selectTarget();
    if (!targetActor) return;
    return this.actor.rollAttack(weapon, targetActor, options);
  }

  static async #onForfeitAdvantage(event, target) {
    return this.actor.forfeitAdvantage();
  }

  static async #onDeclareRetreat(event, target) {
    return this.actor.declareRetreat();
  }

  static async #onNpcSkillAdd(event, target) {
    const skills = foundry.utils.deepClone(this.actor.system.skills ?? []);
    skills.push({ name: "", value: 0 });
    return this.actor.update({ "system.skills": skills });
  }

  static async #onRollCreationAttributes(event, target) {
    const stature = this.actor.system.stature;
    const statures = { weeFolk: "WeeFolk", dwarfolk: "Dwarfolk", commonFolk: "CommonFolk", giantFolk: "GiantFolk" };
    const proceed = await DialogV2.confirm({
      window: { title: "Roll Attributes (Step 2)" },
      content: `<p>Roll all twelve Attributes for <strong>${this.actor.name}</strong> as a <strong>${statures[stature] ?? stature}</strong>?</p>
        <p><em>This uses the p.53 dice table (Grace Effect per world setting), assigns every AV, and then <strong>locks the Stature and this roll</strong>. Confirm the Stature above is correct first.</em></p>`,
      rejectClose: false
    });
    if (!proceed) return;
    return this.actor.rollCreationAttributes();
  }

  static async #onRollStep2A(event, target) {
    const unmet = this.actor.getUnmetClassRequirements();
    if (!unmet.length) return;
    const list = unmet.map(r => `<li>${r.label}: AV ${r.current}, requires ${r.min}</li>`).join("");
    const proceed = await DialogV2.confirm({
      window: { title: "Step 2A: Class Attribute Rerolls" },
      content: `<p><strong>${this.actor.classItem?.name}</strong> requirements not met:</p><ul>${list}</ul>
        <p><em>Reroll each with the Stature dice until the requirement is met (p.53, Step 2A)? Other Attributes stay locked.</em></p>`,
      rejectClose: false
    });
    if (!proceed) return;
    return this.actor.rollStep2ARerolls();
  }

  static async #onUnlockCreationAttributes(event, target) {
    const proceed = await DialogV2.confirm({
      window: { title: "Unlock Attribute Generation" },
      content: `<p>Rac override: unlock Stature and attribute generation for <strong>${this.actor.name}</strong>, allowing a fresh Step 2 roll?</p>`,
      rejectClose: false
    });
    if (!proceed) return;
    return this.actor.unlockCreationAttributes();
  }

  static async #onLevelUp(event, target) {
    const proceed = await DialogV2.confirm({
      window: { title: "Level Up" },
      content: `<p>Advance <strong>${this.actor.name}</strong> to Level ${(this.actor.system.level || 1) + 1}? This rolls the class Life and Faith dice and applies them.</p>`,
      rejectClose: false
    });
    if (!proceed) return;
    return this.actor.levelUp();
  }

  static async #onRollStartingLifeFaith(event, target) {
    const proceed = await DialogV2.confirm({
      window: { title: "Roll Starting Life & Faith" },
      content: `<p>Roll starting Life and Faith for <strong>${this.actor.name}</strong> from the class formulas? This overwrites current and maximum Life/Faith.</p>`,
      rejectClose: false
    });
    if (!proceed) return;
    return this.actor.rollStartingLifeFaith();
  }

  static async #onNpcSkillDelete(event, target) {
    const index = Number(target.dataset.index);
    const skills = foundry.utils.deepClone(this.actor.system.skills ?? []);
    skills.splice(index, 1);
    return this.actor.update({ "system.skills": skills });
  }

  static async #onRollDamage(event, target) {
    const weapon = this.#getItemForTarget(target);
    const isCritical = event.shiftKey || false;
    return this.actor.rollDamage(weapon, isCritical);
  }

  static async #onCastMiracle(event, target) {
    const miracle = this.#getItemForTarget(target);
    return miracle?.castMiracle();
  }

  static async #onUseBlessing(event, target) {
    const blessing = this.#getItemForTarget(target);
    return blessing?.useBlessing();
  }

  /* -------------------------------------------- */
  /*  Dialogs                                     */
  /* -------------------------------------------- */

  /**
   * Prompt for attack options: type (Attack / Critical xN / Special) and a
   * situational modifier (Flanking +1 per ally, Rac bonuses, etc).
   * @returns {Promise<object|null>} { mode, multiplier, modifier } or null.
   */
  async #promptAttackOptions(weapon) {
    const wsKey = weapon?.system?.weaponSkill || "lightArms";
    const ws = this.actor.system.weaponSkills?.[wsKey];
    if (!ws) return { mode: "attack", multiplier: 1, modifier: 0 };

    const atrCurrent = ws.atRCurrent ?? 1;
    let modes = `<option value="attack">Attack (+${ws.attackBonus || 0}, 1 AtR)</option>`;
    const effectiveCrit = Math.min(ws.criticalBonus || 0, ws.attackBonus || 0);
    for (let n = 2; n <= atrCurrent; n++) {
      modes += `<option value="critical:${n}">Critical x${n} Damage (+${effectiveCrit}, ${n} AtR)</option>`;
    }
    modes += `<option value="special">Special (+${ws.specialBonus || 0}, 1 AtR)</option>`;

    const result = await DialogV2.wait({
      window: { title: `${weapon?.name || "Unarmed"} - Attack Options (${ws.label}, AtR ${atrCurrent})` },
      content: `
        <div class="form-group">
          <label>Attack type:</label>
          <select name="mode" autofocus>${modes}</select>
        </div>
        <div class="form-group">
          <label>Situational modifier (Flanking +1/ally, etc):</label>
          <input type="number" name="modifier" value="0"/>
        </div>`,
      buttons: [
        {
          action: "roll",
          label: "Roll Attack",
          default: true,
          callback: (event, button) => ({
            mode: button.form.elements.mode.value,
            modifier: Number(button.form.elements.modifier.value) || 0
          })
        },
        { action: "cancel", label: "Cancel" }
      ],
      rejectClose: false
    });

    if (!result || (result === "cancel")) return null;
    const [mode, mult] = String(result.mode).split(":");
    return { mode, multiplier: Number(mult) || 1, modifier: result.modifier };
  }

  /**
   * Ask the user for a Difficulty Factor.
   * @returns {Promise<number|null>} The DF, or null if cancelled.
   */
  async #getDifficultyFactor() {
    const df = await DialogV2.prompt({
      window: { title: "Difficulty Factor" },
      content: `
        <div class="form-group">
          <label>Enter Difficulty Factor (DF):</label>
          <input type="number" name="df" value="10" autofocus/>
        </div>`,
      ok: {
        label: "Roll",
        callback: (event, button) => Number(button.form.elements.df.value)
      },
      rejectClose: false
    });
    return (typeof df === "number" && Number.isFinite(df)) ? df : null;
  }

  /**
   * Select a target actor for combat.
   * @returns {Promise<Actor|null>}
   */
  async #selectTarget() {
    const actors = game.actors.filter(a =>
      (a.id !== this.actor.id) && ["character", "npc"].includes(a.type)
    );
    if (actors.length === 0) {
      ui.notifications.warn("No valid targets found");
      return null;
    }

    const options = actors.map(a => `<option value="${a.id}">${foundry.utils.escapeHTML(a.name)}</option>`).join("");
    const targetId = await DialogV2.wait({
      window: { title: "Select Target" },
      content: `
        <div class="form-group">
          <label>Choose target:</label>
          <select name="targetId" autofocus>${options}</select>
        </div>`,
      buttons: [
        {
          action: "attack",
          label: "Attack",
          default: true,
          callback: (event, button) => button.form.elements.targetId.value
        },
        { action: "cancel", label: "Cancel" }
      ],
      rejectClose: false
    });

    if (!targetId || targetId === "cancel") return null;
    return game.actors.get(targetId) ?? null;
  }
}
