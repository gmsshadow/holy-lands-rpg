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
      toggleEquip: HolyLandsActorSheet.#onToggleEquip,
      castMiracle: HolyLandsActorSheet.#onCastMiracle,
      useBlessing: HolyLandsActorSheet.#onUseBlessing,
      forfeitAdvantage: HolyLandsActorSheet.#onForfeitAdvantage,
      declareRetreat: HolyLandsActorSheet.#onDeclareRetreat,
      npcSkillAdd: HolyLandsActorSheet.#onNpcSkillAdd,
      npcSkillDelete: HolyLandsActorSheet.#onNpcSkillDelete,
      addCustomSkill: HolyLandsActorSheet.#onAddCustomSkill,
      levelUp: HolyLandsActorSheet.#onLevelUp,
      rollStartingLifeFaith: HolyLandsActorSheet.#onRollStartingLifeFaith,
      rollCreationAttributes: HolyLandsActorSheet.#onRollCreationAttributes,
      unlockCreationAttributes: HolyLandsActorSheet.#onUnlockCreationAttributes,
      rollStep2A: HolyLandsActorSheet.#onRollStep2A,
      chooseSaveBonus: HolyLandsActorSheet.#onChooseSaveBonus,
      unlockSaveBonus: HolyLandsActorSheet.#onUnlockSaveBonus,
      unlockStartingRoll: HolyLandsActorSheet.#onUnlockStartingRoll,
      chooseClass: HolyLandsActorSheet.#onChooseClass,
      rollDetails: HolyLandsActorSheet.#onRollDetails,
      rollSinsPhobias: HolyLandsActorSheet.#onRollSinsPhobias,
      charArrayAdd: HolyLandsActorSheet.#onCharArrayAdd,
      charArrayDelete: HolyLandsActorSheet.#onCharArrayDelete,
      grantGifts: HolyLandsActorSheet.#onGrantGifts,
      addSkill: HolyLandsActorSheet.#onAddSkill,
      chooseTalentsCrafts: HolyLandsActorSheet.#onChooseTalentsCrafts,
      chooseBasicSkills: HolyLandsActorSheet.#onChooseBasicSkills,
      unlockTalentsCrafts: HolyLandsActorSheet.#onUnlockTalentsCrafts,
      applyAttrBonus: HolyLandsActorSheet.#onApplyAttrBonus,
      addMiracle: HolyLandsActorSheet.#onAddMiracle,
      grantClericMiracles: HolyLandsActorSheet.#onGrantClericMiracles,
      grantEquipment: HolyLandsActorSheet.#onGrantEquipment,
      unlockEquipment: HolyLandsActorSheet.#onUnlockEquipment,
      rollBlessings: HolyLandsActorSheet.#onRollBlessings
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
    context.unmetRequirements = this.actor.getUnmetClassRequirements();
    context.saveBonusChosen = !!this.actor.system.creation?.saveBonusChosen;
    context.startingRolled = !!this.actor.system.creation?.startingRolled;
    context.giftsGranted = !!this.actor.system.creation?.giftsGranted;
    context.equipmentGranted = !!this.actor.system.creation?.equipmentGranted;
    context.hasStartingKit = !!this.actor.classItem?.system.startingKit?.length;
    context.attrBonuses = this.actor.system.attrBonusValidation;
    context.miracleClass = this.actor.miracleClass;
    if (context.miracleClass) {
      context.miracleGuidance = (context.miracleClass === "saint")
        ? "Saint: select 5 High Miracles and 2 Clerical Miracles (your level or lower)."
        : "Cleric: gain all Clerical Miracles of your level, plus 1 High Miracle.";
    }
    context.hasClassGifts = !!this.actor.classItem?.system.grantedGifts?.trim();
    context.hasTalentCraftList = !!this.actor.talentCraftList;
    context.hasBasicSkillList = !!this.actor.basicSkillList;
    context.talentsCraftsChosen = !!this.actor.system.creation?.talentsCraftsChosen;
    context.statures = {
      weeFolk: "WeeFolk",
      dwarfolk: "Dwarfolk",
      commonFolk: "CommonFolk",
      giantFolk: "GiantFolk"
    };

    // A dropped Class item is authoritative: warn if the current Stature
    // isn't in the item's statures list (Ch7 per-class lists).
    const clsItem = context.classItem;
    if (clsItem) {
      const okStatures = clsItem.system.statures ?? [];
      context.classStatureInvalid = okStatures.length
        && !okStatures.includes(this.actor.system.stature);
    }

    // Legacy display: characters with only the old class key show its label.
    context.legacyClassLabel = (!clsItem && this.actor.system.class)
      ? (HolyLandsActorSheet.CLASSES[this.actor.system.class] ?? this.actor.system.class)
      : null;
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
    context.notableSkills = this.actor.system.notableSkills;
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
    context.activeAtR = this.actor.activeAtR;
    // Equipped weapons + innate unarmed attacks for the Combat tab quick block.
    if (this.actor.type === "character") {
      context.equippedWeapons = buckets.weapon.filter(w => w.system.equipped);
      context.innateAttacks = this.actor.innateAttacks;
    }
    // Annotate each weapon with the damage for this character's stature.
    if (this.actor.type === "character") {
      const stature = this.actor.system.stature;
      for (const w of context.weapons) {
        w.displayDamage = w.system.damageForStature?.(stature) || w.system.damage;
      }
    }
    context.armor = buckets.armor;
    context.equipment = buckets.equipment;
    context.miracles = buckets.miracle;
    context.blessings = buckets.blessing;

    // Skill items grouped into the three paper-sheet sections.
    // Sort each skill column alphabetically so they're easy to scan.
    const byName = (a, b) => a.name.localeCompare(b.name);
    context.gifts = buckets.skill.filter(i => i.system.skillType === "gift").sort(byName);
    context.talents = buckets.skill.filter(i => i.system.skillType === "talent").sort(byName);
    context.crafts = buckets.skill.filter(i => i.system.skillType === "craft").sort(byName);
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

    // Character string-array rows (Sins, Phobias): same rebuild pattern.
    for (const input of this.element.querySelectorAll(".char-array-field")) {
      input.addEventListener("change", this.#onCharArrayChange.bind(this));
    }
  }

  /** Persist an edit to one string-array row (sins/phobias). */
  async #onCharArrayChange(event) {
    const input = event.currentTarget;
    const path = input.dataset.array;
    const index = Number(input.dataset.index);
    const arr = foundry.utils.deepClone(foundry.utils.getProperty(this.actor.system, path) ?? []);
    if (arr[index] === undefined) return;
    arr[index] = input.value;
    await this.actor.update({ [`system.${path}`]: arr });
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
    // Depending on core version/path this may be an Item document or raw
    // drag data - resolve defensively.
    let doc = item;
    if (doc && !(doc instanceof Item) && (doc.uuid || doc.type === "Item")) {
      doc = await Item.implementation.fromDropData(doc);
    }

    if ((doc?.type === "class") && (this.actor.type === "character")) {
      return this.#assignClassItem(doc);
    }
    return super._onDropItem(event, item);
  }

  /**
   * Shared class assignment pipeline: stature gate, single-class
   * enforcement, key sync, Step 2A offer, then the starting-roll offer.
   */
  async #assignClassItem(doc, { skipStatureGate = false } = {}) {
    const statureLabels = { weeFolk: "WeeFolk", dwarfolk: "Dwarfolk", commonFolk: "CommonFolk", giantFolk: "GiantFolk" };
    const okStatures = doc.system.statures ?? [];
    const stature = this.actor.system.stature;
    if (!skipStatureGate && okStatures.length && !okStatures.includes(stature)) {
      const legal = okStatures.map(k => statureLabels[k] ?? k).join(", ");
      const proceed = await DialogV2.confirm({
        window: { title: `${doc.name} - Stature Restriction` },
        content: `<p><strong>${doc.name}</strong> cannot be a <strong>${statureLabels[stature] ?? stature}</strong> (Ch7 - legal Statures: ${legal}).</p>
          <p><em>Assign anyway? (Rac override - the sheet will keep showing a warning.)</em></p>`,
        no: { default: true },
        rejectClose: false
      });
      if (!proceed) {
        ui.notifications.info(`${doc.name} was not assigned.`);
        return;
      }
    }

    const existing = this.actor.items.filter(i => i.type === "class");
    if (existing.length) await this.actor.deleteEmbeddedDocuments("Item", existing.map(i => i.id));
    const [created] = await this.actor.createEmbeddedDocuments("Item", [doc.toObject()]);
    const key = created.system.key;
    if (key) await this.actor.update({ "system.class": key });

    // Step 2A first: if attribute requirements are unmet, offer the
    // reroll immediately (before Life/Faith, which depend on STR/END).
    const unmet = this.actor.getUnmetClassRequirements();
    if (unmet.length) {
      if (this.actor.system.creation?.attributesRolled) {
        const list = unmet.map(r => `<li>${r.label}: AV ${r.current}, requires ${r.min}</li>`).join("");
        const reroll = await DialogV2.confirm({
          window: { title: `${created.name} - Step 2A` },
          content: `<p><strong>${created.name}</strong> has Attribute requirements this character does not meet:</p>
            <ul>${list}</ul>
            <p><em>Reroll each with the Stature dice until met (p.53, Step 2A)?</em></p>`,
          rejectClose: false
        });
        if (reroll) await this.actor.rollStep2ARerolls();
      }
      else {
        ui.notifications.warn(`${created.name}: attribute requirements not met (${unmet.map(r => `${r.label} ${r.current}/${r.min}`).join(", ")}). Roll Attributes (Step 2), then use Step 2A Reroll.`);
      }
    }

    if (this.actor.system.creation?.attributesRolled && !this.actor.system.creation?.startingRolled) {
      const rollNow = await DialogV2.confirm({
        window: { title: created.name },
        content: `<p><strong>${created.name}</strong> assigned. Roll starting Life and Faith from the class formulas now? (Locks after rolling.)</p>`,
        rejectClose: false
      });
      if (rollNow) await this.actor.rollStartingLifeFaith();
    }
    else if (!this.actor.system.creation?.attributesRolled) {
      ui.notifications.info(`${created.name} assigned. Roll Attributes (Step 2) first, then use the Start button for Life & Faith.`);
    }
    return created;
  }

  /** Open a Stature-filtered class picker fed from the compendium. */
  /** Add a Miracle from the compendium, filtered by High/Clerical. */
  static async #onAddMiracle(event, target) {
    const filter = target.dataset.miracleType; // "high" | "clerical" | ""
    const pack = game.packs.get("holy-lands-rpg.miracles");
    if (!pack) { ui.notifications.error("Miracles compendium not found."); return; }
    let docs = (await pack.getDocuments()).sort((a, b) => a.name.localeCompare(b.name));
    if (filter) docs = docs.filter(d => d.system.miracleType === filter);
    const have = new Set(this.actor.items.filter(i => i.type === "miracle").map(i => i.name.toLowerCase()));
    const options = docs.map(d => {
      const dis = have.has(d.name.toLowerCase()) ? " (already have)" : "";
      return `<option value="${d.id}">${foundry.utils.escapeHTML(d.name)} — Fc ${d.system.faithCost}${dis}</option>`;
    }).join("");
    const chosen = await DialogV2.wait({
      window: { title: `Add ${filter ? filter.capitalize() + " " : ""}Miracle` },
      content: `<div class="form-group"><label>Miracle:</label><select name="id" autofocus>${options}</select></div>`,
      buttons: [
        { action: "add", label: "Add", default: true, callback: (e, b) => b.form.elements.id.value },
        { action: "cancel", label: "Cancel" }
      ],
      rejectClose: false
    });
    if (!chosen || chosen === "cancel") return;
    return this.actor.addMiracleFromCompendium(chosen);
  }

  static async #onRollBlessings(event, target) {
    const bv = this.actor.system.blessingsValidation;
    const outstanding = bv?.remaining ?? 0;
    if (outstanding <= 0) {
      ui.notifications.info(`${this.actor.name} already has all ${bv?.entitled ?? 0} entitled Blessings.`);
      return;
    }
    const proceed = await DialogV2.confirm({
      window: { title: "Roll Blessings" },
      content: `<p>Roll <strong>${outstanding}</strong> new Blessing${outstanding > 1 ? "s" : ""} for <strong>${this.actor.name}</strong> on the <strong>${this.actor.classItem?.system.blessingsType ?? "class"}</strong> table (p.61)?</p>
        <p><em>Rolls d% for each, rerolling duplicates and any already held, and grants the matching Blessings.</em></p>`,
      rejectClose: false
    });
    if (!proceed) return;
    return this.actor.rollBlessings();
  }

  static async #onGrantEquipment(event, target) {
    const cls = this.actor.classItem;
    if (!cls) { ui.notifications.warn("Assign a Class first."); return; }
    const kit = cls.system.startingKit ?? [];

    // Build a choice form for any 'or' entries.
    const optionEntries = kit.map((e, i) => ({ e, i })).filter(x => x.e.options?.length);
    let choices = {};
    if (optionEntries.length) {
      const rows = optionEntries.map(({ e, i }) => {
        const opts = e.options.map(o => `<option value="${foundry.utils.escapeHTML(o)}">${foundry.utils.escapeHTML(o)}</option>`).join("");
        return `<div class="form-group"><label>Choose:</label><select name="opt_${i}">${opts}</select></div>`;
      }).join("");
      const result = await DialogV2.wait({
        window: { title: `${cls.name} - Starting Equipment Choices` },
        content: `<p>This class offers some equipment choices:</p>${rows}`,
        buttons: [
          { action: "ok", label: "Grant Equipment", default: true,
            callback: (event, button) => {
              const out = {};
              for (const { i } of optionEntries) out[i] = button.form.elements[`opt_${i}`].value;
              return out;
            } },
          { action: "cancel", label: "Cancel" }
        ],
        rejectClose: false
      });
      if (!result || result === "cancel") return;
      choices = result;
    } else {
      const proceed = await DialogV2.confirm({
        window: { title: "Step 9: Starting Equipment" },
        content: `<p>Grant <strong>${cls.name}</strong>'s starting weapons, armor, and equipment to <strong>${this.actor.name}</strong>? (Dice quantities are rolled; then locks.)</p>`,
        rejectClose: false
      });
      if (!proceed) return;
    }
    return this.actor.grantStartingEquipment(choices);
  }

  static async #onUnlockEquipment(event, target) {
    const proceed = await DialogV2.confirm({
      window: { title: "Unlock Starting Equipment" },
      content: `<p>Rac override: unlock the Step 9 equipment grant for <strong>${this.actor.name}</strong>? (Does not remove items already granted.)</p>`,
      rejectClose: false
    });
    if (!proceed) return;
    return this.actor.unlockStartingEquipment();
  }

  static async #onGrantClericMiracles(event, target) {
    const proceed = await DialogV2.confirm({
      window: { title: "Grant Clerical Miracles" },
      content: `<p>Add all Level 1 Clerical Miracles to <strong>${this.actor.name}</strong>? (Then choose one High Miracle.)</p>`,
      rejectClose: false
    });
    if (!proceed) return;
    return this.actor.grantClericClericalMiracles();
  }

  static async #onApplyAttrBonus(event, target) {
    const attrKey = target.dataset.attr;
    let choiceKey = null;

    // Attributes that require a choice: which skill, save, WS, or sin.
    const skillSection = { int: "craft", wis: "gift", mem: "talent" }[attrKey];
    if (skillSection) {
      const skills = this.actor.items.filter(i => (i.type === "skill") && (i.system.skillType === skillSection));
      if (!skills.length) { ui.notifications.warn(`No ${skillSection}s to raise - add one first.`); return; }
      choiceKey = await this.#pickFromList(`Raise which ${skillSection}?`,
        skills.map(sk => [sk.id, `${sk.name} (+${sk.system.pf || 0})`]));
    }
    else if (attrKey === "agi") {
      choiceKey = await this.#pickFromList("Add +1 AtR to which Weapon Skill?",
        Object.entries(this.actor.system.weaponSkills).map(([k, ws]) => [k, `${ws.label} (AtR ${ws.atRMax})`]));
    }
    else if (attrKey === "will") {
      choiceKey = await this.#pickFromList("Add +1 to which Saving Throw?",
        Object.entries(this.actor.system.saves).map(([k, sv]) => [k, `${sv.label} (+${sv.value || 0})`]));
    }
    else if (attrKey === "vir") {
      const sins = this.actor.system.sins ?? [];
      if (!sins.length) { ui.notifications.warn("No Sins to remove."); return; }
      choiceKey = await this.#pickFromList("Lose which Sin?", sins.map((sn, i) => [String(i), sn]));
    }
    if (skillSection || ["agi", "will", "vir"].includes(attrKey)) {
      if (choiceKey === null) return; // cancelled
    }
    return this.actor.applyAttributeBonus(attrKey, choiceKey);
  }

  /** Small single-select helper returning the chosen value or null. */
  async #pickFromList(title, entries) {
    const options = entries.map(([v, label]) => `<option value="${v}">${foundry.utils.escapeHTML(label)}</option>`).join("");
    const choice = await DialogV2.wait({
      window: { title },
      content: `<div class="form-group"><select name="v" autofocus>${options}</select></div>`,
      buttons: [
        { action: "ok", label: "Apply", default: true, callback: (e, b) => b.form.elements.v.value },
        { action: "cancel", label: "Cancel" }
      ],
      rejectClose: false
    });
    return (choice && choice !== "cancel") ? choice : null;
  }

  static async #onGrantGifts(event, target) {
    const cls = this.actor.classItem;
    if (!cls) { ui.notifications.warn("Assign a Class first."); return; }
    const proceed = await DialogV2.confirm({
      window: { title: "Step 6: Grant Class Gifts" },
      content: `<p>Add <strong>${cls.name}</strong>'s listed Gifts to <strong>${this.actor.name}</strong> as skill items (Gifts at +3, or +2 for Adventurer/Fighter)?</p>
        <p><em>Skips any the character already has; you then choose Talents and Crafts.</em></p>`,
      rejectClose: false
    });
    if (!proceed) return;
    return this.actor.grantClassGifts();
  }

  /** Add a skill from the compendium into a chosen section at the step PF. */
  static async #onAddSkill(event, target) {
    const section = target.dataset.section; // gift/talent/craft
    const pack = game.packs.get("holy-lands-rpg.skills");
    if (!pack) { ui.notifications.error("Skills compendium not found."); return; }
    const docs = (await pack.getDocuments()).sort((a, b) => a.name.localeCompare(b.name));

    const sectionLabels = { gift: "Gift", talent: "Talent", craft: "Craft" };
    const defaultPF = { gift: 3, talent: 2, craft: 1 };
    const have = new Set(this.actor.items.filter(i => i.type === "skill").map(i => i.name.toLowerCase()));
    const options = docs.map(d => {
      const dis = have.has(d.name.toLowerCase()) ? " (already have)" : "";
      return `<option value="${d.id}">${foundry.utils.escapeHTML(d.name)}${dis}</option>`;
    }).join("");

    const result = await DialogV2.wait({
      window: { title: `Add ${sectionLabels[section]} from Skills` },
      content: `
        <div class="form-group">
          <label>Skill:</label>
          <select name="skillId" autofocus>${options}</select>
        </div>
        <div class="form-group">
          <label>PF:</label>
          <input type="number" name="pf" value="${defaultPF[section] ?? 0}"/>
        </div>`,
      buttons: [
        { action: "add", label: "Add", default: true,
          callback: (event, button) => ({ id: button.form.elements.skillId.value, pf: Number(button.form.elements.pf.value) || 0 }) },
        { action: "cancel", label: "Cancel" }
      ],
      rejectClose: false
    });
    if (!result || result === "cancel") return;
    return this.actor.addSkillFromCompendium(result.id, section, result.pf);
  }

  /**
   * Pick 5 Talents (+2) then 3 Crafts (+1) from the class's Talent/Craft list
   * (Genesis Ch7). Crafts cannot repeat a chosen Talent. Client-side JS keeps
   * the dropdowns in sync so duplicates aren't selectable.
   */
  static async #onChooseTalentsCrafts(event, target) {
    const list = this.actor.talentCraftList;
    if (!list) {
      ui.notifications.warn("This class doesn't use the standard Talent/Craft list (Adventurer/Fighter differ).");
      return;
    }

    const opts = extra => `<option value="">- choose -</option>` +
      list.map(n => `<option value="${foundry.utils.escapeHTML(n)}">${foundry.utils.escapeHTML(n)}</option>`).join("");
    const talentRows = Array.from({ length: 5 }, (_, i) =>
      `<div class="form-group"><label>Talent ${i + 1} (+2):</label><select name="talent_${i}" class="tc-pick" data-kind="talent">${opts()}</select></div>`).join("");
    const craftRows = Array.from({ length: 3 }, (_, i) =>
      `<div class="form-group"><label>Craft ${i + 1} (+1):</label><select name="craft_${i}" class="tc-pick" data-kind="craft">${opts()}</select></div>`).join("");

    // Inline script keeps selections unique across all 8 dropdowns.
    const sync = `<script>(function(){
      const root = document.currentScript.parentElement;
      const picks = () => Array.from(root.querySelectorAll('.tc-pick'));
      function refresh(){
        const chosen = picks().map(s=>s.value).filter(Boolean);
        picks().forEach(sel=>{
          Array.from(sel.options).forEach(o=>{
            if(!o.value) return;
            o.disabled = chosen.includes(o.value) && (sel.value !== o.value);
          });
        });
      }
      picks().forEach(s=>s.addEventListener('change', refresh));
      refresh();
    })();</script>`;

    const result = await DialogV2.wait({
      window: { title: `${this.actor.classItem?.name} - Choose Talents & Crafts` },
      content: `<p>Choose <strong>5 Talents</strong> (+2 PF) and <strong>3 Crafts</strong> (+1 PF) from the ${this.actor.classItem?.name} skill list. Each skill may be chosen once.</p>
        <div class="tc-scroll" style="max-height: 60vh; overflow-y: auto; padding-right: 6px;">
        <fieldset><legend>Talents</legend>${talentRows}</fieldset>
        <fieldset><legend>Crafts</legend>${craftRows}</fieldset>
        </div>${sync}`,
      buttons: [
        { action: "grant", label: "Grant", default: true, callback: (event, button) => {
          const f = button.form.elements;
          const talents = [0,1,2,3,4].map(i => f[`talent_${i}`].value).filter(Boolean);
          const crafts = [0,1,2].map(i => f[`craft_${i}`].value).filter(Boolean);
          return { talents, crafts };
        } },
        { action: "cancel", label: "Cancel" }
      ],
      rejectClose: false
    });
    if (!result || result === "cancel") return;

    const { talents, crafts } = result;
    if (talents.length !== 5 || crafts.length !== 3) {
      ui.notifications.warn(`Select exactly 5 Talents and 3 Crafts (got ${talents.length} and ${crafts.length}).`);
      return;
    }
    const all = [...talents, ...crafts];
    if (new Set(all.map(x => x.toLowerCase())).size !== all.length) {
      ui.notifications.warn("Each skill may only be chosen once across Talents and Crafts.");
      return;
    }
    return this.actor.grantTalentsAndCrafts(talents, crafts);
  }

  static async #onUnlockTalentsCrafts(event, target) {
    return this.actor.unlockTalentsCrafts();
  }

  /**
   * Adventurer/Fighter skill picker (p.58): 7 Gifts, 5 Talents, 3 Crafts from
   * one pool, all at +2 PF, each skill chosen once.
   */
  static async #onChooseBasicSkills(event, target) {
    const list = this.actor.basicSkillList;
    if (!list) {
      ui.notifications.warn("This class doesn't use the combined Adventurer/Fighter skill pool.");
      return;
    }

    const opts = () => `<option value="">- choose -</option>` +
      list.map(n => `<option value="${foundry.utils.escapeHTML(n)}">${foundry.utils.escapeHTML(n)}</option>`).join("");
    const rows = (kind, n) => Array.from({ length: n }, (_, i) =>
      `<div class="form-group"><label>${kind} ${i + 1}:</label><select name="${kind.toLowerCase()}_${i}" class="tc-pick">${opts()}</select></div>`).join("");

    const sync = `<script>(function(){
      const root = document.currentScript.parentElement;
      const picks = () => Array.from(root.querySelectorAll('.tc-pick'));
      function refresh(){
        const chosen = picks().map(s=>s.value).filter(Boolean);
        picks().forEach(sel=>{
          Array.from(sel.options).forEach(o=>{
            if(!o.value) return;
            o.disabled = chosen.includes(o.value) && (sel.value !== o.value);
          });
        });
      }
      picks().forEach(s=>s.addEventListener('change', refresh));
      refresh();
    })();</script>`;

    const result = await DialogV2.wait({
      window: { title: `${this.actor.classItem?.name} - Choose Skills (all +2 PF)` },
      content: `<p>Choose <strong>7 Gifts</strong>, <strong>5 Talents</strong>, and <strong>3 Crafts</strong> from the ${this.actor.classItem?.name} pool. All start at +2 PF; each skill may be chosen once.</p>
        <div class="tc-scroll" style="max-height: 60vh; overflow-y: auto; padding-right: 6px;">
        <fieldset><legend>Gifts (7)</legend>${rows("Gift", 7)}</fieldset>
        <fieldset><legend>Talents (5)</legend>${rows("Talent", 5)}</fieldset>
        <fieldset><legend>Crafts (3)</legend>${rows("Craft", 3)}</fieldset>
        </div>${sync}`,
      buttons: [
        { action: "grant", label: "Grant", default: true, callback: (event, button) => {
          const f = button.form.elements;
          const pick = (kind, n) => Array.from({ length: n }, (_, i) => f[`${kind}_${i}`].value).filter(Boolean);
          return { gifts: pick("gift", 7), talents: pick("talent", 5), crafts: pick("craft", 3) };
        } },
        { action: "cancel", label: "Cancel" }
      ],
      rejectClose: false
    });
    if (!result || result === "cancel") return;

    const { gifts, talents, crafts } = result;
    if (gifts.length !== 7 || talents.length !== 5 || crafts.length !== 3) {
      ui.notifications.warn(`Select exactly 7 Gifts, 5 Talents, 3 Crafts (got ${gifts.length}, ${talents.length}, ${crafts.length}).`);
      return;
    }
    const all = [...gifts, ...talents, ...crafts];
    if (new Set(all.map(x => x.toLowerCase())).size !== all.length) {
      ui.notifications.warn("Each skill may only be chosen once.");
      return;
    }
    return this.actor.grantBasicSkills(gifts, talents, crafts);
  }

  static async #onRollDetails(event, target) {
    const proceed = await DialogV2.confirm({
      window: { title: "Step 5: Roll Details" },
      content: `<p>Roll Height (d12 by Stature), look up Weight (STR &times; height, males +10%), and roll Native Land and Language Group (d20 each) for <strong>${this.actor.name}</strong>?</p>
        <p><em>Overwrites the current entries - you can edit any of them afterwards.</em></p>`,
      rejectClose: false
    });
    if (!proceed) return;
    return this.actor.rollDetails();
  }

  static async #onRollSinsPhobias(event, target) {
    const kind = target.dataset.kind;
    const label = kind === "sins" ? "Sins (by Virtue)" : "Phobias (by Will)";
    const proceed = await DialogV2.confirm({
      window: { title: `Step 5: Roll ${label}` },
      content: `<p>Roll ${label} for <strong>${this.actor.name}</strong> - d20 per slot, duplicates rerolled (p.56)?</p>
        <p><em>Overwrites the current list - entries stay editable afterwards.</em></p>`,
      rejectClose: false
    });
    if (!proceed) return;
    return this.actor.rollSinsOrPhobias(kind);
  }

  static async #onCharArrayAdd(event, target) {
    const path = target.dataset.array;
    const arr = foundry.utils.deepClone(foundry.utils.getProperty(this.actor.system, path) ?? []);
    arr.push("");
    return this.actor.update({ [`system.${path}`]: arr });
  }

  static async #onCharArrayDelete(event, target) {
    const path = target.dataset.array;
    const index = Number(target.dataset.index);
    const arr = foundry.utils.deepClone(foundry.utils.getProperty(this.actor.system, path) ?? []);
    arr.splice(index, 1);
    return this.actor.update({ [`system.${path}`]: arr });
  }

  static async #onChooseClass(event, target) {
    const pack = game.packs.get("holy-lands-rpg.classes");
    if (!pack) {
      ui.notifications.error("The Character Classes compendium was not found.");
      return;
    }
    const docs = await pack.getDocuments();
    const stature = this.actor.system.stature;
    const legal = docs.filter(d => {
      const st = d.system.statures ?? [];
      return !st.length || st.includes(stature);
    }).sort((a, b) => a.name.localeCompare(b.name));
    if (!legal.length) {
      ui.notifications.warn("No classes in the compendium are legal for this Stature.");
      return;
    }
    const excluded = docs.length - legal.length;

    const options = legal.map(d => {
      const req = d.system.requirements ? ` - requires ${d.system.requirements}` : "";
      return `<option value="${d.id}">${foundry.utils.escapeHTML(d.name)}${foundry.utils.escapeHTML(req)}</option>`;
    }).join("");
    const chosenId = await DialogV2.wait({
      window: { title: "Choose Class (Step 1)" },
      content: `
        <div class="form-group">
          <label>Classes legal for this Stature (p.53):</label>
          <select name="classId" autofocus>${options}</select>
        </div>
        ${excluded ? `<p class="hint">${excluded} class${excluded > 1 ? "es are" : " is"} hidden by the current Stature.</p>` : ""}`,
      buttons: [
        {
          action: "choose", label: "Assign Class", default: true,
          callback: (event, button) => button.form.elements.classId.value
        },
        { action: "cancel", label: "Cancel" }
      ],
      rejectClose: false
    });
    if (!chosenId || (chosenId === "cancel")) return;

    const doc = docs.find(d => d.id === chosenId);
    if (!doc) return;
    // Already filtered to legal statures - skip the gate.
    return this.#assignClassItem(doc, { skipStatureGate: true });
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
    const itemData = { name: `New ${type.capitalize()}`, type };
    if ((type === "skill") && target.dataset.skillType) {
      itemData.system = { skillType: target.dataset.skillType };
      const labels = { gift: "Gift", talent: "Talent", craft: "Craft" };
      itemData.name = `New ${labels[target.dataset.skillType] ?? "Skill"}`;
    }
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
    const item = this.#getItemForTarget(target);
    if (!item) return;
    const df = await this.#getDifficultyFactor();
    if (df === null) return;
    return this.actor.rollSkill(item.id, df);
  }

  /** Create a blank custom skill item (NPC Notable Skills), then open it. */
  static async #onAddCustomSkill(event, target) {
    const created = await this.actor.createEmbeddedDocuments("Item", [{
      name: "New Skill",
      type: "skill",
      img: "icons/svg/book.svg",
      system: { skillType: "craft", pf: 0 }
    }]);
    return created?.[0]?.sheet?.render(true);
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
    const innateKind = target.closest("[data-innate]")?.dataset.innate;
    if (innateKind) {
      const options = await this.#promptAttackOptions(null);
      if (!options) return;
      const targetActor = await this.#selectTarget();
      if (!targetActor) return;
      return this.actor.rollUnarmedAttack(innateKind, targetActor, options);
    }
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

  /** Prompt for one Saving Throw to receive a +1 Bonus. */
  async #promptSaveChoice(title) {
    const options = Object.entries(this.actor.system.saves)
      .map(([key, save]) => `<option value="${key}">${save.label} (DF ${save.df}, currently +${save.value || 0})</option>`)
      .join("");
    const choice = await DialogV2.wait({
      window: { title },
      content: `
        <div class="form-group">
          <label>Add +1 to which Saving Throw?</label>
          <select name="saveKey" autofocus>${options}</select>
        </div>`,
      buttons: [
        {
          action: "apply", label: "Apply +1", default: true,
          callback: (event, button) => button.form.elements.saveKey.value
        },
        { action: "cancel", label: "Cancel" }
      ],
      rejectClose: false
    });
    return (choice && choice !== "cancel") ? choice : null;
  }

  static async #onChooseSaveBonus(event, target) {
    if (this.actor.system.creation?.saveBonusChosen) return;
    const saveKey = await this.#promptSaveChoice("Step 4: Creation Saving Throw Bonus");
    if (!saveKey) return;
    return this.actor.applySaveBonus(saveKey, { creation: true });
  }

  static async #onUnlockStartingRoll(event, target) {
    const proceed = await DialogV2.confirm({
      window: { title: "Unlock Starting Life & Faith" },
      content: `<p>Rac override: unlock the starting Life &amp; Faith roll for <strong>${this.actor.name}</strong>, allowing a fresh roll? (Current values are kept until re-rolled.)</p>`,
      rejectClose: false
    });
    if (!proceed) return;
    return this.actor.unlockStartingRoll();
  }

  static async #onUnlockSaveBonus(event, target) {
    const proceed = await DialogV2.confirm({
      window: { title: "Unlock Creation Save Bonus" },
      content: `<p>Rac override: unlock the Step 4 Save Bonus choice for <strong>${this.actor.name}</strong>? (Does not remove the +1 already applied - adjust the save manually if needed.)</p>`,
      rejectClose: false
    });
    if (!proceed) return;
    return this.actor.unlockCreationSaveBonus();
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
    await this.actor.levelUp();

    // p.62: each level grants +1 to one Saving Throw - offer the picker now.
    const saveKey = await this.#promptSaveChoice(`Level ${this.actor.system.level}: Saving Throw Bonus`);
    if (saveKey) await this.actor.applySaveBonus(saveKey);
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
    const innateKind = target.closest("[data-innate]")?.dataset.innate;
    if (innateKind) return this.actor.rollUnarmedDamage(innateKind);
    const weapon = this.#getItemForTarget(target);
    const isCritical = event.shiftKey || false;
    return this.actor.rollDamage(weapon, isCritical);
  }

  /** Toggle an item's equipped state (weapons, armor, equipment). */
  static async #onToggleEquip(event, target) {
    const item = this.#getItemForTarget(target);
    if (!item || item.system.equipped === undefined) return;
    return item.update({ "system.equipped": !item.system.equipped });
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
